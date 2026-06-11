from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncGenerator

from ..agents.ingestion  import IngestionAgent
from ..agents.rag_analyst import RAGAnalystAgent
from ..agents.predictive  import PredictiveEngine
from ..agents.summarizer  import SummarizerAgent
from ..models.schemas     import (
    IntelRequest,
    AgentLogEvent,
    AgentEvent,
)


class AgentOrchestrator:
    """
    Chains the four MIRA agents into a sequential pipeline:

      IngestionAgent  →  RAGAnalystAgent  →  PredictiveEngine  →  SummarizerAgent

    Each agent receives the shared `ctx` dict, enriches it, and yields
    AgentEvent objects that are serialised to SSE JSON lines by the route.
    """

    def __init__(self) -> None:
        self._pipeline = [
            IngestionAgent(),
            RAGAnalystAgent(),
            PredictiveEngine(),
            SummarizerAgent(),
        ]

    async def run(self, request: IntelRequest) -> AsyncGenerator[str, None]:
        """
        Run the full pipeline for one IntelRequest.
        Yields raw JSON strings (each is the .model_dump_json() of an AgentEvent).
        """
        # Seed the shared context
        ctx: dict[str, Any] = {
            "capability":     request.capability.value,
            "phase":          request.phase.value,
            "language":       request.language.value,
            "country_code":   request.country_code,
            "country_code_2": request.country_code_2,
            "query":          request.query,
            "user_email":     request.user_email,
        }

        # Opening terminal line
        opener = AgentLogEvent(
            agent="MIRA",
            message="> Accessing MIRA Intelligence Engine v3.1...",
        )
        yield opener.model_dump_json()
        await asyncio.sleep(0.1)

        # Run each agent in sequence
        for agent in self._pipeline:
            try:
                async for event in agent.run(ctx):
                    yield event.model_dump_json()
                    await asyncio.sleep(0.04)   # gentle pacing — prevents flooding
            except Exception as exc:
                from ..models.schemas import ErrorEvent
                err = ErrorEvent(message=f"{agent.name} crashed", detail=str(exc))
                yield err.model_dump_json()
                # Non-fatal: continue to next agent
                continue

        # Persist intelligence session to Supabase (fire-and-forget)
        asyncio.create_task(self._persist(ctx))  # noqa: RUF006

    # ── Persistence (async, non-blocking) ────────────────────────────────────

    @staticmethod
    async def _persist(ctx: dict[str, Any]) -> None:
        try:
            from ..config import settings
            if not (settings.supabase_url and settings.supabase_service_role_key):
                return

            from supabase import create_client
            sb = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
            sb.table("intelligence_sessions").insert({
                "user_email":        ctx.get("user_email"),
                "capability":        ctx.get("capability", "profile"),
                "phase":             ctx.get("phase", "standard"),
                "language":          ctx.get("language", "en"),
                "country_code":      ctx.get("iso3"),
                "country_code_2":    ctx.get("iso3_2"),
                "query_text":        ctx.get("query"),
                "response_sections": json.dumps(ctx.get("sections", [])),
                "agent_log":         [],
                "tokens_used":       ctx.get("tokens_used", 0),
                "latency_ms":        ctx.get("latency_ms", 0),
                "groq_model":        ctx.get("groq_model"),
                "rag_chunks_used":   ctx.get("rag_chunks_count", 0),
            }).execute()
        except Exception:
            pass  # persistence is best-effort


# Singleton — instantiated once at server start
orchestrator = AgentOrchestrator()
