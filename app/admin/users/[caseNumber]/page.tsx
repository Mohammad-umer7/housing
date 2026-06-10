'use client'

// Admin Beneficiary Profile — full applicant record (identity, financials,
// loan, payment-history calendar) plus the AI decision, document verification,
// agent pipeline and audit trail. Ports the source admin user-detail page onto
// the MOEI design system.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type Applicant = {
  case_number: string; full_name: string; full_name_ar: string | null
  emirates_id: string | null; phone: string | null; monthly_salary: number
  monthly_expenses: number; arrears_amount: number; family_size: number
  marital_status: string | null; loan_bank_name: string | null
  loan_account_number: string | null; total_loan_amount: number
  remaining_loan_balance: number; current_installment: number
  remaining_loan_months: number; months_in_arrears: number
  auto_dda: boolean; reschedule_reason: string | null
  previous_default: boolean; has_active_application: boolean
  income_changed: boolean; status: string; created_at: string
  payment_history: { month: string; status: string; amount: number }[] | null
  remarks: string | null
}

type CaseRecord = {
  status: string; decision_reason: string | null; monthly_payment: number | null
  duration_months: number | null; risk_level: string | null; risk_score: number | null
  processed_at: string | null; priority_escalation: boolean | null
  verification_report: { verdict: string; summary?: string; confidenceScore?: number; riskFlags?: string[] } | null
}

type AgentStep = { agentName: string; status: string; durationMs: number | null; resultSummary: string }
type AuditEntry = { id: string; action: string; decision: string | null; rationale: string | null; processedBy: string | null; timestamp: string | null }
type PageData = { applicant: Applicant; case: CaseRecord | null; agentSteps: AgentStep[]; auditLogs: AuditEntry[] }

const aed = (n: number | null | undefined) => n == null ? '—' : `AED ${Number(n).toLocaleString()}`
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('en-AE') : '—')

