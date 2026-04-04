from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.database import init_db, SessionLocal
from backend.routers import ingest, query, compare, policies, mlops

app = FastAPI(
    title="Medical Benefit Drug Policy Tracker",
    description="AI-powered system to ingest, parse, and compare medical benefit drug policies across health plans.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    # Seed default prompts and embedding model if not already present
    db = SessionLocal()
    try:
        from backend.services.prompt_registry import seed_default_prompts
        seed_default_prompts(db)

        from backend.models.orm import EmbeddingModelVersion
        if not db.query(EmbeddingModelVersion).filter(
            EmbeddingModelVersion.is_active == True
        ).first():
            model = EmbeddingModelVersion(
                model_name="sentence-transformers/all-MiniLM-L6-v2",
                model_slug="miniLM-L6-v2",
                model_version="1.0",
                dimensions=384,
                is_active=True,
            )
            db.add(model)
            db.commit()
    finally:
        db.close()


app.include_router(ingest.router, prefix="/api/v1")
app.include_router(query.router, prefix="/api/v1")
app.include_router(compare.router, prefix="/api/v1")
app.include_router(policies.router, prefix="/api/v1")
app.include_router(mlops.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "Medical Benefit Drug Policy Tracker",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
