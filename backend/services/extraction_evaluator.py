"""
Extraction Quality Evaluator — scores Claude extraction output without any LLM calls.
Runs synchronously after every extraction batch.
"""
import json
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

REQUIRED_FIELDS = {"generic_name", "coverage_status"}
OPTIONAL_FIELDS = {
    "brand_name", "drug_class", "indication", "tier", "quantity_limit",
    "requires_prior_auth", "requires_step_therapy", "age_restriction",
    "diagnosis_restriction", "prior_auth_criteria",
}
ALL_SCORED_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS
VALID_COVERAGE_STATUSES = {"covered", "not_covered", "covered_with_restrictions"}


def score_drug_record(drug: dict) -> Dict:
    """Score a single extracted drug record. Returns field-level diagnostics."""
    present = sum(1 for f in ALL_SCORED_FIELDS if drug.get(f) is not None)
    completeness = present / len(ALL_SCORED_FIELDS)
    required_pass = all(drug.get(f) for f in REQUIRED_FIELDS)
    coverage_status = drug.get("coverage_status", "")
    enum_valid = coverage_status in VALID_COVERAGE_STATUSES

    anomalies = []
    if drug.get("requires_prior_auth") and not drug.get("prior_auth_criteria"):
        anomalies.append(f"{drug.get('generic_name','?')}: requires_prior_auth=True but no criteria listed")
    if drug.get("requires_step_therapy") and not drug.get("step_therapy"):
        anomalies.append(f"{drug.get('generic_name','?')}: requires_step_therapy=True but no steps listed")
    if not enum_valid and coverage_status:
        anomalies.append(f"{drug.get('generic_name','?')}: invalid coverage_status '{coverage_status}'")

    return {
        "completeness": completeness,
        "required_pass": required_pass,
        "enum_valid": enum_valid,
        "anomalies": anomalies,
    }


def score_extraction(
    extraction_result: Dict,
    document_id: int,
    prompt_version_id: Optional[int],
    db: Session,
) -> Dict:
    """
    Score the full extraction result and write to extraction_quality_scores table.
    Returns the score dict with a 'pass' key (True if quality is acceptable).
    """
    from backend.models.orm import ExtractionQualityScore

    drugs = extraction_result.get("drugs", [])
    if not drugs:
        score_row = ExtractionQualityScore(
            document_id=document_id,
            prompt_version_id=prompt_version_id,
            drugs_extracted=0,
            schema_completeness_avg=0.0,
            required_fields_pass=0.0,
            enum_validity_rate=0.0,
            anomaly_count=0,
            anomaly_details=json.dumps(["No drugs extracted"]),
        )
        db.add(score_row)
        db.commit()
        return {"pass": False, "completeness": 0.0, "anomaly_count": 0}

    scores = [score_drug_record(d) for d in drugs]
    completeness_avg = sum(s["completeness"] for s in scores) / len(scores)
    required_pass_rate = sum(1 for s in scores if s["required_pass"]) / len(scores)
    enum_validity_rate = sum(1 for s in scores if s["enum_valid"]) / len(scores)
    all_anomalies = [a for s in scores for a in s["anomalies"]]

    score_row = ExtractionQualityScore(
        document_id=document_id,
        prompt_version_id=prompt_version_id,
        drugs_extracted=len(drugs),
        schema_completeness_avg=round(completeness_avg, 4),
        required_fields_pass=round(required_pass_rate, 4),
        enum_validity_rate=round(enum_validity_rate, 4),
        anomaly_count=len(all_anomalies),
        anomaly_details=json.dumps(all_anomalies[:20]),  # cap stored anomalies
    )
    db.add(score_row)
    db.commit()
    db.refresh(score_row)

    quality_pass = completeness_avg >= 0.5 and required_pass_rate >= 0.8

    return {
        "pass": quality_pass,
        "score_id": score_row.id,
        "completeness": completeness_avg,
        "required_pass_rate": required_pass_rate,
        "enum_validity_rate": enum_validity_rate,
        "anomaly_count": len(all_anomalies),
    }
