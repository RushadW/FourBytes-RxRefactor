"""
AntonRx Mock Server
-------------------
Serves index.html + returns realistic stub JSON for every /api/v1/* endpoint.
No database, no Anthropic key, no ChromaDB needed.

Usage:
    python mockup/mock_server.py                   # serves mockup/index.html on port 8000
    python mockup/mock_server.py 9000              # custom port
    python mockup/mock_server.py 9000 frontend_html  # serve a different directory
"""

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DIR  = sys.argv[2] if len(sys.argv) > 2 else "mockup"
HERE  = os.path.join(_ROOT, _DIR)
INDEX = os.path.join(HERE, "index.html")

# ── Stub data ──────────────────────────────────────────────────────────────────

PLANS = [
    {"id": 1, "name": "Florida Blue Commercial", "payer_name": "Florida Blue",
     "plan_type": "commercial", "region": "FL", "created_at": "2026-01-01T00:00:00"},
    {"id": 2, "name": "Cigna Commercial",        "payer_name": "Cigna",
     "plan_type": "commercial", "region": "National", "created_at": "2026-01-01T00:00:00"},
    {"id": 3, "name": "MyPriority Individual 2026", "payer_name": "MyPriority",
     "plan_type": "individual", "region": "FL", "created_at": "2026-01-01T00:00:00"},
]

DOCUMENTS = [
    {"id": 1, "filename": "florida_blue_adalimumab_q1.pdf", "plan_name": "Florida Blue Commercial",
     "payer_name": "Florida Blue", "doc_type": "clinical_policy", "drug_hint": "adalimumab",
     "benefit_side_hint": "medical", "status": "complete", "drugs_extracted": 4,
     "uploaded_at": "2026-03-15T10:22:00", "processed_at": "2026-03-15T10:23:44"},
    {"id": 2, "filename": "cigna_dqm005_adalimumab.pdf",    "plan_name": "Cigna Commercial",
     "payer_name": "Cigna", "doc_type": "dqm_policy", "drug_hint": "adalimumab",
     "benefit_side_hint": "pharmacy", "status": "complete", "drugs_extracted": 6,
     "uploaded_at": "2026-03-16T09:10:00", "processed_at": "2026-03-16T09:12:15"},
    {"id": 3, "filename": "mypriority_formulary_2026.pdf",  "plan_name": "MyPriority Individual 2026",
     "payer_name": "MyPriority", "doc_type": "formulary_book", "drug_hint": "adalimumab",
     "benefit_side_hint": "pharmacy", "status": "low_quality", "drugs_extracted": 2,
     "uploaded_at": "2026-03-17T14:05:00", "processed_at": "2026-03-17T14:08:30"},
]

