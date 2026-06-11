'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { KPIGrid } from './kpi-grid'
import { ActionBar } from './action-bar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  GitCompare,
  Upload,
  Zap,
  Film,
  TrendingUp,
  BarChart3,
  Brain,
  Lock,
  FileText,
  ArrowRight,
  X,
  File,
  Radio,
  Wifi,
  WifiOff,
  Pause,
  Play,
  Loader2,
  Download,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { useLiveWs } from '@/lib/use-live-ws'
import type { ModuleType } from '@/types/modules'
import { VisualInsights } from './visual-insights'
import { exportGlobalFeedToPDF } from '@/lib/pdf-generator'

interface CommandCenterProps {
  onViewChange?: (view: 'comparison' | 'upload' | 'multimedia' | 'report' | 'data-processing') => void
  onOpenModule?: (module: ModuleType) => void
}

// Advanced Analysis Data
const economicGrowthData = [
  { year: '2020', gdp: 4.2, inflation: 1.4, forecast: false },
  { year: '2021', gdp: 4.9, inflation: 1.8, forecast: false },
  { year: '2022', gdp: 5.8, inflation: 3.1, forecast: false },
  { year: '2023', gdp: 6.1, inflation: 3.5, forecast: false },
  { year: '2024', gdp: 5.0, inflation: 2.0, forecast: false },
  { year: '2025', gdp: 5.3, inflation: 1.9, forecast: true },
  { year: '2026', gdp: 5.5, inflation: 1.8, forecast: true },
]

const regionalDistributionData = [
  { region: 'Services', value: 51.6, previousYear: 50.2 },
  { region: 'Industry', value: 47.7, previousYear: 48.1 },
  { region: 'Agriculture', value: 0.7, previousYear: 0.8 },
  { region: 'Mining', value: 3.2, previousYear: 3.4 },
  { region: 'Technology', value: 2.8, previousYear: 2.2 },
]

const marketTrendData = [
  { month: 'Jan', bullish: 65, neutral: 20, bearish: 15 },
  { month: 'Feb', bullish: 68, neutral: 18, bearish: 14 },
  { month: 'Mar', bullish: 72, neutral: 17, bearish: 11 },
  { month: 'Apr', bullish: 70, neutral: 19, bearish: 11 },
  { month: 'May', bullish: 75, neutral: 16, bearish: 9 },
  { month: 'Jun', bullish: 78, neutral: 14, bearish: 8 },
]

// ── Live Global Economic Feed ─────────────────────────────────────────────────

const FEED_COUNTRIES = [
  { code: 'NOR', label: 'Norway',       flag: '🇳🇴' },
  { code: 'CHN', label: 'China',        flag: '🇨🇳' },
  { code: 'IND', label: 'India',        flag: '🇮🇳' },
  { code: 'DEU', label: 'Germany',      flag: '🇩🇪' },
  { code: 'USA', label: 'United States',flag: '🇺🇸' },
]

