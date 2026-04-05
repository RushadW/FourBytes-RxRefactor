from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import crud
from backend.services import embeddings, claude_rag
from backend.services import query_cache_service, rag_evaluator
from backend.models.schemas import (
    AskRequest, AskResponse, SourceChunk, CoveragePolicySummary
)

router = APIRouter(prefix="/query", tags=["query"])


def _build_tier1_answer(rows: List[dict], question: str) -> str:
    """Build human-readable prose from structured DB rows without any Claude call."""
    lines = []
    for row in rows:
        plan = row["plan_name"]
        drug = row["drug_generic_name"]
        brand = f" ({row['drug_brand_name']})" if row.get("drug_brand_name") else ""
        status = row.get("coverage_status", "unknown")
        benefit = row.get("benefit_side", "unknown")
        dc = row.get("data_completeness", "low")
        note = row.get("benefit_side_note", "")

        block = [f"**{plan}** — {drug}{brand}"]
        block.append(f"- Coverage status: **{status}**")
        block.append(f"- Benefit side: **{benefit}**")
        if row.get("requires_prior_auth"):
            block.append("- Prior authorization: **required**")
            pa = row.get("prior_auth_criteria", [])
            if pa:
                block.append(f"  Criteria: {'; '.join(pa[:5])}")
        else:
            block.append("- Prior authorization: not required")
        if row.get("requires_step_therapy"):
            block.append("- Step therapy: **required**")
            st = row.get("step_therapy_drugs", [])
            if st:
                block.append(f"  Must try first: {', '.join(st)}")
        else:
            block.append("- Step therapy: not required")
        if row.get("tier"):
            block.append(f"- Tier: {row['tier']}")
        if row.get("quantity_limit"):
            block.append(f"- Quantity limit: {row['quantity_limit']}")
        if note:
            block.append(f"- Note: {note}")
        block.append(f"- Data completeness: {dc}")
        lines.append("\n".join(block))

    header = f"Structured policy data for your query:\n\n"
    return header + "\n\n---\n\n".join(lines)


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest, db: Session = Depends(get_db)):
    # MLOps: Check semantic cache first
    cached = query_cache_service.get_cached_answer(req.question, req.plan_ids, db)
    if cached:
        return AskResponse(
            answer=cached["answer"],
            sources=[SourceChunk(**s) for s in cached["sources"]],
            structured_hits=[CoveragePolicySummary(**h) for h in cached["structured_hits"]],
            cache_hit=True,
            rag_score_id=None,
            routing_tier="tier_1_structured",
            source_cost="$0.00",
        )

    # Step 1: Extract intent
    intent = claude_rag.extract_intent(req.question)
    drug_name = req.drug_name or intent.get("drug_name")
    query_type = intent.get("query_type", "general")

    # Step 2: SQL pre-filter
    drug_ids = []
    if drug_name:
        drugs = crud.search_drug(db, drug_name)
        drug_ids = [d.id for d in drugs]

    plan_ids = req.plan_ids or []
    structured_rows = []
    if drug_ids:
        structured_rows = crud.get_coverage_for_drug(
            db, drug_ids=drug_ids, plan_ids=plan_ids if plan_ids else None
        )

    # Step 3: Determine routing tier
    routing_tier_key = claude_rag.route_query(query_type, drug_name, structured_rows)

    sources: List[SourceChunk] = []
    answer = ""
    llm_log_id = None
    prompt_version_id = None
    source_cost = "$0.00"
    routing_tier = "tier_3_rag"

    structured_ctx = claude_rag.format_structured_context(structured_rows)

    if routing_tier_key == "tier_1":
        # Answer entirely from structured DB — no vector search, no Claude call
        answer = _build_tier1_answer(structured_rows, req.question)
        routing_tier = "tier_1_structured"
        source_cost = "$0.00"

    elif routing_tier_key == "tier_2":
        # Synthesize from structured data — skip ChromaDB
        answer, llm_log_id, prompt_version_id, source_cost = claude_rag.generate_answer_from_structured(
            req.question, structured_ctx
        )
        routing_tier = "tier_2_synthesis"

    else:
        # Full RAG: vector search + generation
        chunks = embeddings.similarity_search(
            query=req.question, n_results=5,
            plan_ids=plan_ids if plan_ids else None,
        )
        vector_ctx = claude_rag.format_vector_context(chunks)
        answer, llm_log_id, prompt_version_id = claude_rag.generate_answer(
            req.question, structured_ctx, vector_ctx
        )
        routing_tier = "tier_3_rag"

        # Compute cost from log
        try:
            from backend.models.orm import LLMCallLog
            log = db.query(LLMCallLog).filter(LLMCallLog.id == llm_log_id).first()
            if log and log.cost_usd:
                source_cost = f"${log.cost_usd:.4f}"
        except Exception:
            pass

        for chunk in chunks:
            doc_chunks = crud.get_chunks_by_chroma_ids(db, [chunk["chroma_id"]])
            doc_name = doc_chunks[0].document.filename if doc_chunks else chunk["chroma_id"]
            sources.append(SourceChunk(
                chunk_text=chunk["text"][:300] + "..." if len(chunk["text"]) > 300 else chunk["text"],
                document_name=doc_name,
                plan_name=chunk["plan_name"],
                page_number=chunk.get("page_number"),
            ))

    structured_hits = [CoveragePolicySummary(**r) for r in structured_rows[:5]]

    # MLOps: Score RAG response (only for tier 2/3 where a Claude call was made)
    rag_score_id = None
    if routing_tier_key != "tier_1":
        try:
            rag_score_id = rag_evaluator.score_rag_response(
                question=req.question,
                answer=answer,
                chunks=[],
                structured_rows=structured_rows,
                prompt_version_id=prompt_version_id,
                llm_call_log_id=llm_log_id,
                db=db,
            )
        except Exception as e:
            print(f"[rag_eval] Scoring failed (non-fatal): {e}")

    # MLOps: Store in cache
    try:
        sources_dicts = [s.model_dump() for s in sources]
        hits_dicts = [h.model_dump() for h in structured_hits]
        query_cache_service.store_cached_answer(
            question=req.question, plan_ids=req.plan_ids,
            answer=answer, sources=sources_dicts,
            structured_hits=hits_dicts,
            prompt_version_id=prompt_version_id, db=db,
        )
    except Exception as e:
        print(f"[cache] Store failed (non-fatal): {e}")

    return AskResponse(
        answer=answer,
        sources=sources,
        structured_hits=structured_hits,
        cache_hit=False,
        rag_score_id=rag_score_id,
        routing_tier=routing_tier,
        source_cost=source_cost,
    )


