'use client'

import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { useTTS } from '@/lib/tts'
import { Ico, BrandMark } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

function SpeakerButton({ text, lang }: { text: string; lang: 'en' | 'ar' }) {
  const { speak, activeText, enabled } = useTTS()
  if (!enabled) return null
  return (
    <Ico.speaker
      width={16}
      height={16}
      style={{ cursor: 'pointer', color: activeText === text ? 'var(--red)' : 'var(--faint)' }}
      onClick={() => speak(text, lang, true)}
      aria-label={lang === 'ar' ? 'استمع' : 'Read aloud'}
    />
  )
}

type EscalatedCase = {
  id: string
  case_number: string
  full_name: string
  arrears_amount: number
  monthly_salary: number
  status: string
  decision_reason: string
  rationale_ar: string
  risk_level: string
  risk_score: number
  monthly_payment: number | null
  duration_months: number | null
  consistency_score: number | null
  fairness_note: string
  processed_at: string
  rule_triggered: string
  total_new_monthly_payment: number | null
  current_installment: number | null
  remaining_loan_months: number | null
  loan_bank_name: string
  social_status: string | null
  is_priority: boolean | null
  priority_escalation: boolean | null
}

type ActionState = { caseNumber: string; action: 'APPROVE' | 'REJECT'; notes: string } | null

const riskPill: Record<string, string> = {
  LOW: 'pill-green', MEDIUM: 'pill-amber', HIGH: 'pill-amber', CRITICAL: 'pill-red',
}

const SOCIAL_LABELS: Record<string, string> = {
  widow: 'Widow / أرملة',
  orphan: 'Orphan / يتيم',
  senior: 'Senior / Retiree · كبار المواطنين',
  determination: 'Person of Determination / أصحاب الهمم',
}

