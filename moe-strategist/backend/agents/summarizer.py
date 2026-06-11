from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, AsyncGenerator

from .base import BaseAgent
from ..models.schemas import AgentEvent, Section, SectionEvent, DoneEvent

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are MIRA (Ministry Intelligence & Research Advisor), an elite AI strategic \
intelligence system for UAE Ministry of Energy & Infrastructure leadership.

Your ONLY output is a valid JSON array of Section objects — no markdown fences, \
no explanation text, no code blocks. Start your response with [ and end with ].

SECTION SCHEMA:
Each item: {"type": "<type>", "content": <content>, "rtl": false}

TYPE → CONTENT FORMAT:
- "page-title"     → content: string
- "section-header" → content: string  (USE ALL CAPS)
- "text"           → content: string paragraph
- "bullet-list"    → content: ["item1", "item2", ...]
- "kv-grid"        → content: {"Key": "Value", ...}  (3-6 pairs max)
- "opportunity"    → content: {"OPPORTUNITY": "...", "VALUE TO UAE": "...", \
"TIMELINE": "Immediate|Short-term|Medium-term|Long-term", \
"RISK LEVEL": "Low|Medium|High — reason", \
"LEAD UAE ENTITY": "ADNOC|Mubadala|MOEI|ADQ|ADIA|DEWA|Masdar|...", \
"RECOMMENDED FIRST ACTION": "single most impactful next step"}
- "forecast"       → content: {"PREDICTION": "...", "CONFIDENCE": "XX%", \
"BASIS": "...", "TIMELINE": "...", "UAE IMPLICATION": "...", "RESPONSE": "..."}
- "sensitivity"    → content: {"AVOID": "...", "NEUTRAL ON": "...", "AFFIRM": "..."}
- "bottom-line"    → content: "BOTTOM LINE: [max 12 words]"
- "talking-point"  → content: {"number": "1", "text": "..."}
- "metric-row"     → content: {"label": "...", "value": "..."}
- "divider"        → content: ""

MANDATORY RULES:
1. Always start with "page-title"
2. Always end with {"type":"divider","content":""} then a "bottom-line"
3. Every insight must relate to UAE Ministry of Energy & Infrastructure interests
4. Be specific, data-driven, and actionable
5. CONFIDENCE in forecasts: realistic 55-85%
6. For Arabic (language=ar): translate ALL text to formal MSA, set "rtl": true on every section
7. UAE entities: ADNOC, Mubadala, MOEI, ADQ, ADIA, DEWA, Masdar, EmiratesNBD, etc.

