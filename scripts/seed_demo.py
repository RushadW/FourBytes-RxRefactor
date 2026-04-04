"""
Seed script: loads the three demo policy documents via the API.
Run AFTER starting the backend: uvicorn backend.main:app --reload
Usage: python scripts/seed_demo.py
"""
import sys
import os
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api/v1"
TIMEOUT = 300

DEMO_DOCS = [
    {
        "file_path": "demo_data/aetna_biologics_policy_q1_2025.txt",
        "plan_name": "Aetna Commercial 2025",
        "payer_name": "Aetna",
        "plan_type": "Commercial",
        "effective_date": "2025-01-01",
        "quarter": "Q1 2025",
    },
    {
        "file_path": "demo_data/cigna_specialty_policy_q1_2025.txt",
        "plan_name": "Cigna Commercial PPO 2025",
        "payer_name": "Cigna",
        "plan_type": "Commercial",
        "effective_date": "2025-01-01",
        "quarter": "Q1 2025",
    },
    {
        "file_path": "demo_data/bcbs_drug_policy_q2_2025.txt",
        "plan_name": "BCBS Illinois Commercial 2025",
        "payer_name": "Blue Cross Blue Shield of Illinois",
        "plan_type": "Commercial",
        "effective_date": "2025-04-01",
        "quarter": "Q2 2025",
    },
]


def seed():
    print("Seeding demo data...")
    client = httpx.Client(timeout=TIMEOUT)

    for doc_info in DEMO_DOCS:
        file_path = doc_info["file_path"]
        if not os.path.exists(file_path):
            print(f"  SKIP: {file_path} not found")
            continue

        print(f"\nProcessing: {file_path}")

        # Upload
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f, "text/plain")}
            data = {
                "plan_name": doc_info["plan_name"],
                "payer_name": doc_info["payer_name"],
                "plan_type": doc_info["plan_type"],
                "effective_date": doc_info["effective_date"],
                "quarter": doc_info["quarter"],
            }
            resp = client.post(f"{BASE_URL}/ingest/upload", files=files, data=data)
            resp.raise_for_status()
            upload = resp.json()

        doc_id = upload["document_id"]
        status = upload["status"]
        print(f"  Uploaded → doc_id={doc_id}, status={status}")

        if status == "complete":
            print(f"  Already processed (duplicate hash). Skipping.")
            continue

        # Process
        print(f"  Processing with Claude AI... (may take 30-90 seconds)")
        resp = client.post(f"{BASE_URL}/ingest/process/{doc_id}")
        resp.raise_for_status()
        result = resp.json()

        if result["status"] == "complete":
            print(
                f"  ✓ Done: {result['drugs_extracted']} drugs, "
                f"{result['policies_created']} policies, "
                f"{result['changes_detected']} changes"
            )
        else:
            print(f"  ✗ Failed: {result.get('error')}")

    print("\nSeeding complete!")
    client.close()


if __name__ == "__main__":
    seed()
