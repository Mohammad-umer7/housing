from __future__ import annotations

from enum import Enum
from typing import Any, Union
from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class Capability(str, Enum):
    profile    = "profile"
    insights   = "insights"
    briefing   = "briefing"
    search     = "search"
    predict    = "predict"
    comparison = "comparison"


class Phase(str, Enum):
    alert    = "alert"
    urgent   = "urgent"
    standard = "standard"
    research = "research"


class Language(str, Enum):
    en = "en"
    ar = "ar"


class EventType(str, Enum):
    agent_log = "agent_log"
    section   = "section"
    done      = "done"
    error     = "error"


# ── Intel request/response ────────────────────────────────────────────────────

class IntelRequest(BaseModel):
    capability:     Capability       = Capability.profile
    phase:          Phase            = Phase.standard
    language:       Language         = Language.en
    country_code:   str              = Field(..., description="ISO-3 code or country name")
    country_code_2: str | None       = Field(None, description="Second country for comparison mode")
    query:          str              = Field(default="")
    user_email:     str | None       = None


# ── SSE event models ──────────────────────────────────────────────────────────

class AgentLogEvent(BaseModel):
    event:   EventType = EventType.agent_log
    agent:   str       = "MIRA"
    message: str
    level:   str       = "info"   # info | success | warning | error


class Section(BaseModel):
    type:    str
    content: Union[str, list[str], dict[str, str]]
    rtl:     bool = False


class SectionEvent(BaseModel):
    event:   EventType = EventType.section
    section: Section


class DoneEvent(BaseModel):
    event:          EventType = EventType.done
    total_sections: int       = 0
    latency_ms:     int       = 0
    tokens_used:    int       = 0
    rag_chunks:     int       = 0
    groq_model:     str       = ""


class ErrorEvent(BaseModel):
    event:   EventType = EventType.error
    message: str
    detail:  str = ""


AgentEvent = Union[AgentLogEvent, SectionEvent, DoneEvent, ErrorEvent]


# ── Embed request/response ────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    document_id:   str
    document_name: str
    content_text:  str
    country_code:  str | None = None
    document_type: str        = "report"
    language:      str        = "en"


class EmbedResponse(BaseModel):
    document_id:  str
    chunks_count: int
    success:      bool
    error:        str | None = None


# ── Country context (internal pipeline state) ─────────────────────────────────

class CountryContext(BaseModel):
    country_code:    str
    country_name:    str
    country_name_ar: str | None  = None
    flag_emoji:      str | None  = None
    energy_minister: str | None  = None
    primary_energy:  str | None  = None
    net_zero:        int | None  = None
    credit_rating:   str | None  = None
    gdp_usd_bn:      float | None = None
    gdp_growth_pct:  float | None = None
    inflation_pct:   float | None = None
    trade_uae_bn:    float | None = None
    renewable_pct:   float | None = None
    agreements:      list[dict[str, Any]] = []
    rag_chunks:      list[dict[str, Any]] = []
    key_facts:       list[str] = []
    opportunities:   list[str] = []
    risks:           list[str] = []
    # Math model outputs
    cagr:         float | None = None
    ema_gdp:      float | None = None
    sustainability: float | None = None


# ── Live WebSocket tick ───────────────────────────────────────────────────────

class LiveTick(BaseModel):
    ts:            str
    seq:           int
    country_code:  str
    gdp_raw:       float
    gdp_ema:       float
    trade_vol:     float
    inflation:     float
    sustain_score: float
    cagr_1yr:      float
    latency_ms:    int
    source:        str = "mock"
