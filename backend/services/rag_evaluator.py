"""
RAG Quality Evaluator — lightweight scoring of RAG responses without additional LLM calls.
Metrics:
  context_relevance:  token overlap between question and retrieved chunks
  groundedness_score: fraction of answer sentences citing a known plan name
"""
import hashlib
import json
import re
from typing import List, Dict, Optional
from sqlalchemy.orm import Session


def _tokenize(text: str) -> set:
    return set(re.findall(r'\b[a-z]{3,}\b', text.lower()))


def _context_relevance(question: str, chunks: List[Dict]) -> float:
    """Jaccard-style token overlap between question and top retrieved chunks."""
    if not chunks:
        return 0.0
    q_tokens = _tokenize(question)
    if not q_tokens:
        return 0.0
    chunk_text = " ".join(c.get("text", "") for c in chunks[:5])
    c_tokens = _tokenize(chunk_text)
    intersection = q_tokens & c_tokens
    union = q_tokens | c_tokens
    return len(intersection) / len(union) if union else 0.0


def _groundedness(answer: str, structured_rows: List[Dict]) -> float:
    """
    Fraction of answer sentences that mention at least one plan name from the context.
    A rough proxy for faithfulness / citation coverage.
    """
    if not structured_rows or not answer:
        return 0.0

    plan_names = {row.get("plan_name", "").lower() for row in structured_rows if row.get("plan_name")}
    # Also accept payer short names (first word of plan name)
    short_names = {n.split()[0] for n in plan_names if n}
    all_names = plan_names | short_names

    sentences = re.split(r'[.!?\n]', answer)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    if not sentences:
        return 0.0

    grounded = sum(
        1 for s in sentences
        if any(name in s.lower() for name in all_names)
    )
    return grounded / len(sentences)


def score_rag_response(
    question: str,
    answer: str,
    chunks: List[Dict],
    structured_rows: List[Dict],
    prompt_version_id: Optional[int],
    llm_call_log_id: Optional[int],
    db: Session,
) -> int:
    """
    Score a RAG response and write to rag_quality_scores.
    Returns the score row id (returned in AskResponse so analyst can rate it).
    """
    from backend.models.orm import RAGQualityScore

    q_hash = hashlib.sha256(question.strip().lower().encode()).hexdigest()[:32]
    relevance = _context_relevance(question, chunks)
    groundedness = _groundedness(answer, structured_rows)

    row = RAGQualityScore(
        question=question,
        question_hash=q_hash,
        answer_snippet=answer[:500],
        prompt_version_id=prompt_version_id,
        llm_call_log_id=llm_call_log_id,
        context_relevance_score=round(relevance, 4),
        groundedness_score=round(groundedness, 4),
        chunks_retrieved=len(chunks),
        structured_hits=len(structured_rows),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def submit_human_rating(score_id: int, rating: int, comment: Optional[str], db: Session):
    from backend.models.orm import RAGQualityScore
    row = db.query(RAGQualityScore).filter(RAGQualityScore.id == score_id).first()
    if row:
        row.human_rating = max(1, min(5, rating))
        row.human_comment = comment
        db.commit()
