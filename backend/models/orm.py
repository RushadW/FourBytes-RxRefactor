from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date,
    ForeignKey, Text, UniqueConstraint, Float
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ─── Original Tables ──────────────────────────────────────────────────────────

class HealthPlan(Base):
    __tablename__ = "health_plans"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    payer_name = Column(String, nullable=False)
    plan_type = Column(String)
    effective_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("PolicyDocument", back_populates="plan")
    coverage_policies = relationship("CoveragePolicy", back_populates="plan")


class PolicyDocument(Base):
    __tablename__ = "policy_documents"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("health_plans.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_hash = Column(String, unique=True)
    quarter = Column(String)
    version = Column(Integer, default=1)
    status = Column(String, default="pending")  # pending|processing|complete|failed|low_quality
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    # MLOps: link to quality score
    extraction_score_id = Column(Integer, ForeignKey("extraction_quality_scores.id"), nullable=True)

    plan = relationship("HealthPlan", back_populates="documents")
    coverage_policies = relationship("CoveragePolicy", back_populates="document")
    chunks = relationship("DocumentChunk", back_populates="document")


class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True)
    brand_name = Column(String, nullable=True)
    generic_name = Column(String, nullable=False, unique=True)
    drug_class = Column(String, nullable=True)
    ndc_codes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    coverage_policies = relationship("CoveragePolicy", back_populates="drug")


class CoveragePolicy(Base):
    __tablename__ = "coverage_policies"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("health_plans.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    coverage_status = Column(String, nullable=False)
    tier = Column(String, nullable=True)
    quantity_limit = Column(String, nullable=True)
    requires_prior_auth = Column(Boolean, default=False)
    requires_step_therapy = Column(Boolean, default=False)
    age_restriction = Column(String, nullable=True)
    diagnosis_restriction = Column(String, nullable=True)
    site_of_care = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    # MLOps: track which prompt version produced this extraction
    extraction_prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    has_analyst_correction = Column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("plan_id", "drug_id", "document_id"),
    )

    plan = relationship("HealthPlan", back_populates="coverage_policies")
    drug = relationship("Drug", back_populates="coverage_policies")
    document = relationship("PolicyDocument", back_populates="coverage_policies")
    prior_auth_criteria = relationship("PriorAuthCriterion", back_populates="coverage_policy", cascade="all, delete-orphan")
    step_therapy_requirements = relationship("StepTherapyRequirement", back_populates="coverage_policy", cascade="all, delete-orphan")
    analyst_corrections = relationship("AnalystCorrection", back_populates="coverage_policy")


class PriorAuthCriterion(Base):
    __tablename__ = "prior_auth_criteria"

    id = Column(Integer, primary_key=True)
    coverage_policy_id = Column(Integer, ForeignKey("coverage_policies.id"), nullable=False)
    criterion_order = Column(Integer, default=0)
    criterion_text = Column(Text, nullable=False)
    criterion_type = Column(String, nullable=True)

    coverage_policy = relationship("CoveragePolicy", back_populates="prior_auth_criteria")


class StepTherapyRequirement(Base):
    __tablename__ = "step_therapy_requirements"

    id = Column(Integer, primary_key=True)
    coverage_policy_id = Column(Integer, ForeignKey("coverage_policies.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    required_drug = Column(String, nullable=False)
    minimum_duration = Column(String, nullable=True)
    failure_criteria = Column(String, nullable=True)

    coverage_policy = relationship("CoveragePolicy", back_populates="step_therapy_requirements")


class PolicyChangeLog(Base):
    __tablename__ = "policy_change_log"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("health_plans.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=True)
    change_type = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    previous_document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=True)
    new_document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    chroma_id = Column(String, unique=True)
    page_number = Column(Integer, nullable=True)
    # MLOps: track which embedding model generated this chunk's vector
    embedding_model_id = Column(Integer, ForeignKey("embedding_model_versions.id"), nullable=True)

    document = relationship("PolicyDocument", back_populates="chunks")


# ─── MLOps Tables ─────────────────────────────────────────────────────────────

class PromptVersion(Base):
    """Versioned prompt store with lifecycle management."""
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True)
    prompt_name = Column(String, nullable=False)
    version_tag = Column(String, nullable=False)   # e.g. "v1.2"
    status = Column(String, default="draft")        # draft|staging|production|archived
    system_prompt = Column(Text, nullable=True)
    user_prompt = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    promoted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("prompt_name", "version_tag"),
    )


