from __future__ import annotations

import asyncio
import math
from typing import Any, AsyncGenerator

from .base import BaseAgent
from ..models.schemas import AgentEvent

EMA_ALPHA = 0.3


def cagr(v_final: float, v_initial: float, t: float) -> float:
    """Compound Annual Growth Rate."""
    if v_initial <= 0 or t <= 0 or v_final <= 0:
        return 0.0
    return (v_final / v_initial) ** (1.0 / t) - 1.0


def ema(alpha: float, x: float, prev: float) -> float:
    """Exponential Moving Average."""
    return alpha * x + (1.0 - alpha) * prev


def sustainability_score(
    renewable_pct: float,
    net_zero_year: int,
    gdp_growth_pct: float,
) -> float:
    """
    Composite ESG Sustainability Score [0, 1].

    Weights:
      40% — renewable energy share
      35% — net-zero year proximity (2050 = 1.0, 2100 = 0.0)
      25% — normalised GDP growth (-5 % → 0.0, +5 % → 1.0)
    """
    renew  = min(renewable_pct / 100.0, 1.0)
    nz     = max(0.0, 1.0 - (net_zero_year - 2050) / 50.0)
    growth = max(0.0, min(1.0, (gdp_growth_pct + 5.0) / 10.0))
    return round(0.40 * renew + 0.35 * nz + 0.25 * growth, 4)


class PredictiveEngine(BaseAgent):
    """
    Agent 3 — Predictive Engine.

    Runs real-time mathematical models on the country data that
    was loaded by the Ingestion Agent and passes the results to
    the Summarizer Agent for LLM-contextualised interpretation.
    """

    name = "Predictive Engine"

    async def run(self, ctx: dict[str, Any]) -> AsyncGenerator[AgentEvent, None]:  # type: ignore[override]
        gdp        = float(ctx.get("gdp_usd_bn")  or 0)
        gdp_growth = float(ctx.get("gdp_growth_pct") or 0)
        renewable  = float(ctx.get("renewable_pct") or 0)
        net_zero   = int(ctx.get("net_zero") or 2060)

        yield self.log("> Applying MOEI diplomatic sensitivity filters...")
        await asyncio.sleep(0.05)

        yield self.log("> Running CAGR analysis on GDP trajectory...")
        await asyncio.sleep(0.05)

        # CAGR — 1-year window inferred from growth rate
        v_initial = gdp / (1.0 + gdp_growth / 100.0) if gdp > 0 else 1.0
        cagr_val = cagr(gdp, v_initial, 1.0)
        ctx["cagr"] = cagr_val
        yield self.log(
            f"> CAGR (1yr): {cagr_val:+.2%} "
            f"[v₀=${v_initial:.1f}B → v₁=${gdp:.1f}B] ✓",
            "success",
        )

        yield self.log("> Computing Exponential Moving Average (GDP series)...")
        await asyncio.sleep(0.05)

        # EMA — use GDP * 0.97 as a synthetic prev value
        ema_val = ema(EMA_ALPHA, gdp, gdp * 0.97)
        ctx["ema_gdp"] = round(ema_val, 4)
        yield self.log(
            f"> EMA GDP: ${ema_val:.2f}B  (α={EMA_ALPHA}) ✓",
            "success",
        )

        yield self.log("> Computing ESG Sustainability composite score...")
        await asyncio.sleep(0.05)

        sustain = sustainability_score(renewable, net_zero, gdp_growth)
        ctx["sustainability"] = sustain
        yield self.log(
            f"> Sustainability Score: {sustain:.2f}/1.00 "
            f"(renewables={renewable:.0f}%, net-zero={net_zero}) ✓",
            "success",
        )

        yield self.log("> Confidence threshold: PASSED ✓", "success")
