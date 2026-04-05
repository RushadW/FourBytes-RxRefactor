# AntonRx — AI-Powered Medical Benefit Drug Policy Tracker

> **Innovation Hacks 2.0 · April 2026**

AntonRx is a full-stack AI application that tracks, compares, and analyzes **medical benefit drug policies** across multiple payers (BCBS, Cigna, UnitedHealthcare, and more). It combines structured policy data with a RAG-powered Claude AI assistant to let analysts ask natural-language questions and instantly receive structured comparisons, coverage verdicts, and sourced answers.

---

## Key Features

| Capability | Description |
|---|---|
| **AI-Powered Q&A** | Ask any policy question in natural language. Claude Sonnet 4 generates sourced answers using RAG over 6,000+ document chunks. |
| **Structured Comparison Tables** | Comparison queries automatically render side-by-side tables with all 8 key criteria per payer. |
| **8 Extraction Criteria** | Every policy is structured across: Drug Name (brand + generic), Drug Category, Access Status (preferred count), Covered Indications, Prior Auth Requirements, Step Therapy, Site-of-Care Restrictions, Dosing/Quantity Limits, and Effective Date. |
| **Expandable Policy Details** | Right panel shows per-policy detail cards with all criteria, expandable in one click. |
| **Source Evidence** | Every AI answer cites the exact document passages it used, with relevance scores and links. |
| **Policy Evolution** | Track version history and field-level diffs for any policy over time. |
| **Automated Scraping** | Scraper pipeline fetches real PDFs from UHC, Cigna, Priority Health, UPMC portals and auto-ingests them. |
| **Vector Search** | ChromaDB stores 6,000+ chunks from parsed policy PDFs for semantic retrieval. |
| **Tiered Cost Model** | Tier 1 (structured DB, $0.00) for simple lookups; Tier 2 (Claude RAG, ~$0.01) for complex questions. |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│             Next.js 16 Frontend             │
│  (React 19 · Tailwind CSS 4 · Framer Motion)│
│                                             │
│  ┌──────────┐ ┌────────────┐ ┌───────────┐ │
│  │ Ask AI   │ │ Comparison │ │  Policy   │ │
│  │  Chat UI │ │   Tables   │ │  Details  │ │
│  └──────────┘ └────────────┘ └───────────┘ │
└──────────────────┬──────────────────────────┘
                   │ HTTP (port 3000 → 8080)
