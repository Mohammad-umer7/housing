'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload,
  X,
  Globe,
  ChevronDown,
  CheckCircle,
  Wifi,
  WifiOff,
  Radio,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ModuleType } from '@/types/modules'

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-[#4a3728]">{title}</h3>
      {subtitle && <p className="text-xs text-[#9b7a36] mt-0.5">{subtitle}</p>}
    </div>
  )
}

function SliderField({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-5">
      <div className="flex justify-between mb-2">
        <label className="text-sm font-semibold text-[#4a3728]">{label}</label>
        <span className="text-sm font-bold text-[#9b7a36] bg-[#f6f0e1] px-2 py-0.5 rounded-md">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9b7a36 0%, #9b7a36 ${((value - min) / (max - min)) * 100}%, #e8dcc8 ${((value - min) / (max - min)) * 100}%, #e8dcc8 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#c2a14e] mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// Multi-select tag picker
const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain',
  'Oman', 'Egypt', 'Jordan', 'Iraq', 'Iran',
  'China', 'USA', 'Germany', 'Japan', 'India',
  'UK', 'France', 'South Korea', 'Brazil', 'South Africa',
]

function CountryPicker({
  selected,
  onChange,
  maxSelect = 6,
}: {
  selected: string[]
  onChange: (c: string[]) => void
  maxSelect?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = COUNTRIES.filter(
    (c) =>
      c.toLowerCase().includes(query.toLowerCase()) && !selected.includes(c)
  )

  const add = (c: string) => {
    if (selected.length < maxSelect) onChange([...selected, c])
  }
  const remove = (c: string) => onChange(selected.filter((x) => x !== c))

  return (
    <div className="relative">
      {/* Tags display */}
      <div
        onClick={() => setOpen(!open)}
        className="min-h-[44px] flex flex-wrap gap-1.5 items-center p-2 rounded-xl border-2 border-[#e8dcc8] bg-white cursor-pointer hover:border-[#9b7a36] transition-colors"
      >
        {selected.length === 0 && (
          <span className="text-sm text-[#c2a14e]">Select up to {maxSelect} countries...</span>
        )}
        {selected.map((c) => (
          <span
            key={c}
            onClick={(e) => { e.stopPropagation(); remove(c) }}
            className="flex items-center gap-1 bg-[#f6f0e1] border border-[#c2a14e] text-[#9b7a36] text-xs font-medium px-2 py-1 rounded-lg cursor-pointer hover:bg-[#e8dcc8] transition-colors"
          >
            <Globe className="w-3 h-3" /> {c}
            <X className="w-3 h-3 text-[#c2a14e]" />
          </span>
        ))}
        <ChevronDown className={`w-4 h-4 text-[#9b7a36] ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border-2 border-[#e8dcc8] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#f6f0e1]">
            <input
              autoFocus
              placeholder="Search countries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e8dcc8] focus:outline-none focus:border-[#9b7a36] text-[#4a3728]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-center text-[#c2a14e] py-3">No matches</p>
            ) : (
              filtered.map((c) => (
                <div
                  key={c}
                  onClick={() => { add(c); setQuery('') }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#faf6ec] cursor-pointer text-sm text-[#4a3728] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-[#9b7a36]" />
                  {c}
                  {selected.length >= maxSelect && (
                    <span className="ml-auto text-xs text-[#c2a14e]">Max reached</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const METRICS = [
  'GDP (USD Billions)',
  'GDP Growth Rate (%)',
  'Trade Balance',
  'Inflation Rate',
  'FDI Inflows',
  'Energy Investment',
  'Infrastructure Spend',
  'Unemployment Rate',
]

// ── File drop zone ─────────────────────────────────────────────────────────────

function FileDropZone({
  accept,
  label,
  hint,
  file,
  onFile,
}: {
  accept: string
  label: string
  hint: string
  file: File | null
  onFile: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = useCallback(
    (f: File) => { onFile(f) },
    [onFile]
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) handle(f)
      }}
      onClick={() => ref.current?.click()}
      className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${
        dragging || file
          ? 'border-[#9b7a36] bg-[#f6f0e1]'
          : 'border-[#e8dcc8] bg-[#faf6ec] hover:border-[#c2a14e] hover:bg-[#f6f0e1]'
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }}
      />

      {file ? (
        <>
          <div className="w-12 h-12 rounded-xl bg-[#9b7a36]/10 border border-[#9b7a36]/30 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-[#9b7a36]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#4a3728]">{file.name}</p>
            <p className="text-xs text-[#9b7a36] mt-0.5">{(file.size / 1024).toFixed(1)} KB — ready</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null as unknown as File) }}
            className="text-xs text-red-400 hover:text-red-600 underline"
          >
            Remove
          </button>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f6f0e1] to-[#e8dcc8] border border-[#c2a14e]/40 flex items-center justify-center group-hover:from-[#e8dcc8] group-hover:to-[#d4b896] transition-all">
            <Upload className="w-7 h-7 text-[#9b7a36]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#4a3728]">{label}</p>
            <p className="text-xs text-[#9b7a36] mt-1">{hint}</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Module-specific Step 1 forms ──────────────────────────────────────────────

function ComparisonStep1({
  onReady,
}: {
  onReady: (d: Record<string, unknown>) => void
}) {
  const [countries, setCountries] = useState<string[]>(['Saudi Arabia', 'UAE', 'Qatar'])
  const [metrics, setMetrics] = useState<string[]>(['GDP (USD Billions)', 'Energy Investment'])

  const toggleMetric = (m: string) =>
    setMetrics((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    )

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Select Countries to Compare"
          subtitle="Choose up to 6 countries for side-by-side analysis"
        />
        <CountryPicker selected={countries} onChange={setCountries} />
      </div>

      <div>
        <SectionHeader
          title="Select Metrics"
          subtitle="Choose the economic indicators to visualize"
        />
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMetric(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                metrics.includes(m)
                  ? 'bg-[#9b7a36] text-white border-[#9b7a36] shadow-sm'
                  : 'bg-white text-[#9b7a36] border-[#e8dcc8] hover:border-[#9b7a36]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <Button
        disabled={countries.length < 2 || metrics.length === 0}
        onClick={() => onReady({ countries, metrics })}
        className="w-full h-12 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold text-base rounded-xl shadow-lg disabled:opacity-50"
      >
        Start AI Processing →
      </Button>
    </div>
  )
}

function AdvancedStep1({ onReady }: { onReady: (d: Record<string, unknown>) => void }) {
  const [scenario, setScenario] = useState('')
  const [energyInv, setEnergyInv] = useState(35)
  const [tradePolicy, setTradePolicy] = useState(60)
  const [infraBudget, setInfraBudget] = useState(20)
  const [forecastYears, setForecastYears] = useState(5)
  const [country, setCountry] = useState<string[]>(['Saudi Arabia'])

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Target Country"
          subtitle="Select the country for scenario forecasting"
        />
        <CountryPicker selected={country} onChange={setCountry} maxSelect={1} />
      </div>

      <div>
        <SectionHeader
          title="Scenario Description"
          subtitle="Describe the strategic scenario in plain language"
        />
        <textarea
          rows={4}
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="e.g. Increased energy sector investment combined with liberalized trade policy over the next 5 years, targeting GDP growth of 6%..."
          className="w-full rounded-xl border-2 border-[#e8dcc8] bg-white px-4 py-3 text-sm text-[#4a3728] placeholder:text-[#c2a14e] focus:outline-none focus:border-[#9b7a36] resize-none transition-colors"
        />
      </div>

      <div>
        <SectionHeader
          title="Scenario Variables"
          subtitle="Adjust model parameters"
        />
        <div className="bg-[#faf6ec] rounded-2xl p-5 border border-[#e8dcc8] space-y-1">
          <SliderField
            label="Energy Investment (%)"
            value={energyInv}
            onChange={setEnergyInv}
            unit="%"
          />
          <SliderField
            label="Trade Policy Index"
            value={tradePolicy}
            onChange={setTradePolicy}
            unit=" pts"
            min={0}
            max={100}
          />
          <SliderField
            label="Infrastructure Budget (%GDP)"
            value={infraBudget}
            onChange={setInfraBudget}
            unit="%"
            min={0}
            max={50}
          />
          <SliderField
            label="Forecast Horizon"
            value={forecastYears}
            onChange={setForecastYears}
            unit=" yrs"
            min={3}
            max={20}
            step={1}
          />
        </div>
      </div>

      <Button
        onClick={() => onReady({ scenario, energyInv, tradePolicy, infraBudget, forecastYears, country: country[0] })}
        className="w-full h-12 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold text-base rounded-xl shadow-lg"
      >
        Start AI Processing →
      </Button>
    </div>
  )
}

function EconomicStep1({ onReady }: { onReady: (d: Record<string, unknown>) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [countries, setCountries] = useState<string[]>([])
  const [reportType, setReportType] = useState<'annual' | 'quarterly'>('annual')
  const [yearFrom, setYearFrom] = useState('2020')
  const [yearTo, setYearTo] = useState('2024')

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Upload Data File"
          subtitle="CSV or Excel files with economic indicators"
        />
        <FileDropZone
          accept=".csv,.xlsx,.xls"
          label="Drag & drop CSV / Excel"
          hint="Supported: .csv · .xlsx · .xls  ·  Max 20MB"
          file={file}
          onFile={setFile}
        />
      </div>

      <div>
        <SectionHeader title="Target Countries" subtitle="Leave blank to use data from file" />
        <CountryPicker selected={countries} onChange={setCountries} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#4a3728] mb-1.5">Report Type</label>
          <div className="flex gap-2">
            {(['annual', 'quarterly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                  reportType === t
                    ? 'bg-[#9b7a36] text-white border-[#9b7a36]'
                    : 'bg-white text-[#9b7a36] border-[#e8dcc8] hover:border-[#9b7a36]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-semibold text-[#4a3728] mb-1.5">From</label>
            <input
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8dcc8] text-sm text-[#4a3728] focus:outline-none focus:border-[#9b7a36] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#4a3728] mb-1.5">To</label>
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8dcc8] text-sm text-[#4a3728] focus:outline-none focus:border-[#9b7a36] bg-white"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={() => onReady({ file: file?.name, countries, reportType, yearFrom, yearTo })}
        className="w-full h-12 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold text-base rounded-xl shadow-lg"
      >
        Start AI Processing →
      </Button>
    </div>
  )
}

const LANGUAGES = ['Auto-detect', 'Arabic', 'English', 'French', 'German', 'Spanish', 'Chinese', 'Japanese']
const EXTRACTION_TYPES = ['Full Text', 'Tables Only', 'Key-Value Pairs', 'Named Entities', 'Numeric Data']

function UploadStep1({ onReady }: { onReady: (d: Record<string, unknown>) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [lang, setLang] = useState('Auto-detect')
  const [extraction, setExtraction] = useState<string[]>(['Full Text', 'Key-Value Pairs'])

  const toggleEx = (t: string) =>
    setExtraction((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Upload Document"
          subtitle="PDF, JPEG, PNG, TIFF supported"
        />
        <FileDropZone
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
          label="Drag & drop PDF or Image"
          hint="Supported: .pdf · .jpg · .png · .tiff  ·  Max 50MB"
          file={file}
          onFile={setFile}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Document Language" />
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  lang === l
                    ? 'bg-[#9b7a36] text-white border-[#9b7a36]'
                    : 'bg-white text-[#9b7a36] border-[#e8dcc8] hover:border-[#9b7a36]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Extraction Types" />
          <div className="flex flex-wrap gap-2">
            {EXTRACTION_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => toggleEx(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  extraction.includes(t)
                    ? 'bg-[#9b7a36] text-white border-[#9b7a36]'
                    : 'bg-white text-[#9b7a36] border-[#e8dcc8] hover:border-[#9b7a36]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        disabled={!file}
        onClick={() => onReady({ file: file?.name, lang, extraction })}
        className="w-full h-12 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold text-base rounded-xl shadow-lg disabled:opacity-50"
      >
        Start AI Processing →
      </Button>
    </div>
  )
}

// ── Live Feed connection status component ────────────────────────────────────

type ConnStatus = 'connecting' | 'connected' | 'error'

const STATUS_MESSAGES: Record<ConnStatus, string[]> = {
  connecting: [
    'Connecting to Global Trade API...',
    'Authenticating WebSocket handshake...',
    'Subscribing to real-time market feed...',
  ],
  connected: [
    'WebSocket Connected · 94ms latency',
    'Receiving live tick stream · 1s interval',
    'EMA smoothing: α=0.30 · CAGR baseline ready',
  ],
  error: [
    'Connection failed — retrying...',
    'Fallback to simulated data stream',
  ],
}

function LiveConnectionStatus({ status, msgIdx }: { status: ConnStatus; msgIdx: number }) {
  const msgs = STATUS_MESSAGES[status]
  const msg = msgs[msgIdx % msgs.length] ?? msgs[0]

  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-3 border text-xs font-mono ${
        status === 'connected'
          ? 'border-green-300 bg-green-50 text-green-800'
          : status === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-[#e8dcc8] bg-[#1a1208] text-[#c2a14e]'
      }`}
    >
      <span
        className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
          status === 'connected'
            ? 'bg-green-500'
            : status === 'error'
            ? 'bg-red-400'
            : 'bg-[#c2a14e] animate-pulse'
        }`}
      />
      <span>{msg}</span>
    </div>
  )
}

// ── Live Feed baseline parameter panel ───────────────────────────────────────

function LiveFeedPanel({
  moduleType,
  onReady,
}: {
  moduleType: ModuleType
  onReady: (d: Record<string, unknown>) => void
}) {
  const [baseInflation, setBaseInflation] = useState(2.5)
  const [baseGdp, setBaseGdp] = useState(4.2)
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting')
  const [msgIdx, setMsgIdx] = useState(0)

  // Simulate connection lifecycle
  useEffect(() => {
    const t1 = setTimeout(() => setConnStatus('connected'), 2200)
    const ticker = setInterval(() => setMsgIdx((p) => p + 1), 1800)
    return () => { clearTimeout(t1); clearInterval(ticker) }
  }, [])

  return (
    <div className="space-y-6">
      {/* Connection status box */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-[#9b7a36]" />
          <span className="text-sm font-semibold text-[#4a3728]">Connection Status</span>
        </div>
        <LiveConnectionStatus status={connStatus} msgIdx={msgIdx} />
      </div>

      {/* Baseline parameters */}
      <div
        className="rounded-2xl border-2 p-5 space-y-5"
        style={{ borderColor: '#e8dcc8', background: '#faf6ec' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-[#9b7a36]" />
          <span className="text-sm font-bold text-[#4a3728]">Baseline Parameters</span>
          <span className="text-xs text-[#9b7a36] ml-auto">
            These seed the live mathematical models
          </span>
        </div>

        {/* Inflation */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-[#4a3728]">
              Baseline Inflation Rate
            </label>
            <span className="text-sm font-bold text-[#9b7a36] bg-white border border-[#e8dcc8] px-2 py-0.5 rounded-md">
              {baseInflation.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            step={0.1}
            value={baseInflation}
            onChange={(e) => setBaseInflation(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #9b7a36 0%, #9b7a36 ${(baseInflation / 15) * 100}%, #e8dcc8 ${(baseInflation / 15) * 100}%, #e8dcc8 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-[#c2a14e] mt-1">
            <span>0%</span><span>15%</span>
          </div>
        </div>

        {/* GDP */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-[#4a3728]">
              Baseline GDP Growth Rate
            </label>
            <span className="text-sm font-bold text-[#9b7a36] bg-white border border-[#e8dcc8] px-2 py-0.5 rounded-md">
              {baseGdp.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={0.1}
            value={baseGdp}
            onChange={(e) => setBaseGdp(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #9b7a36 0%, #9b7a36 ${(baseGdp / 12) * 100}%, #e8dcc8 ${(baseGdp / 12) * 100}%, #e8dcc8 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-[#c2a14e] mt-1">
            <span>0%</span><span>12%</span>
          </div>
        </div>

        {/* Formula hint */}
        <div className="bg-[#1a1208] rounded-xl p-3 font-mono text-xs text-[#c2a14e] space-y-1">
          <p className="text-[#9b7a36]">// Live model seed values</p>
          <p>EMA_α = 0.30 <span className="text-[#a89060]">// smoothing factor</span></p>
          <p>baseline_inflation = {baseInflation.toFixed(1)}%</p>
          <p>baseline_gdp = {baseGdp.toFixed(1)}%</p>
          <p>feed_interval = 1000ms</p>
        </div>
      </div>

      <Button
        onClick={() =>
          onReady({ isLive: true, baselineInflation: baseInflation, baselineGdp: baseGdp, moduleType })
        }
        className="w-full h-12 bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] hover:from-[#7c612a] hover:to-[#9b7a36] text-white font-semibold text-base rounded-xl shadow-lg gap-2"
      >
        <Radio className="w-4 h-4" />
        Connect &amp; Start Live Processing →
      </Button>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function FeedModeToggle({
  isLive,
  onToggle,
}: {
  isLive: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 p-1 bg-[#f6f0e1] rounded-2xl border-2 border-[#e8dcc8] mb-6">
      <button
        onClick={() => onToggle(false)}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
          !isLive
            ? 'bg-white text-[#4a3728] shadow-sm border border-[#e8dcc8]'
            : 'text-[#c2a14e] hover:text-[#9b7a36]'
        }`}
      >
        <WifiOff className="w-4 h-4" />
        Static Upload
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
          isLive
            ? 'bg-[#9b7a36] text-white shadow-md'
            : 'text-[#c2a14e] hover:text-[#9b7a36]'
        }`}
      >
        <Wifi className="w-4 h-4" />
        Connect Live Feed
        {isLive && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-1" />
        )}
      </button>
    </div>
  )
}

// ── Public export: routes to correct form by moduleType ───────────────────────

interface Step1InputsProps {
  moduleType: ModuleType
  onReady: (inputData: Record<string, unknown>) => void
}

export function Step1Inputs({ moduleType, onReady }: Step1InputsProps) {
  const [isLive, setIsLive] = useState(false)

  const handleStaticReady = useCallback(
    (data: Record<string, unknown>) => onReady({ ...data, isLive: false }),
    [onReady]
  )
  const handleLiveReady = useCallback(
    (data: Record<string, unknown>) => onReady(data),
    [onReady]
  )

  const staticForm = (() => {
    switch (moduleType) {
      case 'comparison': return <ComparisonStep1 onReady={handleStaticReady} />
      case 'advanced':   return <AdvancedStep1   onReady={handleStaticReady} />
      case 'economic':   return <EconomicStep1   onReady={handleStaticReady} />
      case 'upload':     return <UploadStep1     onReady={handleStaticReady} />
      default:           return null
    }
  })()

  return (
    <div>
      <FeedModeToggle isLive={isLive} onToggle={setIsLive} />
      {isLive ? (
        <LiveFeedPanel moduleType={moduleType} onReady={handleLiveReady} />
      ) : (
        staticForm
      )}
    </div>
  )
}

