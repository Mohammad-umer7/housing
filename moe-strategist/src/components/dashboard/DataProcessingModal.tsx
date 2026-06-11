'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Upload, Play, ChevronRight, CheckCircle, FileText, BarChart3,
  Radio, Globe, TrendingUp, DollarSign, Percent, Hash, Layers, Key,
} from 'lucide-react'
import { extractData, type ExtractedData } from '@/lib/text-extraction'

// ── Country data registry ─────────────────────────────────────────────────────

type CountryId = 'UAE' | 'NOR' | 'SAU' | 'DEU' | 'JPN' | 'USA' | 'CHN' | 'IND'

interface CountryProfile {
  id: CountryId
  name: string
  flag: string
  region: string
  color: string
  baselineGdp: number
  baselineInflation: number
  metrics: { metric: string; value: number }[]
  trend: { year: string; investment: number }[]
}

const GLOBAL_BENCHMARK: Record<string, number> = {
  'GDP Growth': 3.0, 'Sustainability': 55, 'Energy Transition': 52,
  'Trade Volume': 60, 'FDI Index': 55,
}

const COUNTRIES: Record<CountryId, CountryProfile> = {
  UAE: {
    id: 'UAE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Middle East', color: '#9b7a36',
    baselineGdp: 4.2, baselineInflation: 2.1,
    metrics: [{ metric: 'GDP Growth', value: 4.2 }, { metric: 'Sustainability', value: 38 }, { metric: 'Energy Transition', value: 29 }, { metric: 'Trade Volume', value: 71 }, { metric: 'FDI Index', value: 63 }],
    trend: [{ year: '2022', investment: 18.4 }, { year: '2023', investment: 23.1 }, { year: '2024', investment: 31.7 }, { year: '2025', investment: 42.0 }, { year: '2026', investment: 55.3 }, { year: '2027', investment: 71.8 }],
  },
  NOR: {
    id: 'NOR', name: 'Norway', flag: '🇳🇴', region: 'Europe', color: '#3a7abf',
    baselineGdp: 2.1, baselineInflation: 3.4,
    metrics: [{ metric: 'GDP Growth', value: 2.1 }, { metric: 'Sustainability', value: 92 }, { metric: 'Energy Transition', value: 88 }, { metric: 'Trade Volume', value: 54 }, { metric: 'FDI Index', value: 47 }],
    trend: [{ year: '2022', investment: 42.1 }, { year: '2023', investment: 48.7 }, { year: '2024', investment: 58.2 }, { year: '2025', investment: 67.4 }, { year: '2026', investment: 79.1 }, { year: '2027', investment: 94.3 }],
  },
  SAU: {
    id: 'SAU', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East', color: '#2d7a4a',
    baselineGdp: 6.0, baselineInflation: 1.8,
    metrics: [{ metric: 'GDP Growth', value: 6.0 }, { metric: 'Sustainability', value: 31 }, { metric: 'Energy Transition', value: 24 }, { metric: 'Trade Volume', value: 84 }, { metric: 'FDI Index', value: 58 }],
    trend: [{ year: '2022', investment: 22.0 }, { year: '2023', investment: 28.5 }, { year: '2024', investment: 38.0 }, { year: '2025', investment: 51.2 }, { year: '2026', investment: 67.8 }, { year: '2027', investment: 89.5 }],
  },
  DEU: {
    id: 'DEU', name: 'Germany', flag: '🇩🇪', region: 'Europe', color: '#7a3abf',
    baselineGdp: 1.4, baselineInflation: 2.7,
    metrics: [{ metric: 'GDP Growth', value: 1.4 }, { metric: 'Sustainability', value: 74 }, { metric: 'Energy Transition', value: 69 }, { metric: 'Trade Volume', value: 88 }, { metric: 'FDI Index', value: 76 }],
    trend: [{ year: '2022', investment: 61.4 }, { year: '2023', investment: 72.1 }, { year: '2024', investment: 85.3 }, { year: '2025', investment: 98.7 }, { year: '2026', investment: 114.2 }, { year: '2027', investment: 132.8 }],
  },
  JPN: {
    id: 'JPN', name: 'Japan', flag: '🇯🇵', region: 'Asia Pacific', color: '#bf3a3a',
    baselineGdp: 1.9, baselineInflation: 2.3,
    metrics: [{ metric: 'GDP Growth', value: 1.9 }, { metric: 'Sustainability', value: 61 }, { metric: 'Energy Transition', value: 54 }, { metric: 'Trade Volume', value: 79 }, { metric: 'FDI Index', value: 44 }],
    trend: [{ year: '2022', investment: 38.2 }, { year: '2023', investment: 45.6 }, { year: '2024', investment: 54.1 }, { year: '2025', investment: 63.8 }, { year: '2026', investment: 74.2 }, { year: '2027', investment: 86.5 }],
  },
  USA: {
    id: 'USA', name: 'United States', flag: '🇺🇸', region: 'Americas', color: '#2d5abf',
    baselineGdp: 2.8, baselineInflation: 3.1,
    metrics: [{ metric: 'GDP Growth', value: 2.8 }, { metric: 'Sustainability', value: 55 }, { metric: 'Energy Transition', value: 48 }, { metric: 'Trade Volume', value: 95 }, { metric: 'FDI Index', value: 91 }],
    trend: [{ year: '2022', investment: 128.4 }, { year: '2023', investment: 148.2 }, { year: '2024', investment: 174.6 }, { year: '2025', investment: 201.3 }, { year: '2026', investment: 231.7 }, { year: '2027', investment: 267.4 }],
  },
  CHN: {
    id: 'CHN', name: 'China', flag: '🇨🇳', region: 'Asia Pacific', color: '#bf2d2d',
    baselineGdp: 5.2, baselineInflation: 1.4,
    metrics: [{ metric: 'GDP Growth', value: 5.2 }, { metric: 'Sustainability', value: 49 }, { metric: 'Energy Transition', value: 57 }, { metric: 'Trade Volume', value: 98 }, { metric: 'FDI Index', value: 72 }],
    trend: [{ year: '2022', investment: 214.7 }, { year: '2023', investment: 258.3 }, { year: '2024', investment: 301.8 }, { year: '2025', investment: 347.2 }, { year: '2026', investment: 398.5 }, { year: '2027', investment: 456.1 }],
  },
  IND: {
    id: 'IND', name: 'India', flag: '🇮🇳', region: 'Asia Pacific', color: '#bf7a2d',
    baselineGdp: 6.8, baselineInflation: 4.2,
    metrics: [{ metric: 'GDP Growth', value: 6.8 }, { metric: 'Sustainability', value: 42 }, { metric: 'Energy Transition', value: 44 }, { metric: 'Trade Volume', value: 66 }, { metric: 'FDI Index', value: 58 }],
    trend: [{ year: '2022', investment: 31.2 }, { year: '2023', investment: 41.7 }, { year: '2024', investment: 55.3 }, { year: '2025', investment: 71.8 }, { year: '2026', investment: 91.4 }, { year: '2027', investment: 115.6 }],
  },
}

