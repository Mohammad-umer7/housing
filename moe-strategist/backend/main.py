from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes.intel import router as intel_router
from .routes.embed import router as embed_router
from .routes.ws    import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm-up: pre-initialise agent singletons so the first request is fast."""
    from .pipeline.orchestrator import orchestrator  # noqa: F401 — triggers __init__
    yield


app = FastAPI(
    title="MIRA — Ministry Intelligence & Research Advisor API",
    description=(
        "FastAPI backend for the UAE Ministry of Energy & Infrastructure AI Platform.\n\n"
        "**Multi-Agent Pipeline:** Ingestion → RAG Analyst → Predictive Engine → Summarizer\n\n"
        "**Key endpoints:**\n"
        "- `POST /api/intel` — SSE streaming intelligence product\n"
        "- `POST /api/embed` — Document embedding (pgvector)\n"
        "- `WS   /ws/live/{country_code}` — Live economic tick stream"
    ),
    version="3.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(intel_router, prefix="/api", tags=["Intelligence"])
app.include_router(embed_router, prefix="/api", tags=["Embeddings"])
app.include_router(ws_router,    prefix="/ws",  tags=["Live Feed"])


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health() -> dict:
    return {
        "status":    "online",
        "version":   "3.1.0",
        "groq":      bool(settings.groq_api_key),
        "openai":    bool(settings.openai_api_key),
        "supabase":  bool(settings.supabase_url and settings.supabase_service_role_key),
        "model":     settings.groq_model,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
        log_level="info",
    )
