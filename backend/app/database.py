from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, JSON, String, Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------- ORM models ----------

class PolicyRecord(Base):
    __tablename__ = "policies"

    id = Column(String, primary_key=True)
    drug_id = Column(String, index=True)
    drug_name = Column(String)
    generic_name = Column(String)
    drug_category = Column(String)
    therapeutic_area = Column(String)
    payer_id = Column(String, index=True)
    payer_name = Column(String)
    policy_title = Column(String)
    covered = Column(Boolean)
    access_status = Column(String)
    preferred_count = Column(Integer)
    covered_indications = Column(JSON)
    prior_auth = Column(Boolean)
    prior_auth_details = Column(Text)
    step_therapy = Column(Boolean)
    step_therapy_details = Column(Text)
    site_of_care = Column(JSON)
    dosing_limits = Column(String)
    coverage_criteria = Column(JSON)
    hcpcs_code = Column(String, nullable=True)
    effective_date = Column(String)
    last_updated = Column(String)
    confidence = Column(String)
    version = Column(Integer, default=1)
    document_id = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    payer_id = Column(String)
    drug_id = Column(String)
    source_url = Column(String)
    file_path = Column(String)
    file_hash = Column(String)
    content_type = Column(String)
    fetched_at = Column(DateTime)
    version = Column(Integer, default=1)


class PolicyVersionRecord(Base):
    __tablename__ = "policy_versions"

    id = Column(String, primary_key=True)
    policy_id = Column(String, index=True)
    version = Column(Integer)
    data = Column(JSON)
    change_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SourceRecord(Base):
    __tablename__ = "sources"

    id = Column(String, primary_key=True)
    payer_id = Column(String)
    payer_name = Column(String)
    index_url = Column(String)
    document_type = Column(String)
    parsing_strategy = Column(String)
    active = Column(Boolean, default=True)


# ---------- helpers ----------

def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:  # type: ignore[misc]
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
