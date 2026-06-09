'use client'

// Admin Citizen-Sentiment Monitor — aggregate satisfaction score, rating
// distribution, badge filters and CSV export over all post-decision feedback.
// Ports the source admin feedback page onto the MOEI design system.

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

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span style={{ color: 'var(--gold-bright)', fontSize: size, letterSpacing: 2 }}>
      {'★★★★★'.slice(0, n)}
      <span style={{ color: 'var(--line-strong)' }}>{'★★★★★'.slice(n)}</span>
    </span>
  )
}

export default function AdminFeedbackPage() {
  const { t } = useA11y()
  const [items, setItems] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stats>({ count: 0, average: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<number | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/feedback', { credentials: 'include' })
      const envelope = await res.json()
      if (!res.ok || !envelope.success) throw new Error(envelope.error || `Could not load feedback (${res.status}).`)
      setItems(envelope.data?.feedback ?? [])
      setStats(envelope.data?.stats ?? { count: 0, average: 0 })
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void (async () => { await load() })() }, [])

  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({ rating: r, count: items.filter(f => f.rating === r).length }))
  const displayed = filter ? items.filter(f => f.rating === filter) : items

  function exportCSV() {
    const rows = [
      ['Date', 'Name', 'Case Number', 'Rating', 'Comment'],
      ...items.map(f => [
        f.created_at ? new Date(f.created_at).toLocaleString('en-AE') : '',
        f.name,
        f.case_number ?? '',
        String(f.rating),
        (f.comment ?? '').replace(/,/g, ';'),
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="fade-in">
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span><span className="cur">{t('Feedback')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <div>
          <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SADDAD · {t('Citizen Sentiment', 'رضا المتعاملين')}</div>
          <h2 style={{ fontSize: 34 }}>{t('Citizen Feedback', 'ملاحظات المواطنين')}</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>{t('All ratings and comments submitted after a decision.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {items.length > 0 && (
            <button className="btn btn-neutral" onClick={exportCSV}><Ico.share width={15} height={15} /> {t('Export CSV')}</button>
          )}
          <button className="btn btn-neutral" onClick={() => { setLoading(true); void load() }} disabled={loading}><Ico.refresh width={16} height={16} /> {t('Refresh')}</button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && !loadError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 18, marginBottom: 22 }}>
          <div className="card card-pad">
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Average Rating')}</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, marginTop: 6 }}>
              {stats.average.toFixed(1)}
              <span style={{ fontSize: 16, marginInlineStart: 8, color: stats.average >= 4 ? 'var(--green)' : stats.average >= 3 ? 'var(--muted)' : 'var(--red)' }}>
                {stats.average >= 4 ? '▲' : stats.average >= 3 ? '–' : '▼'}
              </span>
            </div>
            <div style={{ marginTop: 6 }}><Stars n={Math.round(stats.average)} size={17} /></div>
          </div>
          <div className="card card-pad">
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Total Responses')}</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, marginTop: 6 }}>{stats.count}</div>
            <div className="muted" style={{ fontSize: 13 }}>{t('from citizens', 'من المواطنين')}</div>
          </div>
          <div className="card card-pad">
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{t('Distribution')}</div>
            {ratingCounts.map(rc => {
              const pct = stats.count > 0 ? (rc.count / stats.count) * 100 : 0
              return (
                <div key={rc.rating} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 5 }}>
                  <span className="muted" style={{ width: 12, textAlign: 'right' }}>{rc.rating}</span>
                  <span style={{ color: 'var(--gold-bright)', fontSize: 11 }}>★</span>
                  <div style={{ flex: 1, height: 7, background: 'var(--panel-alt)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 999, transition: 'width .5s' }} />
                  </div>
                  <span className="muted mono" style={{ width: 24, textAlign: 'right' }}>{rc.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rating filter */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 13.5 }}>{t('Filter by rating')}:</span>
          <button onClick={() => setFilter(null)} className={'pill ' + (filter === null ? 'pill-gold' : 'pill-gray')} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
            {t('All')} ({items.length})
          </button>
          {[5, 4, 3, 2, 1].map(r => {
            const c = items.filter(f => f.rating === r).length
            if (!c) return null
            return (
              <button key={r} onClick={() => setFilter(filter === r ? null : r)}
                className={'pill ' + (filter === r ? 'pill-gold' : 'pill-gray')} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                ★ {r} ({c})
              </button>
            )
          })}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }} aria-live="polite">{t('Loading feedback…', 'جارٍ تحميل الملاحظات…')}</div>
      ) : loadError ? (
        <div className="notice" style={{ borderColor: 'rgba(200,16,46,.2)', background: 'var(--red-soft)' }}>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{loadError}</p></div>
          <button className="btn btn-neutral" onClick={() => { setLoading(true); void load() }}><Ico.refresh width={15} height={15} /> {t('Try again')}</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 64 }}>
          <p style={{ fontWeight: 700, color: 'var(--ink)' }}>{filter ? `${t('No')} ${filter}-${t('star feedback')}` : t('No feedback yet')}</p>
          <p className="muted" style={{ marginTop: 4 }}>{filter ? t('Try a different filter.') : t('Feedback submitted by citizens after a decision will appear here.')}</p>
        </div>
      ) : (
        displayed.map((f) => {
          const sentiment = f.rating >= 4 ? { label: t('Positive'), cls: 'pill-green' } : f.rating >= 3 ? { label: t('Neutral'), cls: 'pill-amber' } : { label: t('Negative'), cls: 'pill-red' }
          return (
            <div className="fb-card" key={f.id}>
              <div className="top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gold-tint)', border: '1px solid var(--gold-line)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--gold-dark)', flexShrink: 0 }}>
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="nm">{f.name} <Stars n={f.rating} size={14} /></div>
                    {f.case_number && <div className="cid">{f.case_number}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={'pill ' + sentiment.cls}>{sentiment.label}</span>
                  <div className="when">{f.created_at ? new Date(f.created_at).toLocaleString('en-AE') : ''}</div>
                </div>
              </div>
              {f.comment && <div className="txt">{f.comment}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}