export default function OfficerPage() {
  const { t } = useA11y()
  const [cases, setCases] = useState<EscalatedCase[]>([])
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<ActionState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function loadCases() {
    try {
      const res = await fetch('/api/officer/cases')
      const envelope = await res.json()
      setCases(envelope.data?.cases ?? [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void (async () => { await loadCases() })() }, [])

  async function submitAction() {
    if (!actionState) return
    setSubmitting(true)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/officer/cases/${encodeURIComponent(actionState.caseNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionState.action, officerNotes: actionState.notes }),
      })
      const envelope = await res.json()
      if (!res.ok || !envelope.success) throw new Error(envelope.error || 'Action failed')
      setSuccessMsg(`Case ${actionState.caseNumber} ${actionState.action.toLowerCase()}d successfully.`)
      setActionState(null)
      setLoading(true)
      await loadCases()
    } catch (err) {
      setSuccessMsg(`Error: ${String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const priorityCount = cases.filter(c => c.priority_escalation).length
  const orderedCases = [...cases].sort((a, b) => (b.priority_escalation ? 1 : 0) - (a.priority_escalation ? 1 : 0))

  return (
    <div className="page" style={{ background: 'var(--panel-alt)' }}>
      {/* Officer header */}
      <div className="officer-top">
        <div className="gov-rule" />
        <div className="officer-top-inner">
          <div className="officer-brand"><BrandMark height={30} /> {t('Officer Portal')}</div>
          <div className="internal-tag">{t('Internal Use Only')} <span className="ar">— وزارة الطاقة والبنية التحتية</span></div>
          <div className="officer-links">
            {/* The operations dashboard moved to the Admin portal (/admin). */}
            <span className="active">{t('Escalated Cases', 'الحالات المصعدة')}</span>
            <Link href="/officer/feedback">{t('Citizen Feedback', 'ملاحظات المواطنين')}</Link>
            <Link href="/settings">{t('Settings')}</Link>
            <Link href="/">← {t('Back to SADDAD', 'العودة إلى سدّد')}</Link>
          </div>
        </div>
      </div>

      <div className="officer-body">
        <div className="officer-wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 26 }}>
            <div>
              <h2 style={{ fontSize: 34 }}>{t('Escalated Cases')}</h2>
              <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>{t('Cases referred for officer review — requires manual decision.')}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="muted">{cases.length} {t('pending')}{priorityCount > 0 ? ` · ${priorityCount} ${t('priority')}` : ''}</span>
              <button className="btn btn-neutral" onClick={() => { setLoading(true); loadCases() }}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
            </div>
          </div>

          {successMsg && (
            <div className="notice" style={{ marginBottom: 18, borderColor: successMsg.startsWith('Error') ? 'rgba(200,16,46,.2)' : 'rgba(30,142,62,.25)', background: successMsg.startsWith('Error') ? 'var(--red-soft)' : 'var(--green-soft)' }} aria-live="polite">
              <div><p style={{ fontWeight: 600 }}>{successMsg}</p></div>
            </div>
          )}

          {loading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">Loading escalated cases…</div>
          ) : cases.length === 0 ? (
            <div className="card card-pad" style={{ textAlign: 'center', padding: 64 }}>
              <div className="submitted-circle" style={{ margin: '0 auto 16px' }}><Ico.check /></div>
              <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{t('No escalated cases')}</p>
              <p className="muted" style={{ marginTop: 4 }}>All cases have been processed automatically or reviewed.</p>
            </div>
          ) : (
            orderedCases.map((c, i) => {
              const prev = orderedCases[i - 1]
              const showPriorityHeader = Boolean(c.priority_escalation) && i === 0
              const showStandardHeader = !c.priority_escalation && (i === 0 || Boolean(prev?.priority_escalation))
              return (
                <Fragment key={c.id}>
                  {showPriorityHeader && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                      <span style={{ color: 'var(--amber)', fontWeight: 800, fontSize: 17 }}>{t('★ Priority — Fast-Track')}</span>
                      <span className="pill pill-amber">{priorityCount}</span>
                      <span className="muted" style={{ fontSize: 14 }}>{t('Priority beneficiaries escalated for a genuine reason — handle first.')}</span>
                    </div>
                  )}
                  {showStandardHeader && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                      <span style={{ color: 'var(--ink-navy)', fontWeight: 800, fontSize: 17 }}>{t('Standard Escalations')}</span>
                      <span className="pill pill-gray">{cases.length - priorityCount}</span>
                    </div>
                  )}
                  <div className="esc-card">
                    <div className="esc-top">
                      <div>
                        <div className="esc-id-row">
                          <Ico.users width={18} height={18} style={{ color: 'var(--amber)' }} />
                          <span className="esc-id">{c.case_number}</span>
                          <span className={'pill ' + (riskPill[c.risk_level] ?? 'pill-amber')}>{c.risk_level || 'UNKNOWN'} RISK</span>
                          {c.priority_escalation && (
                            <span className="priority-tag">★ {SOCIAL_LABELS[c.social_status ?? ''] ?? 'Priority'}</span>
                          )}
                        </div>
                        <div className="esc-name">{c.full_name}</div>
                        <div className="esc-proc">Processed {c.processed_at ? new Date(c.processed_at).toLocaleDateString('en-AE') : '—'}</div>
                      </div>
                      <div className="esc-fin">
                        <div className="l">Arrears</div>
                        <div className="v">AED {Number(c.arrears_amount).toLocaleString()}</div>
                        <div className="l" style={{ marginTop: 10 }}>Salary</div>
                        <div className="v sm">AED {Number(c.monthly_salary).toLocaleString()}/mo</div>
                      </div>
                    </div>

                    <div className="analysis-grid">
                      <div className="analysis-col en">
                        <div className="lbl"><span>{t('AI Analysis (English)')}</span>{c.decision_reason && <span className="spk"><SpeakerButton text={c.decision_reason} lang="en" /></span>}</div>
                        <p>{c.decision_reason || '—'}</p>
                      </div>
                      <div className="analysis-col ar">
                        <div className="lbl" style={{ direction: 'rtl' }}><span>التحليل بالعربية</span>{c.rationale_ar && <span className="spk"><SpeakerButton text={c.rationale_ar} lang="ar" /></span>}</div>
                        <p>{c.rationale_ar || '—'}</p>
                      </div>
                    </div>

                    {c.monthly_payment && (
                      <div style={{ padding: '14px 28px', background: 'var(--blue-soft)', borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 28, fontSize: 14 }}>
                        <div><span className="muted" style={{ fontSize: 12 }}>Proposed payment</span><div style={{ fontWeight: 800 }}>AED {Number(c.monthly_payment).toLocaleString()}/mo</div></div>
                        {c.duration_months && <div><span className="muted" style={{ fontSize: 12 }}>Duration</span><div style={{ fontWeight: 800 }}>{c.duration_months} months</div></div>}
                        {c.total_new_monthly_payment && <div><span className="muted" style={{ fontSize: 12 }}>Total new monthly</span><div style={{ fontWeight: 800, color: 'var(--blue)' }}>AED {Number(c.total_new_monthly_payment).toLocaleString()}/mo</div></div>}
                        {c.consistency_score !== null && <div><span className="muted" style={{ fontSize: 12 }}>Consistency</span><div style={{ fontWeight: 800, color: (c.consistency_score ?? 0) >= 70 ? 'var(--green)' : 'var(--amber)' }}>{c.consistency_score}%</div></div>}
                      </div>
                    )}

                    <div className="esc-actions">
                      {actionState?.caseNumber === c.case_number ? (
                        <div style={{ width: '100%' }}>
                          <label className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Officer Notes for {actionState.action}</label>
                          <textarea className="input" rows={3} placeholder="Add notes for the audit log…" style={{ resize: 'vertical', fontFamily: 'inherit' }}
                            value={actionState.notes} onChange={e => setActionState(prev => prev ? { ...prev, notes: e.target.value } : null)} />
                          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                            <button className={'btn ' + (actionState.action === 'APPROVE' ? 'btn-green' : 'btn-red')} onClick={submitAction} disabled={submitting}>
                              {submitting ? 'Submitting…' : `Confirm ${actionState.action}`}
                            </button>
                            <button className="btn btn-neutral" onClick={() => setActionState(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-green" onClick={() => setActionState({ caseNumber: c.case_number, action: 'APPROVE', notes: '' })}><Ico.checkC width={17} height={17} /> {t('Approve')}</button>
                          <button className="btn btn-red" onClick={() => setActionState({ caseNumber: c.case_number, action: 'REJECT', notes: '' })}><Ico.xC width={17} height={17} /> {t('Reject')}</button>
                          <span className="fine"><Ico.warn width={15} height={15} /> Decision will notify the applicant via WhatsApp and create an audit log entry.</span>
                        </>
                      )}
                    </div>
                  </div>
                </Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
