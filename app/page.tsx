'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SubmissionForm from '@/components/SubmissionForm'
import AgentProcessing from '@/components/AgentProcessing'
import CitizenHome from '@/components/CitizenHome'
import { GovHeader, GovFooter, type NavId } from '@/components/saddad-ui'

type Screen = 'home' | 'form' | 'processing'
const SCREENS: Screen[] = ['home', 'form', 'processing']

export default function Home() {
  const router = useRouter()
  const [booted, setBooted] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [appId, setAppId] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [homeKey, setHomeKey] = useState(0)

  // Boot: require a UAE PASS sign-in (which sets the profile App ID). Restore the last
  // screen + form data from the session, so a page refresh — or returning from Settings —
  // keeps the user exactly where they were instead of dropping them back on the home page.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = typeof window !== 'undefined' ? sessionStorage.getItem('saddad_app_id') || '' : ''
      if (!id) { router.replace('/login'); return }
      let s: Screen = 'home'
      let fd: Record<string, string> = {}
      try {
        const raw = sessionStorage.getItem('saddad-session')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (SCREENS.includes(parsed.screen)) s = parsed.screen
          if (parsed.formData && typeof parsed.formData === 'object') fd = parsed.formData
        }
      } catch { /* ignore */ }
      if (cancelled) return
      setAppId(id)
      setFormData(fd)
      setScreen(s)
      setBooted(true)
    })()
    return () => { cancelled = true }
  }, [router])

  // Persist the active screen + submitted form data so refresh / Settings round-trips resume.
  useEffect(() => {
    if (!booted || typeof window === 'undefined') return
    try { sessionStorage.setItem('saddad-session', JSON.stringify({ screen, formData })) } catch { /* ignore */ }
  }, [screen, formData, booted])

  function handleFormSubmit(data: Record<string, string>) {
    if (typeof window !== 'undefined') sessionStorage.removeItem('saddad-wizard-state')
    setFormData(data)
    setScreen('processing')
  }
  function goHome() {
    if (typeof window !== 'undefined') sessionStorage.removeItem('saddad-wizard-state')
    setHomeKey((k) => k + 1)
    setScreen('home')
  }
  function startNewApplication() {
    if (typeof window !== 'undefined') {
      if (appId) sessionStorage.setItem('saddad_prefill_appid', appId)
      sessionStorage.removeItem('saddad-wizard-state')
    }
    setScreen('form')
  }
  // Re-submission from a case card. 'docs' opens the wizard at the Documents step.
  function resubmit(mode: 'docs' | 'reapply') {
    if (typeof window !== 'undefined') {
      if (appId) sessionStorage.setItem('saddad_prefill_appid', appId)
      if (mode === 'docs') sessionStorage.setItem('saddad_resubmit_mode', 'docs')
      sessionStorage.removeItem('saddad-wizard-state')
    }
    setScreen('form')
  }
  function viewProgress(caseNumber: string, fullName = '') {
    setFormData({ case_number: caseNumber, full_name: fullName })
    setScreen('processing')
  }
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('saddad_app_id')
      sessionStorage.removeItem('saddad_logged_in')
      sessionStorage.removeItem('saddad-session')
      sessionStorage.removeItem('saddad-wizard-state')
    }
    router.push('/login')
    router.refresh()
  }
  function handleNav(id: NavId) {
    if (id === 'login') { handleLogout(); return }
    if (id === 'settings') { router.push('/settings'); return }
    if (id === 'submit') goHome()
    if (id === 'processing' && formData.case_number) setScreen('processing')
  }

  if (!booted) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Loading SADDAD…</span>
      </div>
    )
  }

  return (
    <div className="page">
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <GovHeader active={(screen === 'processing' ? 'processing' : 'submit') as NavId} onNav={handleNav} userRole="citizen" />
      <main id="main-content" className="page-body">
        {screen === 'home' && (
          <CitizenHome key={homeKey} appId={appId} onNewApplication={startNewApplication} onResubmit={resubmit} onViewProgress={viewProgress} />
        )}
        {screen === 'form' && <SubmissionForm onSubmit={handleFormSubmit} onHome={goHome} />}
        {/* Key by case number so switching cases fully remounts — never shows a prior case's data. */}
        {screen === 'processing' && <AgentProcessing key={formData.case_number || 'proc'} formData={formData} onReset={goHome} />}
      </main>
      <GovFooter />
    </div>
  )
}