CAPABILITY TEMPLATES:
- profile:    page-title → kv-grid(economics) → section-header → bullet-list(key facts) → section-header → bullet-list(opportunities) → section-header → bullet-list(risks) → divider → bottom-line
- insights:   page-title → 2-3 opportunity sections → divider → bottom-line
- briefing:   page-title → metric-row(phase) → section-header → text(summary) → section-header → bullet-list(talking points) → section-header → sensitivity → divider → bottom-line
- predict:    page-title → 3 forecast sections → divider → bottom-line
- search:     page-title → section-header → bullet-list(findings) → section-header → text(MIRA recommendation) → divider → bottom-line
- comparison: page-title → section-header → kv-grid(side-by-side) → section-header → text(strategic analysis) → divider → bottom-line
"""

# ── Fallback section generators (when Groq not configured) ────────────────────

def _fallback_sections(ctx: dict[str, Any]) -> list[dict]:
    name   = ctx.get("country_name", "Unknown")
    flag   = ctx.get("flag_emoji", "")
    lang   = ctx.get("language", "en")
    rtl    = lang == "ar"
    cap    = ctx.get("capability", "profile")

    if rtl:
        return [
            {"type": "page-title",     "content": f"ملف الاستخبارات — {ctx.get('country_name_ar', name)} {flag}", "rtl": True},
            {"type": "section-header", "content": "المؤشرات الاقتصادية", "rtl": True},
            {"type": "kv-grid",        "content": {
                "الناتج المحلي":   f"${ctx.get('gdp_usd_bn','N/A')}B",
                "النمو":           f"{ctx.get('gdp_growth_pct','N/A')}%",
                "التجارة مع الإمارات": f"${ctx.get('trade_uae_bn','N/A')}B",
                "الحياد المناخي":  str(ctx.get("net_zero","N/A")),
            }, "rtl": True},
            {"type": "divider",        "content": ""},
            {"type": "bottom-line",    "content": f"الخلاصة: {ctx.get('country_name_ar', name)} شريك استراتيجي محوري للإمارات.", "rtl": True},
        ]

    gdp_txt  = f"${ctx.get('gdp_usd_bn','N/A')}B"
    grow_txt = f"+{ctx.get('gdp_growth_pct','N/A')}%"
    sustain  = ctx.get("sustainability")
    cagr_v   = ctx.get("cagr")

    sections: list[dict] = [
        {"type": "page-title", "content": f"Strategic Intelligence Profile — {name} {flag}"},
        {"type": "section-header", "content": "KEY ECONOMIC INDICATORS"},
        {"type": "kv-grid", "content": {
            "GDP":             gdp_txt,
            "GDP Growth":      grow_txt,
            "UAE Trade":       f"${ctx.get('trade_uae_bn','N/A')}B",
            "Net-Zero Target": str(ctx.get("net_zero","N/A")),
            "Credit Rating":   ctx.get("credit_rating","N/A"),
            "Primary Energy":  ctx.get("primary_energy","N/A"),
        }},
    ]

    if cagr_v is not None or sustain is not None:
        math_items = []
        if cagr_v is not None:
            math_items.append(f"CAGR (1yr): {cagr_v:+.2%}")
        if ctx.get("ema_gdp"):
            math_items.append(f"GDP EMA: ${ctx['ema_gdp']:.1f}B (α=0.30)")
        if sustain is not None:
            math_items.append(f"Sustainability Score: {sustain:.2f}/1.00")
        if math_items:
            sections += [
                {"type": "section-header", "content": "MATHEMATICAL ANALYSIS"},
                {"type": "bullet-list", "content": math_items},
            ]

    if ctx.get("key_facts"):
        sections += [
            {"type": "section-header", "content": "KEY STRATEGIC FACTS"},
            {"type": "bullet-list", "content": ctx["key_facts"]},
        ]
    if ctx.get("opportunities"):
        sections += [
            {"type": "section-header", "content": "UAE STRATEGIC OPPORTUNITIES"},
            {"type": "bullet-list", "content": ctx["opportunities"]},
        ]
    if ctx.get("risks"):
        sections += [
            {"type": "section-header", "content": "RISK FACTORS"},
            {"type": "bullet-list", "content": ctx["risks"]},
        ]

    sections += [
        {"type": "divider", "content": ""},
        {"type": "bottom-line", "content": f"BOTTOM LINE: {name} is a high-value strategic partner — act now."},
    ]
    return sections


def _parse_sections(raw: str) -> list[dict]:
    """Strip markdown fences and parse JSON array from LLM response."""
    text = raw.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"^```[a-z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    text = text.strip()

    # Direct parse
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Extract first JSON array from response
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return []


def _build_human_prompt(ctx: dict[str, Any]) -> str:
    lang   = ctx.get("language", "en")
    cap    = ctx.get("capability", "profile")
    phase  = ctx.get("phase", "standard")
    name   = ctx.get("country_name", "")
    flag   = ctx.get("flag_emoji", "")
    query  = ctx.get("query", "")

    lines = [
        f"CAPABILITY: {cap.upper()}",
        f"PHASE: {phase.upper()}",
        f"LANGUAGE: {'Arabic (respond fully in formal MSA, rtl=true on all sections)' if lang=='ar' else 'English'}",
        f"COUNTRY: {name} {flag} (ISO-3: {ctx.get('iso3','')})",
        "",
        "=== ECONOMIC DATA ===",
        f"GDP: ${ctx.get('gdp_usd_bn','N/A')}B | Growth: {ctx.get('gdp_growth_pct','N/A')}% | Inflation: {ctx.get('inflation_pct','N/A')}%",
        f"UAE Trade Volume: ${ctx.get('trade_uae_bn','N/A')}B | Renewable Energy: {ctx.get('renewable_pct','N/A')}%",
        f"Credit Rating: {ctx.get('credit_rating','N/A')} | Net-Zero Target: {ctx.get('net_zero','N/A')}",
        f"Energy Minister: {ctx.get('energy_minister','N/A')}",
        f"Primary Energy Source: {ctx.get('primary_energy','N/A')}",
    ]

    if ctx.get("cagr") is not None:
        lines += [
            "",
            "=== MATHEMATICAL MODELS (Python-computed) ===",
            f"CAGR (1yr): {ctx['cagr']:+.2%}",
            f"GDP EMA (α=0.30): ${ctx.get('ema_gdp',0):.2f}B",
            f"ESG Sustainability Score: {ctx.get('sustainability',0):.2f}/1.00",
        ]

    agreements = ctx.get("agreements", [])
    if agreements:
        lines += ["", f"=== ACTIVE UAE BILATERAL AGREEMENTS ({len(agreements)}) ==="]
        for ag in agreements[:5]:
            title   = ag.get("title", "")
            summary = (ag.get("summary") or "")[:200]
            lines.append(f"• {title}: {summary}")

    chunks = ctx.get("rag_chunks", [])
    if chunks:
        lines += ["", f"=== RELEVANT MINISTRY DOCUMENTS ({len(chunks)} chunks, RAG) ==="]
        for ch in chunks[:3]:
            src   = ch.get("document_name", "Unknown")
            text  = (ch.get("chunk_text") or "")[:300]
            sim   = ch.get("similarity", 0)
            lines.append(f"[{src} | similarity={sim:.2f}] {text}")

    if ctx.get("key_facts"):
        lines += ["", "=== KEY FACTS ==="]
        lines += [f"• {f}" for f in ctx["key_facts"]]

    if cap == "comparison" and ctx.get("country_name_2"):
        lines += [
            "",
            f"=== COMPARISON: {ctx['country_name_2']} {ctx.get('flag_2','')} ===",
            f"GDP: ${ctx.get('gdp_2','N/A')}B | Growth: {ctx.get('gdp_growth_2','N/A')}%",
            f"UAE Trade: ${ctx.get('trade_uae_2','N/A')}B | Renewables: {ctx.get('renewable_2','N/A')}%",
            f"Net-Zero: {ctx.get('net_zero_2','N/A')} | Primary Energy: {ctx.get('primary_energy_2','N/A')}",
        ]

    if query:
        lines += ["", f"=== USER QUERY ===", query]

    lines.append("\nGenerate the intelligence product JSON array now:")
    return "\n".join(lines)


# ── Agent class ───────────────────────────────────────────────────────────────

class SummarizerAgent(BaseAgent):
    """
    Agent 4 — Executive Summarizer.

    Passes the enriched context to Groq (llama-3.3-70b-versatile) via LangChain
    and streams structured Section JSON back to the pipeline.
    Falls back to static section generators when Groq is not configured.
    """

    name = "Summarizer"

    def __init__(self) -> None:
        self._llm = None
        try:
            from ..config import settings
            self._settings = settings
            if settings.groq_api_key:
                from langchain_groq import ChatGroq
                self._llm = ChatGroq(
                    model=settings.groq_model,
                    api_key=settings.groq_api_key,
                    temperature=0.25,
                    max_tokens=4096,
                )
        except Exception:
            pass

    async def run(self, ctx: dict[str, Any]) -> AsyncGenerator[AgentEvent, None]:  # type: ignore[override]
        from ..models.schemas import SectionEvent, DoneEvent

        yield self.log("> Intelligence product ready — presenting results. ✓", "success")
        await asyncio.sleep(0.05)

        if not self._llm:
            yield self.log(
                "> Groq API key not set — using local intelligence engine",
                "warning",
            )
            sections_data = _fallback_sections(ctx)
        else:
            yield self.log(
                f"> Generating intelligence product via "
                f"Groq ({self._settings.groq_model})...",
            )
            await asyncio.sleep(0.05)

            from langchain_core.messages import SystemMessage, HumanMessage

            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=_build_human_prompt(ctx)),
            ]

            t0 = time.time()
            try:
                resp = await self._llm.ainvoke(messages)
                latency = int((time.time() - t0) * 1000)

                sections_data = _parse_sections(resp.content)

                # Try to extract token usage (Groq returns it)
                tokens = 0
                if hasattr(resp, "usage_metadata") and resp.usage_metadata:
                    tokens = resp.usage_metadata.get("total_tokens", 0)

                ctx["latency_ms"]  = latency
                ctx["tokens_used"] = tokens
                ctx["groq_model"]  = self._settings.groq_model

                yield self.log(
                    f"> Groq response: {len(sections_data)} sections in {latency}ms "
                    f"({tokens} tokens) ✓",
                    "success",
                )

                if not sections_data:
                    yield self.log(
                        "> JSON parse failed — falling back to local engine",
                        "warning",
                    )
                    sections_data = _fallback_sections(ctx)

            except Exception as exc:
                yield self.log(f"> Groq error: {exc} — using local engine", "error")
                sections_data = _fallback_sections(ctx)

        # Emit each section as a separate SSE event
        ctx["sections"] = sections_data
        for raw in sections_data:
            try:
                sec = Section(**raw)
                yield SectionEvent(section=sec)
            except Exception:
                pass
            await asyncio.sleep(0.02)

        yield DoneEvent(
            total_sections=len(sections_data),
            latency_ms=ctx.get("latency_ms", 0),
            tokens_used=ctx.get("tokens_used", 0),
            rag_chunks=ctx.get("rag_chunks_count", 0),
            groq_model=ctx.get("groq_model", "local-fallback"),
        )
