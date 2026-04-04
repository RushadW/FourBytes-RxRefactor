import hashlib
from datetime import datetime
from sqlalchemy.orm import Session

from backend.config import PROCESSED_DIR
from backend.db import crud
from backend.services import pdf_parser, claude_extractor, embeddings
from backend.services import extraction_evaluator, drift_detector, query_cache_service


def compute_file_hash(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def process_document(db: Session, document_id: int) -> dict:
    """Full 5-step ingestion pipeline with MLOps hooks."""
    doc = crud.get_document(db, document_id)
    if not doc:
        return {"error": "Document not found", "status": "failed"}

    crud.update_document_status(db, document_id, "processing")

    try:
        # Step 1: Parse PDF / text
        pages = pdf_parser.extract_text(doc.file_path)
        full_text = pdf_parser.get_full_text(pages)
        chunks = pdf_parser.chunk_pages(pages)

        if not full_text.strip():
            raise ValueError("No text could be extracted from the document.")

        # Step 2: Extract structured data with Claude (loads active prompt from DB)
        batches = pdf_parser.batch_text_for_extraction(full_text)
        extraction = claude_extractor.extract_from_batches(
            batches, document_id=document_id
        )
        prompt_version_id = extraction.get("_prompt_version_id")

        # MLOps Hook A: Score extraction quality
        quality = extraction_evaluator.score_extraction(
            extraction, document_id, prompt_version_id, db
        )
        final_status = "complete" if quality["pass"] else "low_quality"

        # Step 3: Embed + store chunks in ChromaDB
        plan = crud.get_plan(db, doc.plan_id)
        embeddings.delete_chunks_for_document(document_id)
        crud.delete_chunks_for_document(db, document_id)

        chroma_ids = embeddings.add_chunks(
            chunks=chunks,
            document_id=document_id,
            plan_id=doc.plan_id,
            plan_name=plan.name if plan else "Unknown",
            quarter=doc.quarter,
        )

        for chunk, chroma_id in zip(chunks, chroma_ids):
            crud.save_chunk(
                db, document_id=document_id,
                chunk_index=chunk["chunk_index"],
                chunk_text=chunk["text"],
                chroma_id=chroma_id,
                page_number=chunk.get("page_num"),
            )

        # Step 4: Write structured data to SQLite
        drugs_extracted = 0
        policies_created = 0
        changes_detected = 0
        new_drug_classes = set()
        pa_count = 0
        covered_count = 0

        for drug_data in extraction.get("drugs", []):
            generic_name = (drug_data.get("generic_name") or "").strip()
            if not generic_name:
                continue

            drug = crud.get_or_create_drug(
                db,
                generic_name=generic_name,
                brand_name=drug_data.get("brand_name"),
                drug_class=drug_data.get("drug_class"),
            )
            drugs_extracted += 1

            if drug_data.get("drug_class"):
                new_drug_classes.add(drug_data["drug_class"])
            if drug_data.get("requires_prior_auth"):
                pa_count += 1
            if drug_data.get("coverage_status") == "covered":
                covered_count += 1

            coverage_fields = {
                "coverage_status": drug_data.get("coverage_status", "covered_with_restrictions"),
                "tier": drug_data.get("tier"),
                "quantity_limit": drug_data.get("quantity_limit"),
                "requires_prior_auth": bool(drug_data.get("requires_prior_auth", False)),
                "requires_step_therapy": bool(drug_data.get("requires_step_therapy", False)),
                "age_restriction": drug_data.get("age_restriction"),
                "diagnosis_restriction": drug_data.get("diagnosis_restriction"),
                "site_of_care": drug_data.get("site_of_care"),
                "notes": drug_data.get("notes"),
                "extraction_prompt_version_id": prompt_version_id,
            }

            # Step 5: Change detection
            prev_policy = crud.get_previous_policy(db, doc.plan_id, drug.id, document_id)
            if prev_policy:
                for field in ["coverage_status", "requires_prior_auth",
                              "requires_step_therapy", "tier"]:
                    old_val = str(getattr(prev_policy, field) or "")
                    new_val = str(coverage_fields.get(field) or "")
                    if old_val != new_val:
                        crud.add_change_log(
                            db, plan_id=doc.plan_id, drug_id=drug.id,
                            change_type=f"{field}_change",
                            old_value=old_val, new_value=new_val,
                            previous_document_id=prev_policy.document_id,
                            new_document_id=document_id,
                        )
                        changes_detected += 1

            policy, is_new = crud.upsert_coverage_policy(
                db, plan_id=doc.plan_id, drug_id=drug.id,
                document_id=document_id, coverage_data=coverage_fields,
            )
            if is_new:
                policies_created += 1

            crud.add_prior_auth_criteria(db, policy.id, drug_data.get("prior_auth_criteria", []))
            crud.add_step_therapy(db, policy.id, drug_data.get("step_therapy", []))

        # MLOps Hook B: Drift detection
        new_pa_rate = pa_count / drugs_extracted if drugs_extracted else 0
        new_covered_rate = covered_count / drugs_extracted if drugs_extracted else 0
        try:
            drift_detector.detect_drift(
                db=db,
                plan_id=doc.plan_id,
                document_id=document_id,
                new_drug_classes=new_drug_classes,
                new_pa_rate=new_pa_rate,
                new_covered_rate=new_covered_rate,
                new_drug_count=drugs_extracted,
            )
        except Exception as e:
            print(f"[drift] Detection failed (non-fatal): {e}")

        # MLOps Hook C: Invalidate query cache for this plan
        try:
            query_cache_service.invalidate_cache_for_plan(doc.plan_id, db)
        except Exception as e:
            print(f"[cache] Invalidation failed (non-fatal): {e}")

        crud.update_document_status(db, document_id, final_status)

        return {
            "document_id": document_id,
            "status": final_status,
            "drugs_extracted": drugs_extracted,
            "policies_created": policies_created,
            "changes_detected": changes_detected,
            "extraction_quality": quality,
        }

    except Exception as e:
        crud.update_document_status(db, document_id, "failed", str(e))
        return {
            "document_id": document_id,
            "status": "failed",
            "error": str(e),
            "drugs_extracted": 0,
            "policies_created": 0,
            "changes_detected": 0,
        }
