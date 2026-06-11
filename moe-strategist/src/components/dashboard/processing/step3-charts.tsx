'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Download, Table2, TrendingUp, AlertTriangle, Globe, BarChart3, Radio, Pause, Play, Wifi, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ModuleType } from '@/types/modules'
import type { LiveTick } from '@/lib/mock-websocket'
import { useLiveWs } from '@/lib/use-live-ws'
import { FORMULAS } from '@/lib/math-models'

// ── Methodology tooltip ───────────────────────────────────────────────────────

function FormulaTooltip({ formulaKey }: { formulaKey: keyof typeof FORMULAS }) {
  const [show, setShow] = useState(false)
  const f = FORMULAS[formulaKey]
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-[#e8dcc8] text-[#9b7a36] text-[10px] font-bold flex items-center justify-center hover:bg-[#9b7a36] hover:text-white transition-colors"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 bg-[#1a1208] text-[#c2a14e] rounded-xl p-3 text-xs shadow-2xl z-50 border border-[#3a2c14]">
          <p className="font-bold text-white mb-1">{f.label}</p>
          <p className="font-mono text-[#ffb87a] mb-2">{f.plain}</p>
          <p className="text-[#a89060] leading-relaxed">{f.description}</p>
        </div>
      )}
    </div>
  )
}

// ── Live stat card (flashes green/red on change) ──────────────────────────────

interface LiveStatCardProps {
  label: string
  value: string
  subValue?: string
  direction: 'up' | 'down' | 'neutral'
  isLive?: boolean
  formulaKey?: keyof typeof FORMULAS
  accent?: string
}

