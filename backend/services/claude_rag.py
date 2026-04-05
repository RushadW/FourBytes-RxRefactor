import json
from typing import List, Dict, Any, Optional

import anthropic

from backend.config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS_RAG
from backend.services.llm_logger import tracked_call

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_DEFAULT_INTENT_SYSTEM = (
    "You are a medical policy query parser. Extract structured intent from the user's question.\n"
    "Return ONLY valid JSON — no markdown, no explanation."
)

_INTENT_PROMPT = """Extract the intent from this medical drug policy question:

"{question}"

Return JSON:
{{
  "drug_name": "drug name mentioned or null",
  "plan_names": ["plan/payer names mentioned"],
  "query_type": "coverage_check" or "prior_auth" or "step_therapy" or "change_history" or "comparison" or "general"
}}"""

_DEFAULT_RAG_SYSTEM = (
    "You are a medical benefit drug policy expert assistant. Answer questions using ONLY the provided policy context.\n"
    "- Be precise about which health plan each fact comes from.\n"
    "- If a piece of information is not in the provided context, say so clearly.\n"
    "- Format your answer clearly with plan names bolded.\n"
    "- Keep answers concise and factual."
)

_RAG_PROMPT = """Question: {question}

STRUCTURED POLICY DATA (from database):
{structured_context}

RELEVANT POLICY TEXT (top matches):
{vector_context}

Answer the question using only the context above. Cite which plan each fact comes from."""


def _get_rag_prompts():
    try:
        from backend.db.database import SessionLocal
        from backend.services.prompt_registry import get_active_prompt
        db = SessionLocal()
        try:
            sys_p, _, vid = get_active_prompt(db, "rag_system")
            int_sys, _, _ = get_active_prompt(db, "intent_system")
            return (sys_p or _DEFAULT_RAG_SYSTEM,
                    int_sys or _DEFAULT_INTENT_SYSTEM,
                    vid)
        finally:
            db.close()
    except Exception:
        return _DEFAULT_RAG_SYSTEM, _DEFAULT_INTENT_SYSTEM, None


def extract_intent(question: str) -> Dict[str, Any]:
    _, intent_system, _ = _get_rag_prompts()
    try:
        response = tracked_call(
            client,
            call_type="intent",
            model=CLAUDE_MODEL,
            max_tokens=256,
            system=intent_system,
            messages=[{"role": "user", "content": _INTENT_PROMPT.format(question=question)}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(raw)
    except Exception:
        return {"drug_name": None, "plan_names": [], "query_type": "general"}


def route_query(query_type: str, drug_name: Optional[str], structured_rows: List[Dict]) -> str:
    """
    Returns 'tier_1', 'tier_2', or 'tier_3'.
    tier_1: answerable entirely from structured DB — skip vector search and Claude call.
    tier_2: partial structured data — short Claude synthesis call, skip ChromaDB.
    tier_3: full RAG with ChromaDB.
    """
    TIER1_QUERY_TYPES = {"coverage_check", "prior_auth", "step_therapy"}
    if query_type in TIER1_QUERY_TYPES and drug_name and structured_rows:
        return "tier_1"
    if structured_rows:
        return "tier_2"
    return "tier_3"


def format_structured_context(coverage_rows: List[Dict]) -> str:
    if not coverage_rows:
        return "No matching structured policy data found."
    lines = []
    for row in coverage_rows[:10]:
        benefit_side = row.get("benefit_side", "unknown") or "unknown"
        lines.append(
            f"Plan: {row['plan_name']} | Drug: {row['drug_generic_name']} "
            f"({row.get('drug_brand_name', '')})\n"
            f"  Coverage: {row['coverage_status']} | Benefit Side: {benefit_side} | "
            f"Prior Auth: {'Yes' if row['requires_prior_auth'] else 'No'} | "
            f"Step Therapy: {'Yes' if row['requires_step_therapy'] else 'No'}\n"
            + (f"  PA Criteria: {'; '.join(row.get('prior_auth_criteria', [])[:3])}\n"
               if row.get('prior_auth_criteria') else "")
            + (f"  Step Therapy Drugs: {', '.join(row.get('step_therapy_drugs', []))}\n"
               if row.get('step_therapy_drugs') else "")
            + (f"  Quantity Limit: {row['quantity_limit']}\n" if row.get('quantity_limit') else "")
            + (f"  Note: {row['benefit_side_note']}\n" if row.get('benefit_side_note') else "")
        )
    return "\n".join(lines)


def format_vector_context(chunks: List[Dict]) -> str:
    if not chunks:
        return "No relevant policy text found."
    parts = []
    for i, chunk in enumerate(chunks):
        parts.append(
            f"[Source {i+1}: {chunk['plan_name']}, "
            f"Quarter: {chunk.get('quarter', 'N/A')}, "
            f"Page {chunk.get('page_number', '?')}]\n{chunk['text'][:600]}"
        )
    return "\n\n---\n\n".join(parts)


def generate_answer(
    question: str,
    structured_context: str,
    vector_context: str,
    prompt_version_id: Optional[int] = None,
) -> tuple:
    """Returns (answer_text, llm_call_log_id)."""
    rag_system, _, vid = _get_rag_prompts()
    effective_version_id = prompt_version_id or vid

    prompt = _RAG_PROMPT.format(
        question=question,
        structured_context=structured_context,
        vector_context=vector_context,
    )

    # We need the log id — peek at the DB after the call
    from backend.db.database import SessionLocal
    from backend.models.orm import LLMCallLog

    response = tracked_call(
        client,
        call_type="rag_generation",
        prompt_version_id=effective_version_id,
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS_RAG,
        system=rag_system,
        messages=[{"role": "user", "content": prompt}],
    )

    # Retrieve the most recent log entry for this call
    log_id = None
    try:
        db = SessionLocal()
        log = db.query(LLMCallLog).filter(
            LLMCallLog.call_type == "rag_generation"
        ).order_by(LLMCallLog.called_at.desc()).first()
        if log:
            log_id = log.id
        db.close()
    except Exception:
        pass

    return response.content[0].text.strip(), log_id, effective_version_id


def generate_answer_from_structured(
    question: str,
    structured_context: str,
    prompt_version_id: Optional[int] = None,
) -> tuple:
    """Tier 2: synthesize answer from structured DB data only, no vector search."""
    rag_system, _, vid = _get_rag_prompts()
    effective_version_id = prompt_version_id or vid

    prompt = _RAG_PROMPT.format(
        question=question,
        structured_context=structured_context,
        vector_context="(Structured database records only — no raw policy text retrieved)",
    )

    from backend.db.database import SessionLocal
    from backend.models.orm import LLMCallLog

    response = tracked_call(
        client,
        call_type="rag_generation",
        prompt_version_id=effective_version_id,
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS_RAG,
        system=rag_system,
        messages=[{"role": "user", "content": prompt}],
    )

    log_id = None
    cost_usd = 0.0
    try:
        db = SessionLocal()
        log = db.query(LLMCallLog).filter(
            LLMCallLog.call_type == "rag_generation"
        ).order_by(LLMCallLog.called_at.desc()).first()
        if log:
            log_id = log.id
            cost_usd = log.cost_usd or 0.0
        db.close()
    except Exception:
        pass

    cost_str = f"${cost_usd:.4f}" if cost_usd else "$0.00"
    return response.content[0].text.strip(), log_id, effective_version_id, cost_str