class LLMCallLog(Base):
    """Append-only log of every Claude API call: tokens, latency, cost."""
    __tablename__ = "llm_call_log"

    id = Column(Integer, primary_key=True)
    call_type = Column(String, nullable=False)      # extraction|extraction_retry|intent|rag_generation
    model = Column(String, nullable=False)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=True)
    stop_reason = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    called_at = Column(DateTime, default=datetime.utcnow)


class ExtractionQualityScore(Base):
    """Quality score for each document's extraction run."""
    __tablename__ = "extraction_quality_scores"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    drugs_extracted = Column(Integer, nullable=False)
    schema_completeness_avg = Column(Float, nullable=False)
    required_fields_pass = Column(Float, nullable=False)
    enum_validity_rate = Column(Float, nullable=False)
    anomaly_count = Column(Integer, default=0)
    anomaly_details = Column(Text, nullable=True)   # JSON list
    scored_at = Column(DateTime, default=datetime.utcnow)


class RAGQualityScore(Base):
    """Quality score for each RAG response."""
    __tablename__ = "rag_quality_scores"

    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    question_hash = Column(String, nullable=False, index=True)
    answer_snippet = Column(Text, nullable=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    llm_call_log_id = Column(Integer, ForeignKey("llm_call_log.id"), nullable=True)
    context_relevance_score = Column(Float, nullable=True)
    groundedness_score = Column(Float, nullable=True)
    chunks_retrieved = Column(Integer, nullable=True)
    structured_hits = Column(Integer, nullable=True)
    human_rating = Column(Integer, nullable=True)   # 1-5 from analyst
    human_comment = Column(Text, nullable=True)
    scored_at = Column(DateTime, default=datetime.utcnow)


class DriftEvent(Base):
    """Data drift signals detected during ingestion."""
    __tablename__ = "drift_events"

    id = Column(Integer, primary_key=True)
    drift_type = Column(String, nullable=False)     # new_drug_class|pa_rate_shift|coverage_status_distribution_shift|extraction_volume_drop
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=True)
    plan_id = Column(Integer, ForeignKey("health_plans.id"), nullable=True)
    description = Column(Text, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    severity = Column(String, default="info")       # info|warning|critical
    acknowledged = Column(Boolean, default=False)
    detected_at = Column(DateTime, default=datetime.utcnow)


class AnalystCorrection(Base):
    """Human-in-the-loop corrections to extracted coverage policies."""
    __tablename__ = "analyst_corrections"

    id = Column(Integer, primary_key=True)
    coverage_policy_id = Column(Integer, ForeignKey("coverage_policies.id"), nullable=False)
    field_name = Column(String, nullable=False)
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=False)
    correction_reason = Column(Text, nullable=True)
    analyst_id = Column(String, nullable=True)
    applied = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    coverage_policy = relationship("CoveragePolicy", back_populates="analyst_corrections")


class QueryCache(Base):
    """Semantic cache for RAG query results."""
    __tablename__ = "query_cache"

    id = Column(Integer, primary_key=True)
    question_hash = Column(String, unique=True, nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    plan_ids_key = Column(String, nullable=True)    # sorted CSV of plan IDs
    answer = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True)
    structured_json = Column(Text, nullable=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    hit_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    invalidated = Column(Boolean, default=False)


class ReextractionJob(Base):
    """Queue of documents scheduled for re-extraction."""
    __tablename__ = "reextraction_jobs"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    trigger_reason = Column(String, nullable=False)  # prompt_promotion|model_change|low_quality_score|manual
    triggered_by_version = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    status = Column(String, default="queued")        # queued|running|complete|failed
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)


class EmbeddingModelVersion(Base):
    """Registry of embedding models used to generate chunk vectors."""
    __tablename__ = "embedding_model_versions"

    id = Column(Integer, primary_key=True)
    model_name = Column(String, nullable=False)     # e.g. "sentence-transformers/all-MiniLM-L6-v2"
    model_slug = Column(String, nullable=False)     # used in ChromaDB collection name
    model_version = Column(String, nullable=True)
    dimensions = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ABTestRun(Base):
    """A/B test comparing two prompt versions on the same document."""
    __tablename__ = "ab_test_runs"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    prompt_version_a_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=False)
    prompt_version_b_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=False)
    status = Column(String, default="pending")      # pending|running|complete|failed
    result_a_json = Column(Text, nullable=True)
    result_b_json = Column(Text, nullable=True)
    diff_json = Column(Text, nullable=True)
    winner = Column(String, nullable=True)          # "A"|"B"|"tie"|null
    analyst_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