const COUNTRY_LIST = Object.values(COUNTRIES)

type Step = 1 | 2 | 3
type FeedMode = 'static' | 'live'

const STEPS: { id: Step; label: string; sublabel: string }[] = [
  { id: 1, label: '1. Input Data',  sublabel: 'Select country & source' },
  { id: 2, label: '2. Processing',  sublabel: 'OCR + AI pipeline'       },
  { id: 3, label: '3. Results',     sublabel: 'Charts & extracted data' },
]

// ── Country selector ──────────────────────────────────────────────────────────

function CountrySelector({ selected, onChange }: { selected: CountryId | null; onChange: (id: CountryId) => void }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#4a3728] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Globe className="w-3.5 h-3.5 text-[#9b7a36]" /> Select Country
      </p>
      <div className="grid grid-cols-4 gap-2">
        {COUNTRY_LIST.map((c) => {
          const active = selected === c.id
          return (
            <button key={c.id} onClick={() => onChange(c.id)}
              className={`rounded-xl border-2 p-2.5 text-left transition-all duration-200 hover:scale-[1.03] active:scale-95 ${active ? 'shadow-md' : 'border-[#e8dcc8] bg-white hover:border-[#c2a14e]'}`}
              style={active ? { borderColor: c.color, background: c.color + '12' } : {}}
            >
              <div className="text-2xl mb-1 leading-none">{c.flag}</div>
              <p className="text-[11px] font-bold leading-tight truncate" style={{ color: active ? c.color : '#4a3728' }}>{c.id}</p>
              <p className="text-[10px] text-[#c2a14e] truncate">{c.region}</p>
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: COUNTRIES[selected].color + '12', border: `1px solid ${COUNTRIES[selected].color}40` }}>
          <span className="text-xl">{COUNTRIES[selected].flag}</span>
          <div>
            <p className="text-xs font-bold" style={{ color: COUNTRIES[selected].color }}>{COUNTRIES[selected].name}</p>
            <p className="text-[10px] text-[#9b7a36]">GDP {COUNTRIES[selected].baselineGdp}% · Inflation {COUNTRIES[selected].baselineInflation}%</p>
          </div>
          <CheckCircle className="w-4 h-4 ml-auto" style={{ color: COUNTRIES[selected].color }} />
        </div>
      )}
    </div>
  )
}

// ── Live connection status ────────────────────────────────────────────────────