COVERAGE = [
    # Florida Blue
    {"plan_id": 1, "plan_name": "Florida Blue Commercial", "payer_name": "Florida Blue",
     "drug_generic_name": "adalimumab", "drug_brand_name": "Humira", "drug_class": "TNF Inhibitor",
     "coverage_status": "covered_with_restrictions", "benefit_side": "medical",
     "requires_prior_auth": True, "requires_step_therapy": True,
     "tier": "Specialty", "quantity_limit": "2 pens/28 days",
     "data_completeness": "high", "quarter": "Q1 2026"},
    {"plan_id": 1, "plan_name": "Florida Blue Commercial", "payer_name": "Florida Blue",
     "drug_generic_name": "secukinumab", "drug_brand_name": "Cosentyx", "drug_class": "IL-17A Inhibitor",
     "coverage_status": "covered_with_restrictions", "benefit_side": "medical",
     "requires_prior_auth": True, "requires_step_therapy": True,
     "tier": "Specialty", "quantity_limit": "2 syringes/28 days",
     "data_completeness": "medium", "quarter": "Q1 2026"},
    {"plan_id": 1, "plan_name": "Florida Blue Commercial", "payer_name": "Florida Blue",
     "drug_generic_name": "ustekinumab", "drug_brand_name": "Stelara", "drug_class": "IL-12/23 Inhibitor",
     "coverage_status": "covered", "benefit_side": "medical",
     "requires_prior_auth": True, "requires_step_therapy": False,
     "tier": "Specialty", "quantity_limit": None,
     "data_completeness": "high", "quarter": "Q1 2026"},
    # Cigna
    {"plan_id": 2, "plan_name": "Cigna Commercial", "payer_name": "Cigna",
     "drug_generic_name": "adalimumab", "drug_brand_name": "Humira", "drug_class": "TNF Inhibitor",
     "coverage_status": "covered_with_restrictions", "benefit_side": "pharmacy",
     "requires_prior_auth": True, "requires_step_therapy": False,
     "tier": "3", "quantity_limit": "1 carton/30 days",
     "data_completeness": "high", "quarter": "Q1 2026"},
    {"plan_id": 2, "plan_name": "Cigna Commercial", "payer_name": "Cigna",
     "drug_generic_name": "secukinumab", "drug_brand_name": "Cosentyx", "drug_class": "IL-17A Inhibitor",
     "coverage_status": "covered", "benefit_side": "pharmacy",
     "requires_prior_auth": False, "requires_step_therapy": False,
     "tier": "2", "quantity_limit": None,
     "data_completeness": "medium", "quarter": "Q1 2026"},
    {"plan_id": 2, "plan_name": "Cigna Commercial", "payer_name": "Cigna",
     "drug_generic_name": "ixekizumab", "drug_brand_name": "Taltz", "drug_class": "IL-17A Inhibitor",
     "coverage_status": "not_covered", "benefit_side": "pharmacy",
     "requires_prior_auth": False, "requires_step_therapy": False,
     "tier": None, "quantity_limit": None,
     "data_completeness": "low", "quarter": "Q1 2026"},
    # MyPriority
    {"plan_id": 3, "plan_name": "MyPriority Individual 2026", "payer_name": "MyPriority",
     "drug_generic_name": "adalimumab", "drug_brand_name": "Humira", "drug_class": "TNF Inhibitor",
     "coverage_status": "covered_with_restrictions", "benefit_side": "pharmacy",
     "requires_prior_auth": True, "requires_step_therapy": True,
     "tier": "4", "quantity_limit": "2 pens/28 days",
     "data_completeness": "low", "quarter": "Q1 2026"},
    {"plan_id": 3, "plan_name": "MyPriority Individual 2026", "payer_name": "MyPriority",
     "drug_generic_name": "secukinumab", "drug_brand_name": "Cosentyx", "drug_class": "IL-17A Inhibitor",
     "coverage_status": "not_covered", "benefit_side": "unknown",
     "requires_prior_auth": False, "requires_step_therapy": False,
     "tier": None, "quantity_limit": None,
     "data_completeness": "low", "quarter": "Q1 2026"},
]

CHANGES = [
    {"id": 1, "plan_name": "Florida Blue Commercial", "drug_generic_name": "adalimumab",
     "change_type": "step_therapy_change",
     "old_value": "Not required", "new_value": "Required — methotrexate, leflunomide",
     "from_quarter": "Q4 2025", "to_quarter": "Q1 2026", "detected_at": "2026-03-15T10:24:00"},
    {"id": 2, "plan_name": "Cigna Commercial", "drug_generic_name": "ixekizumab",
     "change_type": "coverage_status_change",
     "old_value": "covered_with_restrictions", "new_value": "not_covered",
     "from_quarter": "Q4 2025", "to_quarter": "Q1 2026", "detected_at": "2026-03-16T09:13:00"},
    {"id": 3, "plan_name": "Florida Blue Commercial", "drug_generic_name": "ustekinumab",
     "change_type": "prior_auth_change",
     "old_value": "Not required", "new_value": "Required",
     "from_quarter": "Q4 2025", "to_quarter": "Q1 2026", "detected_at": "2026-03-15T10:24:30"},
]

