"""FastAPI routes — all API endpoints."""
from __future__ import annotations

import hashlib
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db, PolicyRecord, DocumentRecord, PolicyVersionRecord, NotificationRecord, ScrapeLogRecord
from app.models import (
    PolicyResponse, Drug, ComparisonResponse, PayerColumn,
    AskRequest, AskResponse, SearchResult, ChangeSummary, FieldChange,
    DocumentResponse, PolicyVersion, SourceInfo, ScrapeResult, ScrapeAllResult,
    IngestResult, MatrixResponse, MatrixRow, MatrixDrug, MatrixPayer, MatrixCell,
    NotificationResponse, PolicyBankItem, ScrapeLogResponse,
)
from app.seed import DRUGS, PAYERS
from app.rag import search as rag_search, generate_answer
from app.ingest import diff_policies, summarize_changes, ingest_file
from app.sources import PAYER_SOURCES, list_sources, get_source
from app.scraper import scrape_source, scrape_all_sources, store_fetched_docs

router = APIRouter(prefix="/api")

# ---------- Answer cache (TTL = 10 minutes) ----------
_ask_cache: dict[str, tuple[float, dict]] = {}  # hash -> (timestamp, response_dict)
_ASK_CACHE_TTL = 600  # seconds

def _cache_key(question: str, payer_ids: list[str] | None, drug_ids: list[str] | None) -> str:
    raw = f"{question.strip().lower()}|{sorted(payer_ids or [])}|{sorted(drug_ids or [])}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------- helpers ----------

def _policy_to_response(p: PolicyRecord) -> PolicyResponse:
    return PolicyResponse(
        id=p.id,
        drug_id=p.drug_id,
        drug_name=p.drug_name,
        generic_name=p.generic_name or "",
        drug_category=p.drug_category or "",
        therapeutic_area=p.therapeutic_area or "",
        payer_id=p.payer_id,
        payer_name=p.payer_name,
        policy_title=p.policy_title or "",
        covered=p.covered,
        access_status=p.access_status or "",
        preferred_count=p.preferred_count or 0,
        covered_indications=p.covered_indications or [],
        prior_auth=p.prior_auth,
        prior_auth_details=p.prior_auth_details or "",
        step_therapy=p.step_therapy,
        step_therapy_details=p.step_therapy_details or "",
        site_of_care=p.site_of_care or [],
        dosing_limits=p.dosing_limits or "",
        coverage_criteria=p.coverage_criteria or [],
        hcpcs_code=p.hcpcs_code,
        effective_date=p.effective_date or "",
        last_updated=p.last_updated or "",
        confidence=p.confidence or "",
        version=p.version or 1,
        document_id=p.document_id,
    )


# ---------- Drugs ----------

@router.get("/drugs", response_model=list[Drug])
def list_drugs(db: Session = Depends(get_db)):
    # Merge seed drugs with drugs from ingested policies
    drugs_map = {d["id"]: Drug(**d) for d in DRUGS}
    for p in db.query(PolicyRecord).all():
        if p.drug_id not in drugs_map:
            drugs_map[p.drug_id] = Drug(
                id=p.drug_id,
                name=p.drug_name or p.drug_id.title(),
                generic_name=p.generic_name or p.drug_id,
                therapeutic_area=p.therapeutic_area or "",
                drug_category=p.drug_category or "",
            )
    return list(drugs_map.values())


@router.get("/drugs/{drug_id}", response_model=Drug)
def get_drug(drug_id: str, db: Session = Depends(get_db)):
    for d in DRUGS:
        if d["id"] == drug_id:
            return Drug(**d)
    # Check ingested policies
    p = db.query(PolicyRecord).filter_by(drug_id=drug_id).first()
    if p:
        return Drug(
            id=p.drug_id,
            name=p.drug_name or p.drug_id.title(),
            generic_name=p.generic_name or p.drug_id,
            therapeutic_area=p.therapeutic_area or "",
            drug_category=p.drug_category or "",
        )
    raise HTTPException(404, "Drug not found")


# ---------- Policies ----------

