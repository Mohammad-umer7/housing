'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Emblem, Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

// SADDAD sign-in (MOEI design). Citizens "sign in with UAE PASS" by entering their
// Application ID — we authenticate (demo session) and validate the ID against the real
// lookup, then carry it to the Submit wizard. Officers sign in with credentials.
// Production swaps the demo session for a real UAE PASS OIDC flow.
type Modal = null | 'uaepass' | 'officer' | 'whatis'

export default function LoginPage() {
  const router = useRouter()
  const { t, update, lang } = useA11y()
  const [activeModal, setActiveModal] = useState<Modal>(null)
  const [citId, setCitId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [offUser, setOffUser] = useState('')
  const [offPass, setOffPass] = useState('')
  const [busy, setBusy] = useState(false)

  function closeModal() {
    setActiveModal(null)
    setErrorMsg('')
  }

  async function handleCitSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanId = citId.trim()
    if (!cleanId) return
    setBusy(true)
    setErrorMsg('')
    try {
      // 1) Establish a session so the protected lookup/submit APIs work.
      const login = await fetch('/api/auth/demo-login', { method: 'POST' })
      if (!login.ok) {
        setErrorMsg('Sign-in is unavailable right now. Please try again.')
        setBusy(false)
        return
      }
      // 2) Validate the Application ID against the real Programme records.
      const res = await fetch(`/api/v1/cases/lookup?caseNumber=${encodeURIComponent(cleanId)}`)
      const env = await res.json()
      if (!res.ok || !env.success) {
        setErrorMsg('Application ID not found. Please enter a valid ID (e.g. MSZHP_111325).')
        setBusy(false)
        return
      }
      // 3) Carry the verified ID to the Submit wizard, which auto-loads the case.
      sessionStorage.setItem('saddad_prefill_appid', cleanId)
      sessionStorage.setItem('saddad_app_id', cleanId)
      sessionStorage.setItem('saddad_logged_in', 'true')
      router.push('/')
      router.refresh()
    } catch {
      setErrorMsg('Could not reach the sign-in service.')
      setBusy(false)
    }
  }

  async function handleOffSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: offUser.trim(), password: offPass }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Invalid credentials.')
        setBusy(false)
        return
      }
      sessionStorage.setItem('saddad_logged_in', 'true')
      router.push('/officer')
      router.refresh()
    } catch {
      setErrorMsg('Could not reach the sign-in service.')
      setBusy(false)
    }
  }

  return (
    <div className="login-container fade-in">
      <button className="login-lang" onClick={() => update({ lang: lang === 'ar' ? 'en' : 'ar' })}>
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>

      <div className="login-card">
        <div className="emblem-container">
          <Emblem size={52} transparent />
        </div>
        <span
          className="pill pill-gold"
          style={{ marginBottom: 16, border: '1px solid rgba(194, 161, 78, 0.25)', background: 'rgba(194, 161, 78, 0.08)', color: 'var(--gold-dark)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', fontWeight: 700 }}
        >
          Ministry of Energy &amp; Infrastructure
        </span>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 6, letterSpacing: '-0.5px' }}>SADDAD · سدّد</h1>
        <p style={{ color: 'var(--body)', opacity: 0.85, fontSize: 13.5, marginBottom: 32, maxWidth: '280px', marginInline: 'auto', lineHeight: 1.4 }}>
          {t('For a personalised experience, please sign in.')}
        </p>

        <button className="uaepass-btn" onClick={() => setActiveModal('uaepass')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M12 2c-5.5 0-10 4.5-10 10c0 .9.1 1.9.4 2.8" stroke="#E03020" />
            <path d="M5.5 10c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="#1E8E3E" />
            <path d="M8.5 12c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5v2" stroke="#1C2733" />
            <path d="M11.5 16.5c0 .3.2.5.5.5s.5-.2.5-.5v-2" stroke="#1C2733" />
            <path d="M12 6a6 6 0 0 0-6 6c0 1 .3 2 .7 2.8" stroke="#1E8E3E" />
            <path d="M18.3 12c0 3.5-2.8 6.3-6.3 6.3c-.9 0-1.7-.2-2.5-.6" stroke="#E03020" />
          </svg>
          {t('Sign in with UAE PASS')}
        </button>

        <a className="what-is-link" onClick={() => setActiveModal('whatis')}>
          {t('What is UAE PASS?')}
        </a>
      </div>

      <button className="officer-btn" onClick={() => setActiveModal('officer')}>
        {t('Continue as an Officer')}
      </button>

      {/* UAE PASS LOGIN MODAL */}
      {activeModal === 'uaepass' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div className="modal-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <path d="M12 2a10 10 0 0 0-10 10c0 1.2.2 2.4.6 3.4" stroke="#E03020" />
                <path d="M5.5 10c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="#1E8E3E" />
                <path d="M8.5 12c0-1.9 1.6-3.5 3.5-3.5" stroke="#1C2733" />
              </svg>
              {t('Sign in with UAE PASS')}
            </div>
            <form className="modal-form" onSubmit={handleCitSubmit}>
              <div className="field">
                <label>{t('Application ID')} / رقم القضية</label>
                <input type="text" className="input" required placeholder="e.g. MSZHP_111325" value={citId} onChange={(e) => setCitId(e.target.value)} />
              </div>
              {errorMsg && (
                <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, background: 'var(--red-soft)', padding: '10px 14px', borderRadius: 'var(--r)', border: '1px solid rgba(200, 16, 46, 0.15)' }}>
                  {errorMsg}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-neutral" onClick={closeModal}>{t('Cancel')}</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#1C2733' }} disabled={busy}>
                  {busy ? t('Signing in…') : t('Sign In')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICER LOGIN MODAL */}
      {activeModal === 'officer' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div className="modal-title">
              <Ico.shield width={20} height={20} style={{ color: 'var(--gold)', marginRight: 8, flexShrink: 0 }} />
              {t('Officer Login')}
            </div>
            <form className="modal-form" onSubmit={handleOffSubmit}>
              <div className="field">
                <label>{t('Officer Username / ID')}</label>
                <input type="text" className="input" required placeholder="e.g. officer" value={offUser} onChange={(e) => setOffUser(e.target.value)} />
              </div>
              <div className="field">
                <label>{t('Password')}</label>
                <input type="password" className="input" required placeholder="••••••••" value={offPass} onChange={(e) => setOffPass(e.target.value)} />
              </div>
              {errorMsg && (
                <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, background: 'var(--red-soft)', padding: '10px 14px', borderRadius: 'var(--r)', border: '1px solid rgba(200, 16, 46, 0.15)' }}>
                  {errorMsg}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-neutral" onClick={closeModal}>{t('Cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('Logging in…') : t('Log In')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHAT IS UAE PASS MODAL */}
      {activeModal === 'whatis' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div className="modal-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <path d="M12 2a10 10 0 0 0-10 10c0 1.2.2 2.4.6 3.4" stroke="#E03020" />
                <path d="M5.5 10c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="#1E8E3E" />
              </svg>
              {t('What is UAE PASS?')}
            </div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>
                {t('UAE PASS is the first national digital identity for all citizens, residents, and visitors in the United Arab Emirates. It allows you to access various government and private sector services securely online, sign documents digitally, and verify your identity without needing physical visits.')}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" style={{ background: '#1C2733' }} onClick={closeModal}>{t('Got it')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
