from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator

from .base import BaseAgent
from ..models.schemas import AgentEvent


class RAGAnalystAgent(BaseAgent):
    """
    Agent 2 — RAG Analyst.

    1. Fetches active bilateral agreements from Supabase.
    2. Generates an OpenAI embedding for the query.
    3. Calls the Supabase `match_documents` pgvector RPC.
    4. Injects results into the pipeline context.

    Degrades gracefully when Supabase / OpenAI are not configured.
    """

    name = "RAG Analyst"

    def __init__(self) -> None:
        self._sb = None
        self._oai = None

        try:
            from ..config import settings
            self._settings = settings

            if settings.supabase_url and settings.supabase_service_role_key:
                from supabase import create_client
                self._sb = create_client(
                    settings.supabase_url,
                    settings.supabase_service_role_key,
                )

            if settings.openai_api_key:
                from openai import AsyncOpenAI
                self._oai = AsyncOpenAI(api_key=settings.openai_api_key)

        except Exception:
            pass

    async def run(self, ctx: dict[str, Any]) -> AsyncGenerator[AgentEvent, None]:  # type: ignore[override]
        iso3 = ctx.get("iso3", "")
        query = ctx.get("query", "")
        country_name = ctx.get("country_name", "")

        yield self.log("> Cross-referencing UAE strategic interests database...")
        await asyncio.sleep(0.05)

        # ── Bilateral agreements ───────────────────────────────────────────
        if self._sb and iso3:
            try:
                resp = (
                    self._sb.table("bilateral_agreements")
                    .select(
                        "title, agreement_type, signed_date, key_sectors, summary,"
                        " countries!inner(code)"
                    )
                    .eq("countries.code", iso3)
                    .eq("status", "active")
                    .order("signed_date", desc=True)
                    .limit(6)
                    .execute()
                )
                agreements = resp.data or []
                ctx["agreements"] = agreements
                yield self.log(
                    f"> Found {len(agreements)} active bilateral agreements ✓",
                    "success",
                )
            except Exception as exc:
                yield self.log(f"> Agreement lookup failed: {exc}", "warning")
                ctx.setdefault("agreements", [])
        else:
            ctx.setdefault("agreements", [])
            if not self._sb:
                yield self.log("> Supabase not configured — skipping agreement lookup", "warning")

        # ── Semantic document search (pgvector) ────────────────────────────
        if not self._oai:
            ctx["rag_chunks"] = []
            ctx["rag_chunks_count"] = 0
            if not self._oai:
                yield self.log("> OpenAI not configured — skipping document search", "warning")
            return

        search_text = (
            f"{query} {country_name} UAE Ministry of Energy Infrastructure strategy"
        ).strip()

        yield self.log("> Generating semantic query embedding (text-embedding-3-small)...")
        await asyncio.sleep(0.05)

        try:
            embed_resp = await self._oai.embeddings.create(
                model=self._settings.embed_model,
                input=search_text,
                dimensions=self._settings.embed_dim,
            )
            embedding: list[float] = embed_resp.data[0].embedding

            yield self.log(
                f"> Searching ministry document corpus "
                f"({self._settings.embed_dim}d HNSW index)...",
            )
            await asyncio.sleep(0.05)

            rpc_resp = self._sb.rpc(
                "match_documents",
                {
                    "query_embedding": embedding,
                    "match_count": 5,
                    "filter_country": iso3 or None,
                    "min_similarity": 0.70,
                },
            ).execute()

            chunks = rpc_resp.data or []
            ctx["rag_chunks"] = chunks
            ctx["rag_chunks_count"] = len(chunks)
            ctx["query_embedding"] = embedding

            yield self.log(
                f"> Retrieved {len(chunks)} relevant document chunks ✓",
                "success",
            )

        except Exception as exc:
            yield self.log(f"> RAG search error: {exc} — continuing without docs", "error")
            ctx["rag_chunks"] = []
            ctx["rag_chunks_count"] = 0
