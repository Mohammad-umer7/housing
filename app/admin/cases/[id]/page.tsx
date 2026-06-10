'use client'

// Admin Case Review — full case detail with the AI analysis, document
// verification report, agent pipeline trace, manual adjudication form and the
// audit trail. Decisions update the case, create an audit record and notify
// the citizen via WhatsApp (same /api/officer/cases/[caseNumber] backend the
// officer queue uses).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type AgentStep = { agentName: string; status: string; durationMs: number | null; resultSummary: string }
type AuditEntry = { id: string; action: string; decision: string | null; rationale: string | null; processedBy: string | null; timestamp: string | null }
type AdminOverride = { by: string; at: string; note: string; from: string; to: string }
type DocEntry = { index: number; role: 'primary' | 'supporting' | 'additional'; filename: string; mimeType: string; description: string; size: number }
type DocManifest = { requestDescription: string | null; documents: DocEntry[] }

type CaseDetail = {
  case_number: string
  full_name: string
  emirates_id: string | null
  arrears_amount: number
  monthly_salary: number
  status: string
  decision_reason: string | null
  rationale_ar: string | null
  risk_level: string | null
  risk_score: number | null
  monthly_payment: number | null
  duration_months: number | null
  consistency_score: number | null
  fairness_note: string | null
  processed_at: string | null
  is_priority: boolean | null
  social_status: string | null
  recovery_guidance: string | null
  current_installment: number | null
  total_new_monthly_payment: number | null
  remaining_loan_months: number | null
  loan_bank_name: string | null
  account_number?: string | null
  iban?: string | null
  case_study?: { recommendation?: string; adminOverride?: AdminOverride | null } | null
  verification_report?: {
    verdict: string
    confidenceScore: number
    recommendedAction?: string
    riskFlags?: string[]
    summary?: string
  } | null
  agentSteps: AgentStep[]
  auditLogs: AuditEntry[]
}

const OVERRIDES = [
  ['APPROVE', 'Approve'],
  ['REJECT', 'Reject'],
  ['RETURN_TO_OFFICER', 'Return to Officer (reconsider)'],
] as const

const statusPill: Record<string, string> = {
  approved: 'pill-green', rejected: 'pill-red', escalated: 'pill-gold', pending: 'pill-amber', processing: 'pill-blue',
}
const verdictColor: Record<string, string> = {
  verified: 'var(--green)', unverifiable: 'var(--muted)', mismatch: 'var(--red)',
  suspicious: 'var(--amber)', tampered: 'var(--amber)', invalid: 'var(--red)',
}

function aed(n: number | null | undefined) {
  return n == null ? '—' : `AED ${Number(n).toLocaleString()}`
}
function maskEid(eid: string) {
  return eid.length > 7 ? `${eid.slice(0, 4)}-XXXX-XXXXXXX-${eid.slice(-1)}` : eid
}

function Row({ k, v, highlight, warn }: { k: string; v: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 14.5 }}>
      <span className="muted">{k}</span>
      <span style={{ textAlign: 'right', fontWeight: 700, color: warn ? 'var(--amber)' : highlight ? 'var(--gold-dark)' : 'var(--ink)' }}>{v}</span>
    </div>
  )
}

