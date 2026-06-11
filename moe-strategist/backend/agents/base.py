from __future__ import annotations

from typing import Any, AsyncGenerator
from ..models.schemas import AgentLogEvent, SectionEvent, DoneEvent, ErrorEvent, AgentEvent


class BaseAgent:
    """Base class for all MIRA pipeline agents."""

    name: str = "Agent"

    # ── Helper to create a log event ─────────────────────────────────────────

    def log(self, message: str, level: str = "info") -> AgentLogEvent:
        return AgentLogEvent(agent=self.name, message=message, level=level)

    # ── Subclasses implement this as an async generator ───────────────────────

    async def run(self, ctx: dict[str, Any]) -> AsyncGenerator[AgentEvent, None]:
        """
        Process context dict, enrich it, and yield AgentEvent objects.
        Must be implemented as an async generator in subclasses.
        """
        raise NotImplementedError
        yield  # pragma: no cover — makes Python treat this as an async generator
