'use client'

import { useState } from 'react'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type Props = {
  caseNumber: string
  defaultName?: string
}

// Shown after a decision is rendered. The citizen rates the experience (1-5 stars),
// optionally leaves a comment, and gives their name. Submits to /api/feedback, which
// surfaces it in the officer Feedback section.
export default function FeedbackWidget({ caseNumber, defaultName }: Props) {
  const { t } = useA11y()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [name, setName] = useState(defaultName ?? '')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (rating < 1) { setError('Please select a star rating.'); return }
    if (!name.trim()) { setError('Please enter your name.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_number: caseNumber, name: name.trim(), rating, comment: comment.trim() }),
      })
      const envelope = await res.json()
      if (!res.ok || !envelope.success) throw new Error(envelope.error || 'Could not submit feedback')
      setSubmitted(true)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', borderColor: 'rgba(30,142,62,.25)', background: 'var(--green-soft)' }}>
        <div className="submitted-circle" style={{ margin: '0 auto 14px' }}><Ico.check /></div>
        <div style={{ fontWeight: 800, color: 'var(--green)' }}>{t('Thank you for your feedback!')}</div>
        <div className="ar muted" style={{ fontSize: 14, marginTop: 4 }}>شكراً لتقييمك — تم استلام ملاحظاتك</div>
      </div>
    )
  }

  return (
    <div className="card card-pad">
      <div className="data-head"><span className="dot" /><span>{t('Rate your experience')}</span><span className="ar">/ قيّم تجربتك</span></div>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{t('Your feedback helps us improve the service.')}</p>

      <div className="feedback-stars-row" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={'feedback-star' + ((hover || rating) >= n ? ' active' : '')}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </span>
        ))}
        {rating > 0 && <span className="muted" style={{ fontSize: 15, alignSelf: 'center' }}>{rating}/5</span>}
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>{t('Your name')} / الاسم</label>
        <input type="text" className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t('Your name')} />
      </div>
      <div className="field">
        <label>{t('Comments (optional)')} / ملاحظات</label>
        <textarea className="input" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Tell us about your experience…')} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13.5, marginTop: 12 }}>⚠ {error}</p>}

      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={submit} disabled={submitting}>
        {submitting ? t('Submitting…') : t('Submit Feedback')}
      </button>
    </div>
  )
}
