'use client'

import { useEffect, useRef, useState } from 'react'
import FeedbackWidget from './FeedbackWidget'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'
import { CaseDecisionDetail, citizenStatus, TONE_PILL, type Decision } from './CaseDecisionDetail'

// Pipeline (11 agents, in execution order) — the Decision Trace renders these.
const PIPELINE: { id: string; name: string; name_ar: string; icon: string; desc: string }[] = [
  { id: 'planner_agent', name: 'Planner Agent', name_ar: 'المخطط', icon: '🧭', desc: 'Formulates the multi-agent execution graph based on the case profile.' },
  { id: 'risk_forecaster', name: 'Risk Forecaster', name_ar: 'تقييم المخاطر', icon: '🔮', desc: 'Calculates historical payment volatility and probability of default.' },
  { id: 'document_agent', name: 'Document Agent', name_ar: 'وكيل المستندات', icon: '📄', desc: 'OCR + vision authenticity and cross-reference against federal registries.' },
  { id: 'db_fetch', name: 'Database Fetch', name_ar: 'جلب البيانات', icon: '🗄️', desc: 'Queries MOEI housing database and registries for official loan balances.' },
  { id: 'financial_agent', name: 'Financial Analysis', name_ar: 'التحليل المالي', icon: '📊', desc: 'Applies rescheduling models and evaluates the 20% deduction parameters.' },
  { id: 'rules_agent', name: 'Rules Engine + AI', name_ar: 'محرك القواعد', icon: '⚖️', desc: 'Checks statutory policy rules and writes the bilingual rationale.' },
  { id: 'fairness_agent', name: 'Fairness Check', name_ar: 'التحقق من العدالة', icon: '🤝', desc: 'Checks historical approvals to prevent demographic or systemic bias.' },
  { id: 'critic_agent', name: 'Compliance Critic', name_ar: 'الناقد', icon: '🔍', desc: 'Acts as a strict regulator, auditing intermediate agent outcomes.' },
  { id: 'recovery_agent', name: 'Recovery Guidance', name_ar: 'إرشادات التعافي', icon: '🛟', desc: 'Generates a concrete path back to eligibility when not approved.' },
  { id: 'communication_agent', name: 'Communication', name_ar: 'التواصل', icon: '📱', desc: 'Delivers the outcome to the citizen (WhatsApp / SMS).' },
  { id: 'escalation_agent', name: 'Escalation & Audit', name_ar: 'التصعيد والتدقيق', icon: '📋', desc: 'Persists the final decision and writes the immutable audit log.' },
]

type AgentStep = {
  agentName: string
  status: 'pending' | 'running' | 'done' | 'failed'
  durationMs: number | null
  ranInParallel: boolean
  resultSummary: string
}

type CaseStatus = {
  caseNumber: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  agentSteps: AgentStep[]
  decision: Decision | null
  processingTimeMs: number | null
  queuePosition: number | null
  _endDateStr?: string
}

type Props = {
  formData: Record<string, string>
  onReset: () => void
}

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function traceStatus(s: AgentStep['status']) {
  if (s === 'done') return { card: 'complete', badge: 'Completed', badgeCls: 'complete' }
  if (s === 'running') return { card: 'active', badge: 'Running', badgeCls: 'pending' }
  if (s === 'failed') return { card: 'blocker', badge: 'Failed', badgeCls: 'blocker' }
  return { card: 'pending', badge: 'Pending', badgeCls: 'pending' }
}

