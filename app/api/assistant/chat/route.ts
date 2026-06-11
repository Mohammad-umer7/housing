import { NextRequest, NextResponse } from 'next/server'
import { runAssistant, type ChatMessage } from '@/lib/assistant/chat'
import type { AssistantCaseContext, AssistantStatsContext, AudiencePortal } from '@/lib/assistant/knowledge'
import { readSessionFromCookieHeader } from '@/lib/auth/session'
import { getLatestCaseForBaseAppId, getJobStatus, getCaseStats, getSystemSetting } from '@/lib/data-layer'
import { getApplicant } from '@/lib/integrations/source-systems'
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
    // For the citizen, resolve their identity from the beneficiary registry so the
    // assistant greets them by name and never asks for an Application ID it already
    // holds — even before they have submitted a rescheduling request. Officer/admin
    // tones are deliberately left unchanged (no identity lookup, same context shape).
    let fullName: string | null = null
    if (audience === 'citizen') {
      try {
        const applicant = await getApplicant(authorizedCaseNumber)
        fullName = (applicant as { full_name?: string | null } | null)?.full_name ?? null
      } catch (err) {
        console.error('[assistant] applicant lookup failed:', err)
      }
    }
    try {
      // Resolve to the LATEST submission: citizens track the base Application ID,
      // but every re-submission is its own "-rN" case — answering from the base
      // row would describe a stale, superseded decision.
      const caseRow = await getLatestCaseForBaseAppId(authorizedCaseNumber)
      const latestCaseNumber = caseRow ? String(caseRow.case_number) : authorizedCaseNumber
      const job = await getJobStatus(latestCaseNumber)
      if (caseRow) {
        const status = String(caseRow.status ?? '')
        const terminal = TERMINAL.includes(status)
        const cs = (caseRow.case_study && typeof caseRow.case_study === 'object'
          ? caseRow.case_study : null) as Record<string, unknown> | null
        const vr = (caseRow.verification_report && typeof caseRow.verification_report === 'object'
          ? caseRow.verification_report : null) as Record<string, unknown> | null
        const pendingDoc = cs?.pendingSupportingDoc as { label?: string } | null
        caseContext = {
          caseNumber: latestCaseNumber,
          fullName,
          status: job?.status ?? status ?? null,
          decision: terminal ? status : null,
          monthlyPayment: terminal ? (caseRow.monthly_payment as number | null) ?? null : null,
          durationMonths: terminal ? (caseRow.duration_months as number | null) ?? null : null,
          rationale: terminal ? (caseRow.decision_reason as string | null) ?? null : null,
          totalNewMonthly: terminal ? (caseRow.total_new_monthly_payment as number | null) ?? null : null,
          recommendation: terminal && cs?.recommendation ? String(cs.recommendation) : null,
          riskLevel: terminal && caseRow.risk_level ? String(caseRow.risk_level) : null,
          verificationVerdict: terminal && vr?.verdict ? String(vr.verdict) : null,
          reschedulingPathLabel: terminal && cs?.reschedulingPathLabel ? String(cs.reschedulingPathLabel) : null,
          pendingDocument: pendingDoc?.label ? String(pendingDoc.label) : null,
        }
      } else {
        // A known beneficiary with no case row simply has not applied yet — say so
        // plainly instead of "not found", which reads as an error to the model.
        caseContext = {
          caseNumber: authorizedCaseNumber,
          fullName,
          status: fullName ? 'no rescheduling request submitted yet' : 'not found',
        }
      }
    } catch (err) {
      console.error('[assistant] case lookup failed:', err)
      // Keep the resolved identity even if the case/job lookup failed.
      if (fullName) caseContext = { caseNumber: authorizedCaseNumber, fullName, status: null }
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
