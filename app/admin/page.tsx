'use client'

// Admin Overview — real-time SADDAD rescheduling operations. Ports the source
// admin dashboard (KPIs, status donut, outcome bars, recent cases, priority
// queue) onto the MOEI light design system. Charts are hand-drawn SVG so no
// chart library is added.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type CaseRow = {
  case_number: string
  full_name: string
  arrears_amount: number
  status: string
  risk_level: string | null
  monthly_payment: number | null
  processed_at: string | null
  is_priority: boolean | null
}

type DashData = {
  cases: CaseRow[]
  stats: { total: number; approved: number; rejected: number; escalated: number }
  queue: { queued: number; processing: number; avgProcessingMs: number; longestWaitMs: number }
}

const statusPill: Record<string, string> = {
  approved: 'pill-green', rejected: 'pill-red', escalated: 'pill-gold', pending: 'pill-amber', processing: 'pill-blue',
}
const riskPill: Record<string, string> = {
  LOW: 'pill-green', MEDIUM: 'pill-amber', HIGH: 'pill-amber', CRITICAL: 'pill-red',
}

// Minimal donut chart from (label, value, color) slices.
function Donut({ slices, size = 190 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  const R = 70, C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg width={size} height={size} viewBox="0 0 190 190" role="img" aria-label="Cases by status">
      <g transform="rotate(-90 95 95)">
        {total === 0 ? (
          <circle cx="95" cy="95" r={R} fill="none" stroke="var(--line)" strokeWidth="26" />
        ) : (
          slices.filter(d => d.value > 0).map((d) => {
            const frac = d.value / total
            const el = (
              <circle key={d.label} cx="95" cy="95" r={R} fill="none" stroke={d.color} strokeWidth="26"
                strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-offset * C} />
            )
            offset += frac
            return el
          })
        )}
      </g>
      <text x="95" y="90" textAnchor="middle" style={{ fontSize: 30, fontWeight: 800, fill: 'var(--ink)' }}>{total}</text>
      <text x="95" y="112" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--muted)' }}>cases</text>
    </svg>
  )
}

