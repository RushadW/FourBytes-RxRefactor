# Medical Benefit Drug Policy Tracker

AI-powered system to ingest, parse, normalize, and compare medical benefit drug policies across health plans.

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure API key
```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the application
**Windows:**
```
start.bat
```

**Manual (two terminals):**
```bash
# Terminal 1 - Backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 - Frontend
streamlit run frontend/app.py --server.port 8501
```

### 4. Load demo data
```bash
python scripts/seed_demo.py
```

### 5. Open the UI
- **Frontend:** http://localhost:8501
- **API Docs:** http://localhost:8000/docs

---

## Features

| Feature | Description |
|---|---|
| **Document Upload** | Upload PDF or TXT policy documents with plan metadata |
| **AI Extraction** | Claude extracts structured drug/coverage data automatically |
| **Coverage Grid** | Filterable matrix of all drugs × all plans |
| **Ask AI** | Natural language Q&A with RAG over all loaded policies |
| **Plan Comparison** | Side-by-side drug coverage diff between two plans |
| **Change Tracker** | Detect what changed between policy versions |

## Example Queries

- *"Which plans cover adalimumab?"*
- *"What prior auth criteria does Aetna require for semaglutide?"*
- *"Does Cigna require step therapy for dupilumab?"*
- *"What changed in BCBS policy from Q1 to Q2 2025?"*
- *"Which plan has the most permissive coverage for pembrolizumab?"*

## Architecture

See `architecture.puml` for the full system diagram (render at https://plantuml.com/plantuml).

```
Streamlit UI → FastAPI Backend → Claude AI (extraction + RAG)
                              → ChromaDB (vector search)
                              → SQLite (structured queries)
```

## Tech Stack

- **Backend:** FastAPI + Python
- **AI:** Claude claude-sonnet-4-6 (Anthropic SDK)
- **Vector DB:** ChromaDB with sentence-transformers embeddings
- **SQL DB:** SQLite via SQLAlchemy
- **PDF Parsing:** pdfplumber
- **Frontend:** Streamlit
