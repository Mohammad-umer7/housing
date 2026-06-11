from __future__ import annotations

import asyncio
import random
import time
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..agents.ingestion import COUNTRY_FALLBACK, resolve_code
from ..models.schemas import LiveTick

router = APIRouter()

EMA_ALPHA = 0.3


def _ema(alpha: float, x: float, prev: float) -> float:
    return alpha * x + (1.0 - alpha) * prev


def _cagr(v_final: float, v_initial: float) -> float:
    if v_initial <= 0 or v_final <= 0:
        return 0.0
    return v_final / v_initial - 1.0


def _sustainability(renewable: float, net_zero: int, growth: float) -> float:
    renew  = min(renewable / 100.0, 1.0)
    nz     = max(0.0, 1.0 - (net_zero - 2050) / 50.0)
    gr     = max(0.0, min(1.0, (growth + 5.0) / 10.0))
    return round(0.40 * renew + 0.35 * nz + 0.25 * gr, 4)


@router.websocket("/live/{country_code}")
async def websocket_live(websocket: WebSocket, country_code: str) -> None:
    """
    WS /ws/live/{country_code}

    Streams live economic ticks every 2 seconds using a random-walk
    EMA model seeded from the country's real GDP baseline.

    Front-end can connect directly to ws://localhost:8000/ws/live/NOR
    """
    await websocket.accept()

    iso3 = resolve_code(country_code) or country_code.upper()
    fb   = COUNTRY_FALLBACK.get(iso3, {})

    # Seed initial values from country baseline
    base_gdp   = float(fb.get("gdp",       419.0))
    base_trade = float(fb.get("trade_uae",   3.1))
    base_infl  = float(fb.get("inflation",   3.5))
    net_zero   = int(  fb.get("net_zero",   2050))
    renewable  = float(fb.get("renewable",  50.0))
    gdp_growth = float(fb.get("gdp_growth",  2.0))
    sustain_base = _sustainability(renewable, net_zero, gdp_growth)

    prev_gdp   = base_gdp
    prev_ema   = base_gdp
    prev_trade = base_trade
    seq        = 0

    # Store last tick in Supabase (optional, best-effort)
    _sb = None
    try:
        from ..config import settings
        if settings.supabase_url and settings.supabase_service_role_key:
            from supabase import create_client
            _sb = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
    except Exception:
        pass

    try:
        while True:
            t0 = time.time()

            # Random walk on GDP (±0.8% per tick)
            delta     = random.gauss(0, prev_gdp * 0.008)
            gdp_raw   = round(prev_gdp + delta, 4)
            gdp_ema   = round(_ema(EMA_ALPHA, gdp_raw, prev_ema), 4)
            trade_vol = round(prev_trade * random.uniform(0.992, 1.008), 4)
            inflation = round(base_infl + random.gauss(0, 0.15), 4)
            sustain   = round(
                sustain_base + random.gauss(0, 0.01), 4
            )
            cagr_v    = round(_cagr(gdp_raw, prev_gdp), 6)
            latency   = int((time.time() - t0) * 1000) + random.randint(5, 20)

            tick = LiveTick(
                ts           =datetime.now(timezone.utc).isoformat(),
                seq          =seq,
                country_code =iso3,
                gdp_raw      =gdp_raw,
                gdp_ema      =gdp_ema,
                trade_vol    =trade_vol,
                inflation    =inflation,
                sustain_score=max(0.0, min(1.0, sustain)),
                cagr_1yr     =cagr_v,
                latency_ms   =latency,
            )

            await websocket.send_text(tick.model_dump_json())

            # Persist to Supabase (best-effort, non-blocking)
            if _sb:
                try:
                    _sb.rpc("upsert_live_tick", {
                        "p_country_code": iso3,
                        "p_seq":          seq,
                        "p_gdp_raw":      gdp_raw,
                        "p_gdp_ema":      gdp_ema,
                        "p_trade_vol":    trade_vol,
                        "p_inflation":    inflation,
                        "p_sustain":      sustain,
                        "p_cagr":         cagr_v,
                        "p_latency_ms":   latency,
                        "p_source":       "mock",
                    }).execute()
                except Exception:
                    pass

            prev_gdp   = gdp_raw
            prev_ema   = gdp_ema
            prev_trade = trade_vol
            seq       += 1

            await asyncio.sleep(2.0)

    except WebSocketDisconnect:
        pass
