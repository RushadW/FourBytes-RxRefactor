"""
Semantic Query Cache — avoids redundant Claude calls for repeated questions.
Cache key: SHA256(normalized_question + sorted_plan_ids).
Invalidated when a new document is ingested for an affected plan.
TTL: 7 days (configurable via QUERY_CACHE_TTL_DAYS in config.py).
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from backend.models.orm import QueryCache


def _make_key(question: str, plan_ids: Optional[List[int]]) -> str:
    normalized = question.strip().lower()
    ids_part = ",".join(str(p) for p in sorted(plan_ids)) if plan_ids else "all"
    raw = f"{normalized}|{ids_part}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_cached_answer(
    question: str, plan_ids: Optional[List[int]], db: Session
) -> Optional[Dict[str, Any]]:
    """Returns cached answer dict or None on miss/expiry/invalidation."""
    key = _make_key(question, plan_ids)
    now = datetime.utcnow()
    row = db.query(QueryCache).filter(
        QueryCache.question_hash == key,
        QueryCache.invalidated == False,
    ).first()

    if not row:
        return None
    if row.expires_at and row.expires_at < now:
        return None

    # Increment hit count
    row.hit_count += 1
    db.commit()

    return {
        "answer": row.answer,
        "sources": json.loads(row.sources_json) if row.sources_json else [],
        "structured_hits": json.loads(row.structured_json) if row.structured_json else [],
        "cache_hit": True,
        "rag_score_id": None,
    }


def store_cached_answer(
    question: str,
    plan_ids: Optional[List[int]],
    answer: str,
    sources: List[Dict],
    structured_hits: List[Dict],
    prompt_version_id: Optional[int],
    db: Session,
    ttl_days: int = 7,
):
    key = _make_key(question, plan_ids)
    ids_key = ",".join(str(p) for p in sorted(plan_ids)) if plan_ids else None
    expires_at = datetime.utcnow() + timedelta(days=ttl_days) if ttl_days else None

    # Upsert
    existing = db.query(QueryCache).filter(QueryCache.question_hash == key).first()
    if existing:
        existing.answer = answer
        existing.sources_json = json.dumps(sources)
        existing.structured_json = json.dumps(structured_hits)
        existing.prompt_version_id = prompt_version_id
        existing.expires_at = expires_at
        existing.invalidated = False
        existing.hit_count = 0
    else:
        row = QueryCache(
            question_hash=key,
            question_text=question,
            plan_ids_key=ids_key,
            answer=answer,
            sources_json=json.dumps(sources),
            structured_json=json.dumps(structured_hits),
            prompt_version_id=prompt_version_id,
            expires_at=expires_at,
        )
        db.add(row)
    db.commit()


def invalidate_cache_for_plan(plan_id: int, db: Session):
    """Mark all cache entries that included this plan as invalidated."""
    rows = db.query(QueryCache).filter(
        QueryCache.plan_ids_key.contains(str(plan_id)),
        QueryCache.invalidated == False,
    ).all()
    for row in rows:
        row.invalidated = True
    # Also invalidate "all plans" cache entries
    all_rows = db.query(QueryCache).filter(
        QueryCache.plan_ids_key == None,
        QueryCache.invalidated == False,
    ).all()
    for row in all_rows:
        row.invalidated = True
    db.commit()


def invalidate_all(db: Session):
    db.query(QueryCache).filter(QueryCache.invalidated == False).update(
        {"invalidated": True}
    )
    db.commit()


def cache_stats(db: Session) -> Dict:
    total = db.query(QueryCache).count()
    active = db.query(QueryCache).filter(QueryCache.invalidated == False).count()
    invalidated = total - active
    hit_sum = db.query(QueryCache).with_entities(
        QueryCache.hit_count
    ).all()
    total_hits = sum(r[0] for r in hit_sum)
    return {
        "total_entries": total,
        "active_entries": active,
        "invalidated_entries": invalidated,
        "total_cache_hits": total_hits,
    }
