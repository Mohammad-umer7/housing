import { NextRequest, NextResponse } from 'next/server'
import { runAssistant, type ChatMessage } from '@/lib/assistant/chat'
import type { AssistantCaseContext, AssistantStatsContext, AudiencePortal } from '@/lib/assistant/knowledge'
import { readSessionFromCookieHeader } from '@/lib/auth/session'
import { getCaseByCaseNumber, getJobStatus, getCaseStats, getSystemSetting } from '@/lib/data-layer'
import { supabaseAdmin } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

const TERMINAL = ['approved', 'rejected', 'escalated']

// POST /api/assistant/chat  { messages: {role,content}[], caseNumber?: string, audience?: string }
// Anonymous users get general SZHP guidance. A logged-in session personalizes the
// answer. The admin audience is derived from the session role (never trusted from
// the client); citizen/officer come from the portal the widget is mounted on —
// in this deployment both use the same demo session role, so the body hint only
// selects between the two non-privileged tones. Admin-only stats stay role-gated.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(`assistant:${ip}`, 30)) {
    return NextResponse.json(errorResponse('Too many messages. Please wait a moment.', 429), { status: 429 })
  }

  let body: { messages?: ChatMessage[]; caseNumber?: string; audience?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResponse('Invalid request body', 400), { status: 400 })
  }

  // Resolve audience + the case this user is allowed to ask about.
  const session = await readSessionFromCookieHeader(req.headers.get('cookie'))
  let audience: AudiencePortal = 'citizen'
  let authorizedCaseNumber: string | null = null
  if (session) {
    if (session.caseNumber) {
      audience = 'citizen'
      authorizedCaseNumber = session.caseNumber // citizen persona: own case only
    } else if (session.role === 'admin') {
      audience = 'admin'
      authorizedCaseNumber = body.caseNumber?.trim() || null
    } else if (session.role === 'officer') {
      // Demo sessions are officer-role for both portals; the widget says which
      // portal it is mounted on. Only the two non-privileged tones are accepted.
      audience = body.audience === 'officer' ? 'officer' : 'citizen'
      authorizedCaseNumber = body.caseNumber?.trim() || null
    }
  }

  // Build case context from authorized records (best-effort — never blocks the reply).
  let caseContext: AssistantCaseContext | null = null
  if (authorizedCaseNumber) {
    try {
      const [caseRow, job] = await Promise.all([
        getCaseByCaseNumber(authorizedCaseNumber),
        getJobStatus(authorizedCaseNumber),
      ])
      if (caseRow) {
        const terminal = TERMINAL.includes(caseRow.status)
        caseContext = {
          caseNumber: authorizedCaseNumber,
          status: job?.status ?? caseRow.status ?? null,
          decision: terminal ? caseRow.status : null,
          monthlyPayment: terminal ? caseRow.monthly_payment ?? null : null,
          durationMonths: terminal ? caseRow.duration_months ?? null : null,
          rationale: terminal ? caseRow.decision_reason ?? null : null,
        }
      } else {
        caseContext = { caseNumber: authorizedCaseNumber, status: 'not found' }
      }
    } catch (err) {
      console.error('[assistant] case lookup failed:', err)
    }
  }

  // Admin gets live programme stats so they can ask "how many cases were approved?" etc.
  // Officer + citizen do not get aggregate stats (privacy / relevance).
  let stats: AssistantStatsContext | null = null
  if (audience === 'admin') {
    try {
      const raw = await getCaseStats()
      const { data } = await supabaseAdmin
        .from('cases')
        .select('status')
        .in('status', ['pending', 'processing', 'queued'])
      stats = { ...raw, pending: (data ?? []).length }
    } catch { /* stats are best-effort */ }
  }

  // Load admin-configured custom instructions for this audience role (fail-open).
  let customInstructions: string | null = null
  try {
    customInstructions = await getSystemSetting(`assistant_${audience}_instructions`)
  } catch { /* use defaults */ }

  const { reply, source } = await runAssistant({ messages: body.messages ?? [], audience, caseContext, customInstructions, stats })
  return NextResponse.json(successResponse({ reply, source }))
}