@router.get("/policies", response_model=list[PolicyResponse])
def list_policies(
    drug_id: str | None = None,
    payer_id: str | None = None,
    covered: bool | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(PolicyRecord)
    if drug_id:
        q = q.filter(PolicyRecord.drug_id == drug_id)
    if payer_id:
        q = q.filter(PolicyRecord.payer_id == payer_id)
    if covered is not None:
        q = q.filter(PolicyRecord.covered == covered)
    return [_policy_to_response(p) for p in q.all()]


@router.get("/policies/{policy_id}", response_model=PolicyResponse)
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    p = db.query(PolicyRecord).filter_by(id=policy_id).first()
    if not p:
        raise HTTPException(404, "Policy not found")
    return _policy_to_response(p)


# ---------- Versions + Diff ----------

@router.get("/policies/{policy_id}/versions", response_model=list[PolicyVersion])
def get_versions(policy_id: str, db: Session = Depends(get_db)):
    versions = (
        db.query(PolicyVersionRecord)
        .filter_by(policy_id=policy_id)
        .order_by(PolicyVersionRecord.version)
        .all()
    )
    return [
        PolicyVersion(
            id=v.id,
            policy_id=v.policy_id,
            version=v.version,
            data=v.data or {},
            change_summary=v.change_summary,
            created_at=v.created_at.isoformat() if v.created_at else "",
        )
        for v in versions
    ]


@router.get("/policies/{policy_id}/diff", response_model=ChangeSummary)
def get_diff(
    policy_id: str,
    v1: int = Query(1, description="Old version number"),
    v2: int = Query(2, description="New version number"),
    db: Session = Depends(get_db),
):
    ver1 = db.query(PolicyVersionRecord).filter_by(policy_id=policy_id, version=v1).first()
    ver2 = db.query(PolicyVersionRecord).filter_by(policy_id=policy_id, version=v2).first()
    if not ver1 or not ver2:
        raise HTTPException(404, "Version not found")

    changes = diff_policies(ver1.data or {}, ver2.data or {})
    summary = summarize_changes(changes)

    return ChangeSummary(
        policy_id=policy_id,
        drug_name=ver2.data.get("drug_name", "") if ver2.data else "",
        payer_name=ver2.data.get("payer_name", "") if ver2.data else "",
        from_version=v1,
        to_version=v2,
        changes=[FieldChange(**c) for c in changes],
        summary=summary,
    )


# ---------- Comparison ----------

@router.get("/comparison/{drug_id}", response_model=ComparisonResponse)
def get_comparison(drug_id: str, db: Session = Depends(get_db)):
    # Try seed data first, then look in DB
    drug_data = next((d for d in DRUGS if d["id"] == drug_id), None)
    if not drug_data:
        p = db.query(PolicyRecord).filter_by(drug_id=drug_id).first()
        if not p:
            raise HTTPException(404, "Drug not found")
        drug_data = {
            "id": p.drug_id,
            "name": p.drug_name or p.drug_id.title(),
            "generic_name": p.generic_name or p.drug_id,
            "therapeutic_area": p.therapeutic_area or "",
            "drug_category": p.drug_category or "",
        }

    policies = db.query(PolicyRecord).filter_by(drug_id=drug_id).all()
    policy_map = {p.payer_id: _policy_to_response(p) for p in policies}

    # Build payer columns — include all known payers (seed + any from policies)
    seen_payers = dict(PAYERS)
    for p in policies:
        if p.payer_id not in seen_payers:
            seen_payers[p.payer_id] = p.payer_name

    payer_columns = []
    for pid, pname in seen_payers.items():
        payer_columns.append(PayerColumn(
            payer_id=pid,
            payer_name=pname,
            policy=policy_map.get(pid),
        ))

    return ComparisonResponse(
        drug=Drug(**drug_data),
        payers=payer_columns,
    )


# ---------- Matrix (all drugs × all payers) ----------

@router.get("/matrix", response_model=MatrixResponse)
def get_matrix(db: Session = Depends(get_db)):
    """Return the full drug × payer matrix with all policies."""
    all_policies = db.query(PolicyRecord).all()

    # Skip 'unknown' drug entries (comprehensive docs without drug mapping)
    all_policies = [p for p in all_policies if p.drug_id != "unknown"]

    # Collect unique payers and drugs
    payer_map: dict[str, str] = {}
    drug_map: dict[str, str] = {}
    for p in all_policies:
        payer_map[p.payer_id] = p.payer_name
        drug_map[p.drug_id] = p.drug_name or p.drug_id.title()

    payers = [MatrixPayer(payer_id=pid, payer_name=pname) for pid, pname in sorted(payer_map.items(), key=lambda x: x[1])]
    drugs = [MatrixDrug(drug_id=did, drug_name=dname) for did, dname in sorted(drug_map.items(), key=lambda x: x[1])]

    # Build a lookup: (drug_id, payer_id) -> policy
    policy_lookup: dict[tuple[str, str], PolicyRecord] = {}
    for p in all_policies:
        policy_lookup[(p.drug_id, p.payer_id)] = p

    # Build rows
    rows = []
    for d in drugs:
        cells: dict[str, MatrixCell] = {}
        for pay in payers:
            rec = policy_lookup.get((d.drug_id, pay.payer_id))
            if rec:
                cells[pay.payer_id] = MatrixCell(policy=_policy_to_response(rec), has_data=True)
            else:
                cells[pay.payer_id] = MatrixCell(has_data=False)
        rows.append(MatrixRow(drug=d, cells=cells))

    return MatrixResponse(
        payers=payers,
        drugs=drugs,
        rows=rows,
        total_policies=len(all_policies),
    )


# ---------- Re-index vector store ----------

@router.post("/reindex")
def reindex_vectors(db: Session = Depends(get_db)):
    """Re-index all policies with raw_text into the vector store for RAG."""
    from app.rag import index_policy, get_collection
    col = get_collection()
    before = col.count()

    policies = db.query(PolicyRecord).all()
    indexed = 0
    for p in policies:
        if p.raw_text and len(p.raw_text) > 50:
            index_policy(p.id, p.drug_id, p.payer_id, p.raw_text)
            indexed += 1

    after = col.count()
    return {
        "policies_with_text": indexed,
        "chunks_before": before,
        "chunks_after": after,
    }


# ---------- Search ----------

@router.get("/search", response_model=SearchResult)
def search_policies(
    q: str = Query(..., min_length=1),
    payer_id: str | None = None,
    drug_id: str | None = None,
    db: Session = Depends(get_db),
):
    # Structured search
    query = db.query(PolicyRecord)
    search_lower = q.lower()

    policies = query.all()
    results: list[PolicyResponse] = []
    for p in policies:
        text = f"{p.drug_name} {p.payer_name} {p.policy_title} {p.drug_category} {p.therapeutic_area}".lower()
        if search_lower in text or any(kw in text for kw in search_lower.split()):
            if payer_id and p.payer_id != payer_id:
                continue
            if drug_id and p.drug_id != drug_id:
                continue
            results.append(_policy_to_response(p))

    # RAG search
    payer_ids = [payer_id] if payer_id else None
    drug_ids = [drug_id] if drug_id else None
    chunks = rag_search(q, n_results=3, payer_ids=payer_ids, drug_ids=drug_ids)

    # If structured search found nothing, try matching from RAG metadata
    if not results and chunks:
        policy_ids = {c["metadata"].get("policy_id") for c in chunks if c.get("metadata")}
        for pid in policy_ids:
            p = db.query(PolicyRecord).filter_by(id=pid).first()
            if p:
                results.append(_policy_to_response(p))

    return SearchResult(
        query=q,
        results=results,
        relevant_chunks=chunks,
    )


# ---------- Ask (RAG Q&A) ----------

@router.post("/ask", response_model=AskResponse)
def ask_question(req: AskRequest, db: Session = Depends(get_db)):
    # Check cache first
    key = _cache_key(req.question, req.payer_ids, req.drug_ids)
    now = time.time()
    if key in _ask_cache:
        ts, cached = _ask_cache[key]
        if now - ts < _ASK_CACHE_TTL:
            return AskResponse(**cached)
        else:
            del _ask_cache[key]

    # Server-side query parsing — extract drug/payer hints if client didn't send them
    drug_ids = req.drug_ids or []
    payer_ids = req.payer_ids or []
    if not drug_ids or not payer_ids:
        q_lower = req.question.lower()
        _DRUG_MAP = {
            "rituximab": "rituximab", "rituxan": "rituximab", "riabni": "rituximab",
            "humira": "adalimumab", "adalimumab": "adalimumab",
            "bevacizumab": "bevacizumab", "avastin": "bevacizumab",
            "botox": "botulinum", "botulinum": "botulinum",
            "denosumab": "denosumab", "prolia": "denosumab", "xgeva": "denosumab",
            "infliximab": "infliximab", "remicade": "infliximab",
            "trastuzumab": "trastuzumab", "herceptin": "trastuzumab",
            "pembrolizumab": "pembrolizumab", "keytruda": "pembrolizumab",
            "nivolumab": "nivolumab", "opdivo": "nivolumab",
            "ocrelizumab": "ocrelizumab", "ocrevus": "ocrelizumab",
            "natalizumab": "natalizumab", "tysabri": "natalizumab",
            "ustekinumab": "ustekinumab", "stelara": "ustekinumab",
            "vedolizumab": "vedolizumab", "entyvio": "vedolizumab",
            "dupilumab": "dupilumab", "dupixent": "dupilumab",
            "secukinumab": "secukinumab", "cosentyx": "secukinumab",
        }
        _PAYER_MAP = {
            "cigna": "cigna",
            "uhc": "uhc", "united": "uhc", "unitedhealthcare": "uhc",
            "bcbs": "bcbs_nc", "blue cross": "bcbs_nc", "blue shield": "bcbs_nc",
            "upmc": "upmc", "priority health": "priority_health",
            "emblem": "emblemhealth", "emblemhealth": "emblemhealth",
            "florida blue": "florida_blue",
        }
        if not drug_ids:
            drug_ids = list({v for k, v in _DRUG_MAP.items() if k in q_lower})
        if not payer_ids:
            payer_ids = list({v for k, v in _PAYER_MAP.items() if k in q_lower})

    # More chunks for multi-payer/drug comparison queries
    n_chunks = 3
    if len(drug_ids) > 1 or len(payer_ids) > 1 or not payer_ids:
        n_chunks = 5

    chunks = rag_search(
        req.question,
        n_results=n_chunks,
        payer_ids=payer_ids or None,
        drug_ids=drug_ids or None,
    )

    # Filter out low-relevance chunks (prevents returning unrelated drug info)
    MIN_RELEVANCE = 0.25
    chunks = [c for c in chunks if c.get("score", 0) >= MIN_RELEVANCE]

    # Gather relevant structured policies + document URLs
    policy_ids = {c["metadata"].get("policy_id") for c in chunks if c.get("metadata")}

    # Also pull in DB policies for the detected drugs so the answer covers all payers
    if drug_ids:
        q_db = db.query(PolicyRecord).filter(PolicyRecord.drug_id.in_(drug_ids))
        if payer_ids:
            q_db = q_db.filter(PolicyRecord.payer_id.in_(payer_ids))
        for p in q_db.all():
            policy_ids.add(p.id)

    policies_data: list[dict] = []
    policy_responses: list[PolicyResponse] = []
    doc_urls: dict[str, str] = {}  # policy_id -> source_url
    for pid in policy_ids:
        p = db.query(PolicyRecord).filter_by(id=pid).first()
        if p:
            policy_responses.append(_policy_to_response(p))
            policies_data.append({
                "drug_name": p.drug_name,
                "payer_name": p.payer_name,
                "payer_id": p.payer_id,
                "covered": p.covered,
                "access_status": p.access_status,
                "prior_auth": p.prior_auth,
                "prior_auth_details": p.prior_auth_details,
                "step_therapy": p.step_therapy,
                "step_therapy_details": p.step_therapy_details,
                "covered_indications": p.covered_indications or [],
                "site_of_care": p.site_of_care or [],
                "dosing_limits": p.dosing_limits,
            })
            # Look up source URL from document
            if p.document_id:
                doc = db.query(DocumentRecord).filter_by(id=p.document_id).first()
                if doc and doc.source_url:
                    doc_urls[p.id] = doc.source_url

    answer = generate_answer(req.question, chunks, policies_data)

    # Enrich sources with document URLs
    enriched_sources = []
    for c in chunks:
        meta = c.get("metadata", {})
        source = {"text": c["text"][:300], "score": c.get("score", 0), **meta}
        pid = meta.get("policy_id", "")
        if pid in doc_urls:
            source["source_url"] = doc_urls[pid]
        enriched_sources.append(source)

    result = AskResponse(
        question=req.question,
        answer=answer,
        sources=enriched_sources,
        relevant_policies=policy_responses,
    )

    # Store in cache
    _ask_cache[key] = (time.time(), result.model_dump())

    return result


# ---------- Documents ----------

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document_meta(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentRecord).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentResponse(
        id=doc.id,
        payer_id=doc.payer_id,
        drug_id=doc.drug_id,
        source_url=doc.source_url or "",
        file_path=doc.file_path or "",
        content_type=doc.content_type or "",
        fetched_at=doc.fetched_at.isoformat() if doc.fetched_at else "",
        version=doc.version or 1,
    )


@router.get("/documents/{doc_id}/view")
def view_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentRecord).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(404, "Document file not found on disk")

    media_type = "application/pdf" if doc.content_type == "pdf" else "text/html"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