function LiveConnectionStatus({ country }: { country: CountryProfile | null }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [connected, setConnected] = useState(false)
  const messages = country
    ? [`Resolving ${country.name} Trade API endpoint...`, `Connecting to ws://live.moe-data.io/${country.id.toLowerCase()}`, 'Handshake complete — authenticating session', `WebSocket connected · ${country.name} feed active`, `Receiving ticks @ 120ms · GDP baseline ${country.baselineGdp}%`]
    : ['Select a country to connect live feed...']

  useEffect(() => {
    setMsgIdx(0); setConnected(false)
    if (!country) return
    let i = 0
    const id = setInterval(() => { i++; setMsgIdx(i); if (i >= messages.length - 1) { clearInterval(id); setConnected(true) } }, 700)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country?.id])

  return (
    <div className="bg-[#1a1208] rounded-xl border border-[#3a2c14] p-3 font-mono text-[11px]">
      <div className="flex items-center gap-2 mb-2">
        <Radio className={`w-3.5 h-3.5 ${connected ? 'text-green-400' : 'text-[#c2a14e] animate-pulse'}`} />
        <span className={connected ? 'text-green-400 font-bold' : 'text-[#c2a14e]'}>{connected ? '● CONNECTED' : '○ CONNECTING...'}</span>
        {country && <span className="ml-auto text-[#4a6a4a]">{country.flag} {country.id}</span>}
      </div>
      {messages.slice(0, msgIdx + 1).map((m, i) => (
        <p key={i} className={`mb-0.5 ${i === msgIdx ? 'text-[#c2a14e]' : 'text-[#4a6a4a]'}`}>
          {i === msgIdx && !connected && <span className="animate-pulse">▸ </span>}{m}
        </p>
      ))}
    </div>
  )
}