export default function AdminCaseDetailPage() {
  const { t } = useA11y()
  const { id } = useParams<{ id: string }>()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [override, setOverride] = useState<'APPROVE' | 'REJECT' | 'RETURN_TO_OFFICER'>('APPROVE')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [docsManifest, setDocsManifest] = useState<DocManifest | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/officer/cases/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      setCaseData(json.data ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load case')
    } finally {
      setLoading(false)
    }
  }, [id])

  function refresh() {
    setLoading(true)
    setError(null)
    void load()
  }

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  useEffect(() => {
    if (!id) return
    fetch(`/api/officer/cases/${encodeURIComponent(id)}/document?list=1`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.success) setDocsManifest(j.data) })
      .catch(() => null)
  }, [id])

  async function submitOverride() {
    if (!caseData) return
    if (!notes.trim()) { setActionMsg('Error: a note explaining the override is required.'); return }
    setSubmitting(true)
    setActionMsg(null)
    try {
      const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: override, note: notes }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `Status ${res.status}`)
      }
      const done: Record<string, string> = { APPROVE: 'approved', REJECT: 'rejected', RETURN_TO_OFFICER: 'returned to the officer' }
      setActionMsg(`Decision overridden — case ${done[override]}. Audit log created. Citizen notified via WhatsApp.`)
      setNotes('')
      await load()
    } catch (e) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'Failed to submit override'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span>
        <Link href="/admin/cases">{t('Cases')}</Link><span className="sep">›</span>
        <span className="cur mono">{id}</span>
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">{t('Loading case…', 'جارٍ تحميل الحالة…')}</div>
      ) : error ? (
        <div className="notice" style={{ borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{error}</p></div>
          <button className="btn btn-neutral" onClick={refresh}><Ico.refresh width={15} height={15} /> {t('Retry')}</button>
        </div>
      ) : !caseData ? (
        <p className="muted">{t('Case not found.')}</p>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{t('Case')} · <span className="mono">{caseData.case_number}</span></div>
              <h2 style={{ fontSize: 32 }}>
                {caseData.full_name}
                {caseData.is_priority && <span style={{ color: 'var(--gold-bright)', marginInlineStart: 10, fontSize: 24 }}>★</span>}
              </h2>
              {caseData.social_status && caseData.social_status !== 'none' && <p className="muted" style={{ marginTop: 4 }}>{caseData.social_status}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={'pill ' + (statusPill[caseData.status] ?? 'pill-gray')}>{caseData.status}</span>
              <button className="btn btn-neutral" onClick={refresh}><Ico.refresh width={15} height={15} /> {t('Refresh')}</button>
            </div>
          </div>

          {actionMsg && (
            <div className="notice" style={{ marginBottom: 18, borderColor: actionMsg.startsWith('Error') ? 'rgba(200,16,46,.2)' : 'rgba(30,142,62,.25)', background: actionMsg.startsWith('Error') ? 'var(--red-soft)' : 'var(--green-soft)' }} aria-live="polite">
              <div><p style={{ fontWeight: 600 }}>{actionMsg}</p></div>
            </div>
          )}

          <div className="resp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, alignItems: 'start' }}>
            {/* Panel 1 — Beneficiary & Loan */}
            <div className="card card-pad">
              <h3 style={{ fontSize: 18, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ico.user width={18} height={18} style={{ color: 'var(--gold)' }} /> {t('Beneficiary & Loan', 'المستفيد والقرض')}
              </h3>
              {caseData.emirates_id && <Row k={t('Emirates ID')} v={maskEid(caseData.emirates_id)} />}
              <Row k={t('Monthly Salary')} v={aed(caseData.monthly_salary)} />
              <Row k={t('Arrears Amount')} v={aed(caseData.arrears_amount)} highlight />
              {caseData.current_installment != null && <Row k={t('Current Installment')} v={`${aed(caseData.current_installment)}/mo`} />}
              {caseData.monthly_payment != null && <Row k={t('Proposed Plan')} v={`${aed(caseData.monthly_payment)}/mo`} />}
              {caseData.total_new_monthly_payment != null && <Row k={t('Total New Monthly')} v={`${aed(caseData.total_new_monthly_payment)}/mo`} />}
              {caseData.duration_months != null && <Row k={t('Duration')} v={`${caseData.duration_months} ${t('months')}`} />}
              {caseData.remaining_loan_months != null && <Row k={t('Remaining Loan Period')} v={`${caseData.remaining_loan_months} ${t('months')}`} />}
              {caseData.loan_bank_name && <Row k={t('Bank')} v={caseData.loan_bank_name} />}
              {caseData.account_number && <Row k={t('Account Number')} v={caseData.account_number} />}
              {caseData.iban && <Row k={t('IBAN')} v={caseData.iban} />}
              {caseData.consistency_score != null && <Row k={t('Fairness Score')} v={`${caseData.consistency_score}%`} warn={caseData.consistency_score < 70} />}
              {caseData.risk_level && <Row k={t('Risk Level')} v={caseData.risk_level} />}
              {caseData.risk_score != null && <Row k={t('Risk Score')} v={String(caseData.risk_score)} />}
              {caseData.processed_at && <Row k={t('Processed')} v={new Date(caseData.processed_at).toLocaleString('en-AE')} />}
              {/* Documents panel */}
              <div style={{ marginTop: 16 }}>
                {docsManifest?.requestDescription && (
                  <div style={{ background: 'var(--blue-soft)', border: '1px solid #cdddef', borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: 12, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 800, color: 'var(--blue)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Citizen Request</span>
                    {docsManifest.requestDescription}
                  </div>
                )}
                {docsManifest && docsManifest.documents.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {docsManifest.documents.map(doc => {
                      const docUrl = `/api/officer/cases/${encodeURIComponent(caseData.case_number)}/document?index=${doc.index}`
                      const isImage = doc.mimeType.startsWith('image/')
                      const roleLabel = doc.role === 'primary' ? 'Primary' : doc.role === 'supporting' ? 'Supporting' : 'Additional'
                      const rolePill = doc.role === 'primary' ? 'pill-gold' : doc.role === 'supporting' ? 'pill-blue' : 'pill-gray'
                      const sizeKb = doc.size > 0 ? ` · ${(doc.size / 1024).toFixed(0)} KB` : ''
                      return (
                        <div key={doc.index} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 12px', background: 'var(--panel-alt)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: doc.description ? 6 : 0 }}>
                            <Ico.doc2 width={14} height={14} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                <span className={'pill ' + rolePill} style={{ fontSize: 10.5, padding: '1px 6px' }}>{roleLabel}</span>
                                <span style={{ marginLeft: 6 }}>{doc.mimeType}{sizeKb}</span>
                              </div>
                            </div>
                          </div>
                          {doc.description && (
                            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px', paddingLeft: 22 }}>{doc.description}</p>
                          )}
                          <div style={{ display: 'flex', gap: 8, paddingLeft: 22 }}>
                            <a className="btn btn-neutral" style={{ fontSize: 12.5, padding: '5px 10px' }}
                              href={docUrl} target={isImage ? '_blank' : '_blank'} rel="noreferrer">
                              <Ico.doc2 width={13} height={13} /> View
                            </a>
                            <a className="btn btn-neutral" style={{ fontSize: 12.5, padding: '5px 10px' }}
                              href={`${docUrl}&download=1`} download>
                              ↓ Download
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <a className="btn btn-neutral btn-block"
                    href={`/api/officer/cases/${encodeURIComponent(caseData.case_number)}/document`} target="_blank" rel="noreferrer">
                    <Ico.doc2 width={16} height={16} /> {t('View Uploaded Certificate', 'عرض الشهادة المرفوعة')}
                  </a>
                )}
              </div>
            </div>

            {/* Panel 2 — AI Analysis */}
            <div className="card card-pad">
              <h3 style={{ fontSize: 18, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ico.shield width={18} height={18} style={{ color: 'var(--gold)' }} /> {t('AI Analysis', 'تحليل الذكاء الاصطناعي')}
              </h3>

              {/* Agent steps */}
              <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                {caseData.agentSteps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'var(--panel-alt)', border: '1px solid var(--line)' }}>
                    {s.status === 'done'
                      ? <Ico.checkC width={14} height={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      : s.status === 'failed'
                        ? <Ico.xC width={14} height={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                        : <Ico.clock width={14} height={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />}
                    <span style={{ flex: 1, textTransform: 'capitalize', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.agentName.replace(/_/g, ' ')}</span>
                    {s.durationMs != null && <span className="muted" style={{ flexShrink: 0 }}>{(s.durationMs / 1000).toFixed(1)}s</span>}
                  </div>
                ))}
              </div>

              {/* Document verification report */}
              {caseData.verification_report && (
                <div className="card" style={{ padding: 14, marginBottom: 14, boxShadow: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Doc Verification', 'التحقق من المستند')}</span>
                    {caseData.verification_report.verdict && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: verdictColor[caseData.verification_report.verdict] ?? 'var(--muted)' }}>
                        {caseData.verification_report.verdict.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {caseData.verification_report.summary && <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{caseData.verification_report.summary}</p>}
                  {caseData.verification_report.confidenceScore != null && (
                    <p style={{ fontSize: 13 }}>{t('Confidence')}: <span className="mono" style={{ fontWeight: 700 }}>{caseData.verification_report.confidenceScore}%</span></p>
                  )}
                  {(caseData.verification_report.riskFlags?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                      {caseData.verification_report.riskFlags!.map((f, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: 'var(--amber)', display: 'flex', gap: 6 }}>
                          <Ico.warn width={13} height={13} style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rationale EN / AR */}
              {caseData.decision_reason && (
                <div className="card" style={{ padding: 14, marginBottom: 10, boxShadow: 'none', fontSize: 13.5, color: 'var(--body)', lineHeight: 1.6 }}>
                  {caseData.decision_reason}
                </div>
              )}
              {caseData.rationale_ar && (
                <div className="card ar" style={{ padding: 14, marginBottom: 10, boxShadow: 'none', fontSize: 13.5, color: 'var(--body)', lineHeight: 1.7 }} dir="rtl">
                  {caseData.rationale_ar}
                </div>
              )}
              {caseData.fairness_note && (
                <div className="notice notice-blue" style={{ padding: 14, marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontSize: 13.5 }}>{t('Fairness Note', 'ملاحظة الإنصاف')}</h4>
                    <p style={{ fontSize: 13 }}>{caseData.fairness_note}</p>
                  </div>
                </div>
              )}
              {caseData.recovery_guidance && (
                <div className="notice" style={{ padding: 14 }}>
                  <div>
                    <h4 style={{ fontSize: 13.5 }}>{t('Recovery Guidance', 'إرشادات التعافي')}</h4>
                    <p style={{ fontSize: 13 }}>{caseData.recovery_guidance}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Panel 3 — Decision + Audit */}
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="card card-pad">
                <h3 style={{ fontSize: 18, marginBottom: 4 }}>{t('Administrator Override', 'تجاوز الإدارة')}</h3>
                <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t('Override the AI / officer decision. This replaces the outcome everywhere and notifies the citizen.')}</p>

                <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--gold-tint)', borderColor: 'var(--gold-line)', boxShadow: 'none' }}>
                  <div className="muted" style={{ fontSize: 12.5 }}>{t('Current Status')}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, textTransform: 'capitalize', color: caseData.status === 'approved' ? 'var(--green)' : caseData.status === 'rejected' ? 'var(--red)' : 'var(--gold-dark)' }}>
                    {caseData.status}
                  </div>
                  {caseData.monthly_payment != null && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{t('Plan')}: {aed(caseData.monthly_payment)}/mo</div>}
                  {caseData.case_study?.adminOverride && (
                    <div className="pill pill-gold" style={{ marginTop: 10 }}>★ {t('Overridden by')} {caseData.case_study.adminOverride.by}</div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                  {OVERRIDES.map(([k, l]) => (
                    <label key={k} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
                      border: `1px solid ${override === k ? 'var(--gold)' : 'var(--line-strong)'}`, background: override === k ? 'var(--gold-tint)' : 'var(--panel)',
                    }}>
                      <input type="radio" name="ovr" value={k} checked={override === k} onChange={() => setOverride(k)} style={{ accentColor: 'var(--gold)' }} />
                      {t(l)}
                    </label>
                  ))}
                </div>

                <textarea className="input" rows={3} placeholder={t('Reason for override (required)…', 'سبب التجاوز (مطلوب)…')} style={{ resize: 'vertical', fontFamily: 'inherit', marginBottom: 14 }}
                  value={notes} onChange={e => setNotes(e.target.value)} />

                <button className={'btn btn-block ' + (override === 'APPROVE' ? 'btn-green' : override === 'REJECT' ? 'btn-red' : 'btn-primary')} onClick={submitOverride} disabled={submitting}>
                  {submitting ? t('Applying…') : t('Apply Override', 'تطبيق التجاوز')}
                </button>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 10, display: 'flex', gap: 6 }}>
                  <Ico.warn width={14} height={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {t('This override updates the citizen, officer and admin views, notifies the applicant via WhatsApp, and is recorded in the audit log.')}
                </p>
              </div>

              {/* Audit trail */}
              {caseData.auditLogs.length > 0 && (
                <div className="card card-pad">
                  <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('Audit Trail', 'سجل التدقيق')}</h3>
                  <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {caseData.auditLogs.map((log, i) => (
                      <div key={log.id ?? i} className="card" style={{ padding: '10px 12px', boxShadow: 'none', fontSize: 12.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, color: log.action?.includes('APPROVE') ? 'var(--green)' : log.action?.includes('REJECT') ? 'var(--red)' : 'var(--gold-dark)' }}>{log.action}</span>
                          <span className="muted" style={{ fontSize: 11.5 }}>{log.timestamp ? new Date(log.timestamp).toLocaleString('en-AE') : '—'}</span>
                        </div>
                        {log.processedBy && <div className="muted">{t('By')}: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{log.processedBy}</span></div>}
                        {log.rationale && <p className="muted" style={{ marginTop: 4, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{log.rationale}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
