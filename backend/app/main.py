"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import router
from app.seed import seed_all
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed DB + vector store if empty
    seed_all()
    # Start weekly auto-scraper daemon
    start_scheduler()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="RxRefactor API",
    description="Medical Benefit Drug Policy Tracker — backend API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Vercel frontend and localhost
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