export default function AgentProcessing({ formData, onReset }: Props) {
  const caseNumber = formData.case_number
  const [data, setData] = useState<CaseStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'citizen' | 'officer'>('citizen')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const announcedKeysRef = useRef<Set<string>>(new Set())
  const [srAnnouncement, setSrAnnouncement] = useState<string>('')
  const { t, lang } = useA11y()

  useEffect(() => {
    mountedRef.current = true
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    async function poll() {
      if (!mountedRef.current) return
      try {
        const res = await fetch(`/api/case-status/${encodeURIComponent(caseNumber)}`)
        const envelope = await res.json()
        const json: CaseStatus = envelope.data
        if (!mountedRef.current) return
        const months = json.decision?.durationMonths
        json._endDateStr = months
          ? new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toLocaleDateString('en-AE', { month: 'short', year: 'numeric' })
          : '—'
        setData(json)
        if (json.status !== 'completed' && json.status !== 'failed') {
          pollingRef.current = setTimeout(poll, 2000)
        } else if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      } catch (err) {
        if (!mountedRef.current) return
        setError(String(err))
      }
    }
    poll()

    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearTimeout(pollingRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [caseNumber])

  // Screen-reader announcements only (visual aria-live region). Audio is NEVER auto-played
  // — it speaks solely when the user clicks a speaker icon (TTS toggle handles that).
  useEffect(() => {
    if (!data) return
    const announcements: string[] = []
    if (data.status === 'queued' && data.queuePosition !== null) {
      const key = `queued-${data.queuePosition}`
      if (!announcedKeysRef.current.has(key)) {
        announcedKeysRef.current.add(key)
        const estSec = Math.round((data.queuePosition - 1) * 15)
        announcements.push(`Case submitted. Waiting in queue at position ${data.queuePosition}. Estimated wait ${estSec === 0 ? 'now' : `${estSec} seconds`}.`)
      }
    }
    if (data.status === 'processing' && !announcedKeysRef.current.has('status-processing')) {
      announcedKeysRef.current.add('status-processing')
      announcements.push('Processing started. SADDAD AI agents are evaluating your application.')
    }
    data.agentSteps?.forEach(step => {
      const doneKey = `agent-done-${step.agentName}`
      if (step.status === 'done' && !announcedKeysRef.current.has(doneKey)) {
        announcedKeysRef.current.add(doneKey)
        announcements.push(`${step.agentName} finished${step.resultSummary ? `: ${step.resultSummary}` : ''}.`)
      }
    })
    if (data.status === 'completed' && data.decision && !announcedKeysRef.current.has('status-completed')) {
      announcedKeysRef.current.add('status-completed')
      announcements.push(`Processing completed. Outcome is ${data.decision.outcome}.`)
    }
    if (announcements.length > 0) setSrAnnouncement(announcements.join(' '))
  }, [data])

  function getStep(id: string): AgentStep | undefined {
    return data?.agentSteps.find(s => s.agentName === id)
  }

  const isComplete = data?.status === 'completed'
  const isFailed = data?.status === 'failed'
  const isQueued = data?.status === 'queued'
  const doneCount = data?.agentSteps.filter(s => s.status === 'done').length ?? 0
  const totalSteps = data?.agentSteps.length || PIPELINE.length
  const progress = Math.min(100, Math.round((doneCount / totalSteps) * 100))
  const fullName = formData.full_name || ''

  // Citizen timeline (4 milestones) derived from real progress.
  function citizenTimeline() {
    const docStatus = isComplete || isFailed ? 'complete' : (doneCount >= 3 ? 'complete' : (doneCount >= 2 ? 'active' : 'pending'))
    const decisionStatus = isComplete || isFailed ? 'complete' : 'pending'

    let decisionEn = 'Final Decision'
    let decisionAr = 'القرار النهائي'
    let decisionSub = 'The final decision will be determined after completing all verification steps.'

    if (isComplete && data?.decision) {
      const outcome = data.decision.outcome
      const rec = data.decision.caseStudy?.recommendation
      if (outcome === 'approved') {
        decisionEn = 'Approved'; decisionAr = 'تمت الموافقة'
        decisionSub = 'Your rescheduling request has been approved successfully.'
      } else if (outcome === 'escalated') {
        decisionEn = 'Escalated for Review'; decisionAr = 'تم التصعيد للمراجعة'
        decisionSub = 'Your request has been escalated to an officer for manual review.'
      } else if (rec === 'Reject' || outcome === 'rejected') {
        decisionEn = 'Rejected'; decisionAr = 'تم الرفض'
        decisionSub = 'Your rescheduling request was not approved based on eligibility criteria.'
      } else {
        decisionEn = 'Additional Information Required'; decisionAr = 'مطلوب معلومات إضافية'
        decisionSub = 'Your request requires additional documents or details.'
      }
    } else if (isFailed) {
      decisionEn = 'Processing Failed'; decisionAr = 'فشل معالجة الطلب'
      decisionSub = 'An error occurred during verification. Please contact support.'
    }

    return [
      { en: 'UAE PASS Verification', ar: 'التحقق من الهوية الرقمية', sub: 'Identity and social-status profile retrieved and verified through UAE PASS.', st: 'complete' },
      { en: 'Application Submitted', ar: 'تم تقديم الطلب', sub: 'Your rescheduling request was submitted successfully.', st: 'complete' },
      { en: 'Document Verification', ar: 'التحقق من المستندات', sub: 'OCR and vision authenticity checks on your submitted salary certificate.', st: docStatus },
      { en: decisionEn, ar: decisionAr, sub: decisionSub, st: decisionStatus },
    ]
  }

  const decisionPanels = data?.decision ? (
    <CaseDecisionDetail
      decision={data.decision}
      caseNumber={data.caseNumber}
      endDateStr={data._endDateStr}
      processingLabel={data.processingTimeMs ? fmt(data.processingTimeMs) : `${elapsed}s`}
    />
  ) : null

  return (
    <div className="wrap fade-in" style={{ paddingTop: 36, paddingBottom: 60 }}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srAnnouncement}</div>

      {/* Header */}
      <div className="proc-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="section-title" style={{ fontSize: 30, color: 'var(--ink-navy)' }}>{t('Request Status')}</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 15, fontWeight: 500 }}>{caseNumber}{fullName ? ` · ${fullName}` : ''}</p>
        </div>
        {viewMode === 'officer' && (
          <div className="proc-count">
            <div className="big">{doneCount}<span>/{totalSteps}</span></div>
            <div className="lbl">{t('steps done', 'الخطوات المنجزة')}</div>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: '12px 18px', background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-navy)' }}>
            {viewMode === 'citizen' ? t('Citizen Access View') : t('Officer Decision Trace (Developer & Auditor Demo)')}
          </span>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {viewMode === 'citizen' ? t('Displaying client-safe plain-language status timeline.') : t('Displaying auditable step-by-step agent telemetry trace.')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={viewMode === 'citizen' ? { background: 'var(--gold)', color: '#fff', borderColor: 'var(--gold)' } : { background: 'var(--bg)', color: 'var(--ink)', borderColor: 'var(--line-strong)' }} onClick={() => setViewMode('citizen')}><Ico.user width={16} height={16} /> {t('Citizen View')}</button>
          <button className="btn" style={viewMode === 'officer' ? { background: 'var(--gold)', color: '#fff', borderColor: 'var(--gold)' } : { background: 'var(--bg)', color: 'var(--ink)', borderColor: 'var(--line-strong)' }} onClick={() => setViewMode('officer')}><Ico.search width={16} height={16} /> {t('Decision Trace')}</button>
        </div>
      </div>

      {error && !isFailed && (
        <div className="notice" style={{ marginBottom: 20, borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div className="ico" style={{ color: 'var(--red)' }}><Ico.warn /></div>
          <div><h4>{t('Connection Error')}</h4><p>{error}</p></div>
        </div>
      )}

      {/* ── CITIZEN VIEW ── */}
      {viewMode === 'citizen' && (
        <div className="fade-in">
          {!isComplete && !isFailed ? (
            <div className="card card-pad" style={{ borderColor: 'var(--gold-line)', background: 'var(--cream-soft)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gold-tint)', display: 'grid', placeItems: 'center', color: 'var(--gold-dark)', flexShrink: 0 }}><Ico.clock width={24} height={24} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-navy)', margin: 0 }}>{t('Case Review Underway')}</h3>
                    <span className="ar" style={{ fontSize: 15, color: 'var(--gold-dark)', fontWeight: 700 }}>قيد المراجعة والتدقيق</span>
                  </div>
                  <p style={{ color: 'var(--body)', fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>
                    {isQueued ? `Your application is in the queue (position #${data?.queuePosition ?? 1}). ` : 'Our AI agents are evaluating your request. '}
                    To ensure accuracy, your submitted salary certificate is being validated against the official employment registries.
                  </p>
                  <div style={{ marginTop: 14, padding: '12px 16px', background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--gold-dark)', fontWeight: 700 }}>
                    <Ico.shield width={16} height={16} />
                    <span>{t('Expected Verification Time: 3 to 5 Working Days')} / المدة المتوقعة للتحقق: 3 إلى 5 أيام عمل</span>
                  </div>
                  <div className="proc-progress-container" style={{ marginTop: 18 }}>
                    <div className="proc-progress-bar" style={{ width: `${progress}%`, backgroundColor: 'var(--gold)' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            data?.decision && (() => {
              const cs = citizenStatus(data.decision.outcome, data.decision.caseStudy?.recommendation)
              return (
                <div className="card card-pad" style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={`pill ${TONE_PILL[cs.tone]}`} style={{ fontSize: 14, padding: '8px 16px' }}>{t(cs.label)}</span>
                      <span className="ar muted" style={{ fontSize: 14 }}>{cs.labelAr}</span>
                    </div>
                    {data.decision.riskLevel && <span className="pill pill-gold">◆ {data.decision.riskLevel} RISK</span>}
                  </div>
                </div>
              )
            })()
          )}

          {/* Application progress timeline */}
          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <div className="data-head" style={{ marginBottom: 18 }}><span className="dot" /><span>{t('Application Progress Timeline')}</span></div>
            <div className="timeline-container">
              {citizenTimeline().map((item, i, arr) => (
                <div key={item.en} className={'timeline-item' + (item.st === 'complete' && i < arr.length - 1 ? ' line-green' : '')}>
                  <div className={'timeline-icon-wrap ' + item.st}>{item.st === 'complete' ? <Ico.check width={16} height={16} /> : item.st === 'pending' ? <Ico.clock width={16} height={16} /> : null}</div>
                  <div className="timeline-content">
                    <div className="timeline-title-row">
                      <div className={'timeline-title' + (item.st === 'pending' ? ' pending' : '')}>{lang === 'ar' ? item.ar : item.en}</div>
                      {lang === 'en' && <div className={'timeline-arabic' + (item.st === 'active' ? ' active' : item.st === 'pending' ? ' pending' : '')}>{item.ar}</div>}
                    </div>
                    <p style={{ color: item.st === 'pending' ? 'var(--faint)' : 'var(--body)', fontSize: 13.5, marginTop: 4 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {decisionPanels}
        </div>
      )}

      {/* ── DECISION TRACE VIEW (read-only step list — no playback controls) ── */}
      {viewMode === 'officer' && (
        <div className="fade-in">
          {PIPELINE.map((agent, i) => {
            const step = getStep(agent.id)
            const st = traceStatus(step?.status ?? 'pending')
            return (
              <div key={agent.id} className={`trace-step-card ${st.card}`}>
                <div className="trace-step-grid">
                  <div className="trace-step-illustration" style={{ fontSize: 32 }}>{agent.icon}</div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div className="timeline-title" style={{ fontSize: 17 }}>{i + 1}. {lang === 'ar' ? agent.name_ar : agent.name}</div>
                        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 2 }}>{agent.desc}</p>
                      </div>
                      <span className={`status-badge ${st.badgeCls}`}>{st.badge}</span>
                    </div>
                    {step?.resultSummary && (
                      <div style={{ marginTop: 12, background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 14, color: 'var(--body)' }}>
                        {step.resultSummary}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <span className="muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>
                        {step?.durationMs != null ? `Completed in ${fmt(step.durationMs)} · ` : ''}Logs &amp; Telemetry recorded
                      </span>
                      <button onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))} style={{ background: 'none', border: 0, color: 'var(--gold-dark)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {expanded[i] ? t('Hide Technical Details', 'إخفاء التفاصيل التقنية') : t('Show Technical Details')}
                      </button>
                    </div>
                    {expanded[i] && (
                      <div className="trace-step-details">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="trace-evidence-pill">{agent.id}</span>
                          {step?.ranInParallel && <span className="trace-evidence-pill">PARALLEL</span>}
                          <span className="trace-evidence-pill">{(step?.status ?? 'pending').toUpperCase()}</span>
                        </div>
                        <p style={{ color: 'var(--body)' }}>{step?.resultSummary || 'No telemetry recorded for this step yet.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Feedback + back-to-home (once a terminal decision is on screen) */}
      {data?.decision && (
        <div style={{ marginTop: 24 }}>
          <FeedbackWidget caseNumber={String(caseNumber)} defaultName={fullName} />
        </div>
      )}
      {(isComplete || isFailed) && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={onReset}>
          <Ico.home width={16} height={16} /> {t('Back to Home')}
        </button>
      )}
    </div>
  )
}
