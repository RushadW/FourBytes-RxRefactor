"""Seed the database and vector store with sample policy data."""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import (
    PolicyRecord, DocumentRecord, PolicyVersionRecord, SourceRecord, init_db, SessionLocal,
)
from app.rag import index_policy, get_collection
from app.storage import get_storage


# ============================================================
# Payer + Drug reference data
# ============================================================

PAYERS = {
    "cigna":  "Cigna",
    "uhc":    "UnitedHealthcare",
    "bcbs":   "Blue Cross Blue Shield",
}

DRUGS = [
    {"id": "rituximab",    "name": "Rituximab",    "generic_name": "rituximab",    "therapeutic_area": "Oncology / Autoimmune", "drug_category": "Anti-CD20 Monoclonal Antibody"},
    {"id": "humira",       "name": "Humira",       "generic_name": "adalimumab",   "therapeutic_area": "Autoimmune / Rheumatology", "drug_category": "TNF Inhibitor"},
    {"id": "bevacizumab",  "name": "Bevacizumab",  "generic_name": "bevacizumab",  "therapeutic_area": "Oncology", "drug_category": "Anti-VEGF Monoclonal Antibody"},
]


# ============================================================
# Raw policy text (simulates real payer documents)
# ============================================================

RAW_TEXTS = {
    "rituximab_cigna": """CIGNA MEDICAL COVERAGE POLICY
Policy: Rituximab (Rituxan, Riabni, Ruxience, Truxima)
Policy Number: MCP-0145
Effective Date: January 1, 2024
Last Reviewed: April 2, 2024

DESCRIPTION
Rituximab is a chimeric anti-CD20 monoclonal antibody indicated for the treatment of Non-Hodgkin's Lymphoma (NHL), Chronic Lymphocytic Leukemia (CLL), Rheumatoid Arthritis (RA), and Granulomatosis with Polyangiitis (GPA).

DRUG CATEGORY AND ACCESS STATUS
Rituximab is classified as a Specialty drug within the Anti-CD20 Monoclonal Antibody category. There are 2 drugs with preferred status in this category.

COVERAGE CRITERIA
Rituximab is considered medically necessary when ALL of the following criteria are met:
1. The patient has a documented diagnosis of an FDA-approved indication
2. The patient has failed or is intolerant to first-line therapy
3. Clinical documentation includes disease severity assessment

PRIOR AUTHORIZATION
Prior authorization is REQUIRED for all indications. Clinical documentation must include diagnosis, prior therapies tried, and laboratory results.

STEP THERAPY
For autoimmune indications: Patient must have tried methotrexate or another conventional DMARD for a minimum of 12 weeks prior to approval. Step therapy does not apply to oncology indications.

SITE OF CARE
Administration is restricted to:
- Hospital Outpatient Department
- Accredited Infusion Center
Home infusion is NOT covered for rituximab under this policy.

DOSING AND QUANTITY LIMITS
Standard dosing: 375 mg/m2 intravenous infusion. Maximum: 8 cycles per 12-month period. Dose modifications require updated authorization.""",

    "rituximab_uhc": """UNITEDHEALTHCARE MEDICAL BENEFIT DRUG POLICY
Drug: Rituximab (Rituxan and biosimilars)
Policy Number: UHC-MBD-2024-0089
Effective Date: January 15, 2024
Last Updated: April 1, 2024

DESCRIPTION
Rituximab is an anti-CD20 monoclonal antibody used in oncology and autoimmune conditions. UnitedHealthcare covers rituximab under the medical benefit for provider-administered infusions.

ACCESS STATUS
Rituximab holds Preferred status in the Anti-CD20 Monoclonal Antibody category. It is the sole preferred product (1 of 1).

COVERED INDICATIONS
Non-Hodgkin Lymphoma (NHL), Chronic Lymphocytic Leukemia (CLL), Rheumatoid Arthritis, GPA, MPA, Pemphigus Vulgaris. Coverage extends to NCCN-supported off-label indications with documentation.

PRIOR AUTHORIZATION
Prior authorization is required. Submissions accepted online via CoverMyMeds or by fax. Turnaround time is typically 2-3 business days; urgent requests within 24 hours.

STEP THERAPY
No step therapy requirement for oncology indications. Autoimmune indications also do not require fail-first of alternative agents.

SITE OF CARE
Approved administration sites include:
- Hospital Outpatient Department
- Accredited Infusion Center
- Home Infusion (approved for maintenance dosing)
Home infusion requires prior home health assessment.

DOSING AND QUANTITY LIMITS
375 mg/m2 IV per standard protocol. No annual cycle limit for oncology indications. Autoimmune indications follow rheumatology protocols.""",

    "rituximab_bcbs": """BLUE CROSS BLUE SHIELD MEDICAL POLICY
Subject: Rituximab (Rituxan) and Biosimilars
Policy Number: BCBS-MP-2024-0312
Effective: February 1, 2024
Last Reviewed: March 28, 2024

BACKGROUND
Rituximab is a chimeric monoclonal antibody targeting the CD20 antigen on B-lymphocytes. It is used in hematologic malignancies and select autoimmune disorders.

ACCESS STATUS
Non-preferred in the Anti-CD20 category. 3 products hold preferred status. Rituximab reference biologic may be subject to biosimilar step requirements.

COVERED INDICATIONS
Non-Hodgkin Lymphoma (NHL), Chronic Lymphocytic Leukemia (CLL), Rheumatoid Arthritis. Additional indications require medical director review.

PRIOR AUTHORIZATION
Prior authorization is required and must be submitted within 30 days of planned treatment initiation. Clinical notes must accompany the request.

STEP THERAPY
Step therapy applies to autoimmune indications only. Patients must have a documented trial of a conventional DMARD. Oncology indications are exempt from step therapy.

SITE OF CARE
Covered sites:
- Hospital Outpatient
- Infusion Center
Home infusion is not currently approved for rituximab.

DOSING AND QUANTITY LIMITS
375 mg/m2 IV. Max 6 cycles per 12-month period. Re-authorization required for continuation beyond 6 cycles.""",

    "humira_cigna": """CIGNA MEDICAL COVERAGE POLICY
Policy: Adalimumab Products (Humira and Biosimilars)
Policy Number: MCP-0298
Effective Date: January 1, 2024
Last Reviewed: March 15, 2024

COVERAGE DETERMINATION
Humira (adalimumab) is NOT COVERED under this policy effective January 1, 2024. Cigna has transitioned to preferred biosimilar alternatives for adalimumab products.

DRUG CATEGORY
TNF Inhibitor category. 4 drugs hold preferred status, all of which are biosimilar adalimumab products.

EXCLUSION NOTICE
Humira reference biologic is explicitly excluded from the formulary. Members must transition to an approved biosimilar adalimumab product. Transition assistance is available through the pharmacy department.

ALTERNATIVE COVERAGE
Approved biosimilar adalimumab products include Hadlima, Hyrimoz, and Cyltezo. These products are covered with prior authorization.""",

    "humira_uhc": """UNITEDHEALTHCARE MEDICAL BENEFIT DRUG POLICY
Drug: Adalimumab (Humira)
Policy Number: UHC-MBD-2024-0145
Effective Date: January 1, 2024
Last Updated: April 2, 2024

DESCRIPTION
Adalimumab is a TNF inhibitor biologic used in multiple autoimmune conditions. UnitedHealthcare maintains Humira as a preferred product.

ACCESS STATUS
Humira holds Preferred status. It is the sole preferred TNF inhibitor (1 of 1) in the medical benefit category.

COVERED INDICATIONS
Rheumatoid Arthritis, Psoriatic Arthritis, Crohn's Disease, Ulcerative Colitis, Plaque Psoriasis, Hidradenitis Suppurativa, Uveitis.

PRIOR AUTHORIZATION
Prior authorization is required through OptumRx. Online and fax submissions accepted.

STEP THERAPY
Preferred biologic — no step therapy required. Humira may be initiated as first-line biologic for all approved indications.

SITE OF CARE
Self-Administration (subcutaneous injection), Physician Office, Home Health nursing support available.

DOSING AND QUANTITY LIMITS
40 mg subcutaneous every other week. No annual limit for approved indications. Loading dose permitted per labeling.""",

    "humira_bcbs": """BLUE CROSS BLUE SHIELD MEDICAL POLICY
Subject: Adalimumab (Humira) and Biosimilars
Policy Number: BCBS-MP-2024-0198
Effective: February 15, 2024
Last Reviewed: March 20, 2024

DESCRIPTION
Adalimumab is a fully human monoclonal antibody targeting TNF-alpha used in autoimmune inflammatory conditions.

ACCESS STATUS
Humira is Non-preferred in the TNF Inhibitor category. 3 products hold preferred status (biosimilar adalimumab products).

COVERED INDICATIONS
Rheumatoid Arthritis, Psoriatic Arthritis, Crohn's Disease, Plaque Psoriasis. Other indications require medical director review.

PRIOR AUTHORIZATION
Authorization is required and valid for 12 months with renewal option. Documentation must include diagnosis, treatment history, and specialist recommendation.

STEP THERAPY
Biosimilar step therapy applies. Members must have a documented trial of a biosimilar adalimumab product before Humira will be approved. Exceptions for documented intolerance or contraindication.

SITE OF CARE
Self-Administration, Physician Office. Home health nursing available for training.

DOSING AND QUANTITY LIMITS
40 mg SC every other week. Maximum 26 doses per year.""",

    "bevacizumab_cigna": """CIGNA MEDICAL COVERAGE POLICY
Policy: Bevacizumab (Avastin and Biosimilars)
Policy Number: MCP-0167
Effective Date: October 1, 2025
Last Reviewed: February 28, 2026

DESCRIPTION
Bevacizumab is an anti-VEGF monoclonal antibody used in multiple solid tumor types. Cigna covers bevacizumab under the medical benefit.

ACCESS STATUS
Preferred status (1 of 1) in the Anti-VEGF Monoclonal Antibody category.

COVERED INDICATIONS
Colorectal Cancer, Non-Small Cell Lung Cancer, Glioblastoma, Renal Cell Carcinoma, Cervical Cancer. NCCN Category 1 and 2A indications are covered.

PRIOR AUTHORIZATION
Required for all oncology indications. Must include NCCN-supported use documentation and oncologist treatment plan.

STEP THERAPY
No step therapy for NCCN-supported oncology indications. First-line access available.

SITE OF CARE
Hospital Outpatient, Accredited Infusion Center. Home infusion not available for bevacizumab.

DOSING AND QUANTITY LIMITS
5-15 mg/kg IV every 2-3 weeks per NCCN protocol. Dosing based on approved indication.""",

    "bevacizumab_uhc": """UNITEDHEALTHCARE MEDICAL BENEFIT DRUG POLICY
Drug: Bevacizumab (Avastin and Biosimilars)
Policy Number: UHC-MBD-2025-0234
Effective Date: November 1, 2025
Last Updated: March 15, 2026

DESCRIPTION
Bevacizumab is a recombinant humanized monoclonal antibody that inhibits VEGF. Used in combination with chemotherapy for several cancer types.

ACCESS STATUS
Preferred (1 of 1) in the Anti-VEGF category.

COVERED INDICATIONS
Colorectal Cancer, NSCLC, Glioblastoma, Renal Cell Carcinoma, Cervical Cancer, Ovarian Cancer (expanded coverage).

PRIOR AUTHORIZATION
Required. Online submission via CoverMyMeds. Expedited review available for urgent oncology cases.

STEP THERAPY
No step therapy required. First-line access for all approved indications.

SITE OF CARE
Hospital Outpatient, Infusion Center, Home Infusion (for stable patients on maintenance).

DOSING AND QUANTITY LIMITS
5-15 mg/kg IV per NCCN protocol. No cycle cap for active treatment.""",
}