function CountryFeedCard({ code, label, flag, onUpdate }: { code: string; label: string; flag: string; onUpdate: (code: string, data: any) => void }) {
  const { latest, prev, rechartsData, status, paused, togglePause } = useLiveWs({
    countryCode: code,
    maxTicks: 15,
  })

  useEffect(() => {
    if (latest) {
      onUpdate(code, {
        code,
        label,
        gdpEma: `${latest.gdp_ema.toFixed(1)}B`,
        cagr: `${(latest.cagr_1yr * 100).toFixed(2)}%`,
        esg: `${(latest.sustain_score * 100).toFixed(0)}%`
      })
    }
  }, [latest, code, label, onUpdate])

  const dir = latest && prev
    ? latest.gdp_ema > prev.gdp_ema ? 'up' : latest.gdp_ema < prev.gdp_ema ? 'down' : 'flat'
    : 'flat'

  const statusColor = {
    live: 'bg-green-400', mock: 'bg-[#c2a14e]', connecting: 'bg-blue-400',
    paused: 'bg-gray-400', error: 'bg-red-400',
  }[status]

  return (
    <Card className="p-4 border border-[#e8dcc8] bg-white/90">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <div>
            <p className="text-sm font-bold text-[#4a3728]">{label}</p>
            <p className="text-[10px] text-[#9b7a36] font-mono">{code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
          <button onClick={togglePause} className="text-[#9b7a36] hover:text-[#7a6030]">
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-[10px] text-[#9b7a36] uppercase tracking-wide">GDP EMA</p>
          <p className={`text-sm font-bold ${dir === 'up' ? 'text-green-600' : dir === 'down' ? 'text-red-500' : 'text-[#4a3728]'}`}>
            {latest ? `${latest.gdp_ema.toFixed(1)}B` : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-[#9b7a36] uppercase tracking-wide">CAGR</p>
          <p className="text-sm font-bold text-[#4a3728]">
            {latest ? `${(latest.cagr_1yr * 100).toFixed(2)}%` : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-[#9b7a36] uppercase tracking-wide">ESG</p>
          <p className="text-sm font-bold text-[#4a3728]">
            {latest ? `${(latest.sustain_score * 100).toFixed(0)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      {rechartsData.length > 1 ? (
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={rechartsData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#9b7a36" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9b7a36" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="gdp_ema"
              stroke="#9b7a36"
              strokeWidth={1.5}
              fill={`url(#grad-${code})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[60px] flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-[#9b7a36] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </Card>
  )
}

function LiveGlobalFeed() {
  const [open, setOpen] = useState(true)
  const [latestData, setLatestData] = useState<Record<string, any>>({})

  const handleUpdate = useCallback((code: string, data: any) => {
    setLatestData(prev => ({ ...prev, [code]: data }))
  }, [])

  const handleExport = () => {
    const list = FEED_COUNTRIES.map(c => latestData[c.code] || {
      code: c.code,
      label: c.label,
      gdpEma: '—',
      cagr: '—',
      esg: '—'
    })
    exportGlobalFeedToPDF(list)
  }

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#9b7a36]/10 flex items-center justify-center">
            <Radio className="w-5 h-5 text-[#9b7a36]" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-amber-900">Live Global Feed</h2>
            <p className="text-sm text-amber-700">Real-time EMA · CAGR · ESG streaming from partner countries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-1.5 h-8 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export Feed (PDF)
          </Button>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-[#9b7a36] border border-[#e8dcc8] rounded-lg px-3 py-1.5 hover:bg-[#f6f0e1] transition-colors"
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEED_COUNTRIES.map(c => (
            <CountryFeedCard key={c.code} code={c.code} label={c.label} flag={c.flag} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Streaming AI Briefing Modal ───────────────────────────────────────────────

const BRIEF_COUNTRIES = [
  'United Arab Emirates', 'Norway', 'Germany', 'Saudi Arabia',
  'China', 'India', 'Japan', 'United States', 'United Kingdom',
  'France', 'South Korea',
]

const BRIEF_CAPS = [
  { id: 'briefing',   label: 'Strategic Briefing'  },
  { id: 'profile',    label: 'Country Profile'     },
  { id: 'predict',    label: 'Predictive Analysis' },
  { id: 'comparison', label: 'Comparison'           },
]

interface StreamSection { id: string; title: string; content: string; level: number; icon?: string }

function BriefingModal({ onClose, defaultCountry }: { onClose: () => void; defaultCountry: string }) {
  const [country,     setCountry]     = useState(defaultCountry || BRIEF_COUNTRIES[0])
  const [capability,  setCapability]  = useState('briefing')
  const [language,    setLanguage]    = useState<'en' | 'ar'>('en')
  const [compCountry, setCompCountry] = useState(BRIEF_COUNTRIES[1])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone,      setIsDone]      = useState(false)
  const [logLines,    setLogLines]    = useState<{ text: string; level: string }[]>([])
  const [sections,    setSections]    = useState<StreamSection[]>([])
  const [error,       setError]       = useState<string | null>(null)
  const abortRef  = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Inject @media print styles for PDF export (visibility trick — display:none on parent blocks children)
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'briefing-print-css'
    s.textContent = [
      '@media print{',
      'body{visibility:hidden}',
      '#briefing-print-area,#briefing-print-area *{visibility:visible}',
      '#briefing-print-area{',
        'position:fixed;top:0;left:0;right:0;background:white;',
        'padding:2rem;font-family:Georgia,serif;font-size:13px}',
      '}',
    ].join('')
    document.head.appendChild(s)
    return () => { document.getElementById('briefing-print-css')?.remove() }
  }, [])

  // Auto-scroll agent log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logLines])

  const reset = () => { setLogLines([]); setSections([]); setError(null); setIsDone(false) }

  // Also support popup-window PDF (works in all browsers regardless of print CSS)
  const printBriefing = useCallback(() => {
    const cap = BRIEF_CAPS.find(c => c.id === capability)?.label ?? capability
    const title = `${cap}: ${country}${capability === 'comparison' ? ` vs ${compCountry}` : ''}`
    const body = sections.map(s =>
      `<div style="margin-bottom:20px">
        <h2 style="font:bold 15px Georgia;margin:0 0 6px">${s.icon ?? ''} ${s.title}</h2>
        <p style="font:13px Georgia;line-height:1.7;margin:0;white-space:pre-line">${s.content}</p>
      </div>`
    ).join('')
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) { window.print(); return } // fallback if popup blocked
    win.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#1a1208}
      h1{font-size:20px;color:#4a3728;margin-bottom:4px}
      .meta{font-size:11px;color:#9b7a36;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid #e8dcc8}
      @media print{body{margin:0;padding:2rem}}
      </style></head><body>
      <h1>${title}</h1>
      <p class="meta">MOE Strategist · ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
      ${body}
      <script>window.onload=function(){window.print();window.close()}<\/script>
      </body></html>`
    )
    win.document.close()
  }, [sections, capability, country, compCountry])

  const generate = useCallback(async () => {
    reset()
    setIsStreaming(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const query = capability === 'comparison'
      ? `Compare ${country} and ${compCountry} on energy strategy`
      : `Generate ${capability} for ${country}`
    try {
      const res = await fetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, capability, language, query }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('{')) continue
          try {
            const ev = JSON.parse(t) as { event: string; message?: string; level?: string; section?: StreamSection }
            if (ev.event === 'log')     setLogLines(l => [...l.slice(-60), { text: ev.message!, level: ev.level ?? 'info' }])
            if (ev.event === 'section') setSections(s => [...s, ev.section!])
            if (ev.event === 'done')    setIsDone(true)
            if (ev.event === 'error')   setError(ev.message ?? 'Unknown error')
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError')
        setError('Could not reach AI backend. Ensure the Python server is running on port 8000.')
    } finally {
      setIsStreaming(false)
    }
  }, [country, capability, language, compCountry])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-stretch briefing-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex w-full max-w-6xl mx-auto my-6 rounded-2xl shadow-2xl overflow-hidden border border-[#e8dcc8] bg-[#faf6ec]">

        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-[#1a1208] flex flex-col p-5 gap-4 border-r border-[#9b7a36]/30">
          <div className="flex items-center gap-2 text-[#c2a14e]">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest uppercase">AI Briefing</span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-widest uppercase text-[#9b7a36]">Country</span>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="bg-[#2a1e0a] border border-[#9b7a36]/40 text-[#e8dcc8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c2a14e]">
              {BRIEF_COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] tracking-widest uppercase text-[#9b7a36]">Capability</span>
            {BRIEF_CAPS.map(cap => (
              <button key={cap.id} onClick={() => setCapability(cap.id)}
                className={`text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
                  capability === cap.id
                    ? 'bg-[#9b7a36] text-[#1a1208] font-semibold'
                    : 'text-[#c2a14e] hover:bg-[#9b7a36]/20'
                }`}>
                {cap.label}
              </button>
            ))}
          </div>

          {capability === 'comparison' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-widest uppercase text-[#9b7a36]">Compare With</span>
              <select value={compCountry} onChange={e => setCompCountry(e.target.value)}
                className="bg-[#2a1e0a] border border-[#9b7a36]/40 text-[#e8dcc8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c2a14e]">
                {BRIEF_COUNTRIES.filter(c => c !== country).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[10px] tracking-widest uppercase text-[#9b7a36]">Language</span>
            <div className="flex gap-2">
              {(['en', 'ar'] as const).map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                    language === lang
                      ? 'bg-[#9b7a36] text-[#1a1208]'
                      : 'border border-[#9b7a36]/40 text-[#c2a14e] hover:bg-[#9b7a36]/20'
                  }`}>
                  {lang === 'en' ? 'EN' : 'ع'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <Button onClick={generate} disabled={isStreaming}
              className="w-full bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7a6030] hover:to-[#9b7a36] text-[#1a1208] font-bold">
              {isStreaming
                ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Generating…</>
                : <><ArrowRight className="w-4 h-4 mr-1" />Generate</>}
            </Button>
            {isDone && (
              <button
                onClick={printBriefing}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#9b7a36]/50 text-[#9b7a36] text-sm hover:bg-[#9b7a36]/10 transition-colors">
                <Download className="w-4 h-4" />Export PDF
              </button>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#e8dcc8] bg-white/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#9b7a36]" />
              <h2 className="text-base font-bold text-[#4a3728]">
                {BRIEF_CAPS.find(c => c.id === capability)?.label} — {country}
                {capability === 'comparison' && ` vs ${compCountry}`}
              </h2>
              {isStreaming && <span className="text-[10px] font-mono text-green-600 animate-pulse">● STREAMING</span>}
              {isDone     && <span className="text-[10px] font-mono text-[#9b7a36]">✓ COMPLETE</span>}
            </div>
            <button onClick={onClose} className="text-[#9b7a36] hover:text-[#4a3728] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div id="briefing-print-area" className="flex-1 overflow-y-auto p-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Empty state */}
            {!isStreaming && sections.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-[#f6f0e1] flex items-center justify-center">
                  <Radio className="w-8 h-8 text-[#9b7a36]" />
                </div>
                <div>
                  <p className="text-[#4a3728] font-semibold">Configure and click Generate</p>
                  <p className="text-sm text-[#9b7a36] mt-1">AI agents stream intelligence in real-time</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
            )}

            {/* Agent log terminal */}
            {(isStreaming || logLines.length > 0) && sections.length === 0 && (
              <div className="bg-[#1a1208] rounded-xl p-4 mb-5 font-mono text-xs max-h-52 overflow-y-auto">
                {logLines.length === 0
                  ? <p className="text-[#9b7a36] animate-pulse">▶ Launching agents…</p>
                  : logLines.map((l, i) => (
                    <p key={i} className={
                      l.level === 'success' ? 'text-green-400' :
                      l.level === 'warning' ? 'text-yellow-400' :
                      l.level === 'error'   ? 'text-red-400'   : 'text-[#c2a14e]'
                    }>{l.text}</p>
                  ))}
                <div ref={logEndRef} />
              </div>
            )}

            {/* Skeleton while waiting for first section */}
            {isStreaming && sections.length === 0 && logLines.length > 3 && (
              <div className="space-y-3">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-20 rounded-xl bg-[#e8dcc8] animate-pulse" />
                ))}
              </div>
            )}

            {/* Briefing sections — stream in one by one */}
            <div className="space-y-4">
              {sections.map((sec, i) => (
                <div key={sec.id ?? i} className={`rounded-xl border p-4 ${
                  sec.level === 1 ? 'border-[#9b7a36]/40 bg-[#9b7a36]/5' : 'border-[#e8dcc8] bg-white/80'
                }`}>
                  <h3 className={`font-bold text-[#4a3728] mb-2 flex items-center gap-2 ${
                    sec.level === 1 ? 'text-base' : 'text-sm'
                  }`}>
                    {sec.icon && <span>{sec.icon}</span>}
                    {sec.title}
                  </h3>
                  <p className="text-[#4a3728] text-sm leading-relaxed whitespace-pre-line">{sec.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CommandCenter({ onViewChange, onOpenModule }: CommandCenterProps) {
  const [briefingOpen,    setBriefingOpen]    = useState(false)
  const [briefingCountry, setBriefingCountry] = useState('')

  const handleViewChange = (view: 'comparison' | 'upload' | 'multimedia' | 'report' | 'data-processing') => {
    if (onViewChange) onViewChange(view)
  }
  const handleOpenModule = (mod: ModuleType) => {
    if (onOpenModule) onOpenModule(mod)
    else handleViewChange('data-processing')
  }

  // Modal and file upload state
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [activeChart, setActiveChart] = useState<'growth' | 'sector' | 'sentiment' | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedOption, setSelectedOption] = useState<'mid' | 'summary' | 'full' | null>(null)

  const handleChartClick = (chartType: 'growth' | 'sector' | 'sentiment') => {
    setActiveChart(chartType)
    setShowAnalysisModal(true)
    setSelectedOption(null)
    setUploadedFile(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleAnalysisOption = (option: 'mid' | 'summary' | 'full') => {
    setSelectedOption(option)
    // Here you would process the file with the selected analysis type
    console.log(`Processing file with ${option} analysis`)
  }

  const closeModal = () => {
    setShowAnalysisModal(false)
    setActiveChart(null)
    setUploadedFile(null)
    setSelectedOption(null)
  }

  const getChartTitle = (chart: 'growth' | 'sector' | 'sentiment' | null) => {
    const titles = {
      growth: 'Economic Growth & Inflation',
      sector: 'Sector Distribution',
      sentiment: 'Market Sentiment',
    }
    return titles[chart || 'growth']
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-cream-surface to-amber-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-200 opacity-20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-300 opacity-20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-amber-100 opacity-20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 mb-2">
            Command Center
          </h1>
          <p className="text-lg text-amber-700">
            Real-time intelligence and strategic decision-making platform
          </p>
        </div>

        {/* Key Performance Indicators */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-amber-900 mb-6">
            Critical Indicators
          </h2>
          <KPIGrid />
        </div>

        {/* Visual Insights & Strategic Assets Section */}
        <div className="mb-16">
          <VisualInsights />
        </div>

        {/* ── Live Global Economic Feed ─────────────────────────────── */}
        <LiveGlobalFeed />

        {/* ── AI Briefing Generator CTA ─────────────────────────────── */}
        <div className="mb-10">
          <div className="rounded-2xl border border-[#9b7a36]/30 bg-gradient-to-r from-[#1a1208] to-[#2a1e0a] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#9b7a36]/20 flex items-center justify-center flex-shrink-0">
                <Radio className="w-6 h-6 text-[#c2a14e]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#c2a14e]">AI Intelligence Briefing</h3>
                <p className="text-sm text-[#9b7a36] mt-1">Streaming strategic analysis powered by Groq LLaMA‑3.3 70B · LangChain agents · pgvector RAG</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {['Strategic Briefing', 'Country Profile', 'Predictive', 'Comparison'].map(tag => (
                    <span key={tag} className="text-[10px] font-mono text-[#9b7a36] border border-[#9b7a36]/30 rounded-full px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={() => { setBriefingCountry(''); setBriefingOpen(true) }}
              className="flex-shrink-0 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7a6030] hover:to-[#9b7a36] text-[#1a1208] font-bold px-6 py-3 rounded-xl">
              <ArrowRight className="w-4 h-4 mr-2" />
              Generate Briefing
            </Button>
          </div>
        </div>

        {/* Briefing modal (portal-style fixed overlay) */}
        {briefingOpen && (
          <BriefingModal
            onClose={() => setBriefingOpen(false)}
            defaultCountry={briefingCountry}
          />
        )}

        {/* Platform Features Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-amber-900 mb-8">Explore Our Platform</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Comparison Analysis */}
            <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:border-amber-300 group cursor-pointer" onClick={() => handleOpenModule('comparison')}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center group-hover:from-amber-200 group-hover:to-amber-300 transition-all">
                  <GitCompare className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-amber-900">Comparison Analysis</h3>
              </div>
              <p className="text-amber-700 text-sm mb-4">
                Compare economic indicators and metrics across different countries side-by-side for in-depth strategic analysis.
              </p>
              <Button
                onClick={(e) => { e.stopPropagation(); handleOpenModule('comparison') }}
                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Launch Analysis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>

            {/* File Upload & OCR */}
            <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:border-amber-300 group cursor-pointer" onClick={() => handleOpenModule('upload')}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center group-hover:from-amber-200 group-hover:to-amber-300 transition-all">
                  <Upload className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-amber-900">Upload & Extract</h3>
              </div>
              <p className="text-amber-700 text-sm mb-4">
                Upload documents and images to extract text using advanced OCR and PDF processing technology.
              </p>
              <Button
                onClick={(e) => { e.stopPropagation(); handleOpenModule('upload') }}
                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Launch Extraction
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>



            {/* Multimedia Viewer */}
            <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:border-amber-300 group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center group-hover:from-amber-200 group-hover:to-amber-300 transition-all">
                  <Film className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-amber-900">Multimedia Hub</h3>
              </div>
              <p className="text-amber-700 text-sm mb-4">
                Explore rich multimedia content including videos, documentaries, and interactive presentations about economic trends.
              </p>
              <Button
                onClick={() => handleViewChange('multimedia')}
                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Learn More
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>

            {/* Reports & Insights */}
            <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:border-amber-300 group cursor-pointer" onClick={() => handleOpenModule('economic')}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center group-hover:from-amber-200 group-hover:to-amber-300 transition-all">
                  <TrendingUp className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-amber-900">Economic Reports</h3>
              </div>
              <p className="text-amber-700 text-sm mb-4">
                View comprehensive economic indicators, charts, and analysis reports with downloadable data exports.
              </p>
              <Button
                onClick={(e) => { e.stopPropagation(); handleOpenModule('economic') }}
                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Generate Report
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>

            {/* Key Features Highlight */}
            <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:border-amber-300">
              <h3 className="text-lg font-semibold text-amber-900 mb-4">Platform Highlights</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700">AI-Powered Analytics</span>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700">Interactive Visualizations</span>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700">Secure Data Processing</span>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700">Export & Share Reports</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Executive Action Bar */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-amber-900 mb-6">Quick Actions</h2>
          <ActionBar />
        </div>

        {/* Analysis Options Modal */}
        {showAnalysisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl bg-white shadow-2xl">
              <div className="p-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-amber-900">
                      {getChartTitle(activeChart)} Analysis
                    </h2>
                    <p className="text-sm text-amber-700 mt-1">Upload file and choose analysis depth</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-amber-100 rounded-lg transition"
                  >
                    <X className="w-6 h-6 text-amber-900" />
                  </button>
                </div>

                {/* File Upload Section */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-amber-900 mb-3">
                    1. Upload File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.csv,.xlsx,.xls,image/*"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-6 py-4 border-2 border-dashed border-amber-300 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-amber-600" />
                    <div className="text-left">
                      <p className="font-semibold text-amber-900">
                        {uploadedFile ? `✓ ${uploadedFile.name}` : 'Click to upload or drag file'}
                      </p>
                      <p className="text-xs text-amber-700">PDF, CSV, XLSX or Images</p>
                    </div>
                  </button>
                </div>

                {/* Analysis Options */}
                {uploadedFile && (
                  <div className="mb-8">
                    <label className="block text-sm font-semibold text-amber-900 mb-4">
                      2. Choose Analysis Depth
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Mid Summary */}
                      <button
                        onClick={() => handleAnalysisOption('mid')}
                        className={`p-4 rounded-lg border-2 transition transform hover:scale-105 ${
                          selectedOption === 'mid'
                            ? 'border-amber-600 bg-amber-50'
                            : 'border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <FileText className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="font-semibold text-amber-900">Mid Summary</p>
                        <p className="text-xs text-amber-700 mt-1">Quick overview (1-2 min)</p>
                      </button>

                      {/* Full Summary */}
                      <button
                        onClick={() => handleAnalysisOption('summary')}
                        className={`p-4 rounded-lg border-2 transition transform hover:scale-105 ${
                          selectedOption === 'summary'
                            ? 'border-amber-600 bg-amber-50'
                            : 'border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <FileText className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="font-semibold text-amber-900">Full Summary</p>
                        <p className="text-xs text-amber-700 mt-1">Detailed review (3-5 min)</p>
                      </button>

                      {/* Full Analysis */}
                      <button
                        onClick={() => handleAnalysisOption('full')}
                        className={`p-4 rounded-lg border-2 transition transform hover:scale-105 ${
                          selectedOption === 'full'
                            ? 'border-amber-600 bg-amber-50'
                            : 'border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <BarChart3 className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="font-semibold text-amber-900">Full Analysis</p>
                        <p className="text-xs text-amber-700 mt-1">Comprehensive (5-10 min)</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="flex-1 border-amber-200 hover:border-amber-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedOption) {
                        // Process analysis
                        console.log(`Processing ${activeChart} with ${selectedOption} analysis`)
                        closeModal()
                      }
                    }}
                    disabled={!selectedOption}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white disabled:opacity-50"
                  >
                    {selectedOption ? 'Process Analysis' : 'Select Analysis Type'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
