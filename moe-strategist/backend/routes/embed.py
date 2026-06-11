from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..models.schemas import EmbedRequest, EmbedResponse

router = APIRouter()


@router.post("/embed", response_model=EmbedResponse)
async def embed_document(req: EmbedRequest) -> EmbedResponse:
    """
    POST /api/embed

    Generates text-embedding-3-small vectors for a document's chunks
    and stores them in Supabase document_embeddings via the RAG library.

    Requires OPENAI_API_KEY and Supabase service role key.
    """
    if not settings.openai_api_key:
        return EmbedResponse(
            document_id=req.document_id,
            chunks_count=0,
            success=False,
            error="OPENAI_API_KEY not configured",
        )

    if not (settings.supabase_url and settings.supabase_service_role_key):
        return EmbedResponse(
            document_id=req.document_id,
            chunks_count=0,
            success=False,
            error="Supabase not configured",
        )

    try:
        from openai import AsyncOpenAI
        from supabase import create_client

        oai = AsyncOpenAI(api_key=settings.openai_api_key)
        sb  = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

        # ── Chunk the document text ────────────────────────────────────────
        CHUNK_SIZE    = 800
        CHUNK_OVERLAP = 100

        text   = req.content_text
        chunks: list[str] = []
        start  = 0

        while start < len(text):
            end = start + CHUNK_SIZE
            if end < len(text):
                boundary = text.rfind(". ", start, end)
                if boundary > start + CHUNK_SIZE - 200:
                    end = boundary + 1
            chunks.append(text[start:min(end, len(text))].strip())
            start = end - CHUNK_OVERLAP

        chunks = [c for c in chunks if len(c) > 20]

        if not chunks:
            return EmbedResponse(
                document_id=req.document_id,
                chunks_count=0,
                success=False,
                error="No embeddable content found",
            )

        # ── Generate embeddings (batch up to 20 at a time) ────────────────
        BATCH = 20
        rows: list[dict] = []

        for batch_start in range(0, len(chunks), BATCH):
            batch = chunks[batch_start: batch_start + BATCH]
            resp  = await oai.embeddings.create(
                model=settings.embed_model,
                input=batch,
                dimensions=settings.embed_dim,
            )
            for i, emb_obj in enumerate(resp.data):
                rows.append({
                    "document_id": req.document_id,
                    "chunk_index": batch_start + i,
                    "chunk_text":  batch[i],
                    "embedding":   emb_obj.embedding,
                    "token_count": None,
                })

        # ── Upsert into Supabase ──────────────────────────────────────────
        sb.table("document_embeddings").upsert(
            rows,
            on_conflict="document_id,chunk_index",
        ).execute()

        # Mark document as embedded
        sb.table("ministry_documents").update(
            {"is_embedded": True}
        ).eq("id", req.document_id).execute()

        return EmbedResponse(
            document_id=req.document_id,
            chunks_count=len(rows),
            success=True,
        )

    except Exception as exc:
        return EmbedResponse(
            document_id=req.document_id,
            chunks_count=0,
            success=False,
            error=str(exc),
        )
