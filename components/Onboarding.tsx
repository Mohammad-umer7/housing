'use client'

// First-time onboarding overlay for the citizen experience. Shows once (gated on a
// localStorage flag), a short guided intro to what SADDAD is and how the AI review
// works. Dismiss with Skip or by finishing the last step. Purely front-end — no data
// dependency, so it works in the keyless demo build too.

import { useEffect, useState } from 'react'
import { Emblem, Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

const FLAG = 'saddad_onboarded'

type Step = {
  icon: React.ReactNode
  title: string
  titleAr: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: <Emblem size={44} transparent />,
    title: 'Welcome to SADDAD',
    titleAr: 'مرحباً بك في سدّد',
    body: 'SADDAD is the Ministry of Energy & Infrastructure’s AI assistant for rescheduling housing-loan arrears. Sign in, tell us your situation, and get a fair decision — fast.',
  },
  {
    icon: <Ico.users width={40} height={40} />,
    title: '11 AI agents review your case',
    titleAr: '11 وكيلاً ذكياً يراجعون طلبك',
    body: 'Your request is examined by a team of specialised agents — risk, documents, finances, governance rules, fairness and a critic — working together, transparently, in real time. You can watch every step.',
  },
  {
    icon: <Ico.shield width={40} height={40} />,
    title: 'Fair, consistent & explainable',
    titleAr: 'عادل ومتسق وقابل للتفسير',
    body: 'Every decision is checked against real past cases for fairness and comes with a clear reason. Sensitive or borderline cases are escalated to a human housing officer.',
  },
  {
    icon: <Ico.doc2 width={40} height={40} />,
    title: 'Get started',
    titleAr: 'لنبدأ',
    body: 'Sign in with your UAE PASS Application ID (try one of the demo accounts), then start or track an application. This is a demo environment — all data shown is fictional.',
  },
]

export default function Onboarding() {
  const { t } = useA11y()
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    // Deferred (async) so the first-paint state is set outside the effect body —
    // avoids the cascading-render lint rule and any SSR hydration mismatch.
    let cancelled = false
    void (async () => {
      if (typeof window === 'undefined') return
      let show = false
      try { show = !localStorage.getItem(FLAG) } catch { /* ignore */ }
      if (!cancelled && show) setOpen(true)
    })()
    return () => { cancelled = true }
  }, [])

  function finish() {
    try { localStorage.setItem(FLAG, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  if (!open) return null
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }} role="dialog" aria-modal="true" aria-label="Welcome to SADDAD">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: '94vw', textAlign: 'center' }}>
        <button className="modal-close" onClick={finish} aria-label={t('Close')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div style={{ display: 'grid', placeItems: 'center', width: 84, height: 84, margin: '8px auto 18px', borderRadius: 20, background: 'var(--cream-soft, rgba(194,161,78,0.08))', border: '1px solid var(--gold-line, rgba(194,161,78,0.25))', color: 'var(--gold-dark)' }}>
          {step.icon}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy, #1C2733)', marginBottom: 4 }}>{t(step.title)}</h2>
        <div className="ar muted" style={{ fontSize: 14, marginBottom: 14 }}>{step.titleAr}</div>
        <p style={{ color: 'var(--body)', fontSize: 14.5, lineHeight: 1.55, maxWidth: 360, margin: '0 auto 24px' }}>{t(step.body)}</p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 22 }}>
          {STEPS.map((_, idx) => (
            <span key={idx} style={{ width: idx === i ? 22 : 8, height: 8, borderRadius: 99, background: idx === i ? 'var(--gold-dark)' : 'var(--border)', transition: 'all .2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-neutral" onClick={finish}>{t('Skip')}</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {i > 0 && <button className="btn btn-neutral" onClick={() => setI(i - 1)}>{t('Back')}</button>}
            {last ? (
              <button className="btn btn-primary" style={{ background: '#1C2733' }} onClick={finish}>{t('Get started')} <Ico.chevR width={15} height={15} /></button>
            ) : (
              <button className="btn btn-primary" style={{ background: '#1C2733' }} onClick={() => setI(i + 1)}>{t('Next')} <Ico.chevR width={15} height={15} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
