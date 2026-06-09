'use client'

// Floating SADDAD AI Assistant — wired to /api/assistant/chat (grounded in SZHP
// programme knowledge + the live rule constants). Role-aware: the citizen,
// officer and admin portals each get their own tone, quick prompts and an
// isolated per-role chat history. On a staff case-detail page the case ID is
// attached automatically so the assistant can answer case-specific questions.

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useA11y } from '@/components/AccessibilityProvider'

type Msg = { role: 'user' | 'assistant'; content: string }
type ChatRole = 'citizen' | 'officer' | 'admin'

// Extract a case number from a staff URL e.g. /admin/cases/MSZHP_100126 → MSZHP_100126
function caseFromPath(pathname: string): string | null {
  const m = pathname.match(/\/(?:cases|users)\/([A-Z0-9_-]+)/i)
  return m ? decodeURIComponent(m[1]) : null
}

export default function AssistantWidget() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // sessionStorage is read during state initialisation, so render the chat only
  // on the client (avoids a server/client hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // Not relevant on the sign-in screen.
  if (!mounted || pathname === '/login') return null

  const isAdmin = pathname.startsWith('/admin')
  const isOfficer = pathname.startsWith('/officer')
  const chatRole: ChatRole = isAdmin ? 'admin' : isOfficer ? 'officer' : 'citizen'

  // Staff on a case/user detail page → attach that case; citizens → their own App ID.
  const staffCase = (isAdmin || isOfficer) ? caseFromPath(pathname) : null
  const citizenCase = !isAdmin && !isOfficer ? sessionStorage.getItem('saddad_app_id') : null

  // Key by role + case so navigating between portals/cases fully remounts the
  // chat with the right persisted history (lazy state init — no setState-in-effect).
  return (
    <AssistantChat
      key={`${chatRole}:${staffCase ?? ''}`}
      chatRole={chatRole}
      staffCase={staffCase}
      citizenCase={citizenCase}
    />
  )
}

function AssistantChat({ chatRole, staffCase, citizenCase }: {
  chatRole: ChatRole
  staffCase: string | null
  citizenCase: string | null
}) {
  const { t } = useA11y()
  const isAdmin = chatRole === 'admin'
  const isOfficer = chatRole === 'officer'
  const storageKey = `saddad-chat-${chatRole}`
  const contextCaseNumber = staffCase ?? citizenCase

  const [open, setOpen] = useState(false)
  // On a specific case page start fresh so stale context isn't cited; otherwise
  // restore this role's persisted history.
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (staffCase) return []
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as Msg[]) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const persistMessages = useCallback((msgs: Msg[]) => {
    if (!staffCase) {
      try { sessionStorage.setItem(storageKey, JSON.stringify(msgs.slice(-60))) } catch { /* quota */ }
    }
    setMessages(msgs)
  }, [storageKey, staffCase])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const header = isAdmin
    ? { title: t('SADDAD Admin Assistant'), sub: staffCase ? `${t('Case')} ${staffCase}` : t('Programme stats & policy') }
    : isOfficer
      ? { title: t('SADDAD Officer Assistant'), sub: staffCase ? `${t('Case')} ${staffCase}` : t('Case reasoning & policy') }
      : { title: t('SADDAD Assistant'), sub: citizenCase ? `${t('Tracking')} ${citizenCase}` : t('Ask about housing arrears rescheduling') }

  const quick = isAdmin
    ? staffCase
      ? [`${t('Summarise case')} ${staffCase}`, t('What is the AI decision rationale?'), t('Is this case compliant?')]
      : [t('How many cases were approved?'), t('What is the current queue size?'), t('Explain the 20% deduction rule'), t('What are the hardship thresholds?')]
    : isOfficer
      ? staffCase
        ? [`${t('Summarise case')} ${staffCase}`, t('Is the proposed plan within the 20% ceiling?'), t('What are the risk flags?')]
        : [t('When must a case be referred?'), t('What makes a plan compliant?'), t('Explain the priority escalation criteria')]
      : citizenCase
        ? [t('What is the status of my case?'), t('What documents do I need?'), t('How long does a decision take?')]
        : [t('What is arrears rescheduling?'), t('Am I eligible?'), t('Which documents must I submit?')]

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const next = [...messages, { role: 'user', content: trimmed } as Msg]
    persistMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: next,
          audience: chatRole,
          ...(contextCaseNumber ? { caseNumber: contextCaseNumber } : {}),
        }),
      })
      const json = await res.json()
      const reply =
        res.ok && json?.success
          ? String(json.data?.reply ?? '')
          : json?.error || t('Sorry, I could not respond right now. Please try again.')
      persistMessages([...next, { role: 'assistant', content: reply }])
    } catch {
      persistMessages([...next, { role: 'assistant', content: t('I could not reach the assistant service. Please check your connection and try again.') }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && (
        <button className="assistant-fab" onClick={() => setOpen(true)} aria-label={t('Open the SADDAD assistant')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="26" height="26">
            <path d="M21 12a8 8 0 0 1-8 8H4l2.4-2.4A8 8 0 1 1 21 12z" />
            <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {open && (
        <div className="assistant-panel fade-in" role="dialog" aria-label={t('SADDAD assistant')}>
          <div className="assistant-hd">
            <div className="assistant-hd-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="18" height="18">
                <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
                <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
              </svg>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="assistant-title">{header.title}</div>
              <div className="assistant-sub">{header.sub}</div>
            </div>
            {messages.length > 0 && (
              <button className="assistant-clear" onClick={() => { persistMessages([]); try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ } }} title={t('Clear chat history')}>
                {t('Clear')}
              </button>
            )}
            <button className="assistant-close" onClick={() => setOpen(false)} aria-label={t('Close assistant')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={scrollRef} className="assistant-log" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                {t('Ask anything about Sheikh Zayed Housing Programme arrears rescheduling — eligibility, required documents, the rules, or your case.')}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={'assistant-bubble' + (m.role === 'user' ? ' user' : '')}>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="assistant-bubble" style={{ color: 'var(--muted)' }}>{t('Thinking…', 'جارٍ التفكير…')}</div>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="assistant-quick">
              {quick.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={sending}>{q}</button>
              ))}
            </div>
          )}

          <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Type your message…', 'اكتب رسالتك…')}
              aria-label={t('Message the assistant')}
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label={t('Send message')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
