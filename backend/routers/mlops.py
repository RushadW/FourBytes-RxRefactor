"""
MLOps Router — all endpoints for prompt management, observability, quality, drift,
corrections, cache stats, re-extraction, and A/B testing.
"""
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.db.database import get_db
from backend.models.orm import (
    PromptVersion, LLMCallLog, ExtractionQualityScore, RAGQualityScore,
    DriftEvent, AnalystCorrection, CoveragePolicy, PolicyDocument,
    ReextractionJob,
)
from backend.services import query_cache_service, rag_evaluator

router = APIRouter(prefix="/mlops", tags=["mlops"])


# ─── ① Prompt Registry ───────────────────────────────────────────────────────

@router.get("/prompts")
def list_prompts(
    prompt_name: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(PromptVersion)
    if prompt_name:
        q = q.filter(PromptVersion.prompt_name == prompt_name)
    if status:
        q = q.filter(PromptVersion.status == status)
    rows = q.order_by(PromptVersion.created_at.desc()).all()
    return [
        {
            "id": r.id, "prompt_name": r.prompt_name, "version_tag": r.version_tag,
            "status": r.status, "notes": r.notes, "created_at": r.created_at,
            "promoted_at": r.promoted_at,
        }
        for r in rows
    ]


@router.get("/prompts/active/{prompt_name}")
def get_active_prompt(prompt_name: str, db: Session = Depends(get_db)):
    row = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_name == prompt_name,
                PromptVersion.status == "production")
        .order_by(PromptVersion.promoted_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No production prompt found for this name")
    return {"id": row.id, "version_tag": row.version_tag,
            "system_prompt": row.system_prompt, "user_prompt": row.user_prompt}


@router.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    row = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"id": row.id, "prompt_name": row.prompt_name, "version_tag": row.version_tag,
            "status": row.status, "system_prompt": row.system_prompt,
            "user_prompt": row.user_prompt, "notes": row.notes}


