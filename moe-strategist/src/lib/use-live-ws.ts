'use client'
// ============================================================================
// useLiveWs — Real-time economic tick hook
//
// Priority order:
//   1. Python WebSocket backend  (/ws/live/{countryCode})
//   2. Mock feed fallback        (createMockFeed from lib/mock-websocket)
//
// The hook exposes exactly the same API regardless of which source is active,
// so components don't need to know whether data is real or simulated.
// ============================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createMockFeed, type LiveTick } from './mock-websocket'

export type WsStatus = 'connecting' | 'live' | 'mock' | 'paused' | 'error'

export interface UseLiveWsOptions {
  countryCode: string        // ISO-3 code e.g. 'NOR', 'CHN'
  maxTicks?:   number        // max history rows (default 20)
  intervalMs?: number        // mock feed interval (default 2000)
  enabled?:    boolean       // set false to skip connecting
}

export interface UseLiveWsReturn {
  ticks:          LiveTick[]
  latest:         LiveTick | null
  prev:           LiveTick | null
  paused:         boolean
  status:         WsStatus
  togglePause:    () => void
  dir:            (key: keyof LiveTick) => 'up' | 'down' | 'neutral'
  lineChartData:  (string | number)[][]  // Google Charts format
  rechartsData:   RechartsPoint[]        // Recharts format
  clear:          () => void
}

export interface RechartsPoint {
  time:       string
  gdp_ema:    number
  gdp_raw:    number
  inflation:  number
  trade_vol:  number
  sustain:    number
  cagr_pct:   number
}

const DEFAULT_MAX = 20

export function useLiveWs({
  countryCode,
  maxTicks   = DEFAULT_MAX,
  intervalMs = 2000,
  enabled    = true,
}: UseLiveWsOptions): UseLiveWsReturn {
  const [ticks, setTicks]   = useState<LiveTick[]>([])
  const [status, setStatus] = useState<WsStatus>('connecting')
  const [paused, setPaused] = useState(false)

  const pausedRef  = useRef(false)
  const wsRef      = useRef<WebSocket | null>(null)
  const mockRef    = useRef<ReturnType<typeof createMockFeed> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Append tick to ring buffer ────────────────────────────────────────────

  const push = useCallback((raw: unknown) => {
    if (pausedRef.current) return
    try {
      const tick = raw as LiveTick
      if (typeof tick.gdp_raw !== 'number') return
      setTicks(prev => [...prev.slice(-(maxTicks - 1)), tick])
    } catch { /* ignore */ }
  }, [maxTicks])

  // ── Mock fallback ─────────────────────────────────────────────────────────

  const startMock = useCallback(() => {
    mockRef.current?.stop()
    setStatus('mock')
    const feed = createMockFeed({ intervalMs })
    mockRef.current = feed
    feed.start(push)
  }, [intervalMs, push])

  // ── Real WebSocket ────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!enabled) return
    if (typeof window === 'undefined') { startMock(); return }

    // Build WS URL — works both via Next.js /ws/* rewrite proxy and direct
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host  = window.location.host
    const url   = `${proto}//${host}/ws/live/${countryCode.toUpperCase()}`

    setStatus('connecting')

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('live')
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }

    ws.onmessage = (ev) => {
      try {
        push(JSON.parse(ev.data))
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onclose = () => {
      wsRef.current = null
      // Try once to reconnect after 3s, then fall back to mock
      reconnectRef.current = setTimeout(() => {
        const ws2 = new WebSocket(url)
        wsRef.current = ws2

        ws2.onopen = () => setStatus('live')
        ws2.onmessage = (ev) => {
          try { push(JSON.parse(ev.data)) } catch { /* ignore */ }
        }
        ws2.onerror = () => { ws2.close(); startMock() }
        ws2.onclose = () => { wsRef.current = null; startMock() }
      }, 3000)
    }
  }, [countryCode, enabled, push, startMock])

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    setTicks([])
    connect()

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
      wsRef.current = null
      mockRef.current?.stop()
      mockRef.current = null
    }
  // Re-connect when country changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, enabled])

  // ── Controls ──────────────────────────────────────────────────────────────

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(p => !p)
    setStatus(pausedRef.current ? 'paused' : (wsRef.current ? 'live' : 'mock'))
  }, [])

  const clear = useCallback(() => setTicks([]), [])

  // ── Derived values ────────────────────────────────────────────────────────

  const latest = ticks[ticks.length - 1] ?? null
  const prev   = ticks[ticks.length - 2] ?? null

  const dir = useCallback(
    (key: keyof LiveTick): 'up' | 'down' | 'neutral' => {
      if (!latest || !prev) return 'neutral'
      const a = latest[key] as number
      const b = prev[key]   as number
      return a > b ? 'up' : a < b ? 'down' : 'neutral'
    },
    [latest, prev],
  )

  // Google Charts format
  const lineChartData = useMemo<(string | number)[][]>(() => {
    const header = ['Time', 'GDP (EMA)', 'GDP (Raw)', 'Inflation']
    if (!ticks.length) return [header]
    return [
      header,
      ...ticks.map(t => [
        new Date(t.ts).toLocaleTimeString('en', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
        t.gdp_ema,
        t.gdp_raw,
        t.inflation,
      ]),
    ]
  }, [ticks])

  // Recharts format
  const rechartsData = useMemo<RechartsPoint[]>(
    () =>
      ticks.map(t => ({
        time:      new Date(t.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        gdp_ema:   parseFloat(t.gdp_ema.toFixed(2)),
        gdp_raw:   parseFloat(t.gdp_raw.toFixed(2)),
        inflation: parseFloat(t.inflation.toFixed(3)),
        trade_vol: parseFloat(t.trade_vol.toFixed(1)),
        sustain:   parseFloat((t.sustain_score * 100).toFixed(1)),
        cagr_pct:  parseFloat((t.cagr_1yr * 100).toFixed(3)),
      })),
    [ticks],
  )

  return {
    ticks,
    latest,
    prev,
    paused,
    status,
    togglePause,
    dir,
    lineChartData,
    rechartsData,
    clear,
  }
}