┌──────────────────▼──────────────────────────┐
│          FastAPI Backend (Python)            │
│                                             │
│  ┌─────────┐ ┌────────┐ ┌───────────────┐  │
│  │ Routes  │ │  RAG   │ │   Scraper     │  │
│  │  /api/* │ │ Engine │ │  (4 payers)   │  │
│  └────┬────┘ └───┬────┘ └───────┬───────┘  │
│       │          │               │          │
│  ┌────▼──────────▼───────────────▼───────┐  │
│  │  SQLite DB  │  ChromaDB  │  PDF Store │  │
│  │ 13 policies │ 6,143 chunks│ Documents │  │
│  └─────────────┴────────────┴────────────┘  │
└─────────────────────────────────────────────┘
                   │
          ┌────────▼────────┐
          │  Anthropic API  │
          │  Claude Sonnet 4│
          └─────────────────┘
```

---

## Tech Stack

### Frontend
- **Next.js 16.2.0** with App Router and Turbopack
- **React 19** · **TypeScript 5.7**
- **Tailwind CSS 4.0** · **Framer Motion 11.18**
- **Zustand 5** for state management
- **Recharts** for data visualization
- **shadcn/ui** component library (Radix primitives)

### Backend
- **Python 3.13** · **FastAPI 0.135**
- **SQLAlchemy 2.0** (SQLite)
- **ChromaDB** for vector embeddings
- **PyMuPDF** for PDF parsing
- **Anthropic SDK** (Claude Sonnet 4)
- **BeautifulSoup + httpx** for web scraping

---

## Project Structure

```
├── app/                      # Next.js pages (App Router)
│   ├── page.tsx              # Home — search hero
│   ├── processing/page.tsx   # Processing pipeline animation
│   └── results/page.tsx      # Results dashboard
├── components/
│   ├── anton/                # Core application components
│   │   ├── ai-dashboard.tsx  # Main dashboard (chat, tables, cards)
│   │   ├── app-sidebar.tsx   # Navigation sidebar
│   │   ├── search-hero.tsx   # Landing page search
│   │   └── ...               # Processing, stats, etc.
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── api.ts                # Frontend API client (with caching)
│   ├── mock-data.ts          # Fallback structured data
│   ├── store.ts              # Zustand store
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Helpers
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── routes.py         # All API endpoints
│   │   ├── rag.py            # Claude RAG engine
│   │   ├── models.py         # Pydantic schemas
│   │   ├── database.py       # SQLAlchemy models
│   │   ├── seed.py           # DB seeding (8 policies)
│   │   ├── ingest.py         # PDF → structured data pipeline
│   │   ├── parsers.py        # PDF text extraction
│   │   ├── scraper.py        # Payer website scraper
│   │   ├── sources.py        # Payer source URLs
│   │   ├── storage.py        # Document storage (local/GCS)
│   │   └── config.py         # Settings
│   ├── data/                 # SQLite DB, ChromaDB, PDFs
│   ├── Dockerfile            # Container config
│   └── requirements.txt      # Python dependencies
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+**
- **Anthropic API key** (for Claude AI features)

### 1. Clone & Install Frontend

```bash
git clone <repo-url> && cd <repo>
npm install
```

### 2. Set Up Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=sqlite:///./data/anton_rx.db
STORAGE_PATH=./data/documents
CHROMA_PATH=./data/chroma
ANTHROPIC_API_KEY=sk-ant-...    # Required for AI features
```

### 4. Start Backend (port 8080)

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

The server auto-seeds the database with 8 drug policies and generates vector embeddings on first startup.

### 5. Start Frontend (port 3000)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ask` | Ask a question (Claude RAG). Cached 10 min. |
| `GET` | `/api/matrix` | Full payer × drug coverage matrix |
| `GET` | `/api/comparison/{drug_id}` | Side-by-side comparison for a drug |
| `GET` | `/api/policies` | List all policies (filterable) |
| `GET` | `/api/policies/{id}/versions` | Version history for a policy |
| `GET` | `/api/drugs` | List all tracked drugs |
| `POST` | `/api/ingest` | Upload and ingest a policy PDF |
| `POST` | `/api/reindex` | Re-index all documents into ChromaDB |
| `POST` | `/api/scrape/{source_id}` | Scrape a specific payer source |
| `POST` | `/api/scrape-all` | Scrape all configured payer sources |
| `GET` | `/api/sources` | List configured scraper sources |

---

## Example Queries

| Query | What You Get |
|-------|-------------|
| *"Is Rituximab covered by BCBS?"* | Coverage verdict + PA/ST details + source citations |
| *"Compare Rituximab across all payers"* | Structured comparison table with all 8 criteria per payer |
| *"What step therapy is required for Humira?"* | Step-by-step requirements per plan |
| *"Compare all drugs across payers"* | Multi-drug stacked comparison tables |
| *"What changed in policies this quarter?"* | Version diffs and change summaries |

---

## Docker

```bash
cd backend
docker build -t antonrx-api .
docker run -p 8080:8080 -e ANTHROPIC_API_KEY=sk-ant-... antonrx-api
```

---

## Tracked Drugs

| Drug | Generic | Category |
|------|---------|----------|
| Rituxan | Rituximab | Anti-CD20 Monoclonal Antibody |
| Humira | Adalimumab | TNF-alpha Inhibitor |
| Avastin | Bevacizumab | VEGF Inhibitor |
| Botox | Botulinum Toxin | Neurotoxin |
| Prolia / Xgeva | Denosumab | RANK Ligand Inhibitor |
| Keytruda | Pembrolizumab | PD-1 Inhibitor |

## Tracked Payers

- Blue Cross Blue Shield (BCBS)
- Cigna
- UnitedHealthcare (UHC)

---

## License

This project was built for the **Innovation Hacks 2.0** hackathon (April 3–5, 2026). All rights reserved.
