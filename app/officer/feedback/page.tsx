'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

type Feedback = {
  id: string
  case_number: string | null
  name: string
  rating: number
  comment: string | null
  created_at: string
}
type Stats = { count: number; average: number }

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span style={{ color: 'var(--gold-bright)', fontSize: size, letterSpacing: 2 }}>
      {'★★★★★'.slice(0, n)}
      <span style={{ color: 'var(--line-strong)' }}>{'★★★★★'.slice(n)}</span>
    </span>
  )
}

export default function FeedbackPage() {
  const { t } = useA11y()
  const [items, setItems] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stats>({ count: 0, average: 0 })
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/feedback')
      const envelope = await res.json()
      setItems(envelope.data?.feedback ?? [])
      setStats(envelope.data?.stats ?? { count: 0, average: 0 })
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void (async () => { await load() })() }, [])

  return (
    <div className="page" style={{ background: 'var(--panel-alt)' }}>
      <div className="officer-top">
        <div className="gov-rule" />
        <div className="officer-top-inner">
          <div className="officer-brand"><Ico.shield /> {t('Officer Portal')}</div>
          <div className="internal-tag">{t('Internal Use Only')} <span className="ar">— وزارة الطاقة والبنية التحتية</span></div>
          <div className="officer-links">
            <Link href="/officer">← {t('Escalated Cases')}</Link>
            <Link href="/settings">{t('Settings')}</Link>
            <Link href="/">← {t('Back to SADDAD', 'العودة إلى سدّد')}</Link>
          </div>
        </div>
      </div>

      <div className="officer-body">
        <div className="officer-wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 26 }}>
            <div>
              <h2 style={{ fontSize: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.9"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" /></svg>
                {t('Citizen Feedback')}
              </h2>
              <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>{t('Ratings and comments submitted after a decision.')}</p>
            </div>
            <button className="btn btn-neutral" onClick={() => { setLoading(true); load() }}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
          </div>

          <div className="fb-summary">
            <div style={{ textAlign: 'center' }}>
              <div className="big">{stats.average.toFixed(1)}</div>
              <div className="fb-stars"><Stars n={Math.round(stats.average)} size={18} /></div>
              <div className="lbl">{t('average rating')}</div>
            </div>
            <div className="fb-divider" />
            <div style={{ textAlign: 'center' }}>
              <div className="big">{stats.count}</div>
              <div className="lbl" style={{ marginTop: 16 }}>{t('total responses')}</div>
            </div>
          </div>

          {loading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }}>{t('Loading feedback…', 'جارٍ تحميل الملاحظات…')}</div>
          ) : items.length === 0 ? (
            <div className="card card-pad" style={{ textAlign: 'center', padding: 64, marginTop: 18 }}>
              <p style={{ fontWeight: 700, color: 'var(--ink)' }}>{t('No feedback yet')}</p>
              <p className="muted" style={{ marginTop: 4 }}>Feedback submitted by citizens will appear here.</p>
            </div>
          ) : (
            items.map((f) => (
              <div className="fb-card" key={f.id}>
                <div className="top">
                  <div>
                    <div className="nm">{f.name} <Stars n={f.rating} size={15} /></div>
                    {f.case_number && <div className="cid">{f.case_number}</div>}
                  </div>
                  <div className="when">{f.created_at ? new Date(f.created_at).toLocaleString('en-AE') : ''}</div>
                </div>
                {f.comment && <div className="txt">{f.comment}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