# ---------- Health ----------

@router.get("/health")
def health():
    return {"status": "ok", "service": "Anton Rx API"}


# ---------- Sources ----------

@router.get("/sources", response_model=list[SourceInfo])
def get_all_sources():
    """List all configured payer sources."""
    return [
        SourceInfo(
            payer_id=s.payer_id,
            payer_name=s.payer_name,
            strategy=s.strategy,
            index_url=s.index_url or s.search_url,
            document_type=s.document_type,
            target_drugs=s.target_drugs,
            notes=s.notes,
        )
        for s in list_sources()
    ]


# ---------- Scraper ----------

@router.post("/scrape/{payer_id}", response_model=ScrapeResult)
def scrape_payer(payer_id: str, ingest: bool = Query(False, description="Auto-ingest scraped docs"), db: Session = Depends(get_db)):
    """Scrape a specific payer's source for policy documents."""
    source = get_source(payer_id)
    if not source:
        raise HTTPException(404, f"Payer source '{payer_id}' not found")
    if source.strategy == "manual_upload":
        raise HTTPException(400, f"Payer '{payer_id}' requires manual upload — cannot scrape automatically")

    try:
        docs = scrape_source(source)
        paths = store_fetched_docs(docs) if docs else []

        ingested = 0
        if ingest and docs:
            for doc in docs:
                try:
                    result = ingest_file(
                        db=db,
                        payer_id=doc.payer_id,
                        payer_name=doc.payer_name,
                        drug_id=doc.drug_hint or "unknown",
                        drug_name=doc.drug_hint.title() if doc.drug_hint else "Unknown Drug",
                        content=doc.content,
                        content_type=doc.content_type,
                        source_url=doc.source_url,
                    )
                    if result.get("status") == "ingested":
                        ingested += 1
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Ingest failed for {doc.filename}: {e}")

        return ScrapeResult(
            payer_id=payer_id,
            payer_name=source.payer_name,
            documents_fetched=len(docs),
            documents_stored=len(paths),
            file_paths=paths,
        )
    except Exception as e:
        return ScrapeResult(
            payer_id=payer_id,
            payer_name=source.payer_name,
            documents_fetched=0,
            documents_stored=0,
            errors=[str(e)],
        )


