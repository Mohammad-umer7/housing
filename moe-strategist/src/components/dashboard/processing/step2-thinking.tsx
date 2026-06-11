'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Terminal, Cpu, CheckCircle, Loader2, Zap, Radio, Hash } from 'lucide-react'
import type { ModuleConfig } from '@/types/modules'
import { ema, cagr, sustainabilityScore, EMA_ALPHA, FORMULAS } from '@/lib/math-models'

interface Step2ThinkingProps {
  config: ModuleConfig
  inputData: Record<string, unknown>
  onComplete: () => void
}

type AgentStatus = 'idle' | 'running' | 'done'

// â”€â”€ Mini live JSON ticker (shown when isLive = true) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RawPacket {
  ts: number
  seq: number
  gdp_raw: number
  gdp_ema: number
  inflation: number
  trade_vol: number
  cagr_1yr: number
}

function useTickSimulator(active: boolean, baseGdp: number, baseInflation: number) {
  const [packets, setPackets] = useState<RawPacket[]>([])
  const prevEmaRef = useRef(baseGdp)
  const prevRawRef = useRef(baseGdp)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      seqRef.current++
      const drift = (Math.random() - 0.48) * 0.12
      const raw = Math.max(0.2, prevRawRef.current + drift)
      const emaVal = ema(EMA_ALPHA, raw, prevEmaRef.current)
      prevRawRef.current = raw
      prevEmaRef.current = emaVal
      const packet: RawPacket = {
        ts: Date.now(),
        seq: seqRef.current,
        gdp_raw: parseFloat(raw.toFixed(3)),
        gdp_ema: parseFloat(emaVal.toFixed(3)),
        inflation: parseFloat((baseInflation + (Math.random() - 0.5) * 0.08).toFixed(2)),
        trade_vol: parseFloat((450 + (Math.random() - 0.5) * 18).toFixed(1)),
        cagr_1yr: parseFloat(cagr(emaVal, baseGdp, 1).toFixed(4)),
      }
      setPackets((prev) => [...prev.slice(-14), packet])
    }, 600)
    return () => clearInterval(id)
  }, [active, baseGdp, baseInflation])

  return packets
}

// â”€â”€ Math computation step visualiser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MathComputePanel({ packets }: { packets: RawPacket[] }) {
  const latest = packets[packets.length - 1]
  const prev = packets[packets.length - 2]

  const computedEma = useMemo(() => {
    if (!latest || !prev) return null
    return {
      alpha: EMA_ALPHA,
      x: latest.gdp_raw,
      prevEma: prev.gdp_ema,
      result: latest.gdp_ema,
    }
  }, [latest, prev])

  const computedCagr = useMemo(() => {
    if (!latest) return null
    return {
      vFinal: latest.gdp_ema,
      vInitial: prev?.gdp_ema ?? latest.gdp_ema,
      t: 1,
      result: latest.cagr_1yr,
    }
  }, [latest, prev])

  const computedSustain = useMemo(() => {
    const sectors = [
      { r: 28 + (latest?.seq ?? 0) * 0.03, t: 100, w: 0.4 },
      { r: 42, t: 100, w: 0.35 },
      { r: 18, t: 100, w: 0.25 },
    ]
    return sustainabilityScore(sectors)
  }, [latest?.seq])

  if (!latest) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-[#c2a14e]">
        Waiting for first tick...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* EMA */}
      <div className="bg-[#0f1a0a] rounded-xl p-3 border border-[#1a3a12]">
        <p className="text-[10px] text-[#4a9a3a] uppercase tracking-widest mb-1.5 font-bold">
          {FORMULAS.ema.label}
        </p>
        <p className="text-xs font-mono text-[#8adf7a] mb-1">
          {FORMULAS.ema.plain}
        </p>
        {computedEma && (
          <p className="text-xs font-mono text-[#c2a14e]">
            = {computedEma.alpha} Ã— {computedEma.x} + {(1 - computedEma.alpha).toFixed(1)} Ã—{' '}
            {computedEma.prevEma} ={' '}
            <span className="text-white font-bold">{computedEma.result}</span>
          </p>
        )}
      </div>

      {/* CAGR */}
      <div className="bg-[#0a0f1a] rounded-xl p-3 border border-[#12203a]">
        <p className="text-[10px] text-[#3a7adf] uppercase tracking-widest mb-1.5 font-bold">
          {FORMULAS.cagr.label}
        </p>
        <p className="text-xs font-mono text-[#7aadff] mb-1">{FORMULAS.cagr.plain}</p>
        {computedCagr && (
          <p className="text-xs font-mono text-[#c2a14e]">
            = ({computedCagr.vFinal} Ã· {computedCagr.vInitial})^1 âˆ’ 1 ={' '}
            <span className="text-white font-bold">
              {(computedCagr.result * 100).toFixed(2)}%
            </span>
          </p>
        )}
      </div>

      {/* Sustainability */}
      <div className="bg-[#1a0f0a] rounded-xl p-3 border border-[#3a2012]">
        <p className="text-[10px] text-[#df7a3a] uppercase tracking-widest mb-1.5 font-bold">
          {FORMULAS.sustainability.label}
        </p>
        <p className="text-xs font-mono text-[#ffb87a] mb-1">
          {FORMULAS.sustainability.plain}
        </p>
        <p className="text-xs font-mono text-[#c2a14e]">
          Î£ wÂ·(R/T) ={' '}
          <span className="text-white font-bold">{(computedSustain * 100).toFixed(2)}%</span>
        </p>
      </div>
    </div>
  )
}

