'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLiveWs } from '@/lib/use-live-ws'
import { Lightbulb, TrendingUp, TrendingDown, Minus, Radio, Wifi, WifiOff, Pause, Play, RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportLiveInsightsToPDF } from '@/lib/pdf-generator'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'

const COUNTRIES = [
  { code: 'NOR', label: 'Norway',        flag: 'NO' },
  { code: 'SAU', label: 'Saudi Arabia',  flag: 'SA' },
  { code: 'ARE', label: 'UAE',           flag: 'AE' },
  { code: 'DEU', label: 'Germany',       flag: 'DE' },
  { code: 'CHN', label: 'China',         flag: 'CN' },
  { code: 'IND', label: 'India',         flag: 'IN' },
  { code: 'USA', label: 'United States', flag: 'US' },
  { code: 'JPN', label: 'Japan',         flag: 'JP' },
]

function LiveKPI({ label, value, unit, dir }: { label: string; value: string | number; unit?: string; dir?: 'up' | 'down' | 'flat' }) {
  return (
    <div className="bg-[#0e0b06] border border-[#9b7a36]/30 rounded-2xl px-5 py-4 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9b7a36]">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-extrabold text-white">{value}</span>
        {unit && <span className="text-sm text-[#9b7a36] mb-0.5">{unit}</span>}
        {dir === 'up'   && <TrendingUp   className="w-4 h-4 text-green-400 mb-1" />}
        {dir === 'down' && <TrendingDown className="w-4 h-4 text-red-400   mb-1" />}
        {dir === 'flat' && <Minus        className="w-4 h-4 text-[#9b7a36] mb-1" />}
      </div>
    </div>
  )
}

