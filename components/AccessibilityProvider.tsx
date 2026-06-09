'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AR } from '@/lib/i18n'

// All visual accessibility preferences, applied globally to the #a11y-root wrapper and
// persisted to localStorage. Font size uses zoom; spacing/dyslexia/hidden-images are CSS
// classes; saturation + colour-blindness compose into a single CSS filter.
export type ColorBlind = 'none' | 'gray' | 'blue' | 'green' | 'red'

export type Lang = 'en' | 'ar'

export type A11ySettings = {
  fontScale: number // index into [1, 1.12, 1.25]
  wordSpacing: number // 0 | 1 | 2
  letterSpacing: number // 0 | 1 | 2
  dyslexia: boolean
  saturation: number // index 0..4 (2 = normal)
  removeImages: boolean
  colorBlind: ColorBlind
  highContrast: boolean
  lang: Lang
}

const DEFAULTS: A11ySettings = {
  fontScale: 0,
  wordSpacing: 0,
  letterSpacing: 0,
  dyslexia: false,
  saturation: 2,
  removeImages: false,
  colorBlind: 'none',
  highContrast: false,
  lang: 'en',
}

export const FONT_LEVELS = [1, 1.12, 1.25]
export const SATURATION_LEVELS = [0, 0.6, 1, 1.5, 2]
export const LEVEL_LABELS = ['Normal', 'Large', 'X-Large']

type A11yContextType = {
  settings: A11ySettings
  update: (partial: Partial<A11ySettings>) => void
  reset: () => void
  lang: Lang
  t: (en: string, ar?: string) => string
}

const A11yContext = createContext<A11yContextType | undefined>(undefined)

function applySettings(s: A11ySettings) {
  const root = document.getElementById('a11y-root')
  const html = document.documentElement
  // High contrast + language/direction live on <html> so they cover the whole document.
  html.classList.toggle('high-contrast', s.highContrast)
  html.lang = s.lang
  html.dir = s.lang === 'ar' ? 'rtl' : 'ltr'
  if (!root) return
  root.classList.toggle('a11y-lang-ar', s.lang === 'ar')
  // Font size — zoom scales text + layout proportionally.
  ;(root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(FONT_LEVELS[s.fontScale] ?? 1)
  root.classList.toggle('a11y-word-1', s.wordSpacing === 1)
  root.classList.toggle('a11y-word-2', s.wordSpacing === 2)
  root.classList.toggle('a11y-letter-1', s.letterSpacing === 1)
  root.classList.toggle('a11y-letter-2', s.letterSpacing === 2)
  root.classList.toggle('a11y-dyslexia', s.dyslexia)
  root.classList.toggle('a11y-no-images', s.removeImages)
  const sat = SATURATION_LEVELS[s.saturation] ?? 1
  const cb = s.colorBlind !== 'none' ? ` url(#cb-${s.colorBlind})` : ''
  root.style.filter = `saturate(${sat})${cb}`.trim()
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  // Load persisted prefs on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('saddad-a11y')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) })
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  // Apply + persist whenever settings change (after the first load).
  useEffect(() => {
    if (!loaded) return
    applySettings(settings)
    try {
      localStorage.setItem('saddad-a11y', JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings, loaded])

  function update(partial: Partial<A11ySettings>) {
    setSettings((s) => ({ ...s, ...partial }))
  }
  function reset() {
    setSettings(DEFAULTS)
  }
  // Arabic comes from the repo-local dictionary (lib/i18n.ts). An optional inline `ar`
  // overrides the dictionary for one-off strings; otherwise we look the English up.
  const t = (en: string, ar?: string) => (settings.lang === 'ar' ? ar ?? AR[en] ?? en : en)

  return (
    <A11yContext.Provider value={{ settings, update, reset, lang: settings.lang, t }}>
      {children}
      <ColorBlindFilters />
    </A11yContext.Provider>
  )
}

export function useA11y() {
  const ctx = useContext(A11yContext)
  if (!ctx) throw new Error('useA11y must be used within an AccessibilityProvider')
  return ctx
}

// Hidden SVG colour-vision filters (standard simulation matrices) referenced by the
// #a11y-root filter as url(#cb-<type>).
function ColorBlindFilters() {
  return (
    <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {/* Red weakness (protanopia) */}
        <filter id="cb-red">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
        </filter>
        {/* Green weakness (deuteranopia) */}
        <filter id="cb-green">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.70 0.30 0 0 0  0 0.30 0.70 0 0  0 0 0 1 0" />
        </filter>
        {/* Blue weakness (tritanopia) */}
        <filter id="cb-blue">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
        </filter>
        {/* Gray weakness (achromatopsia) */}
        <filter id="cb-gray">
          <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" />
        </filter>
      </defs>
    </svg>
  )
}