# ============================================================
# Structured policy records (match frontend mock data)
# ============================================================

POLICIES = [
    # Rituximab — Cigna
    {
        "id": "pol_rituximab_cigna",
        "drug_id": "rituximab", "drug_name": "Rituximab", "generic_name": "rituximab",
        "drug_category": "Anti-CD20 Monoclonal Antibody", "therapeutic_area": "Oncology / Autoimmune",
        "payer_id": "cigna", "payer_name": "Cigna",
        "policy_title": "Cigna Medical Coverage Policy — Rituximab",
        "covered": True, "access_status": "specialty", "preferred_count": 2,
        "covered_indications": ["Non-Hodgkin Lymphoma (NHL)", "Chronic Lymphocytic Leukemia (CLL)", "Rheumatoid Arthritis", "Granulomatosis with Polyangiitis (GPA)"],
        "prior_auth": True,
        "prior_auth_details": "Required for all indications. Clinical documentation must include diagnosis, prior therapies tried, and lab results.",
        "step_therapy": True,
        "step_therapy_details": "Must try methotrexate or another conventional DMARD for 12 weeks before approval.",
        "site_of_care": ["Hospital Outpatient", "Infusion Center"],
        "dosing_limits": "375 mg/m² IV, max 8 cycles per 12 months",
        "coverage_criteria": ["FDA-approved indication", "Failed or intolerant to first-line therapy", "Documentation of disease severity"],
        "effective_date": "2024-01-01", "last_updated": "2024-04-02", "confidence": "high",
    },
    # Rituximab — UHC
    {
        "id": "pol_rituximab_uhc",
        "drug_id": "rituximab", "drug_name": "Rituximab", "generic_name": "rituximab",
        "drug_category": "Anti-CD20 Monoclonal Antibody", "therapeutic_area": "Oncology / Autoimmune",
        "payer_id": "uhc", "payer_name": "UnitedHealthcare",
        "policy_title": "UHC Medical Benefit Drug Policy — Rituximab",
        "covered": True, "access_status": "preferred", "preferred_count": 1,
        "covered_indications": ["Non-Hodgkin Lymphoma (NHL)", "Chronic Lymphocytic Leukemia (CLL)", "Rheumatoid Arthritis", "GPA", "MPA", "Pemphigus Vulgaris"],
        "prior_auth": True,
        "prior_auth_details": "Required. Can be submitted online via CoverMyMeds or fax.",
        "step_therapy": False,
        "step_therapy_details": "No step therapy required for oncology indications.",
        "site_of_care": ["Hospital Outpatient", "Infusion Center", "Home Infusion"],
        "dosing_limits": "375 mg/m² IV, no annual cycle limit",
        "coverage_criteria": ["FDA-approved indication", "Diagnosis confirmation", "Body weight for dosing"],
        "effective_date": "2024-01-15", "last_updated": "2024-04-01", "confidence": "high",
    },
    # Rituximab — BCBS
    {
        "id": "pol_rituximab_bcbs",
        "drug_id": "rituximab", "drug_name": "Rituximab", "generic_name": "rituximab",
        "drug_category": "Anti-CD20 Monoclonal Antibody", "therapeutic_area": "Oncology / Autoimmune",
        "payer_id": "bcbs", "payer_name": "Blue Cross Blue Shield",
        "policy_title": "BCBS Medical Policy — Rituximab",
        "covered": True, "access_status": "non-preferred", "preferred_count": 3,
        "covered_indications": ["Non-Hodgkin Lymphoma (NHL)", "CLL", "Rheumatoid Arthritis"],
        "prior_auth": True,
        "prior_auth_details": "Prior authorization required within 30 days of treatment initiation.",
        "step_therapy": True,
        "step_therapy_details": "Step therapy applies to autoimmune indications only. Not required for oncology.",
        "site_of_care": ["Hospital Outpatient", "Infusion Center"],
        "dosing_limits": "375 mg/m² IV, max 6 cycles per 12 months",
        "coverage_criteria": ["FDA-approved indication or compendia support", "Medical necessity documentation", "Treatment plan from specialist"],
        "effective_date": "2024-02-01", "last_updated": "2024-03-28", "confidence": "medium",
    },
    # Humira — Cigna (NOT COVERED)
    {
        "id": "pol_humira_cigna",
        "drug_id": "humira", "drug_name": "Humira", "generic_name": "adalimumab",
        "drug_category": "TNF Inhibitor", "therapeutic_area": "Autoimmune / Rheumatology",
        "payer_id": "cigna", "payer_name": "Cigna",
        "policy_title": "Cigna Medical Coverage Policy — Adalimumab Products",
        "covered": False, "access_status": "non-preferred", "preferred_count": 4,
        "covered_indications": [],
        "prior_auth": False,
        "prior_auth_details": "Drug is not covered under this plan. Biosimilar alternatives are preferred.",
        "step_therapy": False,
        "step_therapy_details": "N/A — drug is not covered.",
        "site_of_care": [],
        "dosing_limits": "N/A",
        "coverage_criteria": ["Drug is explicitly excluded from coverage", "Biosimilar adalimumab alternatives are available"],
        "effective_date": "2024-01-01", "last_updated": "2024-03-15", "confidence": "high",
    },
    # Humira — UHC
    {
        "id": "pol_humira_uhc",
        "drug_id": "humira", "drug_name": "Humira", "generic_name": "adalimumab",
        "drug_category": "TNF Inhibitor", "therapeutic_area": "Autoimmune / Rheumatology",
        "payer_id": "uhc", "payer_name": "UnitedHealthcare",
        "policy_title": "UHC Medical Benefit Drug Policy — Humira",
        "covered": True, "access_status": "preferred", "preferred_count": 1,
        "covered_indications": ["Rheumatoid Arthritis", "Psoriatic Arthritis", "Crohn's Disease", "Ulcerative Colitis", "Plaque Psoriasis", "Hidradenitis Suppurativa", "Uveitis"],
        "prior_auth": True,
        "prior_auth_details": "Prior authorization through OptumRx.",
        "step_therapy": False,
        "step_therapy_details": "Preferred biologic - no step therapy required.",
        "site_of_care": ["Self-Administration", "Physician Office", "Home Health"],
        "dosing_limits": "40 mg SC every other week, no annual limit",
        "coverage_criteria": ["FDA-approved indication", "Documented diagnosis", "No active infections"],
        "effective_date": "2024-01-01", "last_updated": "2024-04-02", "confidence": "high",
    },
    # Humira — BCBS
    {
        "id": "pol_humira_bcbs",
        "drug_id": "humira", "drug_name": "Humira", "generic_name": "adalimumab",
        "drug_category": "TNF Inhibitor", "therapeutic_area": "Autoimmune / Rheumatology",
        "payer_id": "bcbs", "payer_name": "Blue Cross Blue Shield",
        "policy_title": "BCBS Medical Policy — Humira",
        "covered": True, "access_status": "non-preferred", "preferred_count": 3,
        "covered_indications": ["Rheumatoid Arthritis", "Psoriatic Arthritis", "Crohn's Disease", "Plaque Psoriasis"],
        "prior_auth": True,
        "prior_auth_details": "Authorization valid for 12 months with renewal option.",
        "step_therapy": True,
        "step_therapy_details": "Requires trial of biosimilar adalimumab first.",
        "site_of_care": ["Self-Administration", "Physician Office"],
        "dosing_limits": "40 mg SC every other week, max 26 doses/year",
        "coverage_criteria": ["FDA-approved indication", "Trial of biosimilar unless contraindicated", "Specialist confirmation"],
        "effective_date": "2024-02-15", "last_updated": "2024-03-20", "confidence": "high",
    },
    # Bevacizumab — Cigna
    {
        "id": "pol_bevacizumab_cigna",
        "drug_id": "bevacizumab", "drug_name": "Bevacizumab", "generic_name": "bevacizumab",
        "drug_category": "Anti-VEGF Monoclonal Antibody", "therapeutic_area": "Oncology",
        "payer_id": "cigna", "payer_name": "Cigna",
        "policy_title": "Cigna Medical Coverage Policy — Bevacizumab",
        "covered": True, "access_status": "preferred", "preferred_count": 1,
        "covered_indications": ["Colorectal Cancer", "Non-Small Cell Lung Cancer", "Glioblastoma", "Renal Cell Carcinoma", "Cervical Cancer"],
        "prior_auth": True,
        "prior_auth_details": "Required for all oncology indications. Must include NCCN-supported use documentation.",
        "step_therapy": False,
        "step_therapy_details": "No step therapy for NCCN-supported oncology indications.",
        "site_of_care": ["Hospital Outpatient", "Infusion Center"],
        "dosing_limits": "5-15 mg/kg IV every 2-3 weeks per NCCN protocol",
        "coverage_criteria": ["NCCN-supported indication", "Oncologist treatment plan", "Body weight and dosing protocol"],
        "effective_date": "2025-10-01", "last_updated": "2026-02-28", "confidence": "high",
    },
    # Bevacizumab — UHC
    {
        "id": "pol_bevacizumab_uhc",
        "drug_id": "bevacizumab", "drug_name": "Bevacizumab", "generic_name": "bevacizumab",
        "drug_category": "Anti-VEGF Monoclonal Antibody", "therapeutic_area": "Oncology",
        "payer_id": "uhc", "payer_name": "UnitedHealthcare",
        "policy_title": "UHC Medical Benefit Drug Policy — Bevacizumab",
        "covered": True, "access_status": "preferred", "preferred_count": 1,
        "covered_indications": ["Colorectal Cancer", "NSCLC", "Glioblastoma", "Renal Cell Carcinoma", "Cervical Cancer", "Ovarian Cancer"],
        "prior_auth": True,
        "prior_auth_details": "Online submission via CoverMyMeds. Expedited review available for urgent cases.",
        "step_therapy": False,
        "step_therapy_details": "No step therapy required — first-line access for approved indications.",
        "site_of_care": ["Hospital Outpatient", "Infusion Center", "Home Infusion"],
        "dosing_limits": "5-15 mg/kg IV per NCCN, no cycle cap",
        "coverage_criteria": ["FDA-approved or NCCN-supported indication", "Diagnosis confirmation by oncologist", "Treatment protocol documentation"],
        "effective_date": "2025-11-01", "last_updated": "2026-03-15", "confidence": "high",
    },
    # NOTE: No BCBS Bevacizumab policy (no policy found)
]