@router.get("/coverage", response_model=List[CoveragePolicySummary])
def get_coverage(
    drug_name: str = Query(...),
    plan_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    drugs = crud.search_drug(db, drug_name)
    if not drugs:
        return []
    pid_list = [int(p) for p in plan_ids.split(",")] if plan_ids else None
    rows = crud.get_coverage_for_drug(db, [d.id for d in drugs], plan_ids=pid_list)
    return [CoveragePolicySummary(**r) for r in rows]


@router.get("/prior_auth")
def get_prior_auth(
    drug_name: str = Query(...),
    plan_id: int = Query(...),
    db: Session = Depends(get_db),
):
    drugs = crud.search_drug(db, drug_name)
    if not drugs:
        return {"error": "Drug not found"}
    rows = crud.get_coverage_for_drug(db, [d.id for d in drugs], plan_ids=[plan_id])
    if not rows:
        return {"error": "No coverage policy found for this drug and plan"}
    row = rows[0]
    return {
        "plan_name": row["plan_name"],
        "drug_generic_name": row["drug_generic_name"],
        "drug_brand_name": row["drug_brand_name"],
        "coverage_status": row["coverage_status"],
        "requires_prior_auth": row["requires_prior_auth"],
        "prior_auth_criteria": row["prior_auth_criteria"],
        "requires_step_therapy": row["requires_step_therapy"],
        "step_therapy_drugs": row["step_therapy_drugs"],
        "quantity_limit": row["quantity_limit"],
    }


@router.get("/all_coverage")
def all_coverage(
    plan_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    pid_list = [int(p) for p in plan_ids.split(",")] if plan_ids else None
    return crud.get_all_coverage(db, plan_ids=pid_list)