@router.post("/prompts")
def create_prompt(
    prompt_name: str = Body(...),
    version_tag: str = Body(...),
    system_prompt: Optional[str] = Body(default=None),
    user_prompt: Optional[str] = Body(default=None),
    notes: Optional[str] = Body(default=None),
    created_by: Optional[str] = Body(default=None),
    db: Session = Depends(get_db),
):
    existing = db.query(PromptVersion).filter(
        PromptVersion.prompt_name == prompt_name,
        PromptVersion.version_tag == version_tag,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Version tag already exists for this prompt name")
    pv = PromptVersion(
        prompt_name=prompt_name, version_tag=version_tag, status="draft",
        system_prompt=system_prompt, user_prompt=user_prompt,
        notes=notes, created_by=created_by,
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)
    return {"id": pv.id, "status": pv.status, "message": "Draft prompt created"}


@router.put("/prompts/{prompt_id}/promote")
def promote_prompt(prompt_id: int, db: Session = Depends(get_db)):
    pv = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not pv:
        raise HTTPException(status_code=404, detail="Prompt not found")

    transitions = {"draft": "staging", "staging": "production"}
    if pv.status not in transitions:
        raise HTTPException(status_code=400, detail=f"Cannot promote from status '{pv.status}'")

    new_status = transitions[pv.status]

    if new_status == "production":
        # Archive the current production version
        db.query(PromptVersion).filter(
            PromptVersion.prompt_name == pv.prompt_name,
            PromptVersion.status == "production",
        ).update({"status": "archived"})

        pv.promoted_at = datetime.utcnow()

        # Auto-queue re-extraction for all completed documents
        docs = db.query(PolicyDocument).filter(
            PolicyDocument.status.in_(["complete", "low_quality"])
        ).all()
        queued = 0
        for doc in docs:
            job = ReextractionJob(
                document_id=doc.id,
                trigger_reason="prompt_promotion",
                triggered_by_version=prompt_id,
                status="queued",
            )
            db.add(job)
            queued += 1

        pv.status = new_status
        db.commit()
        return {"id": pv.id, "new_status": new_status,
                "re_extraction_jobs_queued": queued,
                "message": f"Promoted to production. {queued} re-extraction jobs queued."}

    pv.status = new_status
    db.commit()
    return {"id": pv.id, "new_status": new_status}


@router.put("/prompts/{prompt_id}/archive")
def archive_prompt(prompt_id: int, db: Session = Depends(get_db)):
    pv = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not pv:
        raise HTTPException(status_code=404, detail="Prompt not found")
    pv.status = "archived"
    db.commit()
    return {"id": pv.id, "status": "archived"}


# ─── ② LLM Observability ─────────────────────────────────────────────────────

@router.get("/observability/summary")
def observability_summary(db: Session = Depends(get_db)):
    rows = db.query(LLMCallLog).all()
    if not rows:
        return {"total_calls": 0, "total_cost_usd": 0.0, "total_input_tokens": 0,
                "total_output_tokens": 0, "by_call_type": {}}

    by_type = {}
    for r in rows:
        t = r.call_type
        if t not in by_type:
            by_type[t] = {"calls": 0, "cost_usd": 0.0, "input_tokens": 0,
                          "output_tokens": 0, "avg_latency_ms": 0, "_lat_sum": 0}
        by_type[t]["calls"] += 1
        by_type[t]["cost_usd"] += r.cost_usd or 0
        by_type[t]["input_tokens"] += r.input_tokens or 0
        by_type[t]["output_tokens"] += r.output_tokens or 0
        by_type[t]["_lat_sum"] += r.latency_ms or 0

    for t in by_type:
        n = by_type[t]["calls"]
        by_type[t]["avg_latency_ms"] = int(by_type[t]["_lat_sum"] / n) if n else 0
        by_type[t]["cost_usd"] = round(by_type[t]["cost_usd"], 6)
        del by_type[t]["_lat_sum"]

    return {
        "total_calls": len(rows),
        "total_cost_usd": round(sum(r.cost_usd or 0 for r in rows), 6),
        "total_input_tokens": sum(r.input_tokens or 0 for r in rows),
        "total_output_tokens": sum(r.output_tokens or 0 for r in rows),
        "by_call_type": by_type,
    }


@router.get("/observability/calls")
def list_llm_calls(
    call_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(LLMCallLog)
    if call_type:
        q = q.filter(LLMCallLog.call_type == call_type)
    rows = q.order_by(LLMCallLog.called_at.desc()).limit(limit).all()
    return [
        {"id": r.id, "call_type": r.call_type, "model": r.model,
         "input_tokens": r.input_tokens, "output_tokens": r.output_tokens,
         "latency_ms": r.latency_ms, "cost_usd": r.cost_usd,
         "stop_reason": r.stop_reason, "error": r.error,
         "document_id": r.document_id, "called_at": r.called_at}
        for r in rows
    ]


# ─── ③ Extraction Quality ─────────────────────────────────────────────────────

@router.get("/quality/extraction")
def list_extraction_scores(
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
):
    rows = db.query(ExtractionQualityScore).order_by(
        ExtractionQualityScore.scored_at.desc()
    ).limit(limit).all()
    return [
        {"id": r.id, "document_id": r.document_id,
         "drugs_extracted": r.drugs_extracted,
         "schema_completeness_avg": r.schema_completeness_avg,
         "required_fields_pass": r.required_fields_pass,
         "enum_validity_rate": r.enum_validity_rate,
         "anomaly_count": r.anomaly_count,
         "anomaly_details": json.loads(r.anomaly_details) if r.anomaly_details else [],
         "scored_at": r.scored_at}
        for r in rows
    ]


@router.get("/quality/low_quality_docs")
def low_quality_docs(threshold: float = Query(default=0.5), db: Session = Depends(get_db)):
    rows = db.query(ExtractionQualityScore).filter(
        ExtractionQualityScore.schema_completeness_avg < threshold
    ).order_by(ExtractionQualityScore.scored_at.desc()).all()
    return [{"document_id": r.document_id, "completeness": r.schema_completeness_avg,
             "anomaly_count": r.anomaly_count} for r in rows]


# ─── ④ RAG Quality ────────────────────────────────────────────────────────────

@router.get("/quality/rag")
def list_rag_scores(limit: int = Query(default=50), db: Session = Depends(get_db)):
    rows = db.query(RAGQualityScore).order_by(
        RAGQualityScore.scored_at.desc()
    ).limit(limit).all()
    return [
        {"id": r.id, "question": r.question[:100],
         "context_relevance_score": r.context_relevance_score,
         "groundedness_score": r.groundedness_score,
         "chunks_retrieved": r.chunks_retrieved,
         "human_rating": r.human_rating, "scored_at": r.scored_at}
        for r in rows
    ]


@router.get("/quality/rag/summary")
def rag_quality_summary(db: Session = Depends(get_db)):
    rows = db.query(RAGQualityScore).all()
    if not rows:
        return {"total_queries": 0}
    rated = [r for r in rows if r.human_rating]
    return {
        "total_queries": len(rows),
        "avg_context_relevance": round(
            sum(r.context_relevance_score or 0 for r in rows) / len(rows), 4),
        "avg_groundedness": round(
            sum(r.groundedness_score or 0 for r in rows) / len(rows), 4),
        "human_rated_count": len(rated),
        "avg_human_rating": round(
            sum(r.human_rating for r in rated) / len(rated), 2) if rated else None,
    }


@router.post("/quality/rag/{score_id}/feedback")
def submit_rag_feedback(
    score_id: int,
    rating: int = Body(..., ge=1, le=5),
    comment: Optional[str] = Body(default=None),
    db: Session = Depends(get_db),
):
    rag_evaluator.submit_human_rating(score_id, rating, comment, db)
    return {"message": "Feedback recorded"}


# ─── ⑤ Drift Events ──────────────────────────────────────────────────────────

@router.get("/drift/events")
def list_drift_events(
    plan_id: Optional[int] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    acknowledged: Optional[bool] = Query(default=None),
    limit: int = Query(default=50),
    db: Session = Depends(get_db),
):
    q = db.query(DriftEvent)
    if plan_id:
        q = q.filter(DriftEvent.plan_id == plan_id)
    if severity:
        q = q.filter(DriftEvent.severity == severity)
    if acknowledged is not None:
        q = q.filter(DriftEvent.acknowledged == acknowledged)
    rows = q.order_by(DriftEvent.detected_at.desc()).limit(limit).all()
    return [
        {"id": r.id, "drift_type": r.drift_type, "plan_id": r.plan_id,
         "description": r.description, "severity": r.severity,
         "acknowledged": r.acknowledged, "detected_at": r.detected_at}
        for r in rows
    ]


@router.put("/drift/events/{event_id}/acknowledge")
def acknowledge_drift(event_id: int, db: Session = Depends(get_db)):
    event = db.query(DriftEvent).filter(DriftEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.acknowledged = True
    db.commit()
    return {"message": "Acknowledged"}


# ─── ⑥ Human Corrections ─────────────────────────────────────────────────────

@router.post("/corrections")
def create_correction(
    coverage_policy_id: int = Body(...),
    field_name: str = Body(...),
    corrected_value: str = Body(...),
    correction_reason: Optional[str] = Body(default=None),
    analyst_id: Optional[str] = Body(default=None),
    db: Session = Depends(get_db),
):
    policy = db.query(CoveragePolicy).filter(
        CoveragePolicy.id == coverage_policy_id
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Coverage policy not found")

    original = str(getattr(policy, field_name, None) or "")
    correction = AnalystCorrection(
        coverage_policy_id=coverage_policy_id,
        field_name=field_name,
        original_value=original,
        corrected_value=corrected_value,
        correction_reason=correction_reason,
        analyst_id=analyst_id,
    )
    db.add(correction)
    policy.has_analyst_correction = True
    db.commit()
    db.refresh(correction)
    return {"id": correction.id, "message": "Correction submitted"}


@router.get("/corrections")
def list_corrections(
    applied: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(AnalystCorrection)
    if applied is not None:
        q = q.filter(AnalystCorrection.applied == applied)
    rows = q.order_by(AnalystCorrection.created_at.desc()).all()
    return [
        {"id": r.id, "coverage_policy_id": r.coverage_policy_id,
         "field_name": r.field_name, "original_value": r.original_value,
         "corrected_value": r.corrected_value, "applied": r.applied,
         "created_at": r.created_at}
        for r in rows
    ]


@router.post("/corrections/{correction_id}/apply")
def apply_correction(correction_id: int, db: Session = Depends(get_db)):
    corr = db.query(AnalystCorrection).filter(
        AnalystCorrection.id == correction_id
    ).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Correction not found")
    if corr.applied:
        return {"message": "Already applied"}

    policy = db.query(CoveragePolicy).filter(
        CoveragePolicy.id == corr.coverage_policy_id
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Coverage policy no longer exists")

    # Apply the corrected value (only for known Boolean and String fields)
    bool_fields = {"requires_prior_auth", "requires_step_therapy", "has_analyst_correction"}
    if corr.field_name in bool_fields:
        setattr(policy, corr.field_name, corr.corrected_value.lower() in ("true", "1", "yes"))
    else:
        setattr(policy, corr.field_name, corr.corrected_value)

    corr.applied = True
    db.commit()
    return {"message": f"Correction applied to {corr.field_name}"}


# ─── ⑦ Cache Stats ────────────────────────────────────────────────────────────

@router.get("/cache/stats")
def cache_stats(db: Session = Depends(get_db)):
    return query_cache_service.cache_stats(db)


@router.post("/cache/invalidate")
def invalidate_cache(
    plan_id: Optional[int] = Body(default=None),
    all_entries: bool = Body(default=False),
    db: Session = Depends(get_db),
):
    if all_entries:
        query_cache_service.invalidate_all(db)
        return {"message": "All cache entries invalidated"}
    if plan_id:
        query_cache_service.invalidate_cache_for_plan(plan_id, db)
        return {"message": f"Cache invalidated for plan {plan_id}"}
    raise HTTPException(status_code=400, detail="Provide plan_id or set all_entries=true")


# ─── ⑧ Re-extraction Jobs ────────────────────────────────────────────────────

@router.post("/reextract/queue")
def queue_reextraction(
    document_ids: List[int] = Body(...),
    reason: str = Body(default="manual"),
    db: Session = Depends(get_db),
):
    queued = 0
    for doc_id in document_ids:
        job = ReextractionJob(
            document_id=doc_id, trigger_reason=reason, status="queued"
        )
        db.add(job)
        queued += 1
    db.commit()
    return {"queued": queued}


@router.post("/reextract/run_next")
def run_next_job(db: Session = Depends(get_db)):
    job = db.query(ReextractionJob).filter(
        ReextractionJob.status == "queued"
    ).order_by(ReextractionJob.created_at).first()

    if not job:
        return {"message": "No queued jobs"}

    job.status = "running"
    job.started_at = datetime.utcnow()
    db.commit()

    from backend.services.ingestion_pipeline import process_document
    # Reset document status so pipeline runs it again
    doc = db.query(PolicyDocument).filter(
        PolicyDocument.id == job.document_id
    ).first()
    if doc:
        doc.status = "pending"
        db.commit()

    result = process_document(db, job.document_id)

    job.status = "complete" if result.get("status") in ("complete", "low_quality") else "failed"
    job.completed_at = datetime.utcnow()
    job.error_message = result.get("error")
    db.commit()

    return {"job_id": job.id, "result": result}


@router.get("/reextract/jobs")
def list_jobs(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50),
    db: Session = Depends(get_db),
):
    q = db.query(ReextractionJob)
    if status:
        q = q.filter(ReextractionJob.status == status)
    rows = q.order_by(ReextractionJob.created_at.desc()).limit(limit).all()
    return [
        {"id": r.id, "document_id": r.document_id, "trigger_reason": r.trigger_reason,
         "status": r.status, "created_at": r.created_at, "completed_at": r.completed_at,
         "error_message": r.error_message}
        for r in rows
    ]