# ============================================================
# Version history (older version of UHC Rituximab for change-detection demo)
# ============================================================

UHC_RITUXIMAB_V1 = {
    "drug_id": "rituximab", "drug_name": "Rituximab", "generic_name": "rituximab",
    "drug_category": "Anti-CD20 Monoclonal Antibody", "therapeutic_area": "Oncology / Autoimmune",
    "payer_id": "uhc", "payer_name": "UnitedHealthcare",
    "policy_title": "UHC Medical Benefit Drug Policy — Rituximab",
    "covered": True, "access_status": "preferred", "preferred_count": 1,
    "covered_indications": ["Non-Hodgkin Lymphoma (NHL)", "Chronic Lymphocytic Leukemia (CLL)", "Rheumatoid Arthritis", "GPA"],
    "prior_auth": True,
    "prior_auth_details": "Required. Fax submissions only.",
    "step_therapy": True,
    "step_therapy_details": "Must trial conventional DMARD for 8 weeks before biologic approval.",
    "site_of_care": ["Hospital Outpatient", "Infusion Center"],
    "dosing_limits": "375 mg/m² IV, max 6 cycles per year",
    "coverage_criteria": ["FDA-approved indication", "Diagnosis confirmation"],
    "effective_date": "2023-10-01", "last_updated": "2023-12-15", "confidence": "high",
    "version": 1,
}


