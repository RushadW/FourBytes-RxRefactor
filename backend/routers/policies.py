from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import crud
from backend.services import embeddings
from backend.models.schemas import HealthPlanSummary, PolicyDocumentSummary

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("/plans", response_model=List[HealthPlanSummary])
def list_plans(db: Session = Depends(get_db)):
    plans = crud.list_plans(db)
    return [HealthPlanSummary.model_validate(p) for p in plans]


@router.get("/plans/{plan_id}", response_model=HealthPlanSummary)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = crud.get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return HealthPlanSummary.model_validate(plan)


@router.get("/documents", response_model=List[PolicyDocumentSummary])
def list_documents(
    plan_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    docs = crud.list_documents(db, plan_id=plan_id, status=status)
    result = []
    for doc in docs:
        result.append(PolicyDocumentSummary(
            id=doc.id,
            plan_id=doc.plan_id,
            plan_name=doc.plan.name if doc.plan else "Unknown",
            filename=doc.filename,
            quarter=doc.quarter,
            version=doc.version,
            status=doc.status,
            uploaded_at=doc.uploaded_at,
            processed_at=doc.processed_at,
        ))
    return result


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = crud.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    embeddings.delete_chunks_for_document(document_id)
    crud.delete_document(db, document_id)
    return {"message": f"Document {document_id} deleted successfully"}


@router.get("/drugs")
def list_drugs(db: Session = Depends(get_db)):
    drugs = crud.list_drugs(db)
    return [{"id": d.id, "brand_name": d.brand_name,
             "generic_name": d.generic_name, "drug_class": d.drug_class}
            for d in drugs]
