/**
 * Mock WebSocket / SSE feed generator.
 *
 * Emits trend-following LiveTick objects at a configurable interval using the
 * EMA formula to produce realistic, smooth-but-noisy data streams.
 * Drop-in: replace `createMockFeed` with a real WebSocket client when the
 * backend is ready — the LiveTick contract stays identical.
 */

import { ema, cagr, sustainabilityScore, EMA_ALPHA } from './math-models'

// ── Public data contract ──────────────────────────────────────────────────────

export interface LiveTick {
  /** Unix timestamp (ms) */
  ts: number
  /** Monotonic sequence number */
  seq: number
  /** Raw (noisy) GDP growth rate % */
  gdp_raw: number
  /** EMA-smoothed GDP growth rate % */
  gdp_ema: number
  /** Trade volume index (USD millions, normalised) */
  trade_vol: number
  /** Inflation rate % */
  inflation: number
  /** Sustainability score [0, 1] */
  sustain_score: number
  /** 1-year CAGR relative to baseline GDP */
  cagr_1yr: number
  /** Simulated WebSocket round-trip latency (ms) */
  latency_ms: number
}

export interface FeedOptions {
  /** Starting inflation rate for the simulation */
  baseInflation?: number
  /** Starting GDP growth rate for the simulation */
  baseGdp?: number
  /** Tick interval in milliseconds (default: 1000) */
  intervalMs?: number
}

// ── Feed factory ──────────────────────────────────────────────────────────────

export function createMockFeed(options: FeedOptions = {}) {
  const baseInflation = options.baseInflation ?? 2.5
  const baseGdp = options.baseGdp ?? 4.2
  const intervalMs = options.intervalMs ?? 1000

  // Internal mutable state (intentionally not React state)
  let seq = 0
  let prevGdpEma = baseGdp
  let prevGdpRaw = baseGdp
  let prevInflation = baseInflation
  let prevTradeVol = 450
  let intervalId: ReturnType<typeof setInterval> | null = null

  // Energy sectors: renewables(r), total(t), strategic weight(w)
  const sectors = [
    { r: 28, t: 100, w: 0.40 }, // Power generation
    { r: 42, t: 100, w: 0.35 }, // Industrial
    { r: 18, t: 100, w: 0.25 }, // Transport
  ]

  const subscribers = new Set<(tick: LiveTick) => void>()

  // ── Tick generator ────────────────────────────────────────────────────────
  const emit = () => {
    seq++

    // Random walk with mean-reversion toward baseline
    const gdpDrift =
      (Math.random() - 0.48) * 0.14 +
      (baseGdp - prevGdpRaw) * 0.05 // gentle pull to baseline

    const gdpRaw = Math.max(0.2, Math.min(12, prevGdpRaw + gdpDrift))
    const gdpEmaNew = ema(EMA_ALPHA, gdpRaw, prevGdpEma)

    const inflationNew = ema(
      0.15,
      baseInflation + (Math.random() - 0.5) * 0.3,
      prevInflation
    )

    const tradeVolNew = ema(
      0.25,
      450 + (Math.random() - 0.5) * 30,
      prevTradeVol
    )

    // Drift sector renewables slowly upward (energy transition)
    sectors.forEach((s) => {
      s.r = Math.min(s.t, Math.max(0, s.r + (Math.random() - 0.45) * 0.6))
    })

    const sustain = sustainabilityScore(sectors)
    const cagrVal = cagr(gdpEmaNew, baseGdp, 1)

    const tick: LiveTick = {
      ts: Date.now(),
      seq,
      gdp_raw: parseFloat(gdpRaw.toFixed(3)),
      gdp_ema: parseFloat(gdpEmaNew.toFixed(3)),
      trade_vol: parseFloat(tradeVolNew.toFixed(1)),
      inflation: parseFloat(inflationNew.toFixed(2)),
      sustain_score: parseFloat(sustain.toFixed(4)),
      cagr_1yr: parseFloat(cagrVal.toFixed(4)),
      latency_ms: Math.floor(75 + Math.random() * 90),
    }

    prevGdpRaw = gdpRaw
    prevGdpEma = gdpEmaNew
    prevInflation = inflationNew
    prevTradeVol = tradeVolNew

    subscribers.forEach((cb) => {
      try { cb(tick) } catch { /* isolate subscriber errors */ }
    })
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    /**
     * Start receiving ticks. Multiple callers can subscribe; each gets every tick.
     * Calling start() when already running just adds the new subscriber.
     */
    start(cb: (tick: LiveTick) => void): void {
      subscribers.add(cb)
      if (!intervalId) {
        intervalId = setInterval(emit, intervalMs)
      }
    },

    /** Stop the feed and clear all subscribers. */
    stop(): void {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      subscribers.clear()
    },

    /** Remove a single subscriber without stopping the feed. */
    unsubscribe(cb: (tick: LiveTick) => void): void {
      subscribers.delete(cb)
    },
  }
}
