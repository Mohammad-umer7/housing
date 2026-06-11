'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Search, Cpu, Sparkles, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { getUserEmail } from '@/lib/auth'
import {
  createSession,
  saveScenarioInput,
  saveEconomicInput,
  saveMeetingData,
  updateSessionStatus,
} from '@/lib/supabase-operations'
import { isSupabaseConfigured } from '@/lib/supabase'
import type { InputData } from '@/types/database'

interface ProcessingStepProps {
  inputData: InputData
  onComplete: (sessionId: string | null) => void
}

const stages = [
  { key: 'validate', label: 'Validating Input', icon: ShieldCheck, durationMs: 900 },
  { key: 'analyze', label: 'Analyzing Data', icon: Search, durationMs: 1100 },
  { key: 'model', label: 'Running Probabilistic Models', icon: Cpu, durationMs: 1200 },
  { key: 'insight', label: 'Generating Insights', icon: Sparkles, durationMs: 800 },
]

type StageStatus = 'pending' | 'running' | 'done'

export function ProcessingStep({ inputData, onComplete }: ProcessingStepProps) {
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(
    stages.map(() => 'pending')
  )
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [dbDone, setDbDone] = useState(false)
  const [animDone, setAnimDone] = useState(false)

  // ── Supabase save ──────────────────────────────────────────────────────────
  const saveToSupabase = useCallback(async () => {
    if (!inputData) {
      setDbDone(true)
      return
    }

    const userEmail = getUserEmail() ?? 'anonymous'
    const sessionType =
      inputData.type === 'scenario'
        ? 'scenario'
        : inputData.type === 'economic'
        ? 'economic'
        : inputData.type === 'meeting'
        ? 'meeting'
        : 'upload'

    const { data: session, error: sessionErr } = await createSession(userEmail, sessionType)

    if (sessionErr || !session) {
      if (!isSupabaseConfigured) {
        setSupabaseError('Supabase not configured — results are local only.')
      } else {
        setSupabaseError(`DB error: ${sessionErr}`)
      }
      setDbDone(true)
      return
    }

    setSessionId(session.id)

    let saveErr: string | null = null
    if (inputData.type === 'scenario') {
      const r = await saveScenarioInput(session.id, inputData.data)
      saveErr = r.error
    } else if (inputData.type === 'economic') {
      const r = await saveEconomicInput(session.id, inputData.data)
      saveErr = r.error
    } else if (inputData.type === 'meeting') {
      const r = await saveMeetingData(session.id, inputData.data)
      saveErr = r.error
    }

    if (saveErr) {
      setSupabaseError(`Save error: ${saveErr}`)
    }

    await updateSessionStatus(session.id, 'complete')
    setDbDone(true)
  }, [inputData])

  // ── Animation ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let elapsed = 0

    const runStages = async () => {
      for (let i = 0; i < stages.length; i++) {
        if (cancelled) return
        setStageStatuses((prev) => {
          const next = [...prev]
          next[i] = 'running'
          return next
        })
        await new Promise((res) => setTimeout(res, stages[i].durationMs))
        if (cancelled) return
        setStageStatuses((prev) => {
          const next = [...prev]
          next[i] = 'done'
          return next
        })
      }
      setAnimDone(true)
    }

    runStages()
    saveToSupabase()

    return () => {
      cancelled = true
    }
  }, [saveToSupabase])

  // ── Advance when both done ─────────────────────────────────────────────────
  useEffect(() => {
    if (animDone && dbDone) {
      const t = setTimeout(() => onComplete(sessionId), 500)
      return () => clearTimeout(t)
    }
  }, [animDone, dbDone, sessionId, onComplete])

  const totalDone = stageStatuses.filter((s) => s === 'done').length
  const progress = Math.round((totalDone / stages.length) * 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-1">
            Processing Your Data
          </h2>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Running analysis pipeline — this will only take a moment
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 mb-2">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage list */}
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const status = stageStatuses[i]
            const Icon = stage.icon
            return (
              <div
                key={stage.key}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border transition-all duration-300 ${
                  status === 'running'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                    : status === 'done'
                    ? 'border-green-200 dark:border-green-800/30 bg-green-50/60 dark:bg-green-900/10'
                    : 'border-amber-100 dark:border-amber-900/20 bg-white/50 dark:bg-card/20'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    status === 'running'
                      ? 'bg-amber-500'
                      : status === 'done'
                      ? 'bg-green-500'
                      : 'bg-amber-100 dark:bg-amber-900/20'
                  }`}
                >
                  {status === 'running' ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : status === 'done' ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Icon className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      status === 'running'
                        ? 'text-amber-900 dark:text-amber-100'
                        : status === 'done'
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-amber-400 dark:text-amber-600'
                    }`}
                  >
                    {stage.label}
                  </p>
                  {status === 'running' && (
                    <div className="w-full bg-amber-200/60 rounded-full h-1 mt-1.5 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </div>

                {status === 'done' && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Done</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Supabase status */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {supabaseError ? (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {supabaseError}
            </div>
          ) : dbDone && sessionId ? (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Saved to database · Session {sessionId.slice(0, 8)}...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-500 dark:text-amber-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving to database...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
