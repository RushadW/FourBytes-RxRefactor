# AntonRx — Medical Benefit Drug Policy Tracker

AI-powered system to ingest, extract, compare, and query medical benefit drug policies across health plans — with full MLOps observability built in.

---

## Quick Start

### 1. Create a virtual environment (recommended)
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API key
```bash
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY or GEMINI_API_KEY (see Free Deployment below)
```

### 4. Initialize and migrate the database
```bash
python scripts/init_db.py      # creates all tables from ORM
python scripts/migrate_v2.py   # adds v2 columns, new tables, seeds v2.0 prompts
```

### 5. Start the application

**Windows (one command):**
```
start.bat
```
`start.bat` auto-detects the `.venv` folder and uses it; falls back to system Python if not found.

**Manual (two terminals):**
```bash
# Terminal 1 — Backend + UI (port 8000)
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Streamlit (port 8501, optional)
streamlit run frontend/app.py --server.port 8501 --server.headless true
```

### 6. Load demo data
```bash
python scripts/seed_demo.py
```

### 7. Open the UI
| Interface | URL | Notes |
|---|---|---|
| **Main UI** (HTML mockup) | http://localhost:8000 | Served by FastAPI — full featured |
| **Streamlit UI** | http://localhost:8501 | Alternative interface |
| **API Docs** | http://localhost:8000/docs | Swagger / OpenAPI |

---

## Core Features

| Feature | Detail |
|---|---|
| **Document Upload** | PDF upload with `doc_type` (clinical_policy / dqm_policy / formulary_book), drug hint, and benefit side context |
| **AI Extraction** | Prompt Registry v2.0; extracts indication-specific step therapy (8 indications), quantity limits, source page + text evidence per field |
| **Three-Tier Query Router** | Tier 1 — structured DB ($0.00, no LLM) → Tier 2 — Claude synthesis → Tier 3 — full RAG with ChromaDB |
| **Benefit Side** | `medical / pharmacy / both / unknown` on every coverage policy; surfaced in all query, compare, and grid UIs |
| **Data Completeness** | `high / medium / low` badge per policy; shown in compare headers and coverage grid |
| **Coverage Grid** | Drug × Plan matrix with colour-coded C / R / N / ? cells; filterable by drug, status, benefit side, and PA requirement |
| **Ask AI** | Natural language Q&A; every response shows routing tier label, cost badge, and cache-hit indicator |
| **Semantic Cache** | SHA256-keyed 7-day cache; invalidated on new ingest; cache hits returned at $0.00 |
| **Compare** | Drug across plans (benefit side first column, completeness badge); two-plan field-level diff with benefit side highlight |
| **Change Tracker** | Field-level change log across quarters with old → new values; filterable by plan and change type |
| **Formulary Book Support** | Large formulary books compressed to drug-relevant lines before extraction (prevents token bloat) |
| **Analyst Corrections** | Review and apply AI extraction corrections from the MLOps dashboard |

---

## MLOps Components

| # | Component | What it does |
|---|---|---|
| ① | **Prompt Registry** | Versioned prompts with `draft → staging → production → archived` lifecycle. Loaded at call time — no hardcoded prompts. Current production: `extraction_system v2.0`, `extraction_user v2.0`. |
| ② | **LLM Observability** | `tracked_call()` wraps every API call. Logs `input_tokens`, `output_tokens`, `latency_ms`, `cost_usd` to `llm_call_log`. Cost computed in-process at $3/M in + $15/M out (Sonnet). |
| ③ | **Extraction Quality Gate** | Scores each extraction: schema completeness ≥ 0.5 AND required fields pass rate ≥ 0.8 → `complete`, else `low_quality`. Anomaly flags for PA-required-but-no-criteria. |
| ④ | **RAG Quality Scoring** | Scores every Tier 2/3 response: Jaccard context relevance + groundedness (plan names in answer). `rag_score_id` returned in every `AskResponse` for analyst rating. |
| ⑤ | **Data Drift Detection** | PA rate shift >20% → warning; coverage distribution shift >25% → warning; extraction volume drop >30% → critical; new drug class → info. Runs on every ingest. |
| ⑥ | **Human-in-the-Loop** | Analysts submit field corrections via UI. Apply endpoint writes corrected values directly to `coverage_policies`. |
| ⑦ | **Semantic Query Cache** | Key: `SHA256(question.lower() + sorted_plan_ids)[:32]`. TTL 7 days. Invalidated on new document ingest for affected plan. |
| ⑧ | **Re-extraction Jobs** | Queue of documents to re-extract — triggered by prompt promotion, low quality score, model change, or manually. New prompt loaded at run time. |
| ⑨ | **Embedding Versioning** | Tracks active embedding model (`all-MiniLM-L6-v2`, 384-dim). New active model auto-queues re-embed jobs to prevent mixing incompatible vector spaces. |
| ⑩ | **A/B Prompt Testing** | Run extraction twice on the same document with prompt A vs B. Diff stored. Analyst picks winner → auto-promoted to production. |

