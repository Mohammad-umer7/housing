'use client'

// Admin Beneficiary Registry — paginated, searchable table of all applicants
// joined with their SADDAD case status. Ports the source admin users page onto
// the MOEI design system.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type CaseRecord = {
  status: string
  decision: string | null
  processed_at: string | null
  priority_escalation: boolean | null
}

type UserRow = {
  id: string
  case_number: string
  full_name: string
  full_name_ar: string | null
  emirates_id: string | null
  phone: string | null
  monthly_salary: number
  arrears_amount: number
  family_size: number
  marital_status: string | null
  status: string
  previous_default: boolean
  has_active_application: boolean
  loan_bank_name: string | null
  total_loan_amount: number
  remaining_loan_balance: number
  months_in_arrears: number
  created_at: string
  case: CaseRecord | null
}

type ApiResponse = { users: UserRow[]; total: number; page: number; limit: number }

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'escalated', label: 'Escalated' },
]

const statusPill: Record<string, string> = {
  pending: 'pill-amber', approved: 'pill-green', rejected: 'pill-red', escalated: 'pill-gold',
}
const decisionPill: Record<string, string> = {
  APPROVE: 'pill-green', REJECT: 'pill-red', ESCALATE: 'pill-gold', DEFER: 'pill-blue',
}

const PAGE_SIZE = 100
const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

export default function AdminUsersPage() {
  const { t } = useA11y()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // 300ms debounce on the search box so we don't query per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const load = useCallback(async (p: number, s: string, st: string) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (s) params.set('search', s)
      if (st) params.set('status', st)
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      setData(json.data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  function refresh() {
    setLoading(true)
    setError(null)
    void load(page, debouncedSearch, statusFilter)
  }

  useEffect(() => { void (async () => { await load(page, debouncedSearch, statusFilter) })() }, [page, debouncedSearch, statusFilter, load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 0

  return (
    <div className="fade-in">
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span><span className="cur">{t('Users')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <div>
          <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SADDAD · {t('Beneficiary Registry', 'سجل المستفيدين')}</div>
          <h2 style={{ fontSize: 34 }}>{t('All Users', 'جميع المستخدمين')}</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>
            {data ? `${data.total.toLocaleString()} ${t('registered beneficiaries', 'مستفيدًا مسجلًا')}` : t('Loading…', 'جارٍ التحميل…')}
          </p>
        </div>
        <button className="btn btn-neutral" onClick={refresh} disabled={loading}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
      </div>

      {/* Stat chips */}
      {data && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          {[
            { label: t('Total Beneficiaries'), value: data.total },
            { label: t('Showing This Page'), value: data.users.length },
            { label: t('With Active Case'), value: data.users.filter(u => u.has_active_application).length },
            { label: t('Priority Escalated'), value: data.users.filter(u => u.case?.priority_escalation).length },
          ].map(s => (
            <div key={s.label} className="kpi" style={{ padding: 18 }}>
              <div className="v" style={{ fontSize: 30, marginTop: 0, color: 'var(--gold-dark)' }}>{s.value.toLocaleString()}</div>
              <div className="lbl" style={{ marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Ico.search width={17} height={17} style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input className="input" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder={t('Search by name, case number, Emirates ID…', 'ابحث بالاسم أو رقم الحالة أو الهوية…')} style={{ paddingInlineStart: 42 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line-strong)', borderRadius: 'var(--r)', padding: 4, background: 'var(--panel)' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(0) }}
              style={{
                padding: '8px 14px', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
                background: statusFilter === f.key ? 'var(--gold)' : 'transparent', color: statusFilter === f.key ? '#fff' : 'var(--muted)',
              }}>
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="notice" style={{ marginBottom: 18, borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{error}</p></div>
          <button className="btn btn-neutral" onClick={refresh}><Ico.refresh width={15} height={15} /> {t('Retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">{t('Loading users…', 'جارٍ تحميل المستخدمين…')}</div>
      ) : !data || data.users.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 64 }}>
          <Ico.users width={36} height={36} style={{ color: 'var(--faint)', marginBottom: 10 }} />
          <p className="muted">{t('No users found')}{search || statusFilter ? ` ${t('matching this filter')}.` : '.'}</p>
        </div>
      ) : (
        <div className="table-card">
          <table className="cases">
            <thead>
              <tr>
                <th>{t('Beneficiary')}</th><th>{t('Case #')}</th>
                <th style={{ textAlign: 'right' }}>{t('Monthly Salary')}</th><th style={{ textAlign: 'right' }}>{t('Arrears')}</th>
                <th style={{ textAlign: 'center' }}>{t('Family')}</th><th>{t('Bank')}</th>
                <th style={{ textAlign: 'center' }}>{t('Status')}</th><th style={{ textAlign: 'center' }}>{t('Decision')}</th><th />
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{u.full_name}</div>
                    {u.full_name_ar && <div className="ar muted" style={{ fontSize: 12.5 }}>{u.full_name_ar}</div>}
                    {u.emirates_id && <div className="mono muted" style={{ fontSize: 11.5 }}>{u.emirates_id}</div>}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>{u.case_number}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 13.5 }}>{aed(u.monthly_salary)}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 13.5, color: 'var(--red)', fontWeight: 700 }}>{aed(u.arrears_amount)}</td>
                  <td style={{ textAlign: 'center', fontSize: 13.5 }}>{u.family_size}{u.marital_status ? <span className="muted"> ({u.marital_status})</span> : null}</td>
                  <td className="muted" style={{ fontSize: 13.5 }}>{u.loan_bank_name ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => { const st = u.case?.status ?? u.status; return <span className={'pill ' + (statusPill[st] ?? 'pill-gray')}>{st}</span> })()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {u.case?.decision ? <span className={'pill ' + (decisionPill[u.case.decision] ?? 'pill-gray')}>{u.case.decision}</span> : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Link href={`/admin/users/${encodeURIComponent(u.case_number)}`} title={t('View details')} style={{ fontWeight: 700 }}>
                      <Ico.chevR width={16} height={16} style={{ verticalAlign: -3 }} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderTop: '1px solid var(--line)', fontSize: 13.5 }} className="muted">
            <span>{t('Showing')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} {t('of')} {data.total.toLocaleString()}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-neutral" style={{ padding: '8px 14px', fontSize: 13.5 }} onClick={() => setPage(p => p - 1)} disabled={page === 0}>← {t('Prev')}</button>
              <span>{t('Page')} {page + 1} / {totalPages}</span>
              <button className="btn btn-neutral" style={{ padding: '8px 14px', fontSize: 13.5 }} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>{t('Next')} →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
