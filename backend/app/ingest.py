"""Ingestion pipeline: normalizer, change differ, and orchestrator."""
from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.database import PolicyRecord, DocumentRecord, PolicyVersionRecord
from app.storage import get_storage
from app.parsers import parse_pdf, parse_pdf_bytes, parse_html, extract_fields
from app.rag import index_policy


# ============================================================
# Normalizer — map payer-specific terms to standard schema
# ============================================================

TERM_MAP: dict[str, str] = {
    "precertification": "prior_auth",
    "prior approval": "prior_auth",
    "prior authorization": "prior_auth",
    "authorization": "prior_auth",
    "pre-certification": "prior_auth",
    "step edit": "step_therapy",
    "step therapy": "step_therapy",
    "fail-first": "step_therapy",
    "fail first": "step_therapy",
    "must try": "step_therapy",
    "provider-administered": "medical_benefit_drug",
    "medical benefit drug": "medical_benefit_drug",
    "physician-administered": "medical_benefit_drug",
    "site of care": "site_of_care",
    "place of service": "site_of_care",
    "site of service": "site_of_care",
    "quantity limit": "dosing_limits",
    "dose limit": "dosing_limits",
    "dosing limit": "dosing_limits",
}


def normalize_term(text: str) -> str:
    lower = text.lower().strip()
    return TERM_MAP.get(lower, lower)


def normalize_policy_text(raw: str) -> str:
    """Replace payer-specific synonyms with standard terms in raw text."""
    result = raw
    for original, standard in TERM_MAP.items():
        pattern = re.compile(re.escape(original), re.IGNORECASE)
        result = pattern.sub(standard, result)
    return result


# ============================================================
# Differ — compare two policy versions
# ============================================================

COMPARABLE_FIELDS = [
    "covered", "access_status", "preferred_count",
    "covered_indications", "prior_auth", "prior_auth_details",
    "step_therapy", "step_therapy_details", "site_of_care",
    "dosing_limits", "coverage_criteria", "effective_date", "confidence",
]


def diff_policies(old: dict, new: dict) -> list[dict]:
    """Return list of {field, old_value, new_value, change_type}."""
    changes: list[dict] = []
    for f in COMPARABLE_FIELDS:
        ov = old.get(f)
        nv = new.get(f)
        if ov == nv:
            continue
        if ov is None:
            ct = "added"
        elif nv is None:
            ct = "removed"
        else:
            ct = "modified"
        changes.append({
            "field": f,
            "old_value": str(ov) if ov is not None else None,
            "new_value": str(nv) if nv is not None else None,
            "change_type": ct,
        })
    return changes


def summarize_changes(changes: list[dict]) -> str:
    """Produce a human-readable change summary."""
    if not changes:
        return "No meaningful changes detected."
    parts: list[str] = []
    for c in changes:
        f = c["field"].replace("_", " ").title()
        if c["change_type"] == "added":
            parts.append(f"{f}: added — {c['new_value']}")
        elif c["change_type"] == "removed":
            parts.append(f"{f}: removed (was {c['old_value']})")
        else:
            parts.append(f"{f}: changed from \"{c['old_value']}\" to \"{c['new_value']}\"")
    return "; ".join(parts)


# ============================================================
# Pipeline — orchestrate ingest for a single document
# ============================================================

