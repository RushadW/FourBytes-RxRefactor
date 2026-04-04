"""
Data Drift Detector — detects distribution shifts between consecutive policy ingestions.
Called at the end of ingestion_pipeline.process_document().
"""
import json
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from backend.models.orm import DriftEvent, CoveragePolicy, Drug, PolicyDocument


PA_RATE_THRESHOLD = 0.20    # 20% change triggers warning
COVERAGE_DIST_THRESHOLD = 0.25
MIN_DRUGS_FOR_COMPARISON = 3  # Don't compare if too few drugs


def _get_plan_coverage_stats(db: Session, plan_id: int, exclude_doc_id: int) -> Optional[Dict]:
    """Get distribution stats for the most recent prior document of this plan."""
    prior_doc = (
        db.query(PolicyDocument)
        .filter(
            PolicyDocument.plan_id == plan_id,
            PolicyDocument.id != exclude_doc_id,
            PolicyDocument.status == "complete",
        )
        .order_by(PolicyDocument.uploaded_at.desc())
        .first()
    )
    if not prior_doc:
        return None

    policies = (
        db.query(CoveragePolicy)
        .filter(CoveragePolicy.document_id == prior_doc.id)
        .all()
    )
    if len(policies) < MIN_DRUGS_FOR_COMPARISON:
        return None

    total = len(policies)
    pa_rate = sum(1 for p in policies if p.requires_prior_auth) / total
    covered_rate = sum(1 for p in policies if p.coverage_status == "covered") / total

    drug_ids = [p.drug_id for p in policies]
    drugs = db.query(Drug).filter(Drug.id.in_(drug_ids)).all()
    drug_classes = {d.drug_class for d in drugs if d.drug_class}

    return {
        "doc_id": prior_doc.id,
        "total_drugs": total,
        "pa_rate": pa_rate,
        "covered_rate": covered_rate,
        "drug_classes": drug_classes,
    }


def detect_drift(
    db: Session,
    plan_id: int,
    document_id: int,
    new_drug_classes: set,
    new_pa_rate: float,
    new_covered_rate: float,
    new_drug_count: int,
):
    """Compare new document stats against prior history. Write DriftEvent rows."""
    prior = _get_plan_coverage_stats(db, plan_id, exclude_doc_id=document_id)

    # Always check for new drug classes against ALL historical classes
    all_prior_drugs = (
        db.query(Drug)
        .join(CoveragePolicy, Drug.id == CoveragePolicy.drug_id)
        .join(PolicyDocument, CoveragePolicy.document_id == PolicyDocument.id)
        .filter(
            PolicyDocument.plan_id == plan_id,
            PolicyDocument.id != document_id,
        )
        .all()
    )
    historical_classes = {d.drug_class for d in all_prior_drugs if d.drug_class}
    novel_classes = new_drug_classes - historical_classes
    if novel_classes:
        _write_event(db, plan_id, document_id, "new_drug_class",
                     old_value=json.dumps(list(historical_classes)),
                     new_value=json.dumps(list(novel_classes)),
                     severity="info",
                     description=f"New drug class(es) detected: {', '.join(novel_classes)}")

    if not prior:
        return  # No prior document to compare against

    # Prior auth rate shift
    pa_delta = abs(new_pa_rate - prior["pa_rate"])
    if pa_delta > PA_RATE_THRESHOLD:
        severity = "critical" if pa_delta > 0.40 else "warning"
        _write_event(db, plan_id, document_id, "pa_rate_shift",
                     old_value=f"{prior['pa_rate']:.0%}",
                     new_value=f"{new_pa_rate:.0%}",
                     severity=severity,
                     description=f"Prior auth rate shifted by {pa_delta:.0%} "
                                 f"({prior['pa_rate']:.0%} → {new_pa_rate:.0%})")

    # Coverage status distribution shift
    cov_delta = abs(new_covered_rate - prior["covered_rate"])
    if cov_delta > COVERAGE_DIST_THRESHOLD:
        severity = "critical" if cov_delta > 0.50 else "warning"
        _write_event(db, plan_id, document_id, "coverage_status_distribution_shift",
                     old_value=f"covered={prior['covered_rate']:.0%}",
                     new_value=f"covered={new_covered_rate:.0%}",
                     severity=severity,
                     description=f"Coverage rate shifted by {cov_delta:.0%}")

    # Drug count drop
    if prior["total_drugs"] > MIN_DRUGS_FOR_COMPARISON:
        drop = (prior["total_drugs"] - new_drug_count) / prior["total_drugs"]
        if drop > 0.30:
            _write_event(db, plan_id, document_id, "extraction_volume_drop",
                         old_value=str(prior["total_drugs"]),
                         new_value=str(new_drug_count),
                         severity="warning",
                         description=f"Drug count dropped {drop:.0%}: "
                                     f"{prior['total_drugs']} → {new_drug_count}. "
                                     "Possible extraction regression.")


def _write_event(db: Session, plan_id: int, document_id: int, drift_type: str,
                 old_value: str, new_value: str, severity: str, description: str):
    event = DriftEvent(
        drift_type=drift_type,
        document_id=document_id,
        plan_id=plan_id,
        description=description,
        old_value=old_value,
        new_value=new_value,
        severity=severity,
    )
    db.add(event)
    db.commit()
