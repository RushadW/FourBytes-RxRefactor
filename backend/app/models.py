from __future__ import annotations

from pydantic import BaseModel


# ---------- Drug ----------
class Drug(BaseModel):
    id: str
    name: str
    generic_name: str
    therapeutic_area: str
    drug_category: str


# ---------- Policy ----------
class PolicyResponse(BaseModel):
    id: str
    drug_id: str
    drug_name: str
    generic_name: str
    drug_category: str
    therapeutic_area: str
    payer_id: str
    payer_name: str
    policy_title: str
    covered: bool | None = None
    access_status: str = ""
    preferred_count: int = 0
    covered_indications: list[str] = []
    prior_auth: bool | None = None
    prior_auth_details: str = ""
    step_therapy: bool | None = None
    step_therapy_details: str = ""
    site_of_care: list[str] = []
    dosing_limits: str = ""
    coverage_criteria: list[str] = []
    hcpcs_code: str | None = None
    effective_date: str = ""
    last_updated: str = ""
    confidence: str = ""
    version: int
    document_id: str | None = None


# ---------- Version / diff ----------
class PolicyVersion(BaseModel):
    id: str
    policy_id: str
    version: int
    data: dict
    change_summary: str | None
    created_at: str


class FieldChange(BaseModel):
    field: str
    old_value: str | None
    new_value: str | None
    change_type: str  # added, removed, modified


class ChangeSummary(BaseModel):
    policy_id: str
    drug_name: str
    payer_name: str
    from_version: int
    to_version: int
    changes: list[FieldChange]
    summary: str


# ---------- Search / RAG ----------
class SearchResult(BaseModel):
    query: str
    results: list[PolicyResponse]
    rag_answer: str | None = None
    relevant_chunks: list[dict] = []


class AskRequest(BaseModel):
    question: str
    payer_ids: list[str] | None = None
    drug_ids: list[str] | None = None


class AskResponse(BaseModel):
    question: str
    answer: str
    sources: list[dict] = []
    relevant_policies: list[PolicyResponse] = []


# ---------- Comparison ----------
class PayerColumn(BaseModel):
    payer_id: str
    payer_name: str
    policy: PolicyResponse | None = None


class ComparisonResponse(BaseModel):
    drug: Drug
    payers: list[PayerColumn]


# ---------- Matrix (all drugs × all payers) ----------
class MatrixCell(BaseModel):
    policy: PolicyResponse | None = None
    has_data: bool = False

class MatrixPayer(BaseModel):
    payer_id: str
    payer_name: str

class MatrixDrug(BaseModel):
    drug_id: str
    drug_name: str

class MatrixRow(BaseModel):
    drug: MatrixDrug
    cells: dict[str, MatrixCell]  # keyed by payer_id

class MatrixResponse(BaseModel):
    payers: list[MatrixPayer]
    drugs: list[MatrixDrug]
    rows: list[MatrixRow]
    total_policies: int


# ---------- Document ----------
class DocumentResponse(BaseModel):
    id: str
    payer_id: str
    drug_id: str
    source_url: str
    file_path: str
    content_type: str
    fetched_at: str
    version: int


# ---------- Ingest ----------
class IngestRequest(BaseModel):
    payer_id: str
    source_url: str | None = None
    file_path: str | None = None
    content_type: str = "pdf"


class IngestResult(BaseModel):
    status: str
    policies_created: int = 0
    documents_stored: int = 0
    message: str = ""


# ---------- Scraper ----------
class SourceInfo(BaseModel):
    payer_id: str
    payer_name: str
    strategy: str
    index_url: str = ""
    document_type: str = ""
    target_drugs: list[str] = []
    notes: str = ""


class ScrapeResult(BaseModel):
    payer_id: str
    payer_name: str
    documents_fetched: int
    documents_stored: int
    errors: list[str] = []
    file_paths: list[str] = []


class ScrapeAllResult(BaseModel):
    total_fetched: int
    total_stored: int
    per_payer: list[ScrapeResult] = []


# ---------- Notifications ----------
class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    policy_id: str | None = None
    payer_id: str | None = None
    drug_id: str | None = None
    read: bool
    created_at: str


# ---------- Policy Bank ----------
class PolicyBankItem(BaseModel):
    id: str
    drug_id: str
    drug_name: str
    generic_name: str
    drug_category: str
    payer_id: str
    payer_name: str
    policy_title: str
    covered: bool | None = None
    access_status: str = ""
    effective_date: str = ""
    last_updated: str = ""
    version: int
    document_id: str | None = None
    source_url: str = ""
    file_path: str = ""


# ---------- Scrape Log ----------
class ScrapeLogResponse(BaseModel):
    id: str
    run_at: str
    trigger: str
    payers_scraped: int
    documents_fetched: int
    policies_updated: int
    policies_added: int
    errors: list[str] = []
    summary: str = ""
