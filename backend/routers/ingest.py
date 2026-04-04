import hashlib
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import crud
from backend.services.ingestion_pipeline import process_document, compute_file_hash
from backend.config import UPLOAD_DIR, PROCESSED_DIR
from backend.models.schemas import IngestUploadResponse, IngestProcessResponse, IngestStatusResponse

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/upload", response_model=IngestUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    plan_name: str = Form(...),
    payer_name: str = Form(...),
    plan_type: str = Form(default=None),
    effective_date: str = Form(default=None),
    quarter: str = Form(default=None),
    db: Session = Depends(get_db),
):
    # Save to uploads dir
    upload_path = UPLOAD_DIR / file.filename
    with open(upload_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_hash = compute_file_hash(str(upload_path))

    # Check for duplicate
    existing = crud.get_document_by_hash(db, file_hash)
    if existing:
        upload_path.unlink(missing_ok=True)
        return IngestUploadResponse(
            document_id=existing.id,
            status=existing.status,
            message="Document already ingested (duplicate file hash).",
        )

    # Move to processed dir
    dest_path = PROCESSED_DIR / file.filename
    shutil.move(str(upload_path), str(dest_path))

    # Parse effective_date
    from datetime import date
    eff_date = None
    if effective_date:
        try:
            eff_date = date.fromisoformat(effective_date)
        except ValueError:
            pass

    plan = crud.get_or_create_plan(
        db, name=plan_name, payer_name=payer_name,
        plan_type=plan_type, effective_date=eff_date,
    )

    # Determine version (count existing docs for this plan)
    existing_docs = crud.list_documents(db, plan_id=plan.id)
    version = len(existing_docs) + 1

    doc = crud.create_document(
        db, plan_id=plan.id, filename=file.filename,
        file_path=str(dest_path), file_hash=file_hash,
        quarter=quarter, version=version,
    )

    return IngestUploadResponse(
        document_id=doc.id,
        status=doc.status,
        message="Document uploaded successfully. Call /ingest/process/{id} to start processing.",
    )


@router.post("/process/{document_id}", response_model=IngestProcessResponse)
def process_doc(document_id: int, db: Session = Depends(get_db)):
    doc = crud.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status == "complete":
        raise HTTPException(status_code=400, detail="Document already processed")

    result = process_document(db, document_id)
    return IngestProcessResponse(**result)


@router.get("/status/{document_id}", response_model=IngestStatusResponse)
def get_status(document_id: int, db: Session = Depends(get_db)):
    doc = crud.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return IngestStatusResponse(
        document_id=doc.id,
        status=doc.status,
        error_message=doc.error_message,
        processed_at=doc.processed_at,
    )