@router.post("/scrape", response_model=ScrapeAllResult)
def scrape_all():
    """Scrape all configured payer sources that support automated fetching."""
    all_docs = scrape_all_sources()
    results: list[ScrapeResult] = []
    total_fetched = 0
    total_stored = 0

    for payer_id, docs in all_docs.items():
        paths = store_fetched_docs(docs) if docs else []
        total_fetched += len(docs)
        total_stored += len(paths)
        source = get_source(payer_id)
        results.append(ScrapeResult(
            payer_id=payer_id,
            payer_name=source.payer_name if source else payer_id,
            documents_fetched=len(docs),
            documents_stored=len(paths),
            file_paths=paths,
        ))

    return ScrapeAllResult(
        total_fetched=total_fetched,
        total_stored=total_stored,
        per_payer=results,
    )


# ---------- Upload (manual ingest) ----------

@router.post("/upload", response_model=IngestResult)
async def upload_document(
    file: UploadFile = File(...),
    payer_id: str = Form(...),
    drug_id: str = Form(""),
    drug_name: str = Form(""),
    payer_name: str = Form(""),
    db: Session = Depends(get_db),
):
    """Upload a policy document manually (for payers that can't be scraped)."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    # Determine content type
    ct = "pdf" if (file.filename or "").lower().endswith(".pdf") else "html"

    # Use payer_name from PAYER_SOURCES if available
    if not payer_name:
        source = get_source(payer_id)
        payer_name = source.payer_name if source else payer_id

    result = ingest_file(
        db=db,
        payer_id=payer_id,
        payer_name=payer_name,
        drug_id=drug_id or "unknown",
        drug_name=drug_name or "Unknown Drug",
        content=content,
        content_type=ct,
        source_url=f"manual_upload:{file.filename}",
    )

    return IngestResult(
        status=result.get("status", "error"),
        documents_stored=1 if result.get("status") == "ingested" else 0,
        message=result.get("reason", f"Document {result.get('status', 'processed')}"),
    )


# ---------- Policy Bank ----------

@router.get("/policy-bank", response_model=list[PolicyBankItem])
def get_policy_bank(db: Session = Depends(get_db)):
    """Return all policies with document metadata for the Policy Bank page."""
    policies = db.query(PolicyRecord).order_by(PolicyRecord.payer_name, PolicyRecord.drug_name).all()
    items: list[PolicyBankItem] = []
    for p in policies:
        source_url = ""
        file_path = ""
        if p.document_id:
            doc = db.query(DocumentRecord).filter_by(id=p.document_id).first()
            if doc:
                source_url = doc.source_url or ""
                file_path = doc.file_path or ""
        items.append(PolicyBankItem(
            id=p.id,
            drug_id=p.drug_id,
            drug_name=p.drug_name or "",
            generic_name=p.generic_name or "",
            drug_category=p.drug_category or "",
            payer_id=p.payer_id,
            payer_name=p.payer_name or "",
            policy_title=p.policy_title or "",
            covered=p.covered,
            access_status=p.access_status or "",
            effective_date=p.effective_date or "",
            last_updated=p.last_updated or "",
            version=p.version or 1,
            document_id=p.document_id,
            source_url=source_url,
            file_path=file_path,
        ))
    return items


# ---------- Notifications ----------

@router.get("/notifications", response_model=list[NotificationResponse])
def get_notifications(unread_only: bool = Query(False), db: Session = Depends(get_db)):
    """Return notifications, optionally filtered to unread only."""
    q = db.query(NotificationRecord).order_by(NotificationRecord.created_at.desc())
    if unread_only:
        q = q.filter(NotificationRecord.read == False)
    return [
        NotificationResponse(
            id=n.id,
            type=n.type or "policy_update",
            title=n.title or "",
            message=n.message or "",
            policy_id=n.policy_id,
            payer_id=n.payer_id,
            drug_id=n.drug_id,
            read=n.read or False,
            created_at=n.created_at.isoformat() if n.created_at else "",
        )
        for n in q.limit(50).all()
    ]


@router.post("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    n = db.query(NotificationRecord).filter_by(id=notif_id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.read = True
    db.commit()
    return {"status": "ok"}


@router.post("/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """Mark all notifications as read."""
    db.query(NotificationRecord).filter(NotificationRecord.read == False).update({"read": True})
    db.commit()
    return {"status": "ok"}


# ---------- Scrape Logs ----------

@router.get("/scrape-logs", response_model=list[ScrapeLogResponse])
def get_scrape_logs(db: Session = Depends(get_db)):
    """Return recent scrape logs."""
    logs = db.query(ScrapeLogRecord).order_by(ScrapeLogRecord.run_at.desc()).limit(20).all()
    return [
        ScrapeLogResponse(
            id=log.id,
            run_at=log.run_at.isoformat() if log.run_at else "",
            trigger=log.trigger or "manual",
            payers_scraped=log.payers_scraped or 0,
            documents_fetched=log.documents_fetched or 0,
            policies_updated=log.policies_updated or 0,
            policies_added=log.policies_added or 0,
            errors=log.errors or [],
            summary=log.summary or "",
        )
        for log in logs
    ]


# ---------- Manual Scrape Trigger ----------

@router.post("/scrape-now")
def trigger_scrape_now(db: Session = Depends(get_db)):
    """Trigger an immediate scrape cycle (same as cron but manual)."""
    from app.scheduler import run_scrape_now
    result = run_scrape_now(trigger="manual")
    return result
