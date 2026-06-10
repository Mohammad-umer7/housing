'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'
import { CaseDecisionDetail, citizenStatus, TONE_PILL, type Decision } from '@/components/CaseDecisionDetail'
import { SIGN_LANGUAGE_VIDEOS, useSignLanguageVideo } from '@/components/SignLanguageProvider'

type CaseCard = {
  case_number: string
  full_name: string
  status: string
  recommendation: string | null
  arrears_amount: number
  monthly_salary: number
  monthly_payment: number | null
  duration_months: number | null
  processed_at: string | null
  created_at: string | null
}

type Props = {
  appId: string
  // Start a brand-new application (fresh wizard).
  onNewApplication: () => void
  // Re-submit under this profile (creates a new case). 'docs' = upload requested document,
  // 'reapply' = full re-application after a rejection.
  onResubmit: (mode: 'docs' | 'reapply') => void
  // Watch the live pipeline for an in-flight case.
  onViewProgress: (caseNumber: string, fullName?: string) => void
}

const IN_FLIGHT = ['pending', 'queued', 'processing']

type Action = { kind: 'progress' | 'docs' | 'reapply' | 'awaiting' | 'view'; label: string }
function cardAction(status: string, recommendation: string | null): Action {
  if (IN_FLIGHT.includes(status)) return { kind: 'progress', label: 'View Progress' }
  if (status === 'approved') return { kind: 'view', label: 'View Details' }
  if (recommendation === 'Request Documents') return { kind: 'docs', label: 'Submit Documents' }
  if (status === 'escalated') return { kind: 'awaiting', label: 'Awaiting Officer Review' }
  if (status === 'rejected') return { kind: 'reapply', label: 'Re-apply' }
  return { kind: 'view', label: 'View Details' }
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Module-level (not called during render) so the purity rule is satisfied.
function computeEndDate(months: number | null | undefined): string | null {
  if (!months) return null
  return new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toLocaleDateString('en-AE', { month: 'short', year: 'numeric' })
}

export default function CitizenHome({ appId, onNewApplication, onResubmit, onViewProgress }: Props) {
  const { t } = useA11y()
  const [cases, setCases] = useState<CaseCard[]>([])
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ decision: Decision | null; status: string; endDateStr: string | null } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useSignLanguageVideo(selected ? SIGN_LANGUAGE_VIDEOS.verdict : SIGN_LANGUAGE_VIDEOS.home)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/cases/history?appId=${encodeURIComponent(appId)}`)
      const env = await res.json()
      if (res.ok && env.success) {
        setCases(env.data.cases ?? [])
        setFullName(env.data.applicant?.full_name ?? '')
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => { void (async () => { await load() })() }, [load])

  async function openCase(caseNumber: string) {
    setSelected(caseNumber)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/case-status/${encodeURIComponent(caseNumber)}`)
      const env = await res.json()
      const d = env.data
      const endDateStr = computeEndDate(d?.decision?.durationMonths)
      setDetail({ decision: d?.decision ?? null, status: String(d?.status ?? 'pending'), endDateStr })
    } catch {
      setDetail({ decision: null, status: 'pending', endDateStr: null })
    } finally {
      setDetailLoading(false)
    }
  }

  function runAction(a: Action, caseNumber: string) {
    if (a.kind === 'progress') onViewProgress(caseNumber, cases.find((c) => c.case_number === caseNumber)?.full_name)
    else if (a.kind === 'docs') onResubmit('docs')
    else if (a.kind === 'reapply') onResubmit('reapply')
    // 'view' / 'awaiting' → open the detail (no navigation)
    else openCase(caseNumber)
  }

  // ── Case detail view ──────────────────────────────────────────────────────────
  if (selected) {
    const card = cases.find((c) => c.case_number === selected)
    const status = detail?.status ?? card?.status ?? 'pending'
    const recommendation = card?.recommendation ?? detail?.decision?.caseStudy?.recommendation ?? null
    const cs = citizenStatus(status, recommendation)
    const a = cardAction(status, recommendation)
    return (
      <div className="wrap-narrow fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <button className="btn btn-neutral" style={{ marginBottom: 20 }} onClick={() => { setSelected(null); setDetail(null) }}>
          ← {t('Back to my applications')}
        </button>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="mono" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>{selected}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>{card?.full_name || fullName}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Submitted {fmtDate(card?.created_at ?? card?.processed_at ?? null)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`pill ${TONE_PILL[cs.tone]}`} style={{ fontSize: 14, padding: '8px 16px' }}>{t(cs.label)}</span>
              <span className="ar muted" style={{ fontSize: 13 }}>{cs.labelAr}</span>
            </div>
          </div>
        </div>

        {detailLoading ? (
          <div className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>{t('Loading case details…', 'جارٍ تحميل تفاصيل الطلب…')}</div>
        ) : detail?.decision ? (
          <CaseDecisionDetail decision={detail.decision} caseNumber={selected} endDateStr={detail.endDateStr} />
        ) : (
          <div className="notice" style={{ borderColor: 'var(--gold-line)', background: 'var(--cream-soft)' }}>
            <div className="ico"><Ico.clock /></div>
            <div><h4>{t('This application is still being processed')}</h4><p>{t('Open the live view to watch the AI agents evaluate your request.')}</p></div>
          </div>
        )}

        {/* Decision-aware action */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {a.kind === 'progress' && <button className="btn btn-primary" onClick={() => onViewProgress(selected, card?.full_name)}>{t('Watch Live Processing')} <Ico.chevR width={16} height={16} /></button>}
          {a.kind === 'docs' && <button className="btn btn-primary" onClick={() => onResubmit('docs')}><Ico.doc2 width={16} height={16} /> {t('Submit Documents')}</button>}
          {a.kind === 'reapply' && <button className="btn btn-primary" onClick={() => onResubmit('reapply')}><Ico.refresh width={16} height={16} /> {t('Re-apply')}</button>}
          {a.kind === 'awaiting' && <span className="pill pill-amber" style={{ fontSize: 14, padding: '10px 16px' }}><Ico.clock width={15} height={15} /> {t("Awaiting officer review — you'll be notified")}</span>}
          {a.kind === 'view' && status === 'approved' && <span className="pill pill-green" style={{ fontSize: 14, padding: '10px 16px' }}><Ico.checkC width={15} height={15} /> {t('Your rescheduling plan is active')}</span>}
        </div>
      </div>
    )
  }

  // ── Case list (home) ──────────────────────────────────────────────────────────
  return (
    <div className="wrap-narrow fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span className="pill pill-gold" style={{ marginBottom: 16 }}><Ico.building width={14} height={14} /> وزارة الطاقة والبنية التحتية</span>
        <h2 className="section-title" style={{ fontSize: 32, marginTop: 14 }}>{fullName ? `${t('Welcome', 'مرحباً')}، ${fullName.split(' ')[0]}` : t('My Applications')}</h2>
        <p className="section-sub">{t('Your housing-arrears rescheduling applications and their status.')}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div className="data-head"><span className="dot" /><span>{t('My Cases')}</span><span className="ar">/ طلباتي</span></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-neutral" onClick={() => { setLoading(true); load() }}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
          <button className="btn btn-primary" onClick={onNewApplication}><Ico.submit width={16} height={16} /> {t('New Application')}</button>
        </div>
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>{t('Loading your applications…')}</div>
      ) : cases.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 56 }}>
          <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 18 }}>{t('No applications yet')}</p>
          <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>{t('Start a housing-arrears rescheduling request to see it here.')}</p>
          <button className="btn btn-primary" onClick={onNewApplication}>{t('Start your application')} <Ico.chevR width={16} height={16} /></button>
        </div>
      ) : (
        <div className="stack-lg">
          {cases.map((c) => {
            const cs = citizenStatus(c.status, c.recommendation)
            const a = cardAction(c.status, c.recommendation)
            return (
              <div key={c.case_number} className="card card-pad" style={{ cursor: 'pointer', transition: 'box-shadow .2s' }} onClick={() => openCase(c.case_number)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div className="mono" style={{ color: 'var(--gold-dark)', fontWeight: 600, fontSize: 14 }}>{c.case_number}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>{c.full_name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('Submitted', 'تم التقديم')} {fmtDate(c.created_at ?? c.processed_at)}</div>
                  </div>
                  <span className={`pill ${TONE_PILL[cs.tone]}`} style={{ fontSize: 13, padding: '7px 14px' }}>{t(cs.label)}</span>
                </div>

                <div style={{ display: 'flex', gap: 28, marginTop: 16, flexWrap: 'wrap' }}>
                  <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('Arrears')}</div><div style={{ fontWeight: 800 }}>AED {c.arrears_amount.toLocaleString()}</div></div>
                  {c.monthly_payment != null && <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('Monthly plan')}</div><div style={{ fontWeight: 800, color: 'var(--green)' }}>AED {c.monthly_payment.toLocaleString()}/mo</div></div>}
                  {c.duration_months != null && <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('Duration')}</div><div style={{ fontWeight: 800 }}>{c.duration_months} {t('months', 'شهر')}</div></div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 13 }}>{cs.labelAr}</span>
                  <button
                    className={'btn ' + (a.kind === 'awaiting' || a.kind === 'view' ? 'btn-neutral' : 'btn-primary')}
                    onClick={(e) => { e.stopPropagation(); runAction(a, c.case_number) }}
                  >
                    {t(a.label)} {a.kind !== 'awaiting' && <Ico.chevR width={15} height={15} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
