from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.models.orm import (
    HealthPlan, PolicyDocument, Drug, CoveragePolicy,
    PriorAuthCriterion, StepTherapyRequirement, PolicyChangeLog, DocumentChunk
)


# ── Health Plans ──────────────────────────────────────────────────────────────

def get_or_create_plan(db: Session, name: str, payer_name: str, plan_type: str = None, effective_date=None) -> HealthPlan:
    plan = db.query(HealthPlan).filter(HealthPlan.name == name).first()
    if not plan:
        plan = HealthPlan(name=name, payer_name=payer_name, plan_type=plan_type, effective_date=effective_date)
        db.add(plan)
        db.commit()
        db.refresh(plan)
    return plan


def list_plans(db: Session) -> List[HealthPlan]:
    return db.query(HealthPlan).order_by(HealthPlan.name).all()


def get_plan(db: Session, plan_id: int) -> Optional[HealthPlan]:
    return db.query(HealthPlan).filter(HealthPlan.id == plan_id).first()


# ── Policy Documents ──────────────────────────────────────────────────────────

def create_document(db: Session, plan_id: int, filename: str, file_path: str,
                    file_hash: str, quarter: str = None, version: int = 1) -> PolicyDocument:
    doc = PolicyDocument(
        plan_id=plan_id, filename=filename, file_path=file_path,
        file_hash=file_hash, quarter=quarter, version=version, status="pending"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_document(db: Session, document_id: int) -> Optional[PolicyDocument]:
    return db.query(PolicyDocument).filter(PolicyDocument.id == document_id).first()


def get_document_by_hash(db: Session, file_hash: str) -> Optional[PolicyDocument]:
    return db.query(PolicyDocument).filter(PolicyDocument.file_hash == file_hash).first()


def update_document_status(db: Session, document_id: int, status: str,
                            error_message: str = None):
    doc = get_document(db, document_id)
    if doc:
        doc.status = status
        if error_message:
            doc.error_message = error_message
        if status == "complete":
            doc.processed_at = datetime.utcnow()
        db.commit()


def list_documents(db: Session, plan_id: int = None, status: str = None) -> List[PolicyDocument]:
    q = db.query(PolicyDocument)
    if plan_id:
        q = q.filter(PolicyDocument.plan_id == plan_id)
    if status:
        q = q.filter(PolicyDocument.status == status)
    return q.order_by(PolicyDocument.uploaded_at.desc()).all()


def delete_document(db: Session, document_id: int):
    doc = get_document(db, document_id)
    if doc:
        db.delete(doc)
        db.commit()


# ── Drugs ─────────────────────────────────────────────────────────────────────

def get_or_create_drug(db: Session, generic_name: str, brand_name: str = None,
                       drug_class: str = None) -> Drug:
    drug = db.query(Drug).filter(
        Drug.generic_name.ilike(generic_name)
    ).first()
    if not drug:
        drug = Drug(generic_name=generic_name.lower().strip(),
                    brand_name=brand_name, drug_class=drug_class)
        db.add(drug)
        db.commit()
        db.refresh(drug)
    else:
        # Update brand_name/class if we have new info
        updated = False
        if brand_name and not drug.brand_name:
            drug.brand_name = brand_name
            updated = True
        if drug_class and not drug.drug_class:
            drug.drug_class = drug_class
            updated = True
        if updated:
            db.commit()
    return drug


def search_drug(db: Session, query: str) -> List[Drug]:
    q = f"%{query.lower()}%"
    return db.query(Drug).filter(
        or_(Drug.generic_name.ilike(q), Drug.brand_name.ilike(q))
    ).all()


def list_drugs(db: Session) -> List[Drug]:
    return db.query(Drug).order_by(Drug.generic_name).all()


# ── Coverage Policies ─────────────────────────────────────────────────────────

def upsert_coverage_policy(db: Session, plan_id: int, drug_id: int, document_id: int,
                            coverage_data: dict) -> Tuple[CoveragePolicy, bool]:
    """Returns (policy, is_new). Deletes old PA criteria and step therapy before re-inserting."""
    existing = db.query(CoveragePolicy).filter(
        CoveragePolicy.plan_id == plan_id,
        CoveragePolicy.drug_id == drug_id,
        CoveragePolicy.document_id == document_id,
    ).first()

    is_new = existing is None
    if existing:
        for k, v in coverage_data.items():
            if k not in ("prior_auth_criteria", "step_therapy"):
                setattr(existing, k, v)
        policy = existing
    else:
        policy_fields = {k: v for k, v in coverage_data.items()
                        if k not in ("prior_auth_criteria", "step_therapy")}
        policy = CoveragePolicy(plan_id=plan_id, drug_id=drug_id,
                                document_id=document_id, **policy_fields)
        db.add(policy)

    db.commit()
    db.refresh(policy)
    return policy, is_new


def add_prior_auth_criteria(db: Session, coverage_policy_id: int, criteria: List[str]):
    db.query(PriorAuthCriterion).filter(
        PriorAuthCriterion.coverage_policy_id == coverage_policy_id
    ).delete()
    for i, text in enumerate(criteria):
        db.add(PriorAuthCriterion(
            coverage_policy_id=coverage_policy_id,
            criterion_order=i,
            criterion_text=text,
        ))
    db.commit()


def add_step_therapy(db: Session, coverage_policy_id: int, steps: List[dict]):
    db.query(StepTherapyRequirement).filter(
        StepTherapyRequirement.coverage_policy_id == coverage_policy_id
    ).delete()
    for step in steps:
        db.add(StepTherapyRequirement(
            coverage_policy_id=coverage_policy_id,
            step_order=step.get("step_order", 0),
            required_drug=step.get("required_drug", ""),
            minimum_duration=step.get("minimum_duration"),
            failure_criteria=step.get("failure_criteria"),
        ))
    db.commit()


def get_previous_policy(db: Session, plan_id: int, drug_id: int,
                         exclude_document_id: int) -> Optional[CoveragePolicy]:
    return (
        db.query(CoveragePolicy)
        .filter(
            CoveragePolicy.plan_id == plan_id,
            CoveragePolicy.drug_id == drug_id,
            CoveragePolicy.document_id != exclude_document_id,
        )
        .order_by(CoveragePolicy.extracted_at.desc())
        .first()
    )


def get_coverage_for_drug(db: Session, drug_ids: List[int],
                           plan_ids: List[int] = None) -> List[dict]:
    q = (
        db.query(CoveragePolicy, HealthPlan, Drug, PolicyDocument)
        .join(HealthPlan, CoveragePolicy.plan_id == HealthPlan.id)
        .join(Drug, CoveragePolicy.drug_id == Drug.id)
        .join(PolicyDocument, CoveragePolicy.document_id == PolicyDocument.id)
        .filter(CoveragePolicy.drug_id.in_(drug_ids))
    )
    if plan_ids:
        q = q.filter(CoveragePolicy.plan_id.in_(plan_ids))
    rows = q.order_by(HealthPlan.name).all()

    result = []
    for cp, plan, drug, doc in rows:
        pa_criteria = [c.criterion_text for c in cp.prior_auth_criteria]
        step_drugs = [s.required_drug for s in cp.step_therapy_requirements]
        result.append({
            "coverage_policy_id": cp.id,
            "plan_id": plan.id,
            "plan_name": plan.name,
            "drug_id": drug.id,
            "drug_brand_name": drug.brand_name,
            "drug_generic_name": drug.generic_name,
            "drug_class": drug.drug_class,
            "coverage_status": cp.coverage_status,
            "tier": cp.tier,
            "quantity_limit": cp.quantity_limit,
            "requires_prior_auth": cp.requires_prior_auth,
            "requires_step_therapy": cp.requires_step_therapy,
            "age_restriction": cp.age_restriction,
            "diagnosis_restriction": cp.diagnosis_restriction,
            "notes": cp.notes,
            "quarter": doc.quarter,
            "prior_auth_criteria": pa_criteria,
            "step_therapy_drugs": step_drugs,
        })
    return result


def get_all_coverage(db: Session, plan_ids: List[int] = None) -> List[dict]:
    q = (
        db.query(CoveragePolicy, HealthPlan, Drug, PolicyDocument)
        .join(HealthPlan, CoveragePolicy.plan_id == HealthPlan.id)
        .join(Drug, CoveragePolicy.drug_id == Drug.id)
        .join(PolicyDocument, CoveragePolicy.document_id == PolicyDocument.id)
    )
    if plan_ids:
        q = q.filter(CoveragePolicy.plan_id.in_(plan_ids))
    rows = q.order_by(Drug.generic_name, HealthPlan.name).all()
    result = []
    for cp, plan, drug, doc in rows:
        result.append({
            "coverage_policy_id": cp.id,
            "plan_id": plan.id,
            "plan_name": plan.name,
            "drug_id": drug.id,
            "drug_brand_name": drug.brand_name,
            "drug_generic_name": drug.generic_name,
            "drug_class": drug.drug_class,
            "coverage_status": cp.coverage_status,
            "tier": cp.tier,
            "quantity_limit": cp.quantity_limit,
            "requires_prior_auth": cp.requires_prior_auth,
            "requires_step_therapy": cp.requires_step_therapy,
            "age_restriction": cp.age_restriction,
            "diagnosis_restriction": cp.diagnosis_restriction,
            "notes": cp.notes,
            "quarter": doc.quarter,
        })
    return result


# ── Change Log ────────────────────────────────────────────────────────────────

def add_change_log(db: Session, plan_id: int, drug_id: int, change_type: str,
                   old_value: str, new_value: str,
                   previous_document_id: int, new_document_id: int):
    entry = PolicyChangeLog(
        plan_id=plan_id, drug_id=drug_id, change_type=change_type,
        old_value=old_value, new_value=new_value,
        previous_document_id=previous_document_id,
        new_document_id=new_document_id,
    )
    db.add(entry)
    db.commit()


def get_changes(db: Session, plan_id: int = None,
                from_date: datetime = None, to_date: datetime = None) -> List[dict]:
    q = (
        db.query(PolicyChangeLog, HealthPlan, Drug, PolicyDocument)
        .join(HealthPlan, PolicyChangeLog.plan_id == HealthPlan.id)
        .outerjoin(Drug, PolicyChangeLog.drug_id == Drug.id)
        .join(PolicyDocument, PolicyChangeLog.new_document_id == PolicyDocument.id)
    )
    if plan_id:
        q = q.filter(PolicyChangeLog.plan_id == plan_id)
    if from_date:
        q = q.filter(PolicyChangeLog.detected_at >= from_date)
    if to_date:
        q = q.filter(PolicyChangeLog.detected_at <= to_date)
    rows = q.order_by(PolicyChangeLog.detected_at.desc()).all()

    result = []
    for log, plan, drug, doc in rows:
        prev_doc = None
        if log.previous_document_id:
            prev_doc = db.query(PolicyDocument).filter(
                PolicyDocument.id == log.previous_document_id
            ).first()
        result.append({
            "id": log.id,
            "plan_name": plan.name,
            "drug_generic_name": drug.generic_name if drug else None,
            "change_type": log.change_type,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "from_quarter": prev_doc.quarter if prev_doc else None,
            "to_quarter": doc.quarter,
            "detected_at": log.detected_at,
        })
    return result


# ── Chunks ────────────────────────────────────────────────────────────────────

def save_chunk(db: Session, document_id: int, chunk_index: int,
               chunk_text: str, chroma_id: str, page_number: int = None):
    chunk = DocumentChunk(
        document_id=document_id, chunk_index=chunk_index,
        chunk_text=chunk_text, chroma_id=chroma_id, page_number=page_number
    )
    db.add(chunk)
    db.commit()


def delete_chunks_for_document(db: Session, document_id: int):
    db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).delete()
    db.commit()


def get_chunks_by_chroma_ids(db: Session, chroma_ids: List[str]) -> List[DocumentChunk]:
    return db.query(DocumentChunk).filter(
        DocumentChunk.chroma_id.in_(chroma_ids)
    ).all()
