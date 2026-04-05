from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


# ── Ingest ────────────────────────────────────────────────────────────────────

class IngestUploadResponse(BaseModel):
    document_id: int
    status: str
    message: str


class IngestProcessResponse(BaseModel):
    document_id: int
    status: str
    drugs_extracted: int
    policies_created: int
    changes_detected: int
    error: Optional[str] = None


class IngestStatusResponse(BaseModel):
    document_id: int
    status: str
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None


# ── Plans / Docs ───────────────────────────────────────────────────────────────

class HealthPlanCreate(BaseModel):
    name: str
    payer_name: str
    plan_type: Optional[str] = None
    effective_date: Optional[date] = None


class HealthPlanSummary(BaseModel):
    id: int
    name: str
    payer_name: str
    plan_type: Optional[str]
    effective_date: Optional[date]

    model_config = {"from_attributes": True}


class PolicyDocumentSummary(BaseModel):
    id: int
    plan_id: int
    plan_name: str
    filename: str
    quarter: Optional[str]
    version: int
    status: str
    uploaded_at: datetime
    processed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Coverage ───────────────────────────────────────────────────────────────────

class PriorAuthCriterionSchema(BaseModel):
    criterion_order: int
    criterion_text: str
    criterion_type: Optional[str]

    model_config = {"from_attributes": True}


class StepTherapySchema(BaseModel):
    step_order: int
    required_drug: str
    minimum_duration: Optional[str]
    failure_criteria: Optional[str]

    model_config = {"from_attributes": True}


class CoveragePolicySummary(BaseModel):
    coverage_policy_id: int
    plan_id: int
    plan_name: str
    drug_id: int
    drug_brand_name: Optional[str]
    drug_generic_name: str
    drug_class: Optional[str]
    coverage_status: str
    tier: Optional[str]
    quantity_limit: Optional[str]
    requires_prior_auth: bool
    requires_step_therapy: bool
    age_restriction: Optional[str]
    diagnosis_restriction: Optional[str]
    notes: Optional[str]
    quarter: Optional[str]
    benefit_side: Optional[str] = "unknown"
    data_completeness: Optional[str] = "low"
    benefit_side_note: Optional[str] = None


class CoveragePolicyDetail(CoveragePolicySummary):
    prior_auth_criteria: List[PriorAuthCriterionSchema] = []
    step_therapy_requirements: List[StepTherapySchema] = []


# ── Query / RAG ────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    plan_ids: Optional[List[int]] = None
    drug_name: Optional[str] = None


class SourceChunk(BaseModel):
    chunk_text: str
    document_name: str
    plan_name: str
    page_number: Optional[int]


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    structured_hits: List[CoveragePolicySummary]
    cache_hit: bool = False
    rag_score_id: Optional[int] = None
    routing_tier: str = "tier_3_rag"
    source_cost: str = "$0.00"


# ── Compare ────────────────────────────────────────────────────────────────────

class DrugComparisonRow(BaseModel):
    plan_id: int
    plan_name: str
    coverage_status: str
    tier: Optional[str]
    requires_prior_auth: bool
    requires_step_therapy: bool
    prior_auth_criteria: List[str]
    step_therapy_drugs: List[str]
    quantity_limit: Optional[str]
    age_restriction: Optional[str]
    notes: Optional[str]
    benefit_side: Optional[str] = "unknown"
    data_completeness: Optional[str] = "low"
    benefit_side_note: Optional[str] = None


class DrugComparisonResponse(BaseModel):
    drug_brand_name: Optional[str]
    drug_generic_name: str
    drug_class: Optional[str]
    comparisons: List[DrugComparisonRow]


class PlanDiffEntry(BaseModel):
    drug_generic_name: str
    field: str
    plan_a_value: Optional[str]
    plan_b_value: Optional[str]


class PlanComparisonResponse(BaseModel):
    plan_a: HealthPlanSummary
    plan_b: HealthPlanSummary
    differences: List[PlanDiffEntry]
    only_in_plan_a: List[str]
    only_in_plan_b: List[str]


# ── Changes ────────────────────────────────────────────────────────────────────

class ChangeLogEntry(BaseModel):
    id: int
    plan_name: str
    drug_generic_name: Optional[str]
    change_type: str
    old_value: Optional[str]
    new_value: Optional[str]
    from_quarter: Optional[str]
    to_quarter: Optional[str]
    detected_at: datetime
