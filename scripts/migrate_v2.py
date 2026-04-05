"""
Migration v2: Domain-specific schema additions + v2.0 extraction prompt.

Adds benefit_side, data_completeness, benefit_side_note columns to
coverage_policies; adds doc_type, drug_hint, benefit_side_hint columns
to policy_documents; creates quantity_limits and step_therapy_by_indication
tables; seeds v2.0 extraction prompts as production.

Run once:  python scripts/migrate_v2.py
Safe to re-run (idempotent checks on all operations).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from backend.db.database import engine, SessionLocal
from backend.models.orm import Base, PromptVersion

# ── Part 1: ALTER TABLE — idempotent per column ───────────────────────────────

ALTER_STATEMENTS = [
    "ALTER TABLE coverage_policies ADD COLUMN benefit_side VARCHAR DEFAULT 'unknown'",
    "ALTER TABLE coverage_policies ADD COLUMN data_completeness VARCHAR DEFAULT 'low'",
    "ALTER TABLE coverage_policies ADD COLUMN benefit_side_note TEXT",
    "ALTER TABLE policy_documents ADD COLUMN doc_type VARCHAR",
    "ALTER TABLE policy_documents ADD COLUMN drug_hint VARCHAR",
    "ALTER TABLE policy_documents ADD COLUMN benefit_side_hint VARCHAR",
]

print("Running ALTER TABLE statements...")
with engine.connect() as conn:
    for stmt in ALTER_STATEMENTS:
        try:
            conn.execute(text(stmt))
            conn.commit()
            col = stmt.split("ADD COLUMN")[1].strip().split()[0]
            print(f"  + added column: {col}")
        except OperationalError as e:
            if "duplicate column name" in str(e).lower():
                col = stmt.split("ADD COLUMN")[1].strip().split()[0]
                print(f"  ~ already exists: {col}")
            else:
                raise

# ── Part 2: Create new tables (safe — create_all skips existing tables) ───────

print("\nCreating new tables if not present...")
Base.metadata.create_all(bind=engine)
print("  + quantity_limits, step_therapy_by_indication (or already existed)")

# ── Part 3: Seed v2.0 extraction prompts ─────────────────────────────────────

V2_EXTRACTION_SYSTEM = (
    "You are a precise medical policy data extraction engine for health insurance "
    "drug coverage documents.\n\n"
    "RULES:\n"
    "1. Extract ONLY what is explicitly stated. Never infer or assume.\n"
    "2. If a field is not present, return null — not a guess.\n"
    "3. For every key field, capture source_page and source_text "
    "(exact quote, max 150 characters).\n"
    "4. Return valid JSON only. No markdown, no explanation."
)

V2_EXTRACTION_USER = (
    "DOCUMENT CONTEXT:\n"
    "Payer: {payer}\n"
    "Drug: {drug}\n"
    "Document Type: {doc_type}\n"
    "Benefit Side: {benefit_side}\n\n"
    "EXTRACT THESE FIELDS:\n"
    "{{\n"
    '  "coverage_status": "covered|not_covered|non_formulary|partial|unknown",\n'
    '  "benefit_side": "medical|pharmacy|both|unknown",\n'
    '  "preferred_status": null,\n'
    '  "tier": null,\n'
    '  "prior_auth_required": null,\n'
    '  "approval_duration": null,\n'
    '  "step_therapy_required": null,\n'
    '  "step_therapy_by_indication": {{\n'
    '    "RA": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "AS": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "CD": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "UC": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "PS": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "PsA": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "HS": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}},\n'
    '    "Uveitis": {{"required": null, "agents": [], "minimum_duration": null, "exceptions": [], "source_page": null, "source_text": null}}\n'
    "  }},\n"
    '  "biosimilar_hierarchy": {{\n'
    '    "preferred": [], "non_preferred": [], "non_formulary": [],\n'
    '    "step_required_before_non_preferred": null, "source_page": null, "source_text": null\n'
    "  }},\n"
    '  "quantity_limits": {{\n'
    '    "retail_28_day": null, "home_delivery_84_day": null,\n'
    '    "weight_based": null, "indication_specific": null,\n'
    '    "source_page": null, "source_text": null\n'
    "  }},\n"
    '  "change_history": [],\n'
    '  "data_completeness": "high|medium|low",\n'
    '  "benefit_side_note": null,\n'
    '  "notes": null\n'
    "}}\n\n"
    "DOCUMENT TEXT:\n"
    "{document_text}"
)

V2_PROMPTS = [
    ("extraction_system", V2_EXTRACTION_SYSTEM, None),
    ("extraction_user", None, V2_EXTRACTION_USER),
]

print("\nSeeding v2.0 extraction prompts...")
db = SessionLocal()
try:
    for prompt_name, system_p, user_p in V2_PROMPTS:
        # Skip if v2.0 already exists
        existing_v2 = db.query(PromptVersion).filter(
            PromptVersion.prompt_name == prompt_name,
            PromptVersion.version_tag == "v2.0",
        ).first()
        if existing_v2:
            print(f"  ~ v2.0 already exists for {prompt_name}, skipping")
            continue

        # Archive current production version
        current_prod = db.query(PromptVersion).filter(
            PromptVersion.prompt_name == prompt_name,
            PromptVersion.status == "production",
        ).first()
        if current_prod:
            current_prod.status = "archived"
            print(f"  ~ archived {prompt_name} {current_prod.version_tag}")

        # Insert v2.0 as production
        pv = PromptVersion(
            prompt_name=prompt_name,
            version_tag="v2.0",
            status="production",
            system_prompt=system_p,
            user_prompt=user_p,
            notes="Medical-policy-specific v2: indication-level step therapy, source evidence, benefit side",
            promoted_at=datetime.utcnow(),
        )
        db.add(pv)
        print(f"  + seeded {prompt_name} v2.0 as production")

    db.commit()
finally:
    db.close()

print("\nMigration v2 complete.")
