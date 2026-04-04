import httpx
from typing import Optional, List, Dict, Any

BASE_URL = "http://localhost:8000/api/v1"
TIMEOUT = 300  # seconds — extraction can take a while


def _get(path: str, params: dict = None) -> Any:
    r = httpx.get(f"{BASE_URL}{path}", params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _post(path: str, json: dict = None, files=None, data=None) -> Any:
    r = httpx.post(f"{BASE_URL}{path}", json=json, files=files,
                   data=data, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _delete(path: str) -> Any:
    r = httpx.delete(f"{BASE_URL}{path}", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


# Plans & Documents
def list_plans() -> List[Dict]:
    return _get("/policies/plans")


def list_documents(plan_id: int = None, status: str = None) -> List[Dict]:
    params = {}
    if plan_id:
        params["plan_id"] = plan_id
    if status:
        params["status"] = status
    return _get("/policies/documents", params=params)


def list_drugs() -> List[Dict]:
    return _get("/policies/drugs")


def delete_document(document_id: int) -> Dict:
    return _delete(f"/policies/documents/{document_id}")


# Ingestion
def upload_document(file_bytes: bytes, filename: str, plan_name: str,
                    payer_name: str, plan_type: str = None,
                    effective_date: str = None, quarter: str = None) -> Dict:
    files = {"file": (filename, file_bytes, "application/pdf")}
    data = {"plan_name": plan_name, "payer_name": payer_name}
    if plan_type:
        data["plan_type"] = plan_type
    if effective_date:
        data["effective_date"] = effective_date
    if quarter:
        data["quarter"] = quarter
    return _post("/ingest/upload", files=files, data=data)


def process_document(document_id: int) -> Dict:
    return _post(f"/ingest/process/{document_id}")


def get_ingest_status(document_id: int) -> Dict:
    return _get(f"/ingest/status/{document_id}")


# Query
def ask(question: str, plan_ids: List[int] = None,
        drug_name: str = None) -> Dict:
    payload = {"question": question}
    if plan_ids:
        payload["plan_ids"] = plan_ids
    if drug_name:
        payload["drug_name"] = drug_name
    return _post("/query/ask", json=payload)


def get_coverage(drug_name: str, plan_ids: List[int] = None) -> List[Dict]:
    params = {"drug_name": drug_name}
    if plan_ids:
        params["plan_ids"] = ",".join(str(p) for p in plan_ids)
    return _get("/query/coverage", params=params)


def get_all_coverage(plan_ids: List[int] = None) -> List[Dict]:
    params = {}
    if plan_ids:
        params["plan_ids"] = ",".join(str(p) for p in plan_ids)
    return _get("/query/all_coverage", params=params)


# Compare
def compare_drug(drug_name: str, plan_ids: List[int] = None) -> Dict:
    params = {}
    if plan_ids:
        params["plan_ids"] = ",".join(str(p) for p in plan_ids)
    return _get(f"/compare/drug/{drug_name}", params=params)


def compare_plans(plan_id_a: int, plan_id_b: int) -> Dict:
    return _get("/compare/plans", params={"plan_id_a": plan_id_a,
                                          "plan_id_b": plan_id_b})


def get_changes(plan_id: int = None) -> List[Dict]:
    params = {}
    if plan_id:
        params["plan_id"] = plan_id
    return _get("/compare/changes", params=params)