// Minimal vertical bar chart.
function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, height: 200, padding: '0 8px' }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{d.value}</span>
          <div style={{ width: '100%', maxWidth: 72, height: `${Math.max(2, (d.value / max) * 100)}%`, background: 'var(--gold)', borderRadius: '6px 6px 0 0', opacity: d.value === 0 ? 0.25 : 1, transition: 'height .4s' }} />
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminOverviewPage() {
  const { t } = useA11y()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/dashboard', { credentials: 'include', cache: 'no-store' })
      if (res.ok) setData((await res.json()).data)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }

  function refresh() {
    setLoading(true)
    void load()
  }

  useEffect(() => { void (async () => { await load() })() }, [])

  const avgSec = data ? Math.round((data.queue.avgProcessingMs ?? 0) / 1000) : 0
  const donutSlices = [
    { label: t('Approved'), value: data?.stats.approved ?? 0, color: 'var(--green)' },
    { label: t('Rejected'), value: data?.stats.rejected ?? 0, color: 'var(--red)' },
    { label: t('Referred'), value: data?.stats.escalated ?? 0, color: 'var(--gold)' },
    { label: t('Queued'), value: data?.queue.queued ?? 0, color: 'var(--amber)' },
  ]
  const barData = [
    { label: t('Approved'), value: data?.stats.approved ?? 0 },
    { label: t('Rejected'), value: data?.stats.rejected ?? 0 },
    { label: t('Referred'), value: data?.stats.escalated ?? 0 },
    { label: t('Processing'), value: data?.queue.processing ?? 0 },
    { label: t('Queued'), value: data?.queue.queued ?? 0 },
  ]

  const recent = (data?.cases ?? []).slice(0, 6)
  const priority = (data?.cases ?? []).filter(c => c.is_priority || c.status === 'escalated').slice(0, 5)

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 26 }}>
        <div>
          <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SADDAD · {t('Administration')}</div>
          <h2 style={{ fontSize: 34 }}>{t('Operations Overview', 'نظرة عامة على العمليات')}</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>{t('Real-time SZHP rescheduling operations.')}</p>
        </div>
        <button className="btn btn-neutral" onClick={refresh} disabled={loading}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom: 22 }}>
        <div className="kpi">
          <div className="top"><span className="lbl">{t('Total Cases')}</span><Ico.doc2 width={18} height={18} style={{ color: 'var(--muted)' }} /></div>
          <div className="v">{loading ? '…' : (data?.stats.total ?? 0).toLocaleString()}</div>
          <div className="ar">{t('All time', 'منذ البداية')}</div>
        </div>
        <div className="kpi green">
          <div className="top"><span className="lbl">{t('Approved')}</span><Ico.checkC width={18} height={18} style={{ color: 'var(--green)' }} /></div>
          <div className="v">{loading ? '…' : (data?.stats.approved ?? 0).toLocaleString()}</div>
          <div className="ar">{t('AI auto-approved', 'موافقة آلية')}</div>
        </div>
        <div className="kpi amber">
          <div className="top"><span className="lbl">{t('Referred')}</span><Ico.users width={18} height={18} style={{ color: 'var(--amber)' }} /></div>
          <div className="v">{loading ? '…' : (data?.stats.escalated ?? 0).toLocaleString()}</div>
          <div className="ar">{t('Awaiting officer review', 'بانتظار مراجعة الموظف')}</div>
        </div>
        <div className="kpi">
          <div className="top"><span className="lbl">{t('Avg Time')}</span><Ico.clock width={18} height={18} style={{ color: 'var(--muted)' }} /></div>
          <div className="v">{loading ? '…' : `${avgSec}s`}</div>
          <div className="ar">{t('seconds per case', 'ثانية لكل حالة')}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, marginBottom: 22 }}>
        <div className="card card-pad">
          <h3 style={{ fontSize: 19, marginBottom: 14 }}>{t('Cases by status', 'الحالات حسب الوضع')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <Donut slices={donutSlices} />
            <div style={{ display: 'grid', gap: 8 }}>
              {donutSlices.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span className="muted">{d.label}:</span><span style={{ fontWeight: 800, color: 'var(--ink)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 19, marginBottom: 14 }}>{t('Cases by outcome', 'الحالات حسب النتيجة')}</h3>
          <Bars data={barData} />
        </div>
      </div>

      {/* Recent cases + Priority queue */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <div className="table-card">
          <div className="table-hd">
            <h3 style={{ fontSize: 19 }}>{t('Recent cases', 'أحدث الحالات')}</h3>
            <Link href="/admin/cases" style={{ fontWeight: 700, fontSize: 14 }}>{t('View all')} →</Link>
          </div>
          <table className="cases">
            <thead>
              <tr><th>{t('Case')}</th><th>{t('Beneficiary')}</th><th>{t('Risk')}</th><th>{t('Status')}</th><th /></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 36 }}>{t('Loading…', 'جارٍ التحميل…')}</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 36 }}>{t('No cases yet.')}</td></tr>
              ) : recent.map(c => (
                <tr key={c.case_number}>
                  <td className="mono" style={{ fontSize: 13 }}>{c.case_number}</td>
                  <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{c.full_name}</td>
                  <td>{c.risk_level ? <span className={'pill ' + (riskPill[c.risk_level] ?? 'pill-gray')}>{c.risk_level}</span> : '—'}</td>
                  <td><span className={'pill ' + (statusPill[c.status] ?? 'pill-gray')}>{c.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/admin/cases/${encodeURIComponent(c.case_number)}`} style={{ fontWeight: 700, fontSize: 14 }}>{t('Review')} →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 19, marginBottom: 14 }}>{t('Priority queue', 'قائمة الأولوية')}</h3>
          {loading ? (
            <p className="muted">{t('Loading…', 'جارٍ التحميل…')}</p>
          ) : priority.length === 0 ? (
            <p className="muted" style={{ fontSize: 14.5 }}>{t('No priority cases.')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {priority.map(c => (
                <Link key={c.case_number} href={`/admin/cases/${encodeURIComponent(c.case_number)}`}
                  className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', boxShadow: 'none' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: c.status === 'escalated' ? 'var(--red)' : 'var(--amber)' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: 'var(--ink)', fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</span>
                    <span className="mono muted" style={{ fontSize: 12 }}>{c.case_number}</span>
                  </span>
                  <span className={'pill ' + (c.status === 'escalated' ? 'pill-red' : 'pill-amber')}>{c.status === 'escalated' ? t('Urgent') : t('Pending')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {data && (
        <p className="muted" style={{ marginTop: 18, fontSize: 13.5 }}>
          {t('Approved')}: <b>{data.stats.approved}</b> · {t('Referred')}: <b>{data.stats.escalated}</b> · {t('Queue')}: <b>{data.queue.queued} {t('queued')}, {data.queue.processing} {t('processing')}</b>
          {data.queue.avgProcessingMs > 0 && <> · {t('Avg')}: <b>{(data.queue.avgProcessingMs / 1000).toFixed(1)}s/{t('case')}</b></>}
        </p>
      )}
    </div>
  )
}
