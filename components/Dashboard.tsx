'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, UserCheck, Clock, RefreshCw, Loader2, Zap } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

type Case = {
  id: string
  case_number: string
  full_name: string
  status: string
  arrears_amount: number
  monthly_payment: number | null
  duration_months: number | null
  risk_score: number
  processed_at: string
  decision_reason: string
}

type Stats = {
  total: number
  approved: number
  rejected: number
  escalated: number
}

type QueueStats = {
  queued: number
  processing: number
  avgProcessingMs: number
  longestWaitMs: number
}

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export default function Dashboard() {
  const [cases, setCases] = useState<Case[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0, approved: 0, rejected: 0, escalated: 0,
  })
  const [queue, setQueue] = useState<QueueStats>({
    queued: 0, processing: 0, avgProcessingMs: 0, longestWaitMs: 0,
  })
  const [loading, setLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const channelRef = useRef<ReturnType<typeof getSupabase>['channel'] extends (...args: unknown[]) => infer R ? R : never | null>(null)

  async function fetchData() {
    try {
      const res = await fetch('/api/dashboard')
      const envelope = await res.json()
      const data = envelope.data || {}
      setCases(data.cases || [])
      setStats(data.stats || stats)
      setQueue(data.queue || queue)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function refreshData() {
    setLoading(true)
    await fetchData()
  }

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/dashboard')
        const envelope = await res.json()
        const d = envelope.data || {}
        setCases(d.cases || [])
        setStats(d.stats || { total: 0, approved: 0, rejected: 0, escalated: 0 })
        setQueue(d.queue || { queued: 0, processing: 0, avgProcessingMs: 0, longestWaitMs: 0 })
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()

    const supabase = getSupabase()
    const channel = supabase
      .channel('dashboard-cases')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cases' },
        () => {
          // Treat the realtime event purely as a refetch trigger — never render the
          // payload directly. Realtime WAL payloads are not column-filtered, so we
          // reload authoritative, PII-safe data from /api/dashboard (service-role).
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cases' },
        () => { fetchData() }
      )
      .subscribe(status => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelRef.current = channel as any

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statCards = [
    { label: 'Total Cases', label_ar: 'إجمالي القضايا', value: stats.total, color: 'text-slate-800', bg: 'bg-slate-100 border border-slate-200' },
    { label: 'Auto Approved', label_ar: 'موافق تلقائي', value: stats.approved, color: 'text-green-700', bg: 'bg-green-50 border border-green-200', icon: CheckCircle2 },
    { label: 'Request Docs', label_ar: 'مستندات مطلوبة', value: stats.rejected, color: 'text-red-700', bg: 'bg-red-50 border border-red-200', icon: XCircle },
    { label: 'Escalated', label_ar: 'تصعيد للموظف', value: stats.escalated, color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200', icon: UserCheck },
  ]

  const autoResolutionRate = stats.total > 0
    ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100)
    : 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Operations Dashboard</h2>
          <p className="text-slate-500 text-sm flex items-center gap-2">
            لوحة العمليات · Finance & Collections
            {realtimeConnected && (
              <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-sm transition-colors border border-slate-300 shadow-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Queue monitor */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap size={12} />
            Live Queue Monitor
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Queued</div>
              <div className={`text-2xl font-bold ${queue.queued > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                {queue.queued}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Processing</div>
              <div className={`text-2xl font-bold flex items-center gap-1 ${queue.processing > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                {queue.processing > 0 && <Loader2 size={16} className="animate-spin" />}
                {queue.processing}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Avg Processing</div>
          <div className="text-2xl font-bold text-slate-900">
            {queue.avgProcessingMs > 0 ? fmt(queue.avgProcessingMs) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">per case today</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Longest Queue Wait</div>
          <div className="text-2xl font-bold text-slate-900">
            {queue.longestWaitMs > 0 ? fmt(queue.longestWaitMs) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">today</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
              {s.icon && <s.icon size={16} className={s.color} />}
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-slate-600 mt-0.5">{s.label_ar}</div>
          </div>
        ))}
      </div>

      {/* Impact banner */}
      {stats.total > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-blue-950 font-semibold flex items-center gap-2">
              <Clock size={16} className="text-blue-600" />
              Impact Summary / ملخص الأثر
            </div>
            <div className="text-blue-800 text-sm mt-0.5">
              {stats.total} cases processed — {stats.approved} approved, {stats.rejected} requested documents, {stats.escalated} escalated to officer review
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-700">{autoResolutionRate}%</div>
            <div className="text-blue-600 text-xs">auto-resolution rate</div>
          </div>
        </div>
      )}

      {/* Cases table — live feed */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-900">
            Recent Cases / القضايا الأخيرة
            {realtimeConnected && (
              <span className="ml-2 text-xs text-green-600 font-normal">· updating live</span>
            )}
          </h3>
          <span className="text-xs text-slate-500">{cases.length} records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <div className="text-4xl mb-2">📋</div>
            <div>No cases yet.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Case #</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Applicant</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Arrears</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Decision</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Plan</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Risk</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Processed</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{c.case_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{c.full_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      AED {(c.arrears_amount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <Loader2 size={10} className="animate-spin" />
                          Processing
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                          c.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {c.status === 'approved' ? '✓ APPROVED' :
                           c.status === 'rejected' ? '✗ REQUEST DOCS' :
                           '⚠ ESCALATED'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {c.monthly_payment ? `AED ${c.monthly_payment.toLocaleString()}/mo × ${c.duration_months}m` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.risk_score ? (
                        <span className={`text-sm font-bold ${
                          c.risk_score > 70 ? 'text-red-600' :
                          c.risk_score > 40 ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {c.risk_score}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.processed_at
                        ? new Date(c.processed_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