function CountryInsightPanel({ code, label, onUpdate }: { code: string; label: string; onUpdate: (code: string, data: any) => void }) {
  const { latest, prev, rechartsData, status, paused, togglePause } = useLiveWs({ countryCode: code, maxTicks: 30 })

  const isGdpUp = latest && prev && latest.gdp_ema > prev.gdp_ema
  const isGdpDown = latest && prev && latest.gdp_ema < prev.gdp_ema
  const gdpDir = isGdpUp ? 'up' : (isGdpDown ? 'down' : 'flat') as 'up' | 'down' | 'flat'

  const isInfUp = latest && prev && latest.inflation > prev.inflation
  const isInfDown = latest && prev && latest.inflation < prev.inflation
  const infDir = isInfUp ? 'up' : (isInfDown ? 'down' : 'flat') as 'up' | 'down' | 'flat'

  const note = latest
    ? gdpDir === 'up'
      ? `GDP trending up. Inflation ${infDir === 'up' ? 'rising' : 'stable'}. Monitor tightening risk.`
      : gdpDir === 'down'
        ? `GDP softening. Potential easing opportunity for bilateral engagement.`
        : `Market stable. Good window for strategic investment decisions.`
    : 'No active telemetry data.'

  useEffect(() => {
    if (latest) {
      onUpdate(code, {
        code,
        gdp: `${latest.gdp_ema.toFixed(1)}B`,
        inflation: `${latest.inflation.toFixed(2)}%`,
        note,
      })
    }
  }, [latest, code, note, onUpdate])

  let statusDot: React.ReactNode = null
  if (status === 'live') {
    statusDot = (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400">LIVE</span>
      </span>
    )
  } else if (status === 'mock') {
    statusDot = (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#c2a14e]" />
        <span className="text-[#c2a14e]">SIMULATED</span>
      </span>
    )
  } else if (status === 'connecting') {
    statusDot = (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-blue-400">CONNECTING</span>
      </span>
    )
  } else if (status === 'paused') {
    statusDot = (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-400">PAUSED</span>
      </span>
    )
  } else if (status === 'error') {
    statusDot = (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="text-red-400">ERROR</span>
      </span>
    )
  }

  return (
    <div className="bg-[#1a1208] border border-[#9b7a36]/20 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-[#9b7a36] uppercase tracking-widest">{code}</p>
          <p className="text-base font-bold text-white">{label}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">{statusDot}</div>
          <button onClick={togglePause} className="text-[#9b7a36] hover:text-[#c2a14e] transition-colors">
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <LiveKPI label="GDP EMA" value={latest ? latest.gdp_ema.toFixed(1) : '�'} unit="B" dir={gdpDir} />
        <LiveKPI label="CAGR 1yr" value={latest ? (latest.cagr_1yr * 100).toFixed(2) : '�'} unit="%" />
        <LiveKPI label="Inflation" value={latest ? latest.inflation.toFixed(2) : '�'} unit="%" dir={infDir} />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 gap-3">
        <LiveKPI label="ESG Score" value={latest ? (latest.sustain_score * 100).toFixed(0) : '�'} unit="%" />
        <LiveKPI label="Trade Vol" value={latest ? latest.trade_vol.toFixed(1) : '—'} unit="B" />
      </div>

      {/* Sparkline */}
      {rechartsData.length > 2 ? (
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={rechartsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`ins-${code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#9b7a36" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#9b7a36" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <YAxis tick={{ fill: '#9b7a36', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#1a1208', border: '1px solid #9b7a36', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#c2a14e' }}
              itemStyle={{ color: '#e8dcc8' }}
            />
            <Area type="monotone" dataKey="gdp_ema" stroke="#9b7a36" strokeWidth={2}
              fill={`url(#ins-${code})`} dot={false} isAnimationActive={false} name="GDP EMA" />
            <Line type="monotone" dataKey="inflation" stroke="#c2a14e" strokeWidth={1.5}
              dot={false} isAnimationActive={false} name="Inflation" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[100px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#9b7a36] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Insight pill */}
      {latest && (
        <div className="bg-[#0e0b06] rounded-xl px-4 py-2 text-xs text-[#c2a14e] border border-[#9b7a36]/20">
          {gdpDir === 'up'
            ? `? GDP trending up � inflation ${infDir === 'up' ? 'rising' : 'stable'} � monitor tightening risk`
            : gdpDir === 'down'
              ? `? GDP softening � potential easing opportunity for bilateral engagement`
              : `? Market stable � good window for strategic investment decisions`}
        </div>
      )}
    </div>
  )
}

export function InsightsView() {
  const [selected, setSelected] = useState<string[]>(['NOR', 'SAU', 'DEU', 'USA'])
  const [latestData, setLatestData] = useState<Record<string, any>>({})

  const handleUpdate = useCallback((code: string, data: any) => {
    setLatestData(prev => ({ ...prev, [code]: data }))
  }, [])

  const handleExport = () => {
    const list = selected.map(code => {
      const countryObj = COUNTRIES.find(c => c.code === code)
      return latestData[code] || {
        code,
        gdp: '—',
        inflation: '—',
        note: `Insight stream active for ${countryObj?.label || code}`
      }
    })
    exportLiveInsightsToPDF(selected, list)
  }

  const toggleCountry = (code: string) => {
    setSelected(prev =>
      prev.includes(code)
        ? prev.length > 1 ? prev.filter(c => c !== code) : prev
        : [...prev, code]
    )
  }

  return (
    <div className="min-h-screen bg-[#0e0b06]">
      {/* Page header */}
      <div className="border-b border-[#9b7a36]/20 bg-[#1a1208] px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#9b7a36]/10 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-[#c2a14e]" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Live Intelligence Insights</h1>
              <div className="flex items-center gap-2 mt-1">
                <Radio className="w-3 h-3 text-green-400 animate-pulse" />
                <p className="text-sm text-[#9b7a36]">Real-time data only · WebSocket streams · no cached data</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-amber-200/40 text-amber-100 hover:bg-amber-900/40 gap-1.5 h-9 text-xs font-semibold bg-transparent hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Export Insights (PDF)
            </Button>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#9b7a36] border border-[#9b7a36]/30 rounded-full px-3 py-1.5 bg-black/40">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {selected.length} STREAMS ACTIVE
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Country selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              onClick={() => toggleCountry(c.code)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                selected.includes(c.code)
                  ? 'bg-[#9b7a36] text-[#0e0b06] shadow-md'
                  : 'border border-[#9b7a36]/30 text-[#9b7a36] hover:bg-[#9b7a36]/10'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {COUNTRIES.filter(c => selected.includes(c.code)).map(c => (
            <CountryInsightPanel key={c.code} code={c.code} label={c.label} onUpdate={handleUpdate} />
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-10 flex items-start gap-2 bg-[#1a1208] border border-[#9b7a36]/20 rounded-xl px-5 py-4">
          <Wifi className="w-4 h-4 text-[#9b7a36] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#9b7a36]">
            All data shown is streamed live from the Python WebSocket backend (<code className="text-[#c2a14e]">ws://localhost:8000/ws/live/CODE</code>).
            When the backend is offline, a physics-accurate EMA/CAGR simulation runs client-side so the interface remains usable.
            No historical or cached data is used in this view.
          </p>
        </div>
      </div>
    </div>
  )
}