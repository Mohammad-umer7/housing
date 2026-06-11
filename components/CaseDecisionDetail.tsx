'use client'

import { type ReactNode } from 'react'
import { useTTS } from '@/lib/tts'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

// Shared decision result type + panels, used by both the live processing screen and the
// citizen case-history detail view so a decided case looks identical everywhere.
export type Decision = {
  outcome: string
  monthlyPayment: number | null
  durationMonths: number | null
  rationale: string
  rationaleAr: string
  riskLevel: string
  consistencyScore: number | null
  similarCasesFound: number | null
  fairnessNote: string
  totalNewMonthly: number | null
  currentInstallment: number | null
  monthlySalary: number | null
  recoveryGuidance: string
  recoveryGuidanceAr: string
  caseStudy: {
    applicationStatus: string
    caseSummary: string
    incomeAnalysis: { salary: number; stability: string; perMemberAverage: number; familySize: number }
    arrearsAmount: number
    remainingLoanBalance: number
    remainingRepaymentPeriodMonths: number
    unpaidInstallments: number
    proposedDeductionRate: number
    proposedRepaymentPlan: { durationMonths: number; monthlyInstallment: number; planType: string; newEmi: number }
    twentyPercentRule: string
    periodRule: string
    recommendation: string
    reasoning: string
    reschedulingPath?: string
    reschedulingPathLabel?: string
    reschedulingPathLabelAr?: string
    adminOverride?: { by: string; at: string; note: string; from: string; to: string } | null
  } | null
  verificationReport: {
    verdict: string
    confidenceScore: number
    summary: string
    checks: { id: string; label: string; status: string; detail: string }[]
    uaePipelineScore?: {
      schemaValidation: number
      arithmeticCheck: number
      ruleEngine: number
      llmSemanticRisk: number
      databaseMatch: number
      visualForgery: number
      total: number
      verdict: string
    }
  } | null
}

export const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'pill-green' },
  mismatch: { label: 'Mismatch', cls: 'pill-red' },
  suspicious: { label: 'Suspicious (AI vision)', cls: 'pill-red' },
  hash_tampered: { label: 'Modified after issuance (hash)', cls: 'pill-red' },
  tampered: { label: 'Tampered', cls: 'pill-amber' },
  invalid: { label: 'Not a valid certificate', cls: 'pill-red' },
  unverifiable: { label: 'Documents required', cls: 'pill-amber' },
  skipped: { label: 'Not checked', cls: 'pill-gray' },
}

export type CitizenStatus = { label: string; labelAr: string; tone: 'approved' | 'info' | 'rejected' | 'review' }
export function citizenStatus(outcome: string, recommendation?: string | null): CitizenStatus {
  if (outcome === 'approved') return { label: 'Approved', labelAr: 'تمت الموافقة', tone: 'approved' }
  if (outcome === 'escalated') return { label: 'Human Review Required', labelAr: 'مطلوب مراجعة موظف', tone: 'review' }
  if (recommendation === 'Reject') return { label: 'Rejected', labelAr: 'مرفوض', tone: 'rejected' }
  return { label: 'Additional Information Required', labelAr: 'مطلوب معلومات إضافية', tone: 'info' }
}
export const TONE_PILL: Record<CitizenStatus['tone'], string> = {
  approved: 'pill-green', info: 'pill-amber', rejected: 'pill-red', review: 'pill-amber',
}

function DataHeadLocal({ en, ar }: { en: string; ar?: string }) {
  return <div className="data-head"><span className="dot" /><span>{en}</span>{ar && <span className="ar">/ {ar}</span>}</div>
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{k}</span>
      <span style={{ fontSize: 13, color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

const pass = (s: string) => <span style={{ color: s === 'Pass' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{s}</span>

export function CaseDecisionDetail({
  decision: d,
  caseNumber,
  endDateStr,
  processingLabel,
}: {
  decision: Decision
  caseNumber: string
  endDateStr?: string | null
  processingLabel?: string | null
}) {
  const { speak, activeText, enabled } = useTTS()
  const { t } = useA11y()
  const spk = (text: string, extra?: React.CSSProperties) =>
    enabled ? (
      <Ico.speaker width={18} height={18} style={{ color: activeText === text ? 'var(--red)' : 'var(--faint)', cursor: 'pointer', ...extra }} onClick={() => speak(text, 'en', true)} aria-label="Read aloud" />
    ) : null

  const planText = `Rescheduling Plan: Monthly rescheduling payment is AED ${d.monthlyPayment}. Total new monthly payment is AED ${(d.totalNewMonthly ?? ((d.monthlyPayment ?? 0) + (d.currentInstallment ?? 0)))} for a duration of ${d.durationMonths} months.`
  const escalationText = `Referred to a specialist officer: ${d.rationale}`
  const assessmentText = d.caseStudy ? `Structured Assessment: Application status is ${d.caseStudy.applicationStatus}. Income salary is AED ${d.caseStudy.incomeAnalysis.salary.toLocaleString()}. Total arrears amount is AED ${d.caseStudy.arrearsAmount.toLocaleString()}. Recommendation is ${d.caseStudy.recommendation}.` : ''
  const docText = d.verificationReport ? `Document Verification: Verdict is ${VERDICT_BADGE[d.verificationReport.verdict]?.label || d.verificationReport.verdict} with ${d.verificationReport.confidenceScore} percent confidence. Summary: ${d.verificationReport.summary}` : ''
  const recoveryText = `How to get approved: ${d.recoveryGuidance}`

  return (
    <div className="stack-lg">
      {d.caseStudy?.adminOverride && (
        <div className="notice" style={{ borderColor: 'var(--gold-line)', background: 'var(--cream-soft)' }}>
          <div className="ico"><Ico.shield /></div>
          <div>
            <h4>{t('Reviewed by a Ministry administrator')}</h4>
            <p>{d.caseStudy.adminOverride.note}</p>
          </div>
        </div>
      )}

      {d.consistencyScore !== null && (
        <div className="notice notice-blue">
          <div className="ico"><Ico.shield /></div>
          <div><p style={{ fontWeight: 600 }}>{d.consistencyScore}% consistency · {d.fairnessNote}</p></div>
        </div>
      )}

      {d.outcome === 'approved' && d.monthlyPayment && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <DataHeadLocal en={t('Rescheduling Plan')} />
            {spk(planText)}
          </div>
          <div style={{ background: 'var(--green-soft)', border: '1px solid rgba(30,142,62,.2)', borderRadius: 'var(--r)', padding: 16, marginTop: 14, fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Monthly rescheduling payment:</span><strong>AED {d.monthlyPayment.toLocaleString()}</strong></div>
            {d.currentInstallment != null && d.currentInstallment > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginTop: 6 }}><span>+ Existing installment:</span><span>AED {d.currentInstallment.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 8, fontWeight: 800 }}><span>Total new monthly:</span><span style={{ color: 'var(--blue)' }}>AED {(d.totalNewMonthly ?? (d.monthlyPayment + d.currentInstallment)).toLocaleString()}</span></div>
              </>
            )}
            <div className="resp-grid" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
              <div><div className="muted" style={{ fontSize: 11 }}>Duration</div><div style={{ fontWeight: 800, fontSize: 18 }}>{d.durationMonths} months</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Ends</div><div style={{ fontWeight: 800 }}>{endDateStr ?? '—'}</div></div>
            </div>
          </div>
          {/* Current vs proposed deduction — visual % of salary, 20% cap marked */}
          {d.monthlySalary != null && d.monthlySalary > 0 && (() => {
            const salary = d.monthlySalary!
            const current = d.currentInstallment ?? 0
            const proposed = d.totalNewMonthly ?? ((d.monthlyPayment ?? 0) + current)
            const curPct = Math.min(100, (current / salary) * 100)
            const newPct = Math.min(100, (proposed / salary) * 100)
            const bar = (label: string, amount: number, pct: number, color: string) => (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span className="muted">{label}</span>
                  <span style={{ fontWeight: 700 }}>AED {Math.round(amount).toLocaleString()}/mo · {pct.toFixed(1)}% {t('of salary')}</span>
                </div>
                <div style={{ position: 'relative', height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct * 4)}%`, height: '100%', background: color, borderRadius: 4 }} />
                  {/* 20% cap marker at 4× scale → 80% of track */}
                  <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 2, background: 'var(--red)', opacity: .55 }} />
                </div>
              </div>
            )
            return (
              <div style={{ marginTop: 12 }}>
                {bar(t('Current deduction'), current, curPct, 'var(--faint)')}
                {bar(t('Proposed deduction'), proposed, newPct, newPct <= 20 ? 'var(--green)' : 'var(--red)')}
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--muted)' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--red)', opacity: .55, marginRight: 4, verticalAlign: 'middle' }} />{t('20% statutory cap')}</span>
                </div>
              </div>
            )
          })()}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Rule G-03 — total salary deduction capped at 20% of income.</p>
        </div>
      )}

      {d.outcome === 'escalated' && (
        <div className="notice" style={{ borderColor: 'var(--amber-soft)', background: 'var(--amber-soft)' }}>
          <div className="ico" style={{ color: 'var(--amber)' }}><Ico.user /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Referred to a specialist officer / الإحالة للموظف المختص</h4>
              {spk(escalationText)}
            </div>
            <p>{d.rationale}</p>
            {d.rationaleAr && <p className="ar" style={{ marginTop: 6, color: 'var(--muted)' }}>{d.rationaleAr}</p>}
            <p className="fine">You will be contacted within 5 working days · {caseNumber}</p>
          </div>
        </div>
      )}

      {d.caseStudy && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <DataHeadLocal en={t('Structured Assessment')} ar="التقييم المنظم" />
            {spk(assessmentText)}
          </div>
          <div style={{ marginTop: 12 }}>
            <Row k="Application Status" v={d.caseStudy.applicationStatus} />
            <Row k="Income (salary · stability)" v={`AED ${d.caseStudy.incomeAnalysis.salary.toLocaleString()} · ${d.caseStudy.incomeAnalysis.stability}`} />
            <Row k="Avg income / member" v={`AED ${d.caseStudy.incomeAnalysis.perMemberAverage.toLocaleString()} (household ${d.caseStudy.incomeAnalysis.familySize})`} />
            <Row k="Arrears · unpaid" v={`AED ${d.caseStudy.arrearsAmount.toLocaleString()} · ${d.caseStudy.unpaidInstallments}`} />
            <Row k="Remaining balance" v={`AED ${d.caseStudy.remainingLoanBalance.toLocaleString()}`} />
            <Row k="Remaining period" v={`${d.caseStudy.remainingRepaymentPeriodMonths} months`} />
            <Row k="Proposed deduction rate" v={`${d.caseStudy.proposedDeductionRate}% of income`} />
            {d.caseStudy.proposedRepaymentPlan.durationMonths > 0 && (
              <Row k="Proposed plan" v={`AED ${d.caseStudy.proposedRepaymentPlan.monthlyInstallment.toLocaleString()}/mo × ${d.caseStudy.proposedRepaymentPlan.durationMonths}mo`} />
            )}
            <Row k="20% Rule" v={pass(d.caseStudy.twentyPercentRule)} />
            <Row k="Loan Period Rule" v={pass(d.caseStudy.periodRule)} />
            <Row k="Recommendation" v={<strong style={{ color: 'var(--blue)' }}>{d.caseStudy.recommendation}</strong>} />
          </div>
          {/* Official Assessment-Matrix path the agent selected (bilingual) */}
          {d.caseStudy.reschedulingPathLabel && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--gold-tint, var(--panel-alt))', border: '1px solid var(--gold-line, var(--line))', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Rescheduling Path')} <span className="mono" style={{ textTransform: 'none', fontWeight: 600 }}>· {d.caseStudy.reschedulingPath}</span></span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{d.caseStudy.reschedulingPathLabel}</span>
              {d.caseStudy.reschedulingPathLabelAr && <span className="ar" dir="rtl" style={{ fontSize: 13.5, color: 'var(--muted)' }}>{d.caseStudy.reschedulingPathLabelAr}</span>}
            </div>
          )}
        </div>
      )}

      {d.verificationReport && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <DataHeadLocal en={t('Document Verification')} ar="التحقق من المستند" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`pill ${(VERDICT_BADGE[d.verificationReport.verdict] ?? VERDICT_BADGE.skipped).cls}`}>{(VERDICT_BADGE[d.verificationReport.verdict] ?? VERDICT_BADGE.skipped).label}</span>
              <span className={`pill ${d.verificationReport.confidenceScore >= 90 ? 'pill-green' : d.verificationReport.confidenceScore >= 60 ? 'pill-amber' : 'pill-red'}`}>{d.verificationReport.confidenceScore}% confidence</span>
              {spk(docText, { marginLeft: 8 })}
            </div>
          </div>
          {/* UAE Pipeline 100-point score breakdown */}
          {d.verificationReport.uaePipelineScore && (() => {
            const s = d.verificationReport!.uaePipelineScore!
            const scoreColor = s.total >= 80 ? 'var(--green)' : s.total >= 60 ? 'var(--amber)' : 'var(--red)'
            const rows: [string, number, number][] = [
              ['Schema & Format', s.schemaValidation, 15],
              ['Arithmetic Integrity', s.arithmeticCheck, 20],
              ['Rule Engine', s.ruleEngine, 20],
              ['AI Semantic Analysis', s.llmSemanticRisk, 20],
              ['Database Cross-Check', s.databaseMatch, 15],
              ['Visual Forgery Check', s.visualForgery, 10],
            ]
            return (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Document Authenticity Score')}</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: scoreColor }}>{s.total}/100 · {s.verdict}</span>
                </div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${s.total}%`, height: '100%', background: scoreColor, borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {rows.map(([label, score, max]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 140, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(score / max) * 100}%`, height: '100%', background: score === max ? 'var(--green)' : score > 0 ? 'var(--amber)' : 'var(--red)', borderRadius: 2 }} />
                      </div>
                      <span className="mono" style={{ fontWeight: 700, flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{score}/{max}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.verificationReport.checks.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                <span>{c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : c.status === 'warn' ? '⚠️' : '➖'}</span>
                <div><span style={{ color: c.status === 'fail' ? 'var(--red)' : c.status === 'warn' ? 'var(--amber)' : 'var(--ink)' }}>{c.label}</span><span className="muted"> — {c.detail}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.outcome !== 'approved' && d.recoveryGuidance && (
        <div className="notice notice-blue">
          <div className="ico"><Ico.checkC /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>How to get approved / كيفية الحصول على الموافقة</h4>
              {spk(recoveryText)}
            </div>
            <p>{d.recoveryGuidance}</p>
            {d.recoveryGuidanceAr && <p className="ar" style={{ marginTop: 6, color: 'var(--muted)' }}>{d.recoveryGuidanceAr}</p>}
          </div>
        </div>
      )}

      {d.outcome !== 'escalated' && d.rationale && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <DataHeadLocal en={t('AI Rationale')} ar="المبررات" />
            {spk(d.rationale)}
          </div>
          <p style={{ color: 'var(--body)', fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>{d.rationale}</p>
          {d.rationaleAr && <p className="ar" style={{ color: 'var(--muted)', fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>{d.rationaleAr}</p>}
        </div>
      )}

      {processingLabel && (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>{t('Processing Time')}</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)' }}>{processingLabel}</div>
        </div>
      )}
    </div>
  )
}
