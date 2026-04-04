"""
Prompt Registry — load active production prompts from DB instead of hardcoded strings.
Falls back to defaults if no production prompt exists yet.
"""
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from backend.models.orm import PromptVersion

# Default prompts (used as seeds and fallback)
DEFAULTS = {
    "extraction_system": {
        "system": (
            "You are a medical benefit drug policy analyst. Your job is to extract structured "
            "drug coverage information from health plan policy documents.\n\n"
            "You MUST return ONLY valid JSON — no markdown fences, no explanation, no text before or after the JSON object.\n\n"
            "Extract every drug mentioned in the document with its coverage details."
        ),
        "user": None,
    },
    "extraction_user": {
        "system": None,
        "user": (
            'Extract all drugs and their coverage details from the following medical benefit '
            'drug policy document.\n\nReturn a JSON object with this exact structure:\n'
            '{{\n  "plan_name": "...",\n  "payer": "...",\n  "policy_name": "...",\n'
            '  "effective_date": "YYYY-MM-DD or null",\n  "drugs": [\n    {{\n'
            '      "brand_name": "Brand name or null",\n'
            '      "generic_name": "Generic/INN name (required)",\n'
            '      "drug_class": "Drug class or null",\n'
            '      "indication": "Indication or null",\n'
            '      "coverage_status": "covered" or "not_covered" or "covered_with_restrictions",\n'
            '      "tier": "Tier or null",\n'
            '      "quantity_limit": "Limit string or null",\n'
            '      "requires_prior_auth": true or false,\n'
            '      "requires_step_therapy": true or false,\n'
            '      "age_restriction": "Age restriction or null",\n'
            '      "diagnosis_restriction": "Diagnosis or null",\n'
            '      "site_of_care": "Site requirement or null",\n'
            '      "prior_auth_criteria": ["criterion 1", "criterion 2"],\n'
            '      "step_therapy": [{{"step_order": 1, "required_drug": "...", '
            '"minimum_duration": null, "failure_criteria": null}}],\n'
            '      "notes": "Notes or null"\n    }}\n  ]\n}}\n\n'
            'POLICY DOCUMENT:\n{document_text}\n\n'
            'Return ONLY the JSON object. No markdown, no explanation.'
        ),
    },
    "rag_system": {
        "system": (
            "You are a medical benefit drug policy expert assistant. Answer questions using "
            "ONLY the provided policy context.\n"
            "- Be precise about which health plan each fact comes from.\n"
            "- If a piece of information is not in the provided context, say so clearly.\n"
            "- Format your answer clearly with plan names bolded.\n"
            "- Keep answers concise and factual."
        ),
        "user": None,
    },
    "intent_system": {
        "system": (
            "You are a medical policy query parser. Extract structured intent from the user's question.\n"
            "Return ONLY valid JSON — no markdown, no explanation."
        ),
        "user": None,
    },
}


def get_active_prompt(db: Session, prompt_name: str) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """
    Returns (system_prompt, user_prompt, version_id) for the active production prompt.
    Falls back to defaults if none is in production.
    """
    row = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_name == prompt_name, PromptVersion.status == "production")
        .order_by(PromptVersion.promoted_at.desc())
        .first()
    )
    if row:
        return row.system_prompt, row.user_prompt, row.id

    defaults = DEFAULTS.get(prompt_name, {})
    return defaults.get("system"), defaults.get("user"), None


def seed_default_prompts(db: Session):
    """Seed v1.0 production prompts from defaults if no production prompt exists yet."""
    from datetime import datetime
    for prompt_name, content in DEFAULTS.items():
        existing = db.query(PromptVersion).filter(
            PromptVersion.prompt_name == prompt_name,
            PromptVersion.status == "production",
        ).first()
        if existing:
            continue
        pv = PromptVersion(
            prompt_name=prompt_name,
            version_tag="v1.0",
            status="production",
            system_prompt=content.get("system"),
            user_prompt=content.get("user"),
            notes="Initial seeded prompt",
            promoted_at=datetime.utcnow(),
        )
        db.add(pv)
    db.commit()