const statusPill: Record<string, string> = {
  pending: 'pill-amber', approved: 'pill-green', rejected: 'pill-red', escalated: 'pill-gold', queued: 'pill-blue', processing: 'pill-blue',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, mono, color }: { label: string; value: string | number | null; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 14.5 }}>
      <span className="muted" style={{ flexShrink: 0 }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ textAlign: 'right', fontWeight: 700, fontSize: mono ? 13 : undefined, color: color ?? 'var(--ink)' }}>{value ?? '—'}</span>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { t } = useA11y()
  const { caseNumber } = useParams<{ caseNumber: string }>()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(caseNumber)}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Status ${res.status}`)
      setData(json.data)
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [caseNumber])

  function refresh() {
    setLoading(true)
    setError(null)
    void load()
  }

  useEffect(() => { void (async () => { await load() })() }, [load])

  const a = data?.applicant
  const c = data?.case
  const displayStatus = c?.status ?? a?.status ?? 'unknown'
  const paidCount = a?.payment_history?.filter(p => p.status === 'paid').length ?? 0
  const missedCount = a?.payment_history?.filter(p => p.status === 'missed').length ?? 0

  return (
    <div className="fade-in">
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span>
        <Link href="/admin/users">{t('Users')}</Link><span className="sep">›</span>
        <span className="cur mono">{caseNumber}</span>
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">{t('Loading profile…', 'جارٍ تحميل الملف…')}</div>
      ) : error ? (
        <div className="notice" style={{ borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{error}</p></div>
          <button className="btn btn-neutral" onClick={refresh}><Ico.refresh width={15} height={15} /> {t('Retry')}</button>
        </div>
      ) : a && (
        <>
          {/* Hero banner */}
          <div className="card card-pad" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', background: 'var(--gold-tint)', border: '1px solid var(--gold-line)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Ico.user width={26} height={26} style={{ color: 'var(--gold-dark)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 26 }}>{a.full_name}</h2>
                {a.full_name_ar && <div className="ar muted" style={{ fontSize: 14 }}>{a.full_name_ar}</div>}
                <div className="mono" style={{ fontSize: 12.5, color: 'var(--gold-dark)', marginTop: 4 }}>{a.case_number}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={'pill ' + (statusPill[displayStatus] ?? 'pill-gray')}>{displayStatus.toUpperCase()}</span>
              {c?.priority_escalation && <span className="priority-tag">★ {t('Priority')}</span>}
              {c && (
                <Link className="btn btn-neutral" style={{ padding: '10px 16px', fontSize: 14 }} href={`/admin/cases/${encodeURIComponent(a.case_number)}`}>
                  {t('Full Case View', 'عرض الحالة الكاملة')} <Ico.chevR width={14} height={14} />
                </Link>
              )}
            </div>
          </div>

          <div className="resp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Section title={t('Identity & Contact', 'الهوية والتواصل')}>
              <Row label={t('Emirates ID')} value={a.emirates_id} mono />
              <Row label={t('Phone')} value={a.phone} mono />
              <Row label={t('Marital Status')} value={a.marital_status} />
              <Row label={t('Family Size')} value={a.family_size} />
              <Row label={t('Record Created')} value={fmtDate(a.created_at)} />
            </Section>

            <Section title={t('Financial Summary', 'الملخص المالي')}>
              <Row label={t('Monthly Salary')} value={aed(a.monthly_salary)} color="var(--green)" />
              <Row label={t('Monthly Expenses')} value={aed(a.monthly_expenses)} />
              <Row label={t('Arrears Amount')} value={aed(a.arrears_amount)} color="var(--red)" />
              <Row label={t('Months in Arrears')} value={a.months_in_arrears} />
              <Row label={t('Previous Default')} value={a.previous_default ? t('Yes') : t('No')} color={a.previous_default ? 'var(--red)' : 'var(--green)'} />
              <Row label={t('Income Changed')} value={a.income_changed ? t('Yes') : t('No')} />
            </Section>

            <Section title={t('Loan Details', 'تفاصيل القرض')}>
              <Row label={t('Bank')} value={a.loan_bank_name} />
              <Row label={t('Account')} value={a.loan_account_number} mono />
              <Row label={t('Total Loan')} value={aed(a.total_loan_amount)} />
              <Row label={t('Remaining Balance')} value={aed(a.remaining_loan_balance)} />
              <Row label={t('Current Installment')} value={`${aed(a.current_installment)}/mo`} />
              <Row label={t('Remaining Period')} value={`${a.remaining_loan_months ?? '—'} ${t('months')}`} />
              <Row label={t('Auto DDA')} value={a.auto_dda ? `✓ ${t('Enrolled')}` : `✗ ${t('Manual')}`} color={a.auto_dda ? 'var(--green)' : 'var(--muted)'} />
            </Section>

            <Section title={`${t('Payment History')} · ${paidCount} ${t('paid')} · ${missedCount} ${t('missed')}`}>
              {a.payment_history && a.payment_history.length > 0 ? (
                <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  {a.payment_history.map((p, i) => (
                    <div key={i} style={{
                      borderRadius: 'var(--r-sm)', padding: '8px 4px', textAlign: 'center',
                      border: `1px solid ${p.status === 'paid' ? 'rgba(30,142,62,.3)' : 'rgba(200,16,46,.25)'}`,
                      background: p.status === 'paid' ? 'var(--green-soft)' : 'var(--red-soft)',
                    }}>
                      <div className="muted" style={{ fontSize: 10.5 }}>{p.month}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: p.status === 'paid' ? 'var(--green)' : 'var(--red)' }}>{p.status === 'paid' ? '✓' : '✗'}</div>
                      <div className="muted" style={{ fontSize: 10 }}>{p.status}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted" style={{ fontSize: 14 }}>{t('No payment history available')}</p>}
            </Section>

            {c && (
              <Section title={t('AI Decision', 'قرار الذكاء الاصطناعي')}>
                <Row label={t('Status')} value={c.status} />
                <Row label={t('Risk Level')} value={c.risk_level ?? '—'} />
                <Row label={t('Proposed Payment')} value={c.monthly_payment ? `${aed(c.monthly_payment)}/mo` : '—'} color="var(--gold-dark)" />
                <Row label={t('Duration')} value={c.duration_months ? `${c.duration_months} ${t('months')}` : '—'} />
                <Row label={t('Processed')} value={fmtDate(c.processed_at)} />
                {c.decision_reason && (
                  <p className="muted" style={{ marginTop: 12, padding: 12, borderRadius: 'var(--r)', background: 'var(--panel-alt)', border: '1px solid var(--line)', fontSize: 13, lineHeight: 1.6 }}>
                    {c.decision_reason.slice(0, 400)}{c.decision_reason.length > 400 ? '…' : ''}
                  </p>
                )}
              </Section>
            )}

            {c?.verification_report && (
              <Section title={t('Document Verification', 'التحقق من المستندات')}>
                <Row label={t('Verdict')} value={c.verification_report.verdict?.toUpperCase()}
                  color={c.verification_report.verdict === 'verified' ? 'var(--green)' : 'var(--red)'} />
                {c.verification_report.confidenceScore != null && (
                  <Row label={t('Confidence')} value={`${c.verification_report.confidenceScore}%`} />
                )}
                {(c.verification_report.riskFlags?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                    {c.verification_report.riskFlags!.map((f, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--amber)', display: 'flex', gap: 6 }}>
                        <Ico.warn width={13} height={13} style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                      </div>
                    ))}
                  </div>
                )}
                {c.verification_report.summary && <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{c.verification_report.summary}</p>}
              </Section>
            )}
          </div>

          {/* Agent pipeline */}
          {data!.agentSteps.length > 0 && (
            <div className="card card-pad" style={{ marginTop: 18 }}>
              <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 14 }}>{t('AI Agent Pipeline', 'خط معالجة الوكلاء')}</div>
              <div style={{ display: 'grid', gap: 7 }}>
                {data!.agentSteps.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 13px', borderRadius: 'var(--r-sm)', fontSize: 13,
                    border: `1px solid ${s.status === 'done' ? 'rgba(30,142,62,.25)' : s.status === 'failed' ? 'rgba(200,16,46,.25)' : 'var(--line)'}`,
                    background: s.status === 'done' ? 'var(--green-soft)' : s.status === 'failed' ? 'var(--red-soft)' : 'var(--panel-alt)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', flexShrink: 0, textTransform: 'capitalize' }}>{s.agentName.replace(/_/g, ' ')}</span>
                      <span className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.resultSummary}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {s.durationMs != null && <span className="muted">{s.durationMs}ms</span>}
                      <span style={{ fontWeight: 800, fontSize: 11.5, textTransform: 'uppercase', color: s.status === 'done' ? 'var(--green)' : s.status === 'failed' ? 'var(--red)' : 'var(--muted)' }}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit trail */}
          {data!.auditLogs.length > 0 && (
            <div className="card card-pad" style={{ marginTop: 18 }}>
              <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 14 }}>{t('Audit Trail', 'سجل التدقيق')}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {data!.auditLogs.map((l, i) => (
                  <div key={l.id ?? i} style={{ display: 'flex', gap: 14, fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                    <span className="mono muted" style={{ flexShrink: 0, fontSize: 12 }}>{fmtDate(l.timestamp)}</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{l.action}</span>
                      {l.decision && <span className={'pill ' + (statusPill[l.decision] ?? 'pill-gray')} style={{ marginInlineStart: 8 }}>{l.decision}</span>}
                      {l.processedBy && <span className="muted"> · {t('by')} {l.processedBy}</span>}
                      {l.rationale && <p className="muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{l.rationale.slice(0, 200)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
