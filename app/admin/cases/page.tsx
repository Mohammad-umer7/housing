'use client'

// Admin Case Management — all cases with status tabs, keyword search and a
// sortable table. Ports the source admin cases page onto the MOEI design system.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type Case = {
  id: string
  case_number: string
  full_name: string
  status: string
  arrears_amount: number
  monthly_salary: number
  monthly_payment: number | null
  duration_months: number | null
  risk_level: string | null
  risk_score: number | null
  consistency_score: number | null
  is_priority: boolean | null
  processed_at: string | null
  social_status: string | null
  decision_reason: string | null
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

const statusPill: Record<string, string> = {
  approved: 'pill-green', rejected: 'pill-red', escalated: 'pill-gold', pending: 'pill-amber', processing: 'pill-blue',
}
const riskPill: Record<string, string> = {
  low: 'pill-green', medium: 'pill-amber', high: 'pill-red', critical: 'pill-red',
}

export default function AdminCasesPage() {
  const { t } = useA11y()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')

  async function load() {
    try {
      const res = await fetch('/api/officer/cases', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      setCases(json.data?.cases ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }

  function refresh() {
    setLoading(true)
    setError(null)
    void load()
  }

  useEffect(() => { void (async () => { await load() })() }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: cases.length }
    for (const { key } of STATUS_TABS) {
      if (key !== 'all') c[key] = cases.filter(x => x.status === key).length
    }
    return c
  }, [cases])

  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? cases : cases.filter(c => c.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.case_number?.toLowerCase().includes(q) ||
        c.full_name?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      // Priority cases float to the top
      const priorityDiff = (b.is_priority ? 1 : 0) - (a.is_priority ? 1 : 0)
      if (priorityDiff !== 0) return priorityDiff
      // Within same priority tier: latest submission first
      const aTime = a.processed_at ? new Date(a.processed_at).getTime() : 0
      const bTime = b.processed_at ? new Date(b.processed_at).getTime() : 0
      return bTime - aTime
    })
  }, [cases, activeTab, search])

  return (
    <div className="fade-in">
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span><span className="cur">{t('Cases')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <div>
          <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SADDAD · {t('Case Management')}</div>
          <h2 style={{ fontSize: 34 }}>{t('All Cases', 'جميع الحالات')}</h2>
        </div>
        <button className="btn btn-neutral" onClick={refresh} disabled={loading}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line-strong)', marginBottom: 18, overflowX: 'auto' }}>
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '11px 18px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '3px solid var(--gold)' : '3px solid transparent',
              color: activeTab === tab.key ? 'var(--ink)' : 'var(--muted)', marginBottom: -1,
            }}>
            {t(tab.label)} <span className="pill pill-gray" style={{ marginInlineStart: 6, padding: '3px 9px' }}>{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <Ico.search width={17} height={17} style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
        <input className="input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('Search by name, case number…', 'ابحث بالاسم أو رقم الحالة…')} style={{ paddingInlineStart: 42 }} />
      </div>

      {error && (
        <div className="notice" style={{ marginBottom: 18, borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{error}</p></div>
          <button className="btn btn-neutral" onClick={refresh}><Ico.refresh width={15} height={15} /> {t('Retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">{t('Loading cases…', 'جارٍ تحميل الحالات…')}</div>
      ) : filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 64 }}>
          <p className="muted">{t('No cases match the current filter.')}</p>
        </div>
      ) : (
        <div className="table-card">
          <table className="cases">
            <thead>
              <tr>
                <th>{t('Case #')}</th><th>{t('Applicant')}</th><th style={{ textAlign: 'right' }}>{t('Arrears')}</th>
                <th style={{ textAlign: 'right' }}>{t('Plan/mo')}</th><th style={{ textAlign: 'center' }}>{t('Risk')}</th>
                <th style={{ textAlign: 'center' }}>{t('Fairness')}</th><th style={{ textAlign: 'center' }}>{t('Status')}</th>
                <th style={{ textAlign: 'right' }}>{t('Date')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id ?? c.case_number}>
                  <td><Link href={`/admin/cases/${encodeURIComponent(c.case_number)}`} className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{c.case_number}</Link></td>
                  <td>
                    <Link href={`/admin/cases/${encodeURIComponent(c.case_number)}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {c.is_priority && <span style={{ color: 'var(--gold-bright)' }}>★ </span>}{c.full_name}
                    </Link>
                    {c.social_status && c.social_status !== 'none' && <div className="muted" style={{ fontSize: 12.5 }}>{c.social_status}</div>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 13.5 }}>AED {Number(c.arrears_amount || 0).toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 13.5, color: 'var(--gold-dark)', fontWeight: 700 }}>{c.monthly_payment ? `AED ${Number(c.monthly_payment).toLocaleString()}` : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{c.risk_level ? <span className={'pill ' + (riskPill[c.risk_level.toLowerCase()] ?? 'pill-gray')}>{c.risk_level}</span> : '—'}</td>
                  <td className="mono" style={{ textAlign: 'center', fontSize: 13.5 }}>{c.consistency_score != null ? `${c.consistency_score}%` : '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={'pill ' + (statusPill[c.status] ?? 'pill-gray')}>{c.status}</span></td>
                  <td className="muted" style={{ textAlign: 'right', fontSize: 13.5 }}>{c.processed_at ? new Date(c.processed_at).toLocaleDateString('en-AE') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ padding: '14px 26px', borderTop: '1px solid var(--line)', textAlign: 'right', fontSize: 13.5 }}>
            {t('Showing')} {filtered.length} {t('of')} {cases.length} {t('cases')}
          </div>
        </div>
      )}
    </div>
  )
}
