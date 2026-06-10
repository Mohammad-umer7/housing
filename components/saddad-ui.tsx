'use client'

// Shared MOEI design-system primitives, ported verbatim from the approved SADDAD design
// (Ico icon set, Emblem crest, GovHeader/GovFooter, DataHead, Field). Presentational only.

import React from 'react'
import Image from 'next/image'
import { useTTS } from '@/lib/tts'
import { useA11y } from '@/components/AccessibilityProvider'

// SADDAD / MOEI brand mark. Source PNG is 596×654; keep that ratio so headers and the
// login crest never distort it. Served from public/agent-logo.png.
const LOGO_RATIO = 596 / 654

type SVGP = React.SVGProps<SVGSVGElement>

export const Ico = {
  submit: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6M9 17h4" /></svg>,
  bolt: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg>,
  chart: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>,
  shield: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" /></svg>,
  logout: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>,
  user: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>,
  access: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="4" r="1.6" /><path d="M5 8h14M12 8v6M12 14l-3 6M12 14l3 6" /></svg>,
  gear: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.38 1.08V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.38H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .38-1.08V3a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 0 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.22.38.58.74 1 1 .32.18.68.28 1.08.28H21a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15z" /></svg>,
  globe: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>,
  search: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  speaker: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a3 3 0 0 1 0 6" /></svg>,
  chevR: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" {...p}><path d="M9 5l7 7-7 7" /></svg>,
  qr: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v.01M17 20h.01M20 17v4" /></svg>,
  share: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>,
  bookmark: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M6 3h12v18l-6-4-6 4V3z" /></svg>,
  print: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>,
  check: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...p}><path d="M5 12l5 5L20 6" /></svg>,
  checkC: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>,
  xC: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>,
  users: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 3-5.5 6-5.5s6 2 6 5.5" /><path d="M16 5.2A3.5 3.5 0 0 1 16 12M21 20c0-2.6-1.6-4.4-3.6-5.1" /></svg>,
  clock: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  refresh: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>,
  building: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M4 21V5l8-3 8 3v16M4 21h16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" /></svg>,
  warn: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M12 3l9.5 16.5H2.5L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>,
  bell: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z" /><path d="M10.5 21a2 2 0 0 0 3 0" /></svg>,
  phone: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M5 4h3l2 5-2 1c1 2 3 4 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>,
  wa: (p: SVGP) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7L7 20.5A10 10 0 1 0 12 2zm5.3 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.2z" /></svg>,
  fb: (p: SVGP) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M14 9h3l.5-3H14V4.3c0-.9.3-1.5 1.6-1.5H17.5V.2C17.2.1 16.2 0 15 0c-2.5 0-4 1.5-4 4.2V6H8v3h3v9h3V9z" /></svg>,
  ig: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
  li: (p: SVGP) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21H17v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z" /></svg>,
  x: (p: SVGP) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M17.5 3h3l-6.6 7.5L21.5 21h-5.9l-4.3-5.6L6.3 21H3.3l7-8L2.7 3h6l3.9 5.2L17.5 3z" /></svg>,
  yt: (p: SVGP) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.6A3 3 0 0 0 2 8.2 31 31 0 0 0 2 12a31 31 0 0 0 .1 3.8 3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.1-3.8zM10 15V9l5.2 3L10 15z" /></svg>,
  home: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}><path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5" /></svg>,
  doc2: (p: SVGP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /></svg>,
}

// The SADDAD logo, rendered at a target pixel height. Width is derived from LOGO_RATIO so
// the mark keeps its aspect ratio; `priority` because it sits in the page chrome / above the fold.
export function BrandMark({ height = 30, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/agent-logo.png"
      alt="SADDAD — Ministry of Energy and Infrastructure"
      className={className}
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority
      style={{ height, width: 'auto' }}
    />
  )
}

// Login / landing crest. `transparent` keeps it bare (the login card already frames it in a
// gold ring); otherwise it gets the circular crest backing used elsewhere.
export function Emblem({ size = 54, transparent = false }: { size?: number; transparent?: boolean }) {
  if (transparent) return <BrandMark height={size} />
  return (
    <span className="crest-circle" style={{ width: size + 14, height: size + 14 }}>
      <BrandMark height={size} />
    </span>
  )
}

export type NavId = 'submit' | 'processing' | 'dashboard' | 'officer' | 'settings' | 'login'

