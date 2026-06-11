from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..models.schemas import IntelRequest
from ..pipeline.orchestrator import orchestrator

router = APIRouter()


@router.post("/intel")
async def generate_intel(request: IntelRequest) -> StreamingResponse:
    """
    POST /api/intel

    Streams a Server-Sent Events (SSE) response containing the full
    multi-agent pipeline output for a MIRA intelligence request.

    Each event is a JSON-encoded AgentEvent (agent_log | section | done | error).
    """

    async def event_stream():
        async for json_str in orchestrator.run(request):
            yield f"data: {json_str}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
