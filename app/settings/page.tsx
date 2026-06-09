'use client'

import { useRouter } from 'next/navigation'
import { useA11y } from '@/components/AccessibilityProvider'
import AccessibilitySettings from '@/components/AccessibilitySettings'

export default function SettingsPage() {
  const router = useRouter()
  const { t, lang } = useA11y()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
        <button
          onClick={() => router.back()} aria-label={t('Back', 'رجوع')}
          style={{ position: 'absolute', insetInlineStart: 20, width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line-strong)', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)' }}>{t('Settings', 'الإعدادات')}</h1>
      </div>

      <div className="wrap-narrow" style={{ padding: '28px 20px 60px' }}>
        <AccessibilitySettings />
      </div>
    </div>
  )
}