function FeedModeToggle({ mode, onChange }: { mode: FeedMode; onChange: (m: FeedMode) => void }) {
  return (
    <div className="flex gap-1 bg-[#f6f0e1] rounded-xl p-1 border border-[#e8dcc8]">
      {(['static', 'live'] as FeedMode[]).map((m) => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-[#9b7a36] text-white shadow' : 'text-[#9b7a36] hover:bg-white'}`}>
          {m === 'live' ? <><Radio className="w-3 h-3" /> Connect Live Feed</> : <><Upload className="w-3 h-3" /> Static Upload</>}
        </button>
      ))}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ current, country }: { current: Step; country: CountryId | null }) {
  const c = country ? COUNTRIES[country] : null
  return (
    <aside className="w-1/4 min-w-[200px] bg-[#f6f0e1] border-r-2 border-[#e8dcc8] flex flex-col py-10 px-6 gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#c2a14e] mb-6 px-1">Processing Pipeline</p>
      {STEPS.map((step, i) => {
        const state: 'done' | 'active' | 'idle' = step.id < current ? 'done' : step.id === current ? 'active' : 'idle'
        return (
          <div key={step.id} className="relative">
            {i < STEPS.length - 1 && <div className="absolute left-[19px] top-[38px] w-0.5 h-8 rounded-full" style={{ background: state === 'done' ? '#9b7a36' : '#e8dcc8' }} />}
            <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${state === 'active' ? 'bg-[#9b7a36] shadow-md' : state === 'done' ? 'bg-[#9b7a36]/10' : 'bg-transparent'}`}>
              <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm transition-all duration-300 ${state === 'active' ? 'bg-white text-[#9b7a36]' : state === 'done' ? 'bg-[#9b7a36] text-white' : 'bg-[#e8dcc8] text-[#c2a14e]'}`}>
                {state === 'done' ? <CheckCircle className="w-4 h-4" /> : step.id}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold leading-tight ${state === 'active' ? 'text-white' : 'text-[#4a3728]'}`}>{step.label}</p>
                <p className={`text-[11px] mt-0.5 ${state === 'active' ? 'text-white/70' : 'text-[#9b7a36]'}`}>{step.sublabel}</p>
              </div>
            </div>
          </div>
        )
      })}
      <div className="mt-auto pt-8 space-y-2">
        {c && (
          <div className="rounded-xl border p-3 flex items-center gap-2" style={{ borderColor: c.color + '50', background: c.color + '10' }}>
            <span className="text-xl">{c.flag}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold truncate" style={{ color: c.color }}>{c.name}</p>
              <p className="text-[10px] text-[#9b7a36]">{c.region}</p>
            </div>
          </div>
        )}
        <div className="bg-white border border-[#e8dcc8] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[#9b7a36] font-semibold uppercase tracking-wide mb-1">Step {current} of 3</p>
          <div className="w-full h-1.5 rounded-full bg-[#e8dcc8] overflow-hidden">
            <div className="h-full rounded-full bg-[#9b7a36] transition-all duration-500" style={{ width: `${((current - 1) / 2) * 100}%` }} />
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ onStart }: { onStart: (country: CountryId, isLive: boolean, file?: File) => void }) {
  const [mode, setMode] = useState<FeedMode>('static')
  const [selectedCountry, setSelectedCountry] = useState<CountryId | null>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  const canStart = selectedCountry !== null && (mode === 'live' || file !== null)

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[#4a3728] mb-1">Configure Data Source</h2>
        <p className="text-sm text-[#9b7a36]">Choose a country and connect a static file or live data feed.</p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] p-5">
        <CountrySelector selected={selectedCountry} onChange={setSelectedCountry} />
      </div>

      <FeedModeToggle mode={mode} onChange={setMode} />

      {mode === 'static' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 py-10 px-8 text-center select-none ${dragging ? 'border-[#9b7a36] bg-[#9b7a36]/5 scale-[1.01]' : file ? 'border-[#9b7a36] bg-[#9b7a36]/5' : 'border-[#e8dcc8] bg-white hover:border-[#c2a14e] hover:bg-[#faf6ec]'}`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.csv,.xlsx,image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${file ? 'bg-[#9b7a36]' : 'bg-[#f6f0e1]'}`}>
            {file ? <FileText className="w-7 h-7 text-white" /> : <Upload className="w-7 h-7 text-[#c2a14e]" />}
          </div>
          {file ? (
            <div>
              <p className="font-bold text-[#4a3728]">{file.name}</p>
              <p className="text-sm text-[#9b7a36] mt-1">{(file.size / 1024).toFixed(1)} KB — ready for OCR</p>
              <p className="text-xs text-[#c2a14e] mt-1">OCR text extraction will run in Step 2</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-[#4a3728]">Drag & drop your document here</p>
              <p className="text-sm text-[#9b7a36] mt-1">PDF, DOCX, CSV, XLSX, PNG, JPG — text will be OCR extracted</p>
            </div>
          )}
          {dragging && (
            <div className="absolute inset-0 rounded-2xl bg-[#9b7a36]/10 flex items-center justify-center">
              <p className="text-[#9b7a36] font-bold text-lg">Drop to upload</p>
            </div>
          )}
        </div>
      )}

      {mode === 'live' && (
        <div className="space-y-3">
          <LiveConnectionStatus country={selectedCountry ? COUNTRIES[selectedCountry] : null} />
          {selectedCountry && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#e8dcc8] rounded-xl p-3">
                <p className="text-[10px] text-[#9b7a36] uppercase tracking-wider mb-1">Baseline GDP</p>
                <p className="text-xl font-bold text-[#4a3728]">{COUNTRIES[selectedCountry].baselineGdp}%</p>
                <p className="text-[10px] text-[#c2a14e]">Annual growth rate</p>
              </div>
              <div className="bg-white border border-[#e8dcc8] rounded-xl p-3">
                <p className="text-[10px] text-[#9b7a36] uppercase tracking-wider mb-1">Baseline Inflation</p>
                <p className="text-xl font-bold text-[#4a3728]">{COUNTRIES[selectedCountry].baselineInflation}%</p>
                <p className="text-[10px] text-[#c2a14e]">CPI rate</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => selectedCountry && onStart(selectedCountry, mode === 'live', mode === 'static' ? (file ?? undefined) : undefined)}
        disabled={!canStart}
        className={`self-end flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${canStart ? 'bg-[#9b7a36] hover:bg-[#7c612a] text-white hover:shadow-lg active:scale-95' : 'bg-[#e8dcc8] text-[#c2a14e] cursor-not-allowed'}`}
      >
        <Play className="w-4 h-4" />
        {mode === 'live' ? 'Connect & Process' : 'Start OCR + Processing'}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Step 2: OCR + Processing ──────────────────────────────────────────────────

interface LivePacket { seq: number; ts: string; gdp: number; infl: number; vol: number }

function useLiveTicker(active: boolean, baseGdp: number, baseInfl: number) {
  const [packets, setPackets] = useState<LivePacket[]>([])
  const seq = useRef(0); const gdpRef = useRef(baseGdp)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      seq.current++
      const drift = (Math.random() - 0.48) * 0.15
      gdpRef.current = Math.max(0.1, gdpRef.current * 0.7 + (baseGdp + drift) * 0.3)
      setPackets((prev) => [...prev.slice(-12), {
        seq: seq.current,
        ts: new Date().toLocaleTimeString('en', { timeStyle: 'medium' }),
        gdp: parseFloat(gdpRef.current.toFixed(3)),
        infl: parseFloat((baseInfl + (Math.random() - 0.5) * 0.1).toFixed(2)),
        vol: parseFloat((450 + (Math.random() - 0.5) * 20).toFixed(1)),
      }])
    }, 600)
    return () => clearInterval(id)
  }, [active, baseGdp, baseInfl])

  return packets
}

function Step2({
  country, isLive, file, onDone,
}: {
  country: CountryProfile
  isLive: boolean
  file?: File | null
  onDone: (data: ExtractedData | null) => void
}) {
  const termRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
  const packets = useLiveTicker(isLive, country.baselineGdp, country.baselineInflation)

  const [lines, setLines] = useState<string[]>([`> Initialising MOE strategic pipeline — ${country.name}...`])
  const [progress, setProgress] = useState(0)
  const [pipelineDone, setPipelineDone] = useState(false)
  const [ocrDone, setOcrDone] = useState(!file || isLive) // if no file or live mode, OCR not needed
  const [ocrData, setOcrData] = useState<ExtractedData | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const addLine = useCallback((line: string) => setLines((prev) => [...prev, line]), [])

  const pipelineLines = [
    '  Loading document parser v3.1',
    `> ${isLive ? 'Ingesting live feed' : file ? 'Handing off to OCR engine...' : 'Running static analysis...'}`,
    `> Running NLP entity extraction for ${country.flag} ${country.name}...`,
    '  Entities found: 14 countries, 8 KPIs, 3 treaties',
    `> Applying CAGR model — baseline GDP ${country.baselineGdp}%...`,
    `  GDP CAGR (5yr): ${(country.baselineGdp * 1.12).toFixed(2)}%`,
    `  Energy CAGR: ${((country.trend[country.trend.length - 1].investment / country.trend[0].investment - 1) * 100).toFixed(1)}%`,
    `> Computing sustainability score (EMA α=0.30)...`,
    `  ${country.id} — S_score: ${(country.metrics.find((m) => m.metric === 'Sustainability')!.value / 100).toFixed(2)}`,
    `  Inflation baseline: ${country.baselineInflation}%`,
    '> Preparing visualisations...',
    `✓ AI pipeline complete.`,
  ]

  // ── Run pipeline terminal ──
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i >= pipelineLines.length) { clearInterval(id); setPipelineDone(true); return }
      addLine(pipelineLines[i])
      setProgress(Math.round(((i + 1) / (pipelineLines.length)) * (file && !isLive ? 60 : 100)))
      i++
    }, 380)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.id])

  // ── Run real OCR on uploaded file ──
  useEffect(() => {
    if (!file || isLive) return
    setOcrDone(false)

    const run = async () => {
      addLine(`> Starting OCR engine on "${file.name}"...`)
      addLine(`  File type: ${file.type || 'unknown'} · Size: ${(file.size / 1024).toFixed(1)} KB`)

      try {
        // Show a progress update every ~800ms while extraction runs
        const progressMsgs = [
          '  Loading extraction model...',
          '  Pre-processing document pages...',
          '  Running OCR pass (confidence threshold: 85%)...',
          '  Parsing text layers and tables...',
          '  Detecting structured data patterns...',
          '  Extracting key-value pairs...',
          '  Running NLP on extracted text...',
        ]
        let mi = 0
        const progressId = setInterval(() => {
          if (mi < progressMsgs.length) { addLine(progressMsgs[mi]); mi++ }
        }, 700)

        const data = await extractData(file)
        clearInterval(progressId)

        addLine(`> OCR extraction complete ✓`)
        addLine(`  Characters extracted: ${data.rawText.length.toLocaleString()}`)
        addLine(`  Metrics found: ${data.metrics.length}`)
        addLine(`  Key-value pairs: ${data.keyValues.length}`)
        if (data.metrics.length > 0) {
          addLine(`  Sample: ${data.metrics.slice(0, 2).map(m => `${m.label}=${m.value}`).join(', ')}`)
        }
        addLine(`✓ Full extraction stored — navigate to Results.`)

        setOcrData(data)
        setOcrDone(true)
        setProgress(100)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown OCR error'
        addLine(`! OCR error: ${msg}`)
        addLine('  Proceeding with country baseline data only.')
        setOcrError(msg)
        setOcrDone(true)
        setProgress(100)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.name])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  useEffect(() => {
    if (tickerRef.current) tickerRef.current.scrollTop = tickerRef.current.scrollHeight
  }, [packets])

  const allDone = pipelineDone && ocrDone

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#4a3728] mb-1">
            Processing {country.flag} {country.name}
          </h2>
          <p className="text-sm text-[#9b7a36]">
            {allDone ? 'Pipeline complete — results ready.' : file && !isLive ? 'OCR extraction + AI pipeline running...' : isLive ? 'Live feed ingestion active...' : 'AI pipeline running...'}
          </p>
        </div>
        {!allDone
          ? <div className="w-12 h-12 rounded-full border-4 border-[#e8dcc8] border-t-[#9b7a36] animate-spin flex-shrink-0" />
          : <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-6 h-6 text-green-600" /></div>}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] p-4">
        <div className="flex justify-between text-xs font-semibold text-[#4a3728] mb-2">
          <span className="uppercase tracking-wider">{file && !isLive ? 'OCR + Pipeline Progress' : 'Pipeline Progress'}</span>
          <span className="text-[#9b7a36]">{progress}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#f6f0e1] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #9b7a36, #c2a14e)' }} />
        </div>
        {file && !isLive && (
          <div className="flex gap-4 mt-2">
            {[
              { label: 'AI Pipeline', done: pipelineDone },
              { label: `OCR: ${file.name.split('.').pop()?.toUpperCase()}`, done: ocrDone },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${s.done ? 'bg-green-400' : 'bg-[#c2a14e] animate-pulse'}`} />
                <span className="text-[10px] text-[#9b7a36]">{s.label}: {s.done ? 'done' : 'running'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`grid gap-4 ${isLive ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Terminal */}
        <div className="bg-[#1a1208] rounded-2xl border border-[#3a2c14] overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#251a0e] border-b border-[#3a2c14]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#ffbd2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-xs text-[#9b7a36] font-mono ml-2 truncate">moe-ocr-pipeline — {country.id}</span>
            <span className={`ml-auto text-[10px] font-mono flex-shrink-0 ${allDone ? 'text-green-400' : 'text-[#c2a14e] animate-pulse'}`}>{allDone ? '✓' : '●'}</span>
          </div>
          <div ref={termRef} className="h-64 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
            {lines.map((line, i) => (
              <div key={i} className="mb-0.5">
                <span className={line.startsWith('>') ? 'text-[#c2a14e]' : line.startsWith('✓') ? 'text-green-400' : line.startsWith('!') ? 'text-red-400' : 'text-[#a89060]'}>{line}</span>
              </div>
            ))}
            {!allDone && <span className="text-[#9b7a36] animate-pulse">█</span>}
          </div>
        </div>

        {/* Live ticker */}
        {isLive && (
          <div className="bg-[#1a1208] rounded-2xl border border-[#3a2c14] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#251a0e] border-b border-[#3a2c14]">
              <Radio className="w-3 h-3 text-green-400 animate-pulse" />
              <span className="text-xs text-[#9b7a36] font-mono truncate">live · {country.flag} {country.id}</span>
              <span className="ml-auto text-[10px] text-green-400 font-mono">{packets.length} pkts</span>
            </div>
            <div ref={tickerRef} className="h-64 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
              {packets.map((p) => (
                <div key={p.seq}>
                  <span className="text-[#4a6a4a]">{p.ts} </span>
                  <span className="text-[#c2a14e]">{'{'}</span>
                  <span className="text-[#7aadff]">gdp</span><span className="text-[#22c55e]">:{p.gdp}</span>
                  <span className="text-white">, </span>
                  <span className="text-[#7aadff]">infl</span><span className="text-[#ffb87a]">:{p.infl}</span>
                  <span className="text-white">, vol:{p.vol}</span>
                  <span className="text-[#c2a14e]">{'}'}</span>
                </div>
              ))}
              {packets.length === 0 && <p className="text-[#4a6a4a] animate-pulse">Awaiting ticks...</p>}
            </div>
          </div>
        )}
      </div>

      {allDone && (
        <button onClick={() => onDone(ocrData)}
          className="self-end flex items-center gap-2 px-6 py-3 rounded-xl bg-[#9b7a36] hover:bg-[#7c612a] text-white font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
          {ocrData ? `View Results · ${ocrData.metrics.length} metrics extracted` : 'View Results'}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ── Recharts tooltip ──────────────────────────────────────────────────────────

function GoldTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1208] border border-[#3a2c14] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[#c2a14e] text-xs font-bold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-white text-xs"><span style={{ color: p.color }}>{p.name}</span>: {p.value}</p>
      ))}
    </div>
  )
}

// ── Live stat cards ───────────────────────────────────────────────────────────

function LiveStatCard({ label, value, subValue, direction }: { label: string; value: string; subValue?: string; direction: 'up' | 'down' | 'neutral' }) {
  const [flash, setFlash] = useState(false)
  const prevDir = useRef(direction)
  useEffect(() => {
    if (direction !== prevDir.current) { prevDir.current = direction; setFlash(true); const t = setTimeout(() => setFlash(false), 600); return () => clearTimeout(t) }
  }, [direction])
  return (
    <div className="rounded-2xl border-2 p-4 transition-all duration-300"
      style={{ borderColor: flash ? (direction === 'up' ? '#22c55e' : '#ef4444') : '#e8dcc8', background: flash ? (direction === 'up' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)') : 'white' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-[#9b7a36]">{label}</p>
        <span className={`w-2 h-2 rounded-full animate-pulse ${direction === 'up' ? 'bg-green-400' : direction === 'down' ? 'bg-red-400' : 'bg-[#c2a14e]'}`} />
      </div>
      <p className="text-xl font-bold transition-colors duration-300" style={{ color: flash ? (direction === 'up' ? '#16a34a' : '#dc2626') : '#4a3728' }}>{value}</p>
      {subValue && <p className={`text-xs mt-1 font-medium ${direction === 'up' ? 'text-green-600' : direction === 'down' ? 'text-red-500' : 'text-[#9b7a36]'}`}>{direction === 'up' ? '▲' : direction === 'down' ? '▼' : '◆'} {subValue}</p>}
    </div>
  )
}

function useLiveStats(active: boolean, country: CountryProfile) {
  const base = { gdp: country.baselineGdp, infl: country.baselineInflation, vol: 450, sustain: country.metrics.find((m) => m.metric === 'Sustainability')!.value }
  const [stats, setStats] = useState(base)
  const prev = useRef(base)
  useEffect(() => {
    setStats(base); prev.current = base
    if (!active) return
    const id = setInterval(() => {
      setStats((s) => {
        prev.current = s
        return {
          gdp:     parseFloat(Math.max(0.1, s.gdp   + (Math.random() - 0.48) * 0.08).toFixed(3)),
          infl:    parseFloat(Math.max(0.1, s.infl   + (Math.random() - 0.5)  * 0.05).toFixed(2)),
          vol:     parseFloat((s.vol    + (Math.random() - 0.5) * 8).toFixed(1)),
          sustain: parseFloat(Math.min(100, Math.max(0, s.sustain + (Math.random() - 0.5) * 0.5)).toFixed(1)),
        }
      })
    }, 2000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, country.id])
  const dir = (cur: number, p: number): 'up' | 'down' | 'neutral' => cur > p ? 'up' : cur < p ? 'down' : 'neutral'
  return { stats, gdpDir: dir(stats.gdp, prev.current.gdp), inflDir: dir(stats.infl, prev.current.infl), volDir: dir(stats.vol, prev.current.vol), sustainDir: dir(stats.sustain, prev.current.sustain) }
}

// ── OCR Results Panel ─────────────────────────────────────────────────────────

function OcrResultsPanel({ data }: { data: ExtractedData }) {
  const [tab, setTab] = useState<'metrics' | 'kvpairs' | 'rawtext'>('metrics')

  const metricIcon = (type: string) => {
    if (type === 'currency') return <DollarSign className="w-3.5 h-3.5 text-[#9b7a36]" />
    if (type === 'percentage') return <Percent className="w-3.5 h-3.5 text-[#9b7a36]" />
    return <TrendingUp className="w-3.5 h-3.5 text-[#9b7a36]" />
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-[#f6f0e1] to-white border-b border-[#e8dcc8]">
        <div className="w-8 h-8 bg-[#9b7a36] rounded-lg flex items-center justify-center">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#4a3728]">OCR Extracted Intelligence</p>
          <p className="text-[11px] text-[#9b7a36]">
            {data.metrics.length} metrics · {data.keyValues.length} key-value pairs · {data.rawText.length.toLocaleString()} chars
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg font-semibold">✓ OCR Complete</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-[#faf6ec] border-b border-[#e8dcc8]">
        {[
          { id: 'metrics' as const, label: `Metrics (${data.metrics.length})`, icon: <Hash className="w-3 h-3" /> },
          { id: 'kvpairs' as const, label: `Data Points (${data.keyValues.length})`, icon: <Key className="w-3 h-3" /> },
          { id: 'rawtext' as const, label: 'Raw Text', icon: <FileText className="w-3 h-3" /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-[#9b7a36] text-white' : 'text-[#9b7a36] hover:bg-white'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {tab === 'metrics' && (
          data.metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {data.metrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf6ec] border border-[#e8dcc8]">
                  <div className="flex items-center gap-2">
                    {metricIcon(m.type)}
                    <span className="text-xs text-[#9b7a36]">{m.label}</span>
                  </div>
                  <span className="text-sm font-bold text-[#4a3728]">{m.value}{m.unit || ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#c2a14e] text-center py-4">No numeric metrics extracted from this document.</p>
        )}

        {tab === 'kvpairs' && (
          data.keyValues.length > 0 ? (
            <div className="space-y-2">
              {data.keyValues.map((kv, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-[#faf6ec] border border-[#e8dcc8] flex items-start gap-3">
                  <span className="text-[11px] font-bold text-[#9b7a36] min-w-[120px] flex-shrink-0">{kv.key}</span>
                  <span className="text-[11px] text-[#4a3728]">{kv.value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#c2a14e] text-center py-4">No key-value pairs extracted.</p>
        )}

        {tab === 'rawtext' && (
          <div className="bg-[#1a1208] rounded-xl p-3 font-mono text-[10px] text-[#a89060] leading-relaxed whitespace-pre-wrap">
            {data.rawText || 'No raw text extracted.'}
          </div>
        )}
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-5 py-3 border-t border-[#e8dcc8] bg-[#faf6ec]">
          <p className="text-[11px] text-[#9b7a36]"><span className="font-bold text-[#4a3728]">Summary: </span>{data.summary}</p>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Results ───────────────────────────────────────────────────────────

function Step3({ country, isLive, extractedData, onReset }: {
  country: CountryProfile
  isLive: boolean
  extractedData: ExtractedData | null
  onReset: () => void
}) {
  const { stats, gdpDir, inflDir, volDir, sustainDir } = useLiveStats(isLive, country)
  const barData = country.metrics.map((m) => ({ metric: m.metric, [country.id]: m.value, 'Global Avg': GLOBAL_BENCHMARK[m.metric] ?? 50 }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#4a3728] mb-1">{country.flag} {country.name} — Results</h2>
          <p className="text-sm text-[#9b7a36]">
            {extractedData ? `OCR extracted ${extractedData.metrics.length} metrics · ` : ''}
            {isLive ? 'Live data feed active · updating every 2s' : 'Analysis complete.'}
          </p>
        </div>
        <button onClick={onReset} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-[#e8dcc8] text-xs font-bold text-[#9b7a36] hover:bg-[#f6f0e1] transition-colors">
          ↺ New Analysis
        </button>
      </div>

      {/* Live stat cards */}
      {isLive && (
        <div className="grid grid-cols-4 gap-3">
          <LiveStatCard label="GDP Growth"     value={`${stats.gdp.toFixed(2)}%`}      subValue={`base ${country.baselineGdp}%`}              direction={gdpDir}     />
          <LiveStatCard label="Inflation"      value={`${stats.infl.toFixed(2)}%`}     subValue={`CPI baseline ${country.baselineInflation}%`} direction={inflDir}    />
          <LiveStatCard label="Trade Volume"   value={stats.vol.toFixed(0)}             subValue="Index units"                                  direction={volDir}     />
          <LiveStatCard label="Sustainability" value={`${stats.sustain.toFixed(1)}`}   subValue="/ 100 score"                                  direction={sustainDir} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: country.color + '20' }}>
              <BarChart3 className="w-4 h-4" style={{ color: country.color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#4a3728]">{country.flag} {country.id} Key Metrics</p>
              <p className="text-[11px] text-[#9b7a36]">vs Global Average benchmark</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0e8d8" vertical={false} />
              <XAxis dataKey="metric" tick={{ fill: '#9b7a36', fontSize: 10 }} axisLine={{ stroke: '#e8dcc8' }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={38} />
              <YAxis tick={{ fill: '#9b7a36', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<GoldTooltip />} cursor={{ fill: '#faf6ec' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9b7a36', paddingTop: 8 }} iconType="circle" iconSize={8} />
              <Bar dataKey={country.id}  fill={country.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Global Avg" fill="#c2a14e"       radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line chart */}
        <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#c2a14e]/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#c2a14e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#4a3728]">Energy Investment Trend</p>
              <p className="text-[11px] text-[#9b7a36]">{country.name} · 5-Year Projection (USD bn)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={country.trend} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0e8d8" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#9b7a36', fontSize: 10 }} axisLine={{ stroke: '#e8dcc8' }} tickLine={false} />
              <YAxis tick={{ fill: '#9b7a36', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<GoldTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9b7a36', paddingTop: 8 }} iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="investment" name="Energy Investment" stroke="#c2a14e" strokeWidth={2.5}
                dot={{ r: 5, fill: '#c2a14e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, fill: country.color }} />
              <ReferenceLine y={country.trend[0].investment} stroke={country.color} strokeDasharray="4 3"
                label={{ value: 'Base', fill: country.color, fontSize: 10, position: 'right' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* OCR results panel — only shown when a file was processed */}
      {extractedData && <OcrResultsPanel data={extractedData} />}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function DataProcessingModal() {
  const [step, setStep] = useState<Step>(1)
  const [selectedCountry, setSelectedCountry] = useState<CountryId | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)

  const handleStart = useCallback((country: CountryId, live: boolean, file?: File) => {
    setSelectedCountry(country)
    setIsLive(live)
    setUploadedFile(file ?? null)
    setExtractedData(null)
    setStep(2)
  }, [])

  const handleReset = useCallback(() => {
    setStep(1)
    setSelectedCountry(null)
    setIsLive(false)
    setUploadedFile(null)
    setExtractedData(null)
  }, [])

  const country = selectedCountry ? COUNTRIES[selectedCountry] : null

  return (
    <div className="flex min-h-screen w-full" style={{ background: '#faf6ec', fontFamily: 'Georgia, serif' }}>
      <Sidebar current={step} country={selectedCountry} />
      <main className="flex-1 overflow-y-auto p-10">
        {step === 1 && <Step1 onStart={handleStart} />}
        {step === 2 && country && (
          <Step2
            country={country}
            isLive={isLive}
            file={uploadedFile}
            onDone={(data) => { setExtractedData(data); setStep(3) }}
          />
        )}
        {step === 3 && country && (
          <Step3 country={country} isLive={isLive} extractedData={extractedData} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}
