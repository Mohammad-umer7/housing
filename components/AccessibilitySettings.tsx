'use client'

// The accessibility & language preference panel — shared between the citizen
// Settings page (/settings) and the admin Settings → Accessibility tab.
// Extracted verbatim from app/settings/page.tsx; behaviour is unchanged.

import { useTTS } from '@/lib/tts'
import { useA11y, LEVEL_LABELS, type ColorBlind } from '@/components/AccessibilityProvider'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 52, height: 30, borderRadius: 999, border: '1px solid var(--line-strong)', flexShrink: 0, background: on ? 'var(--gold)' : 'var(--panel-alt)', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}
    >
      <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'inset-inline-start .2s' }} />
    </button>
  )
}

function Radio({ on }: { on: boolean }) {
  return (
    <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? 'var(--gold)' : 'var(--line-strong)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {on && <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--gold)' }} />}
    </span>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: '22px 18px',
  textAlign: 'center', cursor: 'pointer', minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
}
const cardTitle: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)' }
const cardValue: React.CSSProperties = { color: 'var(--blue)', fontWeight: 700, fontSize: 15 }

const SAT_DOTS = ['#9aa3ad', '#7e8a99', '#5f7390', '#39598f', '#0b3d91']

export default function AccessibilitySettings() {
  const { settings, update, reset, t } = useA11y()
  const { enabled: ttsEnabled, setEnabled: setTtsEnabled } = useTTS()

  const cycle = (n: number) => (n + 1) % 3
  const levelLabel = (i: number) => t(LEVEL_LABELS[i], ['عادي', 'كبير', 'كبير جدًا'][i] ?? 'عادي')

  const CB_OPTIONS: { id: ColorBlind; label: string; color: string }[] = [
    { id: 'gray', label: t('Gray Weakness', 'ضعف الرمادي'), color: '#4a4a4a' },
    { id: 'blue', label: t('Blue Weakness', 'ضعف الأزرق'), color: '#e87aa8' },
    { id: 'green', label: t('Green Weakness', 'ضعف الأخضر'), color: '#39598f' },
    { id: 'red', label: t('Red Weakness', 'ضعف الأحمر'), color: '#6ee0c0' },
  ]

  function resetAll() {
    reset()
    setTtsEnabled(true)
  }

  return (
    <div>
      {/* Language */}
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 14 }}>{t('Language', 'اللغة')}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {(['en', 'ar'] as const).map((l) => (
          <button
            key={l}
            onClick={() => update({ lang: l })}
            className={'btn ' + (settings.lang === l ? 'btn-primary' : 'btn-neutral')}
            style={{ flex: 1 }}
          >
            {l === 'en' ? 'English' : 'العربية'}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 18 }}>{t('Accessibilities', 'إمكانية الوصول')}</h2>

      {/* 2×2 cards */}
      <div className="resp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={cardStyle} onClick={() => update({ fontScale: cycle(settings.fontScale) })} role="button" tabIndex={0}>
          <div style={cardTitle}>{t('Font size', 'حجم الخط')}</div>
          <p style={{ color: 'var(--body)', fontSize: 14, lineHeight: 1.5 }}>{t('Here is an example of the font size that has been modified', 'هذا مثال على حجم الخط بعد التعديل')}</p>
          <div style={cardValue}>{levelLabel(settings.fontScale)}</div>
        </div>
        <div style={cardStyle} onClick={() => update({ wordSpacing: cycle(settings.wordSpacing) })} role="button" tabIndex={0}>
          <div style={cardTitle}>{t('Word spacing', 'تباعد الكلمات')}</div>
          <div style={{ color: 'var(--body)', fontSize: 18 }}>Aa&lt;--&gt;Aa</div>
          <div style={cardValue}>{levelLabel(settings.wordSpacing)}</div>
        </div>
        <div style={cardStyle} onClick={() => update({ letterSpacing: cycle(settings.letterSpacing) })} role="button" tabIndex={0}>
          <div style={cardTitle}>{t('Letter spacing', 'تباعد الحروف')}</div>
          <div style={{ color: 'var(--body)', fontSize: 18 }}>A&lt;-&gt;B</div>
          <div style={cardValue}>{levelLabel(settings.letterSpacing)}</div>
        </div>
        <div style={cardStyle} onClick={() => update({ dyslexia: !settings.dyslexia })} role="button" tabIndex={0}>
          <div style={{ ...cardTitle, fontSize: 19, lineHeight: 1.2 }}>{t('A font for people with dyslexia', 'خط لذوي عسر القراءة')}</div>
          <div style={{ color: 'var(--body)', fontSize: 14 }}>{settings.dyslexia ? t('An easy-to-read font', 'خط سهل القراءة') : t('Main font', 'الخط الرئيسي')}</div>
          <div style={cardValue}>{settings.dyslexia ? t('Readable', 'سهل القراءة') : 'Graphik Arabic'}</div>
        </div>
      </div>

      {/* Saturation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, padding: '14px 20px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--panel)' }}>
        <span style={{ fontWeight: 800, color: 'var(--ink-navy)', fontSize: 18, flex: 1 }}>{t('Saturation', 'التشبّع')}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {SAT_DOTS.map((c, i) => (
            <button key={i} aria-label={`${t('Saturation', 'التشبّع')} ${i + 1}`} onClick={() => update({ saturation: i })}
              style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: settings.saturation === i ? '3px solid var(--gold-dark)' : '2px solid transparent', boxShadow: settings.saturation === i ? '0 0 0 2px #fff inset' : 'none', cursor: 'pointer' }} />
          ))}
        </div>
      </div>

      {/* High contrast */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink-navy)' }}>{t('High Contrast', 'تباين عالٍ')}</div>
          <div className="muted" style={{ fontSize: 14 }}>{t('Maximise contrast for low-vision readers', 'زيادة التباين لضعاف البصر')}</div>
        </div>
        <Toggle on={settings.highContrast} onChange={(v) => update({ highContrast: v })} label={t('High Contrast', 'تباين عالٍ')} />
      </div>

      {/* Text-to-Speech */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink-navy)" strokeWidth="1.6" style={{ flexShrink: 0 }}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a3 3 0 0 1 0 6" /></svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink-navy)' }}>{t('Text-to-Speech', 'قراءة المحتوى')}</div>
          <div className="muted" style={{ fontSize: 14 }}>{t('Enable or disable reading screen content aloud', 'تفعيل أو إيقاف قراءة محتوى الشاشة')}</div>
        </div>
        <Toggle on={ttsEnabled} onChange={setTtsEnabled} label={t('Text-to-Speech', 'قراءة المحتوى')} />
      </div>

      {/* Remove images */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 18, color: 'var(--ink-navy)' }}>{t('Remove images in app', 'إخفاء الصور في التطبيق')}</div>
        <Toggle on={settings.removeImages} onChange={(v) => update({ removeImages: v })} label={t('Remove images in app', 'إخفاء الصور')} />
      </div>

      {/* Color blindness */}
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-navy)', margin: '28px 0 16px' }}>{t('Color blindness', 'عمى الألوان')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {CB_OPTIONS.map((o) => {
          const on = settings.colorBlind === o.id
          return (
            <button key={o.id} onClick={() => update({ colorBlind: on ? 'none' : o.id })}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: `1px solid ${on ? 'var(--gold-line)' : 'var(--line)'}`, borderRadius: 999, background: 'var(--panel)', cursor: 'pointer', textAlign: 'start' }}>
              <Radio on={on} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: 17, color: 'var(--ink-navy)' }}>{o.label}</span>
              <span style={{ width: 40, height: 40, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
            </button>
          )
        })}
      </div>

      {/* Reset */}
      <button className="btn btn-neutral btn-block" style={{ marginTop: 32, color: 'var(--red)', borderColor: 'rgba(200,16,46,.3)' }} onClick={resetAll}>
        {t('Reset to default', 'إعادة التعيين إلى الوضع الافتراضي')}
      </button>
    </div>
  )
}