---

## Example Queries

- *"Does Florida Blue require step therapy for adalimumab in RA patients?"*
- *"What's the benefit side for Cigna's adalimumab policy?"*
- *"Compare prior auth criteria for adalimumab across all plans"*
- *"What changed in Florida Blue policy from Q1 to Q2 2026?"*
- *"Which plans cover secukinumab without prior authorization?"*
- *"What are the quantity limits for adalimumab on the Cigna pharmacy benefit?"*

---

## Architecture

Five focused diagrams are in `architecture.puml` (render at https://plantuml.com/plantuml):

| Diagram | Focus |
|---|---|
| **1 — System Overview** | Actors, frontend tabs, API layer |
| **2 — Ingestion Pipeline** | PDF → formulary truncation → Claude extraction → ChromaDB + SQLite |
| **3 — Three-Tier Query Router** | Cache → intent → SQL → Tier 1/2/3 branch |
| **4 — MLOps Components** | All 10 MLOps services and their relationships |
| **5 — Storage Layer** | SQLite tables (21+) and ChromaDB collection |

**System flow:**
```
Browser → FastAPI (8000)
  ├─ GET /           → serves mockup/index.html (HTML/JS frontend)
  │
  ├─ Ingest:  pdfplumber → formulary truncation → Claude extraction (v2.0 prompt)
  │           → ChromaDB chunks + SQLite structured write
  │           → Hook A (extraction quality) · Hook B (drift) · Hook C (cache invalidate)
  │
  ├─ Query:   semantic cache → intent extraction → SQL pre-filter
  │           → route_query() → Tier 1 (DB prose, $0.00)
  │                           → Tier 2 (Claude synthesis, no vector search)
  │                           → Tier 3 (ChromaDB top-5 + Claude generation)
  │
  └─ MLOps:   Prompt Registry · LLM Observability · Quality Scores
              Drift Events · Corrections · Cache · Re-extraction · A/B Tests

Streamlit (8501) → same FastAPI backend (alternative interface)
```

---

## Frontend Structure

Two parallel frontends, both backed by the same FastAPI API:

### HTML/JS Frontend (`mockup/`)
Served by FastAPI at `http://localhost:8000/`. Uses native `fetch()` to call `/api/v1/*` directly. No extra server needed.

```
mockup/
  index.html       ← full app (CSS + JS in one file)
  mock_server.py   ← standalone mock server for UI development (no backend needed)
```

Run the mock server for frontend-only development:
```bash
python mockup/mock_server.py
# Open http://localhost:8000 — all screens work with realistic stub data
```

### Streamlit Frontend (`frontend/`)
Modular tab structure — each tab is its own file:

```
frontend/
  app.py              ← entry point (sidebar + tab layout only, ~70 lines)
  tabs/
    upload.py         ← Upload & Documents queue
    ask.py            ← Ask AI + structured hits + sources
    coverage.py       ← Coverage Grid + filters + export
    compare.py        ← Drug compare + two-plan diff
    changes.py        ← Change Tracker + export
    mlops.py          ← All 8 MLOps sections
  utils/
    api_client.py     ← HTTP client wrapper for FastAPI
```

---

## Database Schema

**21+ tables across two layers:**

### Core tables
| Table | Key v2 additions |
|---|---|
| `health_plans` | — |
| `policy_documents` | `doc_type`, `drug_hint`, `benefit_side_hint` ← NEW |
| `drugs` | — |
| `coverage_policies` | `benefit_side`, `data_completeness`, `benefit_side_note`, `extraction_prompt_version_id` ← NEW |
| `prior_auth_criteria` | — |
| `step_therapy_requirements` | — |
| `step_therapy_by_indication` | **NEW** — `indication_code` (RA/AS/CD/UC/PS/PsA/HS/Uveitis), `agents` (JSON), `exceptions` (JSON), `source_page`, `source_text` |
| `quantity_limits` | **NEW** — `retail_28_day`, `home_delivery_84_day`, `weight_based`, `indication_specific`, `source_page`, `source_text` |
| `policy_change_log` | — |
| `document_chunks` | — |

### MLOps tables
`prompt_versions` · `llm_call_log` · `extraction_quality_scores` · `rag_quality_scores` · `drift_events` · `analyst_corrections` · `query_cache` · `reextraction_jobs` · `embedding_model_versions` · `ab_test_runs`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI + Python 3.13 |
| **AI — default** | Claude claude-sonnet-4-6 (Anthropic SDK) |
| **AI — free tier** | Gemini 2.5 Pro via Google AI Studio (see below) |
| **Vector DB** | ChromaDB · `sentence-transformers/all-MiniLM-L6-v2` · 384-dim cosine |
| **SQL DB** | SQLite via SQLAlchemy ORM |
| **PDF Parsing** | pdfplumber |
| **Streamlit UI** | Streamlit 1.43+ |
| **HTML/JS UI** | Vanilla JS + Fetch API (no framework, no build step) |
| **Virtual Env** | `.venv/` (Python 3.13, created with `python -m venv .venv`) |

---

## Free Deployment

Run the full stack for **$0/month** by swapping two things:

### 1. Replace Anthropic with Gemini (free API)

Get a free key at https://aistudio.google.com/app/apikey (no credit card).

In `.env`:
```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-pro-exp-03-25   # or gemini-2.0-flash-exp for higher volume
```

| Model | Free limit | Best for |
|---|---|---|
| `gemini-2.5-pro-exp-03-25` | 25 req/day | Demo, low volume |
| `gemini-2.0-flash-exp` | 1M tokens/day | Production |

### 2. Host on Oracle Cloud Always Free

- **4 ARM cores + 24 GB RAM** — runs FastAPI, Streamlit, and sentence-transformers comfortably
- **200 GB persistent block storage** — SQLite and ChromaDB files survive restarts
- **Public IP** — exposed via nginx; free HTTPS via Let's Encrypt
- **Free subdomain** — via [DuckDNS](https://www.duckdns.org/) (e.g. `yourname.duckdns.org`)

Deploy with Docker Compose:
```bash
docker compose up -d
```

See the deployment plan in `.claude/plans/` for full step-by-step Oracle setup.

---

## Migration from v1

If you have an existing v1 database, run the migration script once:

```bash
python scripts/migrate_v2.py
```

This script is **idempotent** — safe to re-run. It:
- Adds `benefit_side`, `data_completeness`, `benefit_side_note` columns to `coverage_policies`
- Adds `doc_type`, `drug_hint`, `benefit_side_hint` columns to `policy_documents`
- Creates `step_therapy_by_indication` and `quantity_limits` tables
- Archives the v1.0 extraction prompts and seeds v2.0 as production

Verify after running:
```bash
python - <<'EOF'
import sqlite3
conn = sqlite3.connect('data/antonrx.db')
cols = [r[1] for r in conn.execute('PRAGMA table_info(coverage_policies)')]
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("New columns:", all(c in cols for c in ['benefit_side','data_completeness','benefit_side_note']))
print("New tables:", 'quantity_limits' in tables and 'step_therapy_by_indication' in tables)
EOF
```
Both lines should print `True`.

---

## Ingesting Real Documents

Use the manifest-driven script to ingest real PDFs:

```bash
# Drop PDFs into data/raw/ first, then:
python scripts/ingest_real_data.py
```

The script calls `/ingest/upload` then `/ingest/process/{id}` for each document and reports `drugs_extracted`, `policies_created`, `changes_detected` per file.
