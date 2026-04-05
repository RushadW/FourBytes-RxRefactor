"""
Manifest-driven ingestion of real policy documents.

Place your PDFs in data/raw/ then run:
    python scripts/ingest_real_data.py

The backend must be running at http://localhost:8000 before running this script.
"""
import os
import sys
import time

import httpx

BASE_URL = "http://localhost:8000/api/v1"
TIMEOUT = 300

REAL_DOCUMENTS = [
    {
        "path": "data/raw/florida_blue_adalimumab.pdf",
        "payer": "Florida Blue",
        "plan_name": "Florida Blue Commercial",
        "drug": "adalimumab",
        "benefit_side": "medical",
        "doc_type": "clinical_policy",
        "plan_type": "Commercial",
        "effective_date": "2026-04-01",
        "quarter": "Q2 2026",
    },
    {
        "path": "data/raw/cigna_dqm005_adalimumab.pdf",
        "payer": "Cigna",
        "plan_name": "Cigna Commercial",
        "drug": "adalimumab",
        "benefit_side": "pharmacy",
        "doc_type": "dqm_policy",
        "plan_type": "Commercial",
        "effective_date": "2025-11-01",
        "quarter": "Q4 2025",
    },
    {
        "path": "data/raw/mypriority_formulary.pdf",
        "payer": "MyPriority",
        "plan_name": "MyPriority Individual 2026",
        "drug": "adalimumab",
        "benefit_side": "pharmacy",
        "doc_type": "formulary_book",
        "plan_type": "Commercial",
        "effective_date": "2026-01-01",
        "quarter": "Q1 2026",
    },
]


def upload_and_process(doc_config: dict) -> None:
    path = doc_config["path"]
    if not os.path.exists(path):
        print(f"  SKIP — file not found: {path}")
        return

    filename = os.path.basename(path)
    print(f"\n--- {doc_config['plan_name']} ({doc_config['doc_type']}) ---")

    # Upload
    with open(path, "rb") as f:
        file_bytes = f.read()

    files = {"file": (filename, file_bytes, "application/pdf")}
    data = {
        "plan_name": doc_config["plan_name"],
        "payer_name": doc_config["payer"],
        "plan_type": doc_config.get("plan_type", "Commercial"),
        "effective_date": doc_config.get("effective_date", ""),
        "quarter": doc_config.get("quarter", ""),
        "doc_type": doc_config["doc_type"],
        "drug": doc_config["drug"],
        "benefit_side": doc_config["benefit_side"],
    }

    try:
        r = httpx.post(f"{BASE_URL}/ingest/upload", files=files, data=data, timeout=TIMEOUT)
        r.raise_for_status()
        upload_resp = r.json()
        doc_id = upload_resp["document_id"]
        status = upload_resp["status"]
        print(f"  Uploaded → doc_id={doc_id}, status={status}")

        if status == "complete":
            print("  Already processed (duplicate). Skipping.")
            return

        # Process
        print(f"  Processing with Claude (doc_id={doc_id})... this may take 30-90s")
        r2 = httpx.post(f"{BASE_URL}/ingest/process/{doc_id}", timeout=TIMEOUT)
        r2.raise_for_status()
        result = r2.json()

        if result["status"] in ("complete", "low_quality"):
            print(f"  Done — status={result['status']}, "
                  f"drugs={result['drugs_extracted']}, "
                  f"policies={result['policies_created']}, "
                  f"changes={result['changes_detected']}")
            if result["status"] == "low_quality":
                print("  ⚠ Low quality score — review extraction in MLOps dashboard")
        else:
            print(f"  ERROR — {result.get('error', 'unknown error')}")

    except httpx.HTTPStatusError as e:
        print(f"  HTTP error: {e.response.status_code} — {e.response.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")


def main():
    print("AntonRx — Real Data Ingestion")
    print(f"Backend: {BASE_URL}")

    # Health check
    try:
        r = httpx.get(f"{BASE_URL}/policies/plans", timeout=10)
        r.raise_for_status()
        plans = r.json()
        print(f"Backend reachable. {len(plans)} plans currently loaded.\n")
    except Exception as e:
        print(f"ERROR: Cannot reach backend at {BASE_URL}")
        print(f"  {e}")
        print("Start the backend first: uvicorn backend.main:app --reload --port 8000")
        sys.exit(1)

    for doc_config in REAL_DOCUMENTS:
        upload_and_process(doc_config)
        time.sleep(1)  # brief pause between uploads

    print("\n\nIngestion complete.")
    print("Run verification:")
    print("  python -c \"")
    print("  import sqlite3; conn = sqlite3.connect('antonrx.db')")
    print("  print(conn.execute('SELECT indication_code, required, agents FROM step_therapy_by_indication WHERE indication_code=\\\"RA\\\" LIMIT 1').fetchall())")
    print("  \"")


if __name__ == "__main__":
    main()