DRIFT_EVENTS = [
    {"id": 1, "drift_type": "coverage_change_rate_spike", "severity": "warning",
     "description": "Florida Blue: 3 coverage fields changed in 24h (above 1.0 threshold)",
     "acknowledged": False, "detected_at": "2026-03-15T11:00:00"},
    {"id": 2, "drift_type": "extraction_quality_drop", "severity": "critical",
     "description": "MyPriority formulary: schema completeness dropped to 34% (below 50% threshold)",
     "acknowledged": False, "detected_at": "2026-03-17T14:09:00"},
    {"id": 3, "drift_type": "new_drug_detected", "severity": "info",
     "description": "Cigna: ixekizumab (Taltz) not seen in previous quarter",
     "acknowledged": True, "detected_at": "2026-03-16T09:14:00"},
]

PROMPTS = [
    {"id": 1, "prompt_name": "extraction_system", "version_tag": "v2.0", "status": "production",
     "promoted_at": "2026-03-01T00:00:00", "created_at": "2026-03-01T00:00:00",
     "template": "You are a precise medical policy data extraction engine..."},
    {"id": 2, "prompt_name": "extraction_user",   "version_tag": "v2.0", "status": "production",
     "promoted_at": "2026-03-01T00:00:00", "created_at": "2026-03-01T00:00:00",
     "template": "DOCUMENT CONTEXT:\nPayer: {payer}\nDrug: {drug}..."},
    {"id": 3, "prompt_name": "extraction_system", "version_tag": "v1.0", "status": "archived",
     "promoted_at": None, "created_at": "2025-11-01T00:00:00",
     "template": "You are a helpful medical policy assistant..."},
    {"id": 4, "prompt_name": "rag_system",        "version_tag": "v1.1", "status": "staging",
     "promoted_at": None, "created_at": "2026-02-15T00:00:00",
     "template": "You are an expert medical benefit analyst..."},
]

EXTRACTION_QUALITY = [
    {"id": 1, "document_id": 1, "schema_completeness_avg": 0.91, "required_fields_pass": 0.96,
     "drugs_extracted": 4, "anomaly_count": 0, "created_at": "2026-03-15T10:23:44"},
    {"id": 2, "document_id": 2, "schema_completeness_avg": 0.87, "required_fields_pass": 0.92,
     "drugs_extracted": 6, "anomaly_count": 1, "created_at": "2026-03-16T09:12:15"},
    {"id": 3, "document_id": 3, "schema_completeness_avg": 0.34, "required_fields_pass": 0.48,
     "drugs_extracted": 2, "anomaly_count": 3, "created_at": "2026-03-17T14:08:30"},
]

CORRECTIONS = [
    {"id": 1, "coverage_policy_id": 7, "field_name": "step_therapy_required",
     "original_value": "false", "corrected_value": "true",
     "analyst_note": "Page 14 clearly states step therapy required for TNF-naive patients",
     "applied": False, "created_at": "2026-03-18T08:30:00"},
    {"id": 2, "coverage_policy_id": 3, "field_name": "benefit_side",
     "original_value": "unknown", "corrected_value": "medical",
     "analyst_note": "J-code billing confirmed — medical benefit",
     "applied": False, "created_at": "2026-03-18T09:15:00"},
]

CACHE_STATS = {
    "active_entries": 42,
    "total_cache_hits": 187,
    "oldest_entry_days": 14,
    "avg_ttl_hours": 72,
}

OBS_SUMMARY = {
    "total_calls": 38,
    "total_input_tokens": 284000,
    "total_output_tokens": 19400,
    "total_cost_usd": 0.0312,
    "avg_latency_ms": 1840,
    "by_call_type": {
        "extraction":    {"calls": 21, "cost": 0.0278, "avg_latency_ms": 2210},
        "extraction_retry": {"calls": 3, "cost": 0.0022, "avg_latency_ms": 2100},
        "rag_generation": {"calls": 9, "cost": 0.0012, "avg_latency_ms": 980},
        "intent":        {"calls": 5, "cost": 0.0000, "avg_latency_ms": 420},
    },
}

# ── ASK AI canned answers ─────────────────────────────────────────────────────

CANNED = [
    {
        "keywords": ["step therapy", "adalimumab", "florida blue"],
        "answer": "**Florida Blue requires step therapy for adalimumab in RA patients.**\n\nMembers must trial and fail at least one of:\n- Methotrexate (≥3 months at maximally tolerated dose)\n- Leflunomide\n- Hydroxychloroquine + sulfasalazine (combination)\n\nStep therapy is **not required** for AS, CD, UC, or HS indications.\n\n*Source: Florida Blue Clinical Policy CP.PHAR.153, Page 22*",
        "routing_tier": "tier_1_structured",
        "source_cost": "$0.00",
        "structured_hits": [
            {"plan_name": "Florida Blue Commercial", "coverage_status": "covered_with_restrictions",
             "benefit_side": "medical", "requires_prior_auth": True, "requires_step_therapy": True,
             "data_completeness": "high"},
        ],
        "sources": [],
    },
    {
        "keywords": ["benefit side", "cigna", "adalimumab"],
        "answer": "**Cigna covers adalimumab under the pharmacy benefit.**\n\nFor Cigna Commercial plans, adalimumab (Humira and biosimilars) is processed through the pharmacy benefit — members obtain it through a specialty pharmacy, not administered in office.\n\nThis contrasts with Florida Blue, which covers it under the **medical benefit** (J-code billing).",
        "routing_tier": "tier_1_structured",
        "source_cost": "$0.00",
        "structured_hits": [
            {"plan_name": "Cigna Commercial", "coverage_status": "covered_with_restrictions",
             "benefit_side": "pharmacy", "requires_prior_auth": True, "requires_step_therapy": False,
             "data_completeness": "high"},
        ],
        "sources": [],
    },
    {
        "keywords": ["prior auth", "compare", "adalimumab"],
        "answer": "**Prior authorization requirements for adalimumab across plans:**\n\n- **Florida Blue Commercial** ✓ PA Required · Medical benefit · Step therapy required (RA)\n- **Cigna Commercial** ✓ PA Required · Pharmacy benefit · No step therapy\n- **MyPriority Individual 2026** ✓ PA Required · Pharmacy benefit · Step therapy required\n\nAll three plans require prior authorization. The key differences are benefit side (medical vs pharmacy) and step therapy requirements.",
        "routing_tier": "tier_2_synthesis",
        "source_cost": "$0.0003",
        "structured_hits": COVERAGE[:4],
        "sources": [],
    },
]

DEFAULT_ANSWER = {
    "answer": "Based on the policy documents in the system, I can see coverage data for adalimumab, secukinumab, ustekinumab, and ixekizumab across three plans.\n\nFor a more specific answer, try asking about:\n- **Step therapy** requirements for a specific drug and indication\n- **Benefit side** (medical vs pharmacy) for a plan\n- **Prior auth criteria** across all plans\n- **Changes** between quarters",
    "routing_tier": "tier_3_rag",
    "source_cost": "$0.0008",
    "cache_hit": False,
    "structured_hits": COVERAGE[:3],
    "sources": [
        {"document_name": "florida_blue_adalimumab_q1.pdf", "plan_name": "Florida Blue Commercial",
         "page_number": 3, "chunk_text": "Adalimumab (Humira) and biosimilars require prior authorization under the medical benefit. Members must demonstrate inadequate response to conventional therapy before approval is granted."},
        {"document_name": "cigna_dqm005_adalimumab.pdf", "plan_name": "Cigna Commercial",
         "page_number": 1, "chunk_text": "Drug Quantity Management policy for adalimumab products dispensed through the pharmacy benefit channel. Authorization required for initial and renewal requests."},
    ],
}