# ============================================================
# PDF generation
# ============================================================

def _generate_pdf(text: str, title: str, output_path: Path):
    from fpdf import FPDF

    # Replace Unicode chars unsupported by built-in fonts
    def _sanitize(s: str) -> str:
        return (
            s.replace("\u2014", "-")   # em dash
             .replace("\u2013", "-")   # en dash
             .replace("\u2019", "'")   # right single quote
             .replace("\u2018", "'")   # left single quote
             .replace("\u201c", '"')   # left double quote
             .replace("\u201d", '"')   # right double quote
             .replace("\u2022", "*")   # bullet
             .replace("\u00b2", "2")   # superscript 2
        )

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, _sanitize(title))
    pdf.ln(4)

    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5, _sanitize(text))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


# ============================================================
# Seed function
# ============================================================

def seed_all():
    """Seed database, generate PDFs, and index into vector store."""
    init_db()
    db = SessionLocal()

    # Skip if already seeded
    existing = db.query(PolicyRecord).count()
    if existing > 0:
        print(f"Database already has {existing} policies, skipping seed.")
        db.close()
        return

    print("Seeding database with sample policy data...")

    storage = get_storage()
    doc_dir = Path(storage.base if hasattr(storage, "base") else "./data/documents")

    # --- Insert source configs ---
    sources = [
        SourceRecord(id="src_cigna", payer_id="cigna", payer_name="Cigna",
                     index_url="https://www.cigna.com/coverage-policies", document_type="pdf",
                     parsing_strategy="single_drug_pdf", active=True),
        SourceRecord(id="src_uhc", payer_id="uhc", payer_name="UnitedHealthcare",
                     index_url="https://www.uhcprovider.com/medical-policies", document_type="pdf",
                     parsing_strategy="single_drug_pdf", active=True),
        SourceRecord(id="src_bcbs", payer_id="bcbs", payer_name="Blue Cross Blue Shield",
                     index_url="https://www.bcbsnc.com/coverage-policies", document_type="pdf",
                     parsing_strategy="single_drug_pdf", active=True),
    ]
    for s in sources:
        db.add(s)

    # --- Insert policies and generate PDFs ---
    for p in POLICIES:
        raw_key = f"{p['drug_id']}_{p['payer_id']}"
        raw_text = RAW_TEXTS.get(raw_key, "")

        # Generate PDF
        doc_id = f"doc_{raw_key}"
        pdf_path = doc_dir / p["payer_id"] / p["drug_id"] / f"{raw_key}_policy.pdf"
        if raw_text:
            _generate_pdf(raw_text, p["policy_title"], pdf_path)

        # Document record
        doc = DocumentRecord(
            id=doc_id,
            payer_id=p["payer_id"],
            drug_id=p["drug_id"],
            source_url=f"https://example.com/policies/{raw_key}",
            file_path=str(pdf_path),
            file_hash=str(hash(raw_text)),
            content_type="pdf",
            fetched_at=datetime.utcnow(),
            version=2 if raw_key == "rituximab_uhc" else 1,
        )
        db.add(doc)

        # Policy record
        record = PolicyRecord(
            id=p["id"],
            drug_id=p["drug_id"],
            drug_name=p["drug_name"],
            generic_name=p["generic_name"],
            drug_category=p["drug_category"],
            therapeutic_area=p["therapeutic_area"],
            payer_id=p["payer_id"],
            payer_name=p["payer_name"],
            policy_title=p["policy_title"],
            covered=p["covered"],
            access_status=p["access_status"],
            preferred_count=p["preferred_count"],
            covered_indications=p["covered_indications"],
            prior_auth=p["prior_auth"],
            prior_auth_details=p["prior_auth_details"],
            step_therapy=p["step_therapy"],
            step_therapy_details=p["step_therapy_details"],
            site_of_care=p["site_of_care"],
            dosing_limits=p["dosing_limits"],
            coverage_criteria=p["coverage_criteria"],
            effective_date=p["effective_date"],
            last_updated=p["last_updated"],
            confidence=p["confidence"],
            version=2 if raw_key == "rituximab_uhc" else 1,
            document_id=doc_id,
            raw_text=raw_text,
            created_at=datetime.utcnow(),
        )
        db.add(record)

    # --- Insert version history for UHC Rituximab ---
    # V1 (old)
    v1 = PolicyVersionRecord(
        id="ver_rituximab_uhc_v1",
        policy_id="pol_rituximab_uhc",
        version=1,
        data=UHC_RITUXIMAB_V1,
        change_summary=None,
        created_at=datetime(2023, 10, 1),
    )
    db.add(v1)

    # V2 (current) — with change summary
    current_uhc = next(p for p in POLICIES if p["id"] == "pol_rituximab_uhc")
    from app.ingest import diff_policies, summarize_changes
    changes = diff_policies(UHC_RITUXIMAB_V1, current_uhc)
    v2 = PolicyVersionRecord(
        id="ver_rituximab_uhc_v2",
        policy_id="pol_rituximab_uhc",
        version=2,
        data=current_uhc,
        change_summary=summarize_changes(changes),
        created_at=datetime(2024, 1, 15),
    )
    db.add(v2)

    db.commit()
    print(f"Seeded {len(POLICIES)} policies, {len(POLICIES)} documents, 2 version records.")

    # --- Index into ChromaDB for RAG ---
    print("Indexing policies into vector store...")
    indexed = 0
    for p in POLICIES:
        raw_key = f"{p['drug_id']}_{p['payer_id']}"
        raw_text = RAW_TEXTS.get(raw_key, "")
        if raw_text:
            index_policy(p["id"], p["drug_id"], p["payer_id"], raw_text)
            indexed += 1
    print(f"Indexed {indexed} policies into ChromaDB.")

    db.close()