function LiveStatCard({ label, value, subValue, direction, isLive, formulaKey, accent = '#9b7a36' }: LiveStatCardProps) {
  const [flash, setFlash] = useState(false)
  const prevDir = useRef(direction)

  useEffect(() => {
    if (isLive && direction !== prevDir.current) {
      prevDir.current = direction
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [direction, isLive])

  const flashColor =
    direction === 'up' ? 'rgba(34,197,94,0.18)'
    : direction === 'down' ? 'rgba(239,68,68,0.15)'
    : 'transparent'

  return (
    <div
      className="rounded-2xl border-2 p-4 transition-all duration-300"
      style={{
        borderColor: flash ? (direction === 'up' ? '#22c55e' : '#ef4444') : '#e8dcc8',
        background: flash ? flashColor : 'white',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-[#9b7a36] font-medium">{label}</p>
          {formulaKey && <FormulaTooltip formulaKey={formulaKey} />}
        </div>
        {isLive && (
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${
              direction === 'up' ? 'bg-green-400' : direction === 'down' ? 'bg-red-400' : 'bg-[#c2a14e]'
            } animate-pulse`}
          />
        )}
      </div>
      <p
        className="text-xl font-bold transition-colors duration-300"
        style={{ color: flash ? (direction === 'up' ? '#16a34a' : '#dc2626') : '#4a3728' }}
      >
        {value}
      </p>
      {subValue && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className={`text-xs font-semibold ${
              direction === 'up' ? 'text-green-600' : direction === 'down' ? 'text-red-500' : 'text-[#9b7a36]'
            }`}
          >
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '◆'} {subValue}
          </span>
        </div>
      )}
    </div>
  )
}

// ── useLiveFeed — wraps useLiveWs with same API ───────────────────────────────

function useLiveFeed(inputData: Record<string, unknown>) {
  // Resolve country code: prefer inputData.country_code, else fall back to 'NOR'
  const countryCode = String(inputData.country_code ?? inputData.country ?? 'NOR').slice(0, 3).toUpperCase()

  return useLiveWs({ countryCode, maxTicks: 20, intervalMs: 2000 })
}

// ── LiveMonitor section (prepended to every Step 3 result) ────────────────────

function LiveMonitor({ inputData }: { inputData: Record<string, unknown> }) {
  const { latest, dir, lineChartData, paused, togglePause, status } = useLiveFeed(inputData)
  const isLive = Boolean(inputData.isLive)

  const statusBadge = {
    live:       <span className="flex items-center gap-1 text-[10px] font-mono text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg"><Wifi className="w-3 h-3" /> LIVE</span>,
    mock:       <span className="flex items-center gap-1 text-[10px] font-mono text-[#c2a14e] bg-[#f6f0e1] border border-[#e8dcc8] px-2 py-0.5 rounded-lg"><WifiOff className="w-3 h-3" /> SIMULATED</span>,
    connecting: <span className="flex items-center gap-1 text-[10px] font-mono text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg animate-pulse">CONNECTING…</span>,
    paused:     <span className="flex items-center gap-1 text-[10px] font-mono text-[#9b7a36] bg-[#f6f0e1] border border-[#e8dcc8] px-2 py-0.5 rounded-lg">⏸ PAUSED</span>,
    error:      <span className="flex items-center gap-1 text-[10px] font-mono text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">ERROR</span>,
  }[status]

  return (
    <div className="mb-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#9b7a36]/10 rounded-lg flex items-center justify-center">
            <Radio className="w-4 h-4 text-[#9b7a36]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#4a3728]">
              Live Mathematical Monitor
            </h3>
            <p className="text-xs text-[#9b7a36]">
              Real-time EMA smoothing · CAGR projection · Sustainability scoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          {latest && (
            <span className="text-xs text-[#9b7a36] bg-[#f6f0e1] px-2 py-1 rounded-lg border border-[#e8dcc8] font-mono">
              {latest.latency_ms}ms
            </span>
          )}
          <button
            onClick={togglePause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e8dcc8] text-xs font-semibold text-[#9b7a36] bg-white hover:bg-[#f6f0e1] transition-colors"
          >
            {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
          </button>
        </div>
      </div>

      {/* Live stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <LiveStatCard
          label="GDP Growth (EMA)"
          value={latest ? `${latest.gdp_ema.toFixed(2)}%` : '—'}
          subValue={latest && dir('gdp_ema') !== 'neutral' ? `${Math.abs(latest.gdp_ema - (lineChartData[lineChartData.length - 2]?.[1] as number ?? latest.gdp_ema)).toFixed(3)} pp` : undefined}
          direction={dir('gdp_ema')}
          isLive={!paused}
          formulaKey="ema"
        />
        <LiveStatCard
          label="CAGR (1-Year)"
          value={latest ? `${(latest.cagr_1yr * 100).toFixed(2)}%` : '—'}
          subValue={latest ? `base ${(Number(inputData.baselineGdp ?? 4.2)).toFixed(1)}%` : undefined}
          direction={dir('cagr_1yr')}
          isLive={!paused}
          formulaKey="cagr"
        />
        <LiveStatCard
          label="Sustainability Score"
          value={latest ? `${(latest.sustain_score * 100).toFixed(1)}%` : '—'}
          subValue={latest ? 'weighted Σ wᵢ·(Rᵢ/Tᵢ)' : undefined}
          direction={dir('sustain_score')}
          isLive={!paused}
          formulaKey="sustainability"
        />
        <LiveStatCard
          label="Trade Volume Index"
          value={latest ? `${latest.trade_vol.toFixed(0)}` : '—'}
          subValue={latest ? `Inflation ${latest.inflation.toFixed(2)}%` : undefined}
          direction={dir('trade_vol')}
          isLive={!paused}
        />
      </div>

      {/* Real-time line chart */}
      <Card className="border-2 border-[#e8dcc8] bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#4a3728]">
            Live GDP & Inflation Stream
            <span className="ml-2 text-xs font-normal text-[#9b7a36]">
              (EMA-smoothed · updates every 2s)
            </span>
          </p>
          {status === 'live' && latest && (
            <span className="text-[10px] font-mono text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">
              ● LIVE · seq#{latest.seq}
            </span>
          )}
          {status === 'mock' && latest && (
            <span className="text-[10px] font-mono text-[#c2a14e] bg-[#f6f0e1] border border-[#e8dcc8] px-2 py-0.5 rounded-lg">
              ◆ SIM · seq#{latest.seq}
            </span>
          )}
          {status === 'paused' && (
            <span className="text-[10px] font-mono text-[#9b7a36] bg-[#f6f0e1] border border-[#e8dcc8] px-2 py-0.5 rounded-lg">
              ⏸ PAUSED
            </span>
          )}
        </div>
        {lineChartData.length > 2 ? (
          <Chart
            key={lineChartData.length}
            chartType="LineChart"
            data={lineChartData}
            options={{
              fontName: 'Georgia',
              backgroundColor: 'transparent',
              title: '',
              legend: { textStyle: { color: '#9b7a36', fontSize: 11 }, position: 'bottom' },
              hAxis: { textStyle: { color: '#9b7a36', fontSize: 9 }, gridlines: { color: '#f6f0e1' }, slantedText: true, slantedTextAngle: 30 },
              vAxis: { textStyle: { color: '#4a3728' }, gridlines: { color: '#e8dcc8' } },
              curveType: 'function',
              lineWidth: 2,
              colors: ['#9b7a36', '#c2a14e', '#ef4444'],
              series: {
                0: { lineWidth: 2.5 },
                1: { lineWidth: 1.5, lineDashStyle: [4, 2] },
                2: { lineWidth: 1.5, lineDashStyle: [2, 3] },
              },
              animation: { duration: 400, easing: 'out' },
            }}
            width="100%"
            height="240px"
          />
        ) : (
          <div className="flex items-center justify-center h-44 text-sm text-[#c2a14e]">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-[#9b7a36] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Collecting live data...
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Lazy-load Google Charts (no SSR) ─────────────────────────────────────────
const Chart = dynamic(() => import('react-google-charts').then((m) => m.Chart), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 rounded-xl bg-[#faf6ec] border-2 border-dashed border-[#e8dcc8]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#9b7a36] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-[#9b7a36]">Loading chart...</p>
      </div>
    </div>
  ),
})

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-bold text-[#4a3728]">{title}</h3>
      {subtitle && <p className="text-xs text-[#9b7a36] mt-0.5">{subtitle}</p>}
    </div>
  )
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8dcc8]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f6f0e1]">
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-bold text-[#9b7a36] uppercase tracking-wider border-b border-[#e8dcc8]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#faf6ec]'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-[#4a3728] border-b border-[#f6f0e1]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExportButton({ onExport }: { onExport: () => void }) {
  return (
    <Button
      onClick={onExport}
      className="gap-2 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold rounded-xl shadow"
    >
      <Download className="w-4 h-4" />
      Export Report
    </Button>
  )
}

const CHART_OPTIONS_BASE = {
  fontName: 'Georgia',
  backgroundColor: 'transparent',
  titleTextStyle: { color: '#4a3728', fontSize: 14, bold: true },
  legend: { textStyle: { color: '#9b7a36' } },
  hAxis: { textStyle: { color: '#4a3728' }, gridlines: { color: '#e8dcc8' } },
  vAxis: { textStyle: { color: '#4a3728' }, gridlines: { color: '#e8dcc8' } },
}

// ── Comparison Results (GeoChart + Column Chart) ──────────────────────────────

function ComparisonResults({ inputData }: { inputData: Record<string, unknown> }) {
  const countries: string[] = (inputData.countries as string[]) ?? [
    'Saudi Arabia', 'UAE', 'Qatar', 'Kuwait',
  ]

  // Mock GDP data for selected countries (USD Billions)
  const gdpMap: Record<string, number> = {
    'Saudi Arabia': 1061, 'United Arab Emirates': 509, 'Qatar': 237, 'Kuwait': 162,
    'Bahrain': 45, 'Oman': 108, 'Egypt': 476, 'Jordan': 50, 'Iraq': 269,
    'China': 18500, 'USA': 27360, 'Germany': 4430, 'Japan': 4280, 'India': 3750,
    'UK': 3130, 'France': 3050, 'South Korea': 1710, 'Brazil': 2190, 'South Africa': 380,
  }

  const energyMap: Record<string, number> = {
    'Saudi Arabia': 78, 'United Arab Emirates': 65, 'Qatar': 71, 'Kuwait': 60,
    'Bahrain': 45, 'Oman': 55, 'Egypt': 40, 'Jordan': 30, 'Iraq': 68,
    'China': 55, 'USA': 48, 'Germany': 52, 'Japan': 44, 'India': 38,
    'UK': 50, 'France': 58, 'South Korea': 46, 'Brazil': 42, 'South Africa': 35,
  }

  const geoData: (string | number)[][] = [
    ['Country', 'GDP (USD Billions)'],
    ...countries.map((c) => [c, gdpMap[c] ?? 200]),
  ]

  const colData: (string | number | { role: string })[][] = [
    ['Country', 'GDP (B)', { role: 'style' }, 'Energy Inv. %', { role: 'style' }],
    ...countries.map((c, i) => [
      c,
      gdpMap[c] ?? 200,
      `color: #9b7a36; opacity: ${0.6 + i * 0.1}`,
      energyMap[c] ?? 40,
      `color: #c2a14e; opacity: ${0.6 + i * 0.1}`,
    ]),
  ]

  const tableRows = countries.map((c) => [
    c,
    `$${(gdpMap[c] ?? 200).toLocaleString()}B`,
    `${energyMap[c] ?? 40}%`,
    ((gdpMap[c] ?? 200) / (countries.length * 200)).toFixed(2),
  ])

  const handleExport = () => {
    const csv = [
      'Country,GDP (B),Energy Investment (%)',
      ...countries.map((c) => `${c},${gdpMap[c] ?? 200},${energyMap[c] ?? 40}`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'comparison-report.csv'
    a.click()
  }

  return (
    <div className="space-y-8">
      {/* GeoChart */}
      <Card className="border-2 border-[#e8dcc8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#9b7a36]/10 rounded-lg flex items-center justify-center">
            <Globe className="w-4 h-4 text-[#9b7a36]" />
          </div>
          <SectionTitle title="Geographic Distribution" subtitle="GDP visualized on world map" />
        </div>
        <Chart
          chartType="GeoChart"
          data={geoData}
          options={{
            colorAxis: { colors: ['#f6f0e1', '#9b7a36'] },
            backgroundColor: '#faf6ec',
            datalessRegionColor: '#f0e8d4',
            defaultColor: '#e8dcc8',
            legend: { textStyle: { color: '#9b7a36' } },
          }}
          width="100%"
          height="320px"
        />
      </Card>

      {/* Column Chart */}
      <Card className="border-2 border-[#e8dcc8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#9b7a36]/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#9b7a36]" />
          </div>
          <SectionTitle title="Side-by-Side Metric Comparison" subtitle="GDP vs Energy Investment Index" />
        </div>
        <Chart
          chartType="ColumnChart"
          data={colData}
          options={{
            ...CHART_OPTIONS_BASE,
            title: 'GDP & Energy Investment by Country',
            bar: { groupWidth: '60%' },
            seriesType: 'bars',
          }}
          width="100%"
          height="320px"
        />
      </Card>

      {/* Data table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#9b7a36]" />
            <h3 className="text-sm font-bold text-[#4a3728]">Raw Data Summary</h3>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        <DataTable
          columns={['Country', 'GDP (USD Billions)', 'Energy Investment', 'Share Index']}
          rows={tableRows}
        />
      </div>
    </div>
  )
}

// ── Advanced Results (Line Chart — 5-year forecast) ───────────────────────────

function AdvancedResults({ inputData }: { inputData: Record<string, unknown> }) {
  const country = (inputData.country as string) ?? 'Saudi Arabia'
  const energyInv = Number(inputData.energyInv ?? 35)
  const years = Number(inputData.forecastYears ?? 5)

  const currentYear = 2025
  const baseGDP = 4.2
  const boost = energyInv * 0.04

  // Generate baseline, optimistic, pessimistic series
  const lineData: (string | number | null)[][] = [
    ['Year', 'Baseline', 'Optimistic', 'Pessimistic', 'Historical'],
    [String(currentYear - 2), null, null, null, 3.8],
    [String(currentYear - 1), null, null, null, 4.0],
    [String(currentYear), baseGDP, baseGDP, baseGDP, baseGDP],
    ...Array.from({ length: years }, (_, i) => {
      const yr = currentYear + i + 1
      const base = parseFloat((baseGDP + (i + 1) * 0.25 + boost * 0.1).toFixed(2))
      const opt = parseFloat((base + 0.4 + boost * 0.05).toFixed(2))
      const pess = parseFloat((base - 0.35).toFixed(2))
      return [String(yr), base, opt, pess, null]
    }),
  ]

  const riskScore = Math.max(20, 85 - energyInv * 0.3).toFixed(0)
  const forecastGDP = (baseGDP + years * 0.25 + boost * 0.5).toFixed(1)

  const handleExport = () => {
    const csv = lineData.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'scenario-forecast.csv'
    a.click()
  }

  return (
    <div className="space-y-8">
      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Target Country', value: country, icon: Globe, color: 'text-amber-600' },
          { label: `${years}yr GDP Forecast`, value: `${forecastGDP}%`, icon: TrendingUp, color: 'text-green-600' },
          { label: 'Risk Score', value: `${riskScore}/100`, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Energy Boost', value: `+${(boost * 0.5).toFixed(1)}%`, icon: BarChart3, color: 'text-blue-600' },
        ].map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="border-2 border-[#e8dcc8] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#faf6ec] flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div>
                  <p className="text-xs text-[#9b7a36] mb-0.5">{m.label}</p>
                  <p className="text-sm font-bold text-[#4a3728]">{m.value}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Line Chart */}
      <Card className="border-2 border-[#e8dcc8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#9b7a36]/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#9b7a36]" />
          </div>
          <SectionTitle
            title={`${country} — ${years}-Year GDP Growth Forecast`}
            subtitle="Baseline, Optimistic & Pessimistic scenarios"
          />
        </div>
        <Chart
          chartType="LineChart"
          data={lineData}
          options={{
            ...CHART_OPTIONS_BASE,
            title: `GDP Growth Forecast — ${country}`,
            curveType: 'function',
            colors: ['#9b7a36', '#22c55e', '#ef4444', '#c2a14e'],
            lineWidth: 2.5,
            pointSize: 5,
            series: {
              0: { lineDashStyle: [] },
              1: { lineDashStyle: [] },
              2: { lineDashStyle: [6, 3] },
              3: { lineDashStyle: [4, 2], lineWidth: 1.5, color: '#d4b896' },
            },
          }}
          width="100%"
          height="360px"
        />
      </Card>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#9b7a36]" />
            <h3 className="text-sm font-bold text-[#4a3728]">Forecast Data Table</h3>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        <DataTable
          columns={['Year', 'Baseline %', 'Optimistic %', 'Pessimistic %']}
          rows={lineData.slice(1).filter((r) => r[1] !== null).map((r) => [
            r[0] as string,
            r[1] !== null ? `${r[1]}%` : '—',
            r[2] !== null ? `${r[2]}%` : '—',
            r[3] !== null ? `${r[3]}%` : '—',
          ])}
        />
      </div>
    </div>
  )
}

// ── Economic Report Results ───────────────────────────────────────────────────

function EconomicResults({ inputData }: { inputData: Record<string, unknown> }) {
  const barData = [
    ['Year', 'GDP Growth', 'Trade Balance', 'FDI Inflows'],
    ['2020', 2.1, 1.4, 3.2],
    ['2021', 4.8, 2.8, 5.1],
    ['2022', 5.9, 4.1, 6.4],
    ['2023', 4.4, 3.5, 5.8],
    ['2024', 5.2, 3.9, 6.1],
  ]

  const handleExport = () => {
    const csv = barData.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'economic-report.csv'
    a.click()
  }

  return (
    <div className="space-y-8">
      <Card className="border-2 border-[#e8dcc8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#9b7a36]/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#9b7a36]" />
          </div>
          <SectionTitle title="Economic Indicators Overview" subtitle="Multi-metric yearly breakdown" />
        </div>
        <Chart
          chartType="BarChart"
          data={barData}
          options={{
            ...CHART_OPTIONS_BASE,
            title: 'Economic Indicators 2020–2024',
            colors: ['#9b7a36', '#c2a14e', '#d4b896'],
            bar: { groupWidth: '65%' },
            isStacked: false,
          }}
          width="100%"
          height="360px"
        />
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#9b7a36]" />
            <h3 className="text-sm font-bold text-[#4a3728]">Economic Data Table</h3>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        <DataTable
          columns={['Year', 'GDP Growth (%)', 'Trade Balance (%)', 'FDI Inflows (%)']}
          rows={barData.slice(1) as (string | number)[][]}
        />
      </div>
    </div>
  )
}

// ── Upload/OCR Results ────────────────────────────────────────────────────────

function UploadResults({ inputData }: { inputData: Record<string, unknown> }) {
  const fileName = (inputData.file as string) ?? 'document.pdf'
  const mockKV = [
    ['Document Title', 'Bilateral Trade Agreement — 2024'],
    ['Date', 'November 14, 2024'],
    ['Parties', 'Ministry of Economy, State of Qatar'],
    ['Agreement Value', 'USD 4.2 Billion'],
    ['Duration', '5 years (2024–2029)'],
    ['Sector', 'Energy & Infrastructure'],
    ['Signatories', '3 officials identified'],
  ]

  const handleExport = () => {
    const csv = ['Field,Value', ...mockKV.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'extraction-results.csv'
    a.click()
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <BarChart3 className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-green-800">Extraction Complete</p>
          <p className="text-xs text-green-600 mt-0.5">
            File: <span className="font-mono">{fileName}</span> — {mockKV.length} key-value pairs extracted
          </p>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#9b7a36]" />
            <h3 className="text-sm font-bold text-[#4a3728]">Extracted Key-Value Pairs</h3>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        <DataTable
          columns={['Field', 'Extracted Value']}
          rows={mockKV}
        />
      </div>

      <Card className="border-2 border-[#e8dcc8] bg-white p-5">
        <h3 className="text-sm font-bold text-[#4a3728] mb-3">Raw Extracted Text (Preview)</h3>
        <pre className="text-xs text-[#9b7a36] font-mono leading-relaxed whitespace-pre-wrap bg-[#faf6ec] rounded-xl p-4 border border-[#e8dcc8] max-h-48 overflow-y-auto">
{`BILATERAL TRADE AGREEMENT

This agreement is entered into between the parties on the 
14th day of November 2024.

PARTIES:
1. Ministry of Economy — State of Qatar
2. [Counterpart Organisation]

AGREEMENT VALUE: USD 4,200,000,000

DURATION: Five (5) years commencing January 1, 2025.

SECTOR: Energy infrastructure development and renewable 
energy investment.

[Document continues...]`}
        </pre>
      </Card>
    </div>
  )
}

// ── Public router ─────────────────────────────────────────────────────────────

interface Step3ChartsProps {
  moduleType: ModuleType
  inputData: Record<string, unknown>
}

export function Step3Charts({ moduleType, inputData }: Step3ChartsProps) {
  switch (moduleType) {
    case 'comparison': return <><LiveMonitor inputData={inputData} /><ComparisonResults inputData={inputData} /></>
    case 'advanced':   return <><LiveMonitor inputData={inputData} /><AdvancedResults inputData={inputData} /></>
    case 'economic':   return <><LiveMonitor inputData={inputData} /><EconomicResults inputData={inputData} /></>
    case 'upload':     return <><LiveMonitor inputData={inputData} /><UploadResults inputData={inputData} /></>
    default: return null
  }
}
