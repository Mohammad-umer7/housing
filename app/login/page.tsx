'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Emblem, Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'
import Onboarding from '@/components/Onboarding'

type Modal = null | 'uaepass' | 'officer' | 'admin' | 'whatis'

type Applicant = {
  case_number: string
  full_name: string
  full_name_ar: string | null
}

export default function LoginPage() {
  const router = useRouter()
  const { t, update, lang } = useA11y()
  const [activeModal, setActiveModal] = useState<Modal>(null)
  const [citId, setCitId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [offUser, setOffUser] = useState('')
  const [offPass, setOffPass] = useState('')
  const [busy, setBusy] = useState(false)

  // UAE PASS applicant picker
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [pickSearch, setPickSearch] = useState('')
  const [pickLoading, setPickLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeModal !== 'uaepass') return
    fetchApplicants('')
  }, [activeModal])

  async function fetchApplicants(q: string) {
    setPickLoading(true)
    try {
      const res = await fetch(`/api/auth/demo-applicants?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setApplicants(json.success ? json.data : [])
    } catch {
      setApplicants([])
    } finally {
      setPickLoading(false)
    }
  }

  function onSearchChange(val: string) {
    setPickSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchApplicants(val), 300)
  }

  function pickApplicant(a: Applicant) {
    setCitId(a.case_number)
  }

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
      const login = await fetch('/api/auth/demo-login', { method: 'POST' })
      if (!login.ok) {
        setErrorMsg('Sign-in is unavailable right now. Please try again.')
        setBusy(false)
        return
      }
      const res = await fetch(`/api/v1/cases/lookup?caseNumber=${encodeURIComponent(cleanId)}`)
      const env = await res.json()
      if (!res.ok || !env.success) {
        setErrorMsg('Application ID not found. Please enter a valid ID (e.g. MSZHP_111325).')
        setBusy(false)
        return
      }
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

  async function performLogin(role: 'officer' | 'admin') {
    setBusy(true)
    setErrorMsg('')
    try {
      const username = role === 'officer' ? 'officer' : 'admin'
      const password = 'saddad-2026'
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Invalid credentials.')
        setBusy(false)
        return
      }
      sessionStorage.setItem('saddad_logged_in', 'true')
      router.push(role === 'admin' ? '/admin' : '/officer')
      router.refresh()
    } catch {
      setErrorMsg('Could not reach the sign-in service.')
      setBusy(false)
    }
  }

  return (
    <div className="login-container fade-in">
      <Onboarding />
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
        {errorMsg && !activeModal && (
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid rgba(200, 16, 46, 0.15)', marginTop: 16, maxWidth: 320, textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}
      </div>

      <div className="staff-btn-row">
        <button className="officer-btn" onClick={() => performLogin('officer')} disabled={busy}>
          {busy ? t('Logging in…') : t('Continue as an Officer')}
        </button>
        <button className="officer-btn" onClick={() => performLogin('admin')} disabled={busy}>
          {busy ? t('Logging in…') : t('Continue as an Admin')}
        </button>
      </div>

      {/* UAE PASS LOGIN MODAL */}
      {activeModal === 'uaepass' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95vw' }}>
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
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. MSZHP_111325"
                  value={citId}
                  onChange={(e) => setCitId(e.target.value)}
                />
              </div>

              {/* Demo applicant picker */}
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--body)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Demo accounts — click to select
                </p>
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by ID or name…"
                    value={pickSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: 13 }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)' }}>
                  {pickLoading ? (
                    <p style={{ padding: '12px 14px', fontSize: 13, color: 'var(--body)', opacity: 0.5, margin: 0 }}>Loading…</p>
                  ) : applicants.length === 0 ? (
                    <p style={{ padding: '12px 14px', fontSize: 13, color: 'var(--body)', opacity: 0.5, margin: 0 }}>No results found.</p>
                  ) : (
                    applicants.map((a) => (
                      <button
                        key={a.case_number}
                        type="button"
                        onClick={() => pickApplicant(a)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '9px 14px',
                          background: citId === a.case_number ? 'rgba(194,161,78,0.10)' : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ink-navy)', fontWeight: 700, flexShrink: 0 }}>
                          {a.case_number}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'right' }}>
                          {a.full_name}{a.full_name_ar ? ` · ${a.full_name_ar}` : ''}
                        </span>
                        {citId === a.case_number && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dark)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        )}
                      </button>
                    ))
                  )}
                </div>
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
