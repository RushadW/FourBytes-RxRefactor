# AntonRx — AI-Powered Medical Benefit Drug Policy Tracker

> **Innovation Hacks 2.0 · April 3–5, 2026**

AntonRx is a full-stack AI application that tracks, compares, and analyzes **medical benefit drug policies** across multiple payers. It combines a structured database of **55 policies** across **15 specialty drugs** and **5 payers** with a **RAG-powered Claude AI assistant**, letting healthcare analysts ask natural-language questions and instantly receive accurate, sourced answers — with voice input/output, autocomplete, and rich markdown rendering.

**Live Demo:** [https://anton-rx-frontend-770871054693.us-central1.run.app](https://anton-rx-frontend-770871054693.us-central1.run.app)

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Example Queries](#example-queries)
- [Tracked Drugs & Payers](#tracked-drugs--payers)
- [Deployment](#deployment)
- [Team](#team)
- [License](#license)

---

## Key Features

### AI & Search
- **RAG-Powered Q&A** — Ask any policy question in natural language. Claude Haiku generates sourced answers using retrieval-augmented generation over 2,200+ vector-indexed document chunks.
- **Dynamic Token Budget** — Automatically scales response length (1,200–2,400 tokens) based on query complexity and number of policies.
- **Confidence-Calibrated Answers** — System prompt enforces strict accuracy rules: never hallucinates, states "not available" when data is missing, and answers authoritatively when data exists.
- **Source Evidence** — Every AI answer cites the exact document passages it used, with relevance scores and links to source PDFs.
- **Google-Style Autocomplete** — 45 pre-built questions with real-time filtering, keyboard navigation, and bold text matching on the search bar.

### Voice
- **Voice Input** — VoiceOrb microphone button on both the main search bar and follow-up input using the Web Speech API.
- **Neural Text-to-Speech** — Microsoft Aria Neural voice (`en-US-AriaNeural`) via `edge-tts` for natural-sounding answer readback. Falls back to browser SpeechSynthesis.
- **Speaker Button** — One-click TTS on any AI answer card.
- **Auto-Stop on Navigation** — Voice playback automatically stops when switching pages (`beforeunload`/`pagehide` listeners).

### Policy Intelligence
- **Structured Comparison Tables** — Comparison queries automatically render side-by-side tables with all 8 key criteria per payer.
- **8 Extraction Criteria** — Every policy is structured across: Drug Name (brand + generic), Drug Category, Covered Indications, Prior Authorization, Step Therapy, Site-of-Care Restrictions, Dosing/Quantity Limits, and Effective Date.
- **Payer × Drug Coverage Matrix** — Full 15×5 matrix view of all drug-payer combinations.
- **Policy Evolution** — Track version history and field-level diffs for any policy over time.
- **Knowledge Graph** — Visual relationship mapping between drugs, payers, and conditions.

### Data Pipeline
- **Automated Scraping** — Scraper pipeline fetches real PDFs from BCBS, UHC, Cigna, Priority Health, and UPMC portals.
- **PDF Ingestion** — PyMuPDF-based parser extracts text, Claude structures it into the 8 criteria, and ChromaDB indexes chunks for retrieval.
- **Vector Search** — ChromaDB stores 2,296 chunks from parsed policy documents for semantic retrieval with cosine similarity scoring.
- **Tiered Cost Model** — Tier 1 (structured DB lookup, $0.00) for simple queries; Tier 2 (Claude RAG, ~$0.01) for complex analysis.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│               Next.js 16 Frontend                    │
│     (React 19 · Tailwind CSS 4 · Framer Motion)     │
│                                                      │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │  Search    │ │  AI Chat +   │ │  Policy       │  │
│  │  Hero +    │ │  Comparison  │ │  Matrix +     │  │
│  │  Voice Orb │ │  Tables      │ │  Library      │  │
│  └────────────┘ └──────────────┘ └───────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼──────────────────────────────┐
│             FastAPI Backend (Python 3.11)             │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  30+     │ │  RAG     │ │ Scraper  │ │  TTS   │  │
│  │  Routes  │ │  Engine  │ │ Pipeline │ │  API   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │
│       │            │            │            │       │
│  ┌────▼────────────▼────────────▼────────────▼────┐  │
│  │  SQLite DB    │  ChromaDB     │  PDF Store     │  │
│  │  55 policies  │  2,296 chunks │  101 documents │  │
│  └───────────────┴───────────────┴────────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │
        ┌───────────────▼───────────────┐
        │       Anthropic API           │
        │   Claude 3 Haiku (claude-     │
        │   3-haiku-20240307)           │
        └───────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.0 | App Router, SSR, Turbopack |
| React | 19 | UI rendering |
| TypeScript | 5.7 | Type safety |
| Tailwind CSS | 4.2 | Styling |
| Framer Motion | 11.18 | Animations & transitions |
| Zustand | 5 | State management |
| Recharts | — | Data visualization |
| shadcn/ui | — | Component library (Radix primitives) |
| edge-tts | — | Neural TTS (via backend API) |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | 0.115+ | REST API framework |
| SQLAlchemy | 2.0+ | ORM (SQLite) |
| ChromaDB | 0.5+ | Vector embeddings & search |
| PyMuPDF | 1.24+ | PDF text extraction |
| Anthropic SDK | 0.40+ | Claude AI integration |
| edge-tts | 7.0+ | Microsoft Neural TTS |
| BeautifulSoup | 4.12+ | HTML scraping |
| httpx | 0.27+ | Async HTTP client |

---

## Project Structure

```
├── app/                          # Next.js pages (App Router)
│   ├── page.tsx                  # Home — search hero with autocomplete
│   ├── layout.tsx                # Root layout with providers
│   ├── globals.css               # Global styles
│   ├── processing/page.tsx       # Processing pipeline animation
│   ├── results/page.tsx          # Results dashboard
│   ├── policy-bank/page.tsx      # Policy bank browser
│   ├── library/page.tsx          # Policy library
│   ├── evolution/page.tsx        # Policy evolution timeline
│   ├── diff/page.tsx             # Policy diff viewer
│   ├── graph/page.tsx            # Knowledge graph
│   ├── calculator/page.tsx       # Coverage calculator
│   ├── alerts/page.tsx           # Smart alerts
│   └── upload/page.tsx           # PDF upload & ingestion
│
├── components/
│   ├── anton/                    # Core application components
│   │   ├── ai-dashboard.tsx      # Main results dashboard (chat, tables, cards)
│   │   ├── search-hero.tsx       # Landing search with autocomplete & voice
│   │   ├── app-sidebar.tsx       # Navigation sidebar
│   │   ├── voice-orb.tsx         # Animated voice input button
│   │   ├── policy-matrix.tsx     # Payer × Drug coverage matrix
│   │   ├── policy-library.tsx    # Searchable policy browser
│   │   ├── policy-evolution.tsx  # Version timeline view
│   │   ├── policy-diff-view.tsx  # Field-level diff viewer
│   │   ├── policy-compare.tsx    # Side-by-side policy comparison
│   │   ├── knowledge-graph.tsx   # Visual drug-payer-condition graph
│   │   ├── coverage-calculator.tsx # Coverage cost calculator
│   │   ├── smart-alerts.tsx      # Policy change alerts
│   │   ├── pdf-upload-parser.tsx # PDF upload & extraction UI
│   │   ├── chat-panel.tsx        # Follow-up chat interface
│   │   ├── comparison-table.tsx  # Structured comparison tables
│   │   ├── processing-pipeline.tsx # Animated processing steps
│   │   └── ...                   # Additional UI components
│   ├── ui/                       # 50+ shadcn/ui primitives
│   ├── providers.tsx             # React context providers
│   └── theme-provider.tsx        # Dark/light theme
│
├── hooks/
│   ├── use-voice.ts              # TTS + speech recognition hook
│   ├── use-mobile.ts             # Responsive breakpoint hook
│   └── use-toast.ts              # Toast notification hook
│
├── lib/
│   ├── api.ts                    # Frontend API client (with caching)
│   ├── store.ts                  # Zustand global store
│   ├── types.ts                  # TypeScript interfaces
│   ├── mock-data.ts              # Fallback structured data
│   └── utils.ts                  # Helpers (cn, formatters)
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entry point + CORS
│   │   ├── routes.py             # 30+ API endpoints
│   │   ├── rag.py                # RAG engine (ChromaDB + Claude)
│   │   ├── models.py             # Pydantic request/response schemas
│   │   ├── database.py           # SQLAlchemy ORM models
│   │   ├── seed.py               # Drug & payer seed data
│   │   ├── ingest.py             # PDF → structured policy pipeline
│   │   ├── parsers.py            # PDF text extraction (PyMuPDF)
│   │   ├── scraper.py            # Payer website scraper
│   │   ├── sources.py            # Payer source URLs (7 real URLs)
│   │   ├── storage.py            # Document storage (local / GCS)
│   │   └── config.py             # Settings & environment config
│   ├── data/
│   │   ├── anton_rx.db           # SQLite database (55 policies)
│   │   ├── chroma/               # ChromaDB vector index (2,296 chunks)
│   │   └── documents/            # Stored PDF documents
│   ├── Dockerfile                # Backend container
│   └── requirements.txt          # Python dependencies
│
├── Dockerfile                    # Frontend container
├── package.json                  # Node.js dependencies
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
└── postcss.config.mjs            # PostCSS configuration
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+** and **pip**
- **Anthropic API key** (required for AI-powered Q&A)

### 1. Clone the Repository

```bash
git clone https://github.com/RushadW/FourBytes-RxRefactor.git
cd FourBytes-RxRefactor
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Set Up the Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your values (see [Environment Variables](#environment-variables) below).

### 5. Start the Backend (port 8080)

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

On first startup, the server automatically:
- Creates the SQLite database and seeds it with drug/payer metadata
- Generates vector embeddings for all indexed documents

### 6. Start the Frontend (port 3000)

In a separate terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start using AntonRx.

---

## Environment Variables

Create `backend/.env` with the following:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Anthropic API key for Claude AI (`sk-ant-...`) |
| `DATABASE_URL` | No | `sqlite:///./data/anton_rx.db` | SQLAlchemy database URL |
| `STORAGE_PATH` | No | `./data/documents` | Local path for stored PDFs |
| `CHROMA_PATH` | No | `./data/chroma` | ChromaDB persistence directory |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins (comma-separated) |
| `STORAGE_BACKEND` | No | `local` | `local` or `gcs` for Google Cloud Storage |

Example `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
DATABASE_URL=sqlite:///./data/anton_rx.db
STORAGE_PATH=./data/documents
CHROMA_PATH=./data/chroma
```

For the frontend, the API URL is configured in `next.config.mjs` and the root `Dockerfile`:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api` | Backend API base URL |

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ask` | Ask a natural-language question (Claude RAG). Responses cached for 10 min. |
| `GET` | `/api/search?q=...` | Vector search over policy document chunks |
| `POST` | `/api/tts` | Text-to-speech using Microsoft Aria Neural voice (returns MP3) |
| `GET` | `/api/health` | Health check |

### Policy Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/policies` | List all policies (filter by `drug_id`, `payer_id`, `covered`) |
| `GET` | `/api/policies/{id}` | Get a single policy by ID |
| `GET` | `/api/policies/{id}/versions` | Version history for a policy |
| `GET` | `/api/policies/{id}/diff` | Field-level diff between policy versions |
| `GET` | `/api/drugs` | List all 15 tracked drugs |
| `GET` | `/api/drugs/{drug_id}` | Get a single drug by ID |
| `GET` | `/api/comparison/{drug_id}` | Side-by-side payer comparison for a drug |
| `GET` | `/api/matrix` | Full 15×5 payer × drug coverage matrix |
| `GET` | `/api/policy-bank` | All policies with enriched metadata |

### Ingestion & Scraping

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload and ingest a policy PDF |
| `POST` | `/api/reindex` | Re-index all documents into ChromaDB |
| `GET` | `/api/sources` | List all configured payer scraper sources |
| `POST` | `/api/scrape/{payer_id}` | Scrape a specific payer source |
| `POST` | `/api/scrape` | Scrape all configured payer sources |
| `POST` | `/api/scrape-now` | Trigger immediate scrape of all sources |
| `GET` | `/api/scrape-logs` | View scrape history and results |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | List all notifications |
| `POST` | `/api/notifications/{id}/read` | Mark a notification as read |
| `POST` | `/api/notifications/read-all` | Mark all notifications as read |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents/{id}` | Get document metadata |
| `GET` | `/api/documents/{id}/view` | View/download the original document |

---

## Example Queries

AntonRx understands natural-language questions. Here are some examples:

### Drug-Specific
| Query | What You Get |
|-------|-------------|
| *"Is Humira covered by BCBS?"* | Coverage verdict + prior auth/step therapy details + source citations |
| *"Does Keytruda require prior authorization?"* | PA requirements across all payers that cover Keytruda |
| *"Bevacizumab step therapy details"* | Step therapy status per payer with clinical criteria |
| *"Entyvio coverage criteria"* | Covered indications, PA details, and dosing for Entyvio |

### Comparisons
| Query | What You Get |
|-------|-------------|
| *"Compare Remicade vs Humira coverage"* | Side-by-side table across all payers for both drugs |
| *"Nivolumab vs Pembrolizumab coverage"* | Oncology drug comparison with all 8 criteria |
| *"Rituximab coverage across all payers"* | Single-drug multi-payer breakdown |
| *"Compare biologics coverage across BCBS and Cigna"* | Multi-drug comparison for two specific payers |

### Payer-Specific
| Query | What You Get |
|-------|-------------|
| *"What does Cigna cover?"* | All 15 Cigna drug policies with PA/ST summary |
| *"UHC prior authorization requirements"* | PA details for all UHC-covered drugs |
| *"Priority Health formulary coverage"* | Complete Priority Health drug list with coverage status |
| *"Show me all coverage for UPMC"* | Full UPMC policy inventory |

### General
| Query | What You Get |
|-------|-------------|
| *"Which drugs are covered by all payers?"* | Cross-payer coverage analysis |
| *"Which drugs have site of care restrictions?"* | Drugs with specific infusion site requirements |
| *"Prior auth turnaround for specialty drugs"* | PA timeline information from policy data |

---

## Tracked Drugs & Payers

### 15 Specialty Drugs

| Brand Name | Generic Name | Therapeutic Area |
|------------|-------------|------------------|
| Rituxan | Rituximab | Oncology / Autoimmune |
| Humira | Adalimumab | Rheumatology / Autoimmune |
| Avastin | Bevacizumab | Oncology |
| Botox | Botulinum Toxin | Neurology |
| Prolia / Xgeva | Denosumab | Bone Health / Oncology |
| Dupixent | Dupilumab | Immunology |
| Remicade | Infliximab | Autoimmune / Rheumatology |
| Tysabri | Natalizumab | Neurology / Gastroenterology |
| Opdivo | Nivolumab | Oncology |
| Ocrevus | Ocrelizumab | Neurology (Multiple Sclerosis) |
| Keytruda | Pembrolizumab | Oncology |
| Cosentyx | Secukinumab | Rheumatology |
| Herceptin | Trastuzumab | Oncology |
| Stelara | Ustekinumab | Gastroenterology / Dermatology |
| Entyvio | Vedolizumab | Gastroenterology |

### 5 Payers

| Payer | ID | Policies |
|-------|----|----------|
| Blue Cross Blue Shield | `bcbs` | 3 |
| Cigna | `cigna` | 15 |
| UnitedHealthcare | `uhc` | 14 |
| Priority Health | `priority_health` | 14 |
| UPMC Health Plan | `upmc` | 9 |

**Total: 55 structured policies · 101 source documents · 2,296 vector chunks**

---

## Deployment

Both the frontend and backend are containerized and deployed to **Google Cloud Run**.

### Backend

```bash
cd backend
gcloud run deploy anton-rx-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "ANTHROPIC_API_KEY=sk-ant-..."
```

### Frontend

```bash
# From project root
gcloud run deploy anton-rx-frontend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300
```

> **Note:** The frontend `Dockerfile` bakes in `NEXT_PUBLIC_API_URL` pointing to the backend Cloud Run URL. Update it in the Dockerfile if your backend URL changes.

### Docker (Local)

```bash
# Backend
cd backend
docker build -t antonrx-api .
docker run -p 8080:8080 -e ANTHROPIC_API_KEY=sk-ant-... antonrx-api

# Frontend
cd ..
docker build -t antonrx-frontend .
docker run -p 3000:3000 antonrx-frontend
```

### Production URLs

| Service | URL |
|---------|-----|
| Frontend | https://anton-rx-frontend-770871054693.us-central1.run.app |
| Backend API | https://anton-rx-backend-770871054693.us-central1.run.app |

---

## Team

**Team FourBytes** — Innovation Hacks 2.0 (April 3–5, 2026)

---

## License

This project was built for the **Innovation Hacks 2.0** hackathon (April 3–5, 2026). All rights reserved.
