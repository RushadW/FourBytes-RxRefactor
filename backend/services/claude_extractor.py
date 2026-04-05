import json
from collections import defaultdict
from typing import List, Dict, Any, Optional

import anthropic

from backend.config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS_EXTRACTION
from backend.services.llm_logger import tracked_call

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Fallback prompt (used when no production prompt is in DB yet)
_DEFAULT_SYSTEM = (
    "You are a medical benefit drug policy analyst. Your job is to extract structured "
    "drug coverage information from health plan policy documents.\n\n"
    "You MUST return ONLY valid JSON — no markdown fences, no explanation, no text before or after the JSON object.\n\n"
    "Extract every drug mentioned in the document with its coverage details."
)

_DEFAULT_USER_TEMPLATE = (
    'Extract all drugs and their coverage details from the following medical benefit '
    'drug policy document.\n\nReturn a JSON object with this exact structure:\n'
    '{{\n  "plan_name": "Name of the health plan or payer",\n'
    '  "payer": "Insurance company name",\n'
    '  "policy_name": "Name of this specific policy document",\n'
    '  "effective_date": "YYYY-MM-DD or null",\n'
    '  "drugs": [\n    {{\n'
    '      "brand_name": "Brand name or null",\n'
    '      "generic_name": "Generic/INN name (required)",\n'
    '      "drug_class": "Drug class or category or null",\n'
    '      "indication": "Approved indication for this policy or null",\n'
    '      "coverage_status": "covered" or "not_covered" or "covered_with_restrictions",\n'
    '      "tier": "Tier classification or null",\n'
    '      "quantity_limit": "Any quantity or frequency limit as a string, or null",\n'
    '      "requires_prior_auth": true or false,\n'
    '      "requires_step_therapy": true or false,\n'
    '      "age_restriction": "Age restriction string or null",\n'
    '      "diagnosis_restriction": "Required diagnosis string or null",\n'
    '      "site_of_care": "Site of care requirement or null",\n'
    '      "prior_auth_criteria": ["criterion 1", "criterion 2"],\n'
    '      "step_therapy": [\n'
    '        {{"step_order": 1, "required_drug": "Drug name that must be tried first",\n'
    '          "minimum_duration": "Duration string or null",\n'
    '          "failure_criteria": "What constitutes failure or null"}}\n'
    '      ],\n'
    '      "notes": "Any other relevant notes or null"\n'
    '    }}\n  ]\n}}\n\n'
    'POLICY DOCUMENT:\n{document_text}\n\n'
    'Return ONLY the JSON object. No markdown, no explanation.'
)


def _get_prompts(prompt_override: Dict = None) -> tuple:
    """Returns (system_prompt, user_template, version_id)."""
    if prompt_override:
        return (
            prompt_override.get("system", _DEFAULT_SYSTEM),
            prompt_override.get("user", _DEFAULT_USER_TEMPLATE),
            prompt_override.get("version_id"),
        )
    # Try to load from DB
    try:
        from backend.db.database import SessionLocal
        from backend.services.prompt_registry import get_active_prompt
        db = SessionLocal()
        try:
            sys_p, user_p, vid = get_active_prompt(db, "extraction_system")
            _, user_tmpl, _ = get_active_prompt(db, "extraction_user")
            system = sys_p or _DEFAULT_SYSTEM
            user = user_tmpl or _DEFAULT_USER_TEMPLATE
            return system, user, vid
        finally:
            db.close()
    except Exception:
        return _DEFAULT_SYSTEM, _DEFAULT_USER_TEMPLATE, None


def _parse_json(raw: str) -> Dict:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(raw)


def get_relevant_text(full_text: str, drug: str, doc_type: str) -> str:
    """For formulary books, extract only lines near the drug name to avoid token bloat."""
    if doc_type == "formulary_book" and drug:
        lines = full_text.split('\n')
        drug_lower = drug.lower()
        relevant = []
        for i, line in enumerate(lines):
            if drug_lower in line.lower():
                start = max(0, i - 2)
                end = min(len(lines), i + 5)
                relevant.extend(lines[start:end])
        return '\n'.join(relevant) if relevant else full_text[:3000]
    return full_text


def extract_drugs_from_text(
    document_text: str,
    document_id: Optional[int] = None,
    prompt_version_id: Optional[int] = None,
    system_prompt: str = None,
    user_template: str = None,
    payer: str = "",
    drug: str = "",
    doc_type: str = "",
    benefit_side: str = "unknown",
) -> Dict[str, Any]:
    sys_p = system_prompt or _DEFAULT_SYSTEM
    user_t = user_template or _DEFAULT_USER_TEMPLATE
    ctx = defaultdict(str, {
        "document_text": document_text,
        "payer": payer,
        "drug": drug,
        "doc_type": doc_type,
        "benefit_side": benefit_side,
    })
    prompt = user_t.format_map(ctx)

    response = tracked_call(
        client,
        call_type="extraction",
        document_id=document_id,
        prompt_version_id=prompt_version_id,
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS_EXTRACTION,
        system=sys_p,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text

    try:
        return _parse_json(raw)
    except json.JSONDecodeError:
        # Retry
        fix_response = tracked_call(
            client,
            call_type="extraction_retry",
            document_id=document_id,
            prompt_version_id=prompt_version_id,
            model=CLAUDE_MODEL,
            max_tokens=MAX_TOKENS_EXTRACTION,
            messages=[
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": raw},
                {"role": "user", "content": "The response above is not valid JSON. Return ONLY the corrected JSON object with no other text."},
            ],
        )
        return _parse_json(fix_response.content[0].text)


def extract_from_batches(
    batches: List[str],
    document_id: Optional[int] = None,
    prompt_override: Dict = None,
    payer: str = "",
    drug: str = "",
    doc_type: str = "",
    benefit_side: str = "unknown",
) -> Dict[str, Any]:
    """Run extraction on multiple text batches and merge results."""
    system_prompt, user_template, version_id = _get_prompts(prompt_override)

    all_drugs: List[Dict] = []
    plan_meta: Dict = {}

    for i, batch in enumerate(batches):
        try:
            result = extract_drugs_from_text(
                batch,
                document_id=document_id,
                prompt_version_id=version_id,
                system_prompt=system_prompt,
                user_template=user_template,
                payer=payer,
                drug=drug,
                doc_type=doc_type,
                benefit_side=benefit_side,
            )
        except Exception as e:
            print(f"[extractor] Batch {i} failed: {e}")
            continue

        if not plan_meta:
            plan_meta = {
                "plan_name": result.get("plan_name", "Unknown Plan"),
                "payer": result.get("payer", "Unknown Payer"),
                "policy_name": result.get("policy_name", ""),
                "effective_date": result.get("effective_date"),
            }

        all_drugs.extend(result.get("drugs", []))

    # Deduplicate by generic_name
    seen: Dict[str, Dict] = {}
    for d in all_drugs:
        key = (d.get("generic_name") or "").lower().strip()
        if key:
            seen[key] = d

    return {**plan_meta, "drugs": list(seen.values()), "_prompt_version_id": version_id}