# ── Route table ───────────────────────────────────────────────────────────────

def route(method, path, qs, body):
    p = path.rstrip("/")

    # Plans
    if method == "GET" and p == "/api/v1/policies/plans":
        return 200, PLANS

    # Documents
    if method == "GET" and p == "/api/v1/policies/documents":
        return 200, DOCUMENTS

    # All coverage
    if method == "GET" and p == "/api/v1/query/all_coverage":
        return 200, COVERAGE

    # Ask AI
    if method == "POST" and p == "/api/v1/query/ask":
        question = (body.get("question") or "").lower()
        for canned in CANNED:
            if all(kw in question for kw in canned["keywords"]):
                return 200, {**canned, "cache_hit": False, "question": body.get("question")}
        return 200, {**DEFAULT_ANSWER, "question": body.get("question")}

    # Compare drug across plans
    if method == "GET" and p.startswith("/api/v1/compare/drug/"):
        drug_name = p.split("/api/v1/compare/drug/", 1)[1]
        drug_lower = drug_name.lower()
        rows = [r for r in COVERAGE if drug_lower in (r["drug_generic_name"] or "").lower()
                or drug_lower in (r["drug_brand_name"] or "").lower()]
        brand = rows[0]["drug_brand_name"] if rows else drug_name
        return 200, {
            "drug_generic_name": drug_lower,
            "drug_brand_name": brand,
            "drug_class": rows[0]["drug_class"] if rows else None,
            "comparisons": [
                {**r,
                 "prior_auth_criteria": ["Diagnosis of RA, AS, CD, UC, PS, PsA, or HS",
                                         "Inadequate response to conventional therapy",
                                         "Prescribed by or in consultation with a specialist"],
                 "step_therapy_drugs": ["methotrexate", "leflunomide", "hydroxychloroquine"] if r.get("requires_step_therapy") else [],
                 } for r in rows
            ],
        }

    # Compare two plans
    if method == "GET" and p == "/api/v1/compare/plans":
        id_a = int(qs.get("plan_id_a", [1])[0])
        id_b = int(qs.get("plan_id_b", [2])[0])
        plan_a = next((pl for pl in PLANS if pl["id"] == id_a), PLANS[0])
        plan_b = next((pl for pl in PLANS if pl["id"] == id_b), PLANS[1])
        rows_a = {r["drug_generic_name"]: r for r in COVERAGE if r["plan_id"] == id_a}
        rows_b = {r["drug_generic_name"]: r for r in COVERAGE if r["plan_id"] == id_b}
        diffs = []
        for drug in set(rows_a) & set(rows_b):
            for field in ["coverage_status", "benefit_side", "requires_prior_auth", "requires_step_therapy", "tier"]:
                va, vb = str(rows_a[drug].get(field) or ""), str(rows_b[drug].get(field) or "")
                if va != vb:
                    diffs.append({"drug_generic_name": drug, "field": field,
                                  "plan_a_value": va, "plan_b_value": vb})
        return 200, {
            "plan_a": plan_a, "plan_b": plan_b,
            "differences": diffs,
            "only_in_plan_a": list(set(rows_a) - set(rows_b)),
            "only_in_plan_b": list(set(rows_b) - set(rows_a)),
        }

    # Change tracker
    if method == "GET" and p == "/api/v1/compare/changes":
        return 200, CHANGES

    # Extraction quality
    if method == "GET" and p == "/api/v1/mlops/quality/extraction":
        limit = int(qs.get("limit", [10])[0])
        return 200, EXTRACTION_QUALITY[:limit]

    # Observability summary
    if method == "GET" and p == "/api/v1/mlops/observability/summary":
        return 200, OBS_SUMMARY

    # Drift events
    if method == "GET" and p == "/api/v1/mlops/drift/events":
        return 200, DRIFT_EVENTS

    # Acknowledge drift event
    if method == "GET" and "/mlops/drift/events/" in p and p.endswith("/acknowledge"):
        event_id = int(p.split("/")[-2])
        for e in DRIFT_EVENTS:
            if e["id"] == event_id:
                e["acknowledged"] = True
        return 200, {"status": "acknowledged"}

    # Prompts
    if method == "GET" and p == "/api/v1/mlops/prompts":
        return 200, PROMPTS

    if method == "POST" and p == "/api/v1/mlops/prompts":
        new_prompt = {**body, "id": len(PROMPTS) + 1, "created_at": "2026-04-04T00:00:00", "promoted_at": None}
        PROMPTS.append(new_prompt)
        return 201, new_prompt

    # Cache stats
    if method == "GET" and p == "/api/v1/mlops/cache/stats":
        return 200, CACHE_STATS

    # Corrections
    if method == "GET" and p == "/api/v1/mlops/corrections":
        applied_filter = qs.get("applied", [None])[0]
        rows = CORRECTIONS
        if applied_filter == "false":
            rows = [c for c in rows if not c["applied"]]
        elif applied_filter == "true":
            rows = [c for c in rows if c["applied"]]
        limit = int(qs.get("limit", [50])[0])
        return 200, rows[:limit]

    if method == "POST" and "/mlops/corrections/" in p and p.endswith("/apply"):
        corr_id = int(p.split("/")[-2])
        for c in CORRECTIONS:
            if c["id"] == corr_id:
                c["applied"] = True
        return 200, {"status": "applied"}

    # Upload (fake — return a doc id immediately)
    if method == "POST" and p == "/api/v1/ingest/upload":
        new_id = len(DOCUMENTS) + 1
        fake_doc = {
            "document_id": new_id, "filename": f"uploaded_doc_{new_id}.pdf",
            "plan_name": "Demo Plan", "status": "uploaded",
        }
        DOCUMENTS.append({**fake_doc, "payer_name": "Demo", "doc_type": "clinical_policy",
                          "drug_hint": "", "benefit_side_hint": "unknown",
                          "drugs_extracted": 0, "uploaded_at": "2026-04-04T00:00:00", "processed_at": None})
        return 200, fake_doc

    # Process (fake — simulate extraction result after short delay)
    if method == "POST" and p.startswith("/api/v1/ingest/process/"):
        time.sleep(1)  # simulate work
        return 200, {"status": "complete", "drugs_extracted": 3,
                     "schema_completeness_avg": 0.82, "required_fields_pass": 0.90}

    # Health / root (not strictly needed but harmless)
    if p in ("", "/"):
        with open(INDEX, "rb") as f:
            return "html", f.read()

    return 404, {"detail": f"Mock: no stub for {method} {p}"}


# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        try:
            msg = f"  {self.command} {self.path}  ->  {args[1]}"
            sys.stdout.buffer.write((msg + "\n").encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        except Exception:
            pass

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            raw = self.rfile.read(length)
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}

    def _send(self, status, data):
        if status == "html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _handle(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        # Serve index.html for root and non-API paths
        if not parsed.path.startswith("/api/"):
            try:
                with open(INDEX, "rb") as f:
                    self._send("html", f.read())
            except FileNotFoundError:
                self._send(404, {"detail": "index.html not found"})
            return
        body = self._read_body() if self.command == "POST" else {}
        status, data = route(self.command, parsed.path, qs, body)
        self._send(status, data)

    do_GET = _handle
    do_POST = _handle


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), Handler)
    print(f"\n  AntonRx Mock Server")
    print(f"  -------------------")
    print(f"  http://localhost:{PORT}")
    print(f"\n  All API calls return realistic stub data.")
    print(f"  Edit index.html, refresh browser, see changes instantly.")
    print(f"  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