def ingest_file(
    db: Session,
    payer_id: str,
    payer_name: str,
    drug_id: str,
    drug_name: str,
    content: bytes,
    content_type: str = "pdf",
    source_url: str = "",
    extra_fields: dict | None = None,
) -> dict:
    """Ingest a single document: parse, normalize, store, version."""
    storage = get_storage()
    file_hash = hashlib.sha256(content).hexdigest()

    # Check if document already exists with same hash (skip re-processing)
    existing_doc = db.query(DocumentRecord).filter_by(
        payer_id=payer_id, drug_id=drug_id, file_hash=file_hash
    ).first()
    if existing_doc:
        return {"status": "skipped", "reason": "document unchanged", "document_id": existing_doc.id}

    # Store raw document
    ext = "pdf" if content_type == "pdf" else "html"
    filename = f"{drug_id}_{payer_id}_{file_hash[:8]}.{ext}"
    file_path = storage.save(payer_id, drug_id, filename, content)

    # Parse
    if content_type == "pdf":
        parsed = parse_pdf_bytes(content)
    else:
        parsed = parse_html(content.decode("utf-8", errors="replace"))

    extracted = extract_fields(parsed)

    # Create document record
    doc_id = str(uuid.uuid4())
    doc = DocumentRecord(
        id=doc_id,
        payer_id=payer_id,
        drug_id=drug_id,
        source_url=source_url,
        file_path=file_path,
        file_hash=file_hash,
        content_type=content_type,
        fetched_at=datetime.utcnow(),
        version=1,
    )
    db.add(doc)

    # Build policy data (merge extracted fields with any provided overrides)
    policy_data = {
        "drug_id": drug_id,
        "drug_name": drug_name,
        "payer_id": payer_id,
        "payer_name": payer_name,
        "policy_title": parsed.title,
        "covered": True,
        "prior_auth": extracted.get("prior_auth", False),
        "step_therapy": extracted.get("step_therapy", False),
        "site_of_care": extracted.get("site_of_care", []),
        "raw_text": parsed.full_text,
        "document_id": doc_id,
    }
    if extra_fields:
        policy_data.update(extra_fields)

    # Check for existing policy to version it
    existing = db.query(PolicyRecord).filter_by(drug_id=drug_id, payer_id=payer_id).first()
    if existing:
        old_data = _policy_to_dict(existing)
        changes = diff_policies(old_data, policy_data)
        new_version = existing.version + 1

        # Save old version
        ver = PolicyVersionRecord(
            id=str(uuid.uuid4()),
            policy_id=existing.id,
            version=existing.version,
            data=old_data,
            change_summary=summarize_changes(changes),
            created_at=datetime.utcnow(),
        )
        db.add(ver)

        # Update existing record
        for k, v in policy_data.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
        existing.version = new_version
        existing.document_id = doc_id
        doc.version = new_version

        # Index into vector store for RAG
        if parsed.full_text:
            index_policy(existing.id, drug_id, payer_id, parsed.full_text)
    else:
        policy_id = str(uuid.uuid4())
        record = PolicyRecord(
            id=policy_id,
            version=1,
            created_at=datetime.utcnow(),
            **{k: v for k, v in policy_data.items() if hasattr(PolicyRecord, k)},
        )
        db.add(record)

        # Index into vector store for RAG
        if parsed.full_text:
            index_policy(policy_id, drug_id, payer_id, parsed.full_text)

    db.commit()
    return {"status": "ingested", "document_id": doc_id}


def _policy_to_dict(p: PolicyRecord) -> dict:
    return {
        "drug_id": p.drug_id,
        "drug_name": p.drug_name,
        "generic_name": p.generic_name,
        "drug_category": p.drug_category,
        "therapeutic_area": p.therapeutic_area,
        "payer_id": p.payer_id,
        "payer_name": p.payer_name,
        "policy_title": p.policy_title,
        "covered": p.covered,
        "access_status": p.access_status,
        "preferred_count": p.preferred_count,
        "covered_indications": p.covered_indications or [],
        "prior_auth": p.prior_auth,
        "prior_auth_details": p.prior_auth_details,
        "step_therapy": p.step_therapy,
        "step_therapy_details": p.step_therapy_details,
        "site_of_care": p.site_of_care or [],
        "dosing_limits": p.dosing_limits,
        "coverage_criteria": p.coverage_criteria or [],
        "effective_date": p.effective_date,
        "last_updated": p.last_updated,
        "confidence": p.confidence,
        "version": p.version,
    }