// â”€â”€ Main Step 2 component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function Step2Thinking({ config, inputData, onComplete }: Step2ThinkingProps) {
  const isLive = Boolean(inputData.isLive)
  const baseGdp = Number(inputData.baselineGdp ?? 4.2)
  const baseInflation = Number(inputData.baselineInflation ?? 2.5)

  const [lines, setLines] = useState<string[]>([])
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(
    config.agents.map(() => 'idle')
  )
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [activeTab, setActiveTab] = useState<'terminal' | 'stream'>('terminal')
  const termRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
  const completeCalled = useRef(false)

  const packets = useTickSimulator(isLive, baseGdp, baseInflation)

  // Auto-switch to stream tab when live
  useEffect(() => {
    if (isLive) setActiveTab('stream')
  }, [isLive])

  // â”€â”€ Terminal messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const msgs = config.processingMessages
    let i = 0
    const perMsg = 3200 / msgs.length

    const tick = () => {
      if (i >= msgs.length) return
      const msg = msgs[i]
      if (typeof msg === 'string') setLines((prev) => [...prev, msg])
      i++
    }

    tick()
    const id = setInterval(() => {
      tick()
      if (i >= msgs.length) clearInterval(id)
    }, perMsg)
    return () => clearInterval(id)
  }, [config.processingMessages])

  // â”€â”€ Progress bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let p = 0
    const id = setInterval(() => {
      p += 2
      setProgress(Math.min(p, 100))
      if (p >= 100) { clearInterval(id); setDone(true) }
    }, 70)
    return () => clearInterval(id)
  }, [])

  // â”€â”€ Agent statuses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const delays = [200, 1100, 2200]
    const completionDelays = [1000, 2000, 3000]
    delays.forEach((delay, i) => {
      setTimeout(() => setAgentStatuses((prev) => { const n = [...prev]; n[i] = 'running'; return n }), delay)
      setTimeout(() => setAgentStatuses((prev) => { const n = [...prev]; n[i] = 'done'; return n }), completionDelays[i])
    })
  }, [])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  useEffect(() => {
    if (tickerRef.current) tickerRef.current.scrollTop = tickerRef.current.scrollHeight
  }, [packets])

  useEffect(() => {
    if (done && !completeCalled.current) {
      completeCalled.current = true
      const t = setTimeout(onComplete, 700)
      return () => clearTimeout(t)
    }
  }, [done, onComplete])

  return (
    <div className="py-4 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9b7a36] to-[#c2a14e] flex items-center justify-center shadow-lg">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9b7a36] opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#c2a14e]" />
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[#4a3728]">
          {isLive ? 'Live Compute Stream' : 'AI Agents Processing'}
        </h2>
        <p className="text-sm text-[#9b7a36] mt-1 flex items-center justify-center gap-1.5">
          {isLive && <Radio className="w-3.5 h-3.5 text-green-500" />}
          {done ? 'Analysis complete â€” preparing results' : isLive ? 'Ingesting live feed Â· EMA smoothing active' : 'Running advanced analysis pipeline...'}
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-3 gap-3">
        {config.agents.map((agent, i) => {
          const status = agentStatuses[i]
          return (
            <div
              key={agent.name}
              className={`rounded-xl border-2 p-3 transition-all duration-500 ${
                status === 'running' ? 'border-[#9b7a36] bg-[#f6f0e1] shadow-md'
                : status === 'done'  ? 'border-green-300 bg-green-50'
                : 'border-[#e8dcc8] bg-white opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  status === 'running' ? 'bg-[#9b7a36]'
                  : status === 'done'  ? 'bg-green-500'
                  : 'bg-[#e8dcc8]'
                }`}>
                  {status === 'running' ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  : status === 'done'   ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                  : <Zap className="w-3.5 h-3.5 text-[#c2a14e]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#4a3728] truncate">{agent.name}</p>
                  <p className="text-[10px] text-[#9b7a36] truncate">{agent.role}</p>
                </div>
              </div>
              <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block ${
                status === 'running' ? 'bg-[#9b7a36]/10 text-[#9b7a36]'
                : status === 'done'  ? 'bg-green-100 text-green-700'
                : 'bg-[#f6f0e1] text-[#c2a14e]'
              }`}>
                {status === 'running' ? 'â— ACTIVE' : status === 'done' ? 'âœ“ DONE' : 'â—‹ IDLE'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border-2 border-[#e8dcc8] p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-[#4a3728] uppercase tracking-wider">
            {isLive ? 'Live Pipeline Progress' : 'Pipeline Progress'}
          </span>
          <span className="text-xs font-bold text-[#9b7a36]">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#f6f0e1] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: isLive
                ? 'linear-gradient(90deg, #22c55e, #9b7a36, #c2a14e)'
                : 'linear-gradient(90deg, #9b7a36, #c2a14e, #9b7a36)',
            }}
          />
        </div>
      </div>

      {/* Tab switcher (only when live) */}
      {isLive && (
        <div className="flex gap-1 bg-[#f6f0e1] rounded-xl p-1 border border-[#e8dcc8]">
          {([['terminal', 'Processing Log'], ['stream', 'Live Compute Stream']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === id
                  ? 'bg-[#9b7a36] text-white shadow'
                  : 'text-[#9b7a36] hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Terminal window (always shown when static; shown via tab when live) */}
      {(!isLive || activeTab === 'terminal') && (
        <div className="bg-[#1a1208] rounded-2xl border border-[#3a2c14] overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#251a0e] border-b border-[#3a2c14]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-xs text-[#9b7a36] font-mono ml-2 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              moe-ai-pipeline â€” {config.title}
            </span>
            <span className={`ml-auto text-[10px] font-mono ${done ? 'text-green-400' : 'text-[#c2a14e] animate-pulse'}`}>
              {done ? 'âœ“ complete' : 'â— running'}
            </span>
          </div>
          <div ref={termRef} className="h-52 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
            {lines.map((line, i) => {
              if (!line) return null
              const isCmd = line.startsWith('>')
              return (
                <div key={i} className="mb-0.5" style={{ animation: 'fadeSlide 0.25s ease-out' }}>
                  <span className={isCmd ? 'text-[#c2a14e]' : 'text-[#a89060]'}>{line}</span>
                </div>
              )
            })}
            {!done && <div className="flex items-center gap-1 text-[#9b7a36]"><span className="animate-pulse">â–ˆ</span></div>}
            {done && <div className="text-green-400 mt-1">âœ“ All agents completed successfully.</div>}
          </div>
        </div>
      )}

      {/* Live Compute Stream panel */}
      {isLive && activeTab === 'stream' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* JSON ticker */}
          <div className="bg-[#1a1208] rounded-2xl border border-[#3a2c14] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#251a0e] border-b border-[#3a2c14]">
              <Hash className="w-3 h-3 text-green-400" />
              <span className="text-xs text-[#9b7a36] font-mono">raw_tick_stream</span>
              <span className="ml-auto text-[10px] text-green-400 font-mono animate-pulse">
                â— LIVE Â· {packets.length} pkts
              </span>
            </div>
            <div ref={tickerRef} className="h-64 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed space-y-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
              {packets.map((pkt) => (
                <div key={pkt.seq} style={{ animation: 'fadeSlide 0.2s ease-out' }}>
                  <span className="text-[#4a6a4a]">{new Date(pkt.ts).toLocaleTimeString('en', { timeStyle: 'medium' })} </span>
                  <span className="text-[#c2a14e]">{'{'}</span>
                  <span className="text-[#7aadff]">seq</span>
                  <span className="text-white">:{pkt.seq}, </span>
                  <span className="text-[#7aadff]">gdp_raw</span>
                  <span className="text-[#22c55e]">:{pkt.gdp_raw}</span>
                  <span className="text-white">, </span>
                  <span className="text-[#7aadff]">gdp_ema</span>
                  <span className="text-[#ffb87a]">:{pkt.gdp_ema}</span>
                  <span className="text-white">, </span>
                  <span className="text-[#7aadff]">infl</span>
                  <span className="text-white">:{pkt.inflation}</span>
                  <span className="text-[#c2a14e]">{'}'}</span>
                </div>
              ))}
              {packets.length === 0 && (
                <div className="text-[#4a6a4a] animate-pulse">Waiting for first tick...</div>
              )}
            </div>
          </div>

          {/* Math computation panel */}
          <div className="bg-[#1a1208] rounded-2xl border border-[#3a2c14] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#251a0e] border-b border-[#3a2c14]">
              <Cpu className="w-3 h-3 text-[#c2a14e]" />
              <span className="text-xs text-[#9b7a36] font-mono">math_compute</span>
              <span className="ml-auto text-[10px] text-[#c2a14e] font-mono">
                Î±={EMA_ALPHA}
              </span>
            </div>
            <div className="p-3 h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
              <MathComputePanel packets={packets} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