// Government header + service nav. Tabs are filtered by role; onNav drives the parent's
// screen state (and 'login' triggers logout in the shell).
export function GovHeader({
  active,
  onNav,
  userRole = 'citizen',
}: {
  active: NavId
  onNav: (id: NavId) => void
  userRole?: 'citizen' | 'officer'
}) {
  const { t } = useA11y()
  const allTabs: { id: NavId; label: string; icon: (p: SVGP) => React.ReactElement; role: 'citizen' | 'officer' }[] = [
    { id: 'submit', label: t('Submit', 'إرسال'), icon: Ico.submit, role: 'citizen' },
    { id: 'processing', label: t('Processing', 'المعالجة'), icon: Ico.bolt, role: 'citizen' },
    { id: 'dashboard', label: t('Dashboard', 'لوحة المعلومات'), icon: Ico.chart, role: 'officer' },
    { id: 'officer', label: t('Officer View', 'الموظف'), icon: Ico.shield, role: 'officer' },
  ]
  const tabs = allTabs.filter((tab) => tab.role === userRole)
  return (
    <header>
      <div className="gov-rule" />
      <nav className="gov-nav">
        <div className="gov-nav-inner">
          <span className="gov-brand">
            <BrandMark height={30} />
            <span className="gov-brand-name">SADDAD<span className="ar"> · سدّد</span></span>
          </span>
          {tabs.map((tab) => {
            const I = tab.icon
            return (
              <button key={tab.id} className={'navlink' + (active === tab.id ? ' active' : '')} onClick={() => onNav(tab.id)}>
                <I /> {tab.label}
              </button>
            )
          })}
          <button className={'navlink nav-spacer' + (active === 'settings' ? ' active' : '')} onClick={() => onNav('settings')}>
            <Ico.gear /> {t('Settings', 'الإعدادات')}
          </button>
          <button className="navlink nav-logout" onClick={() => onNav('login')}>
            <Ico.logout /> {t('Logout', 'تسجيل الخروج')}
          </button>
        </div>
      </nav>
    </header>
  )
}

export function GovFooter() {
  const socials = [
    { label: 'Facebook', href: 'https://www.facebook.com/moeiuae/', icon: Ico.fb },
    { label: 'Instagram', href: 'https://www.instagram.com/moeiuae/?hl=en', icon: Ico.ig },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/moeiuae/?originalSubdomain=ae', icon: Ico.li },
    { label: 'X', href: 'https://twitter.com/MOEIUAE', icon: Ico.x },
    { label: 'YouTube', href: 'https://www.youtube.com/@MOEIUAE', icon: Ico.yt },
  ]

  return (
    <footer className="gov-foot">
      <div className="foot-bar">
        <div className="foot-bar-inner">
          <span>© 2026 Ministry of Energy and Infrastructure. All rights reserved.</span>
          <div className="foot-social">
            <span className="muted" style={{ fontWeight: 600 }}>Follow us on:</span>
            {socials.map((social) => {
              const Icon = social.icon
              return (
                <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`MOEI ${social.label}`}>
                  <Icon />
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}

// The two speaker glyphs read the English / Arabic label aloud (TTS), preserving the
// platform's read-aloud accessibility feature. speakEn/speakAr override what is spoken.
export function DataHead({
  en,
  ar,
  color,
  speakEn,
  speakAr,
}: {
  en: string
  ar?: string
  color?: string
  speakEn?: string
  speakAr?: string
}) {
  const { speak, activeText, enabled } = useTTS()
  const enText = speakEn ?? en
  const arText = speakAr ?? ar
  return (
    <div className="data-head" style={color ? { color } : undefined}>
      <span className="dot" style={color ? { background: color } : undefined} />
      <span>{en}</span>
      {ar && <span className="ar">/ {ar}</span>}
      {enabled && (
        <span className="spk">
          <Ico.speaker
            onClick={() => speak(enText, 'en', true)}
            style={{ color: activeText === enText ? 'var(--red)' : undefined }}
            aria-label="Read aloud (English)"
          />
          {arText && (
            <Ico.speaker
              onClick={() => speak(arText, 'ar', true)}
              style={{ color: activeText === arText ? 'var(--red)' : undefined }}
              aria-label="استمع"
            />
          )}
        </span>
      )}
    </div>
  )
}

export function Field({
  label,
  ar,
  value,
  readOnly = true,
  placeholder,
  onChange,
}: {
  label: string
  ar?: string
  value?: string
  readOnly?: boolean
  placeholder?: string
  onChange?: (v: string) => void
}) {
  return (
    <div className="field">
      <label><span>{label}</span>{ar && <span className="ar">{ar}</span>}</label>
      <input
        className={'input' + (readOnly ? ' ro' : '')}
        value={value || ''}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  )
}
