import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  upsertCaseDecision,
  createAuditLog,
  getCaseByCaseNumber,
  getAgentSteps,
  getAuditLogsByCaseNumber,
} from '@/lib/data-layer'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyApplicant } from '@/tools/notification-tools'

// GET /api/officer/cases/[caseNumber] — full case detail for officer/admin
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  try {
    await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { caseNumber } = await params

    const { data: caseRow } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('case_number', caseNumber)
      .maybeSingle()

    if (!caseRow) {
      return NextResponse.json(errorResponse('Case not found', 404), { status: 404 })
    }

    const [agentSteps, auditLogs] = await Promise.all([
      getAgentSteps(caseNumber),
      getAuditLogsByCaseNumber(caseNumber),
    ])

    return NextResponse.json(
      successResponse({
        ...caseRow,
        agentSteps: (agentSteps as Record<string, unknown>[]).map(s => ({
          agentName: s.agent_name,
          status: s.status,
          durationMs: s.duration_ms ?? null,
          ranInParallel: s.ran_in_parallel ?? false,
          resultSummary: s.result_summary ?? '',
        })),
        auditLogs: (auditLogs as Record<string, unknown>[]).map(l => ({
          id: l.id,
          action: l.action,
          decision: l.decision,
          rationale: l.rationale,
          processedBy: l.processed_by,
          timestamp: l.timestamp,
          ruleTriggered: l.rule_triggered,
        })),
      })
    )
  } catch (error) {
    console.error('[officer/cases/GET]', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}

// PATCH /api/officer/cases/[caseNumber] — officer approve / reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  let consumer
  try {
    consumer = await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { caseNumber } = await params
    const body = await req.json()
    const { action, officerNotes, requestedDocuments } = body as {
      action?: string
      officerNotes?: string
      requestedDocuments?: string
    }

    if (!action || !['APPROVE', 'REJECT', 'REQUEST_DOCS'].includes(action)) {
      return NextResponse.json(
        errorResponse('action must be APPROVE, REJECT or REQUEST_DOCS', 400),
        { status: 400 },
      )
    }

    const caseRecord = await getCaseByCaseNumber(caseNumber)
    if (!caseRecord) {
      return NextResponse.json(errorResponse('Case not found', 404), { status: 404 })
    }
    const rec = caseRecord as Record<string, unknown>
    const phone = rec.phone as string | undefined
    const baseCaseNumber = caseNumber.replace(/-r\d+$/i, '')

    // ── REQUEST_DOCS — ask the citizen for additional documents ──────────────────
    // Reuses the existing "Request Documents" recommendation so the citizen's home shows
    // the "Submit Documents" re-upload CTA and the re-submission gate lets them back in.
    // The case drops out of the officer's pending queue (filtered in the list route) and
    // re-enters automatically when the citizen resubmits (a fresh -rN case is processed).
    if (action === 'REQUEST_DOCS') {
      const docsAsked = (requestedDocuments ?? '').trim()
      const officerRationale =
        `Officer ${consumer.name} requested additional documents.` +
        (docsAsked ? ` Requested: ${docsAsked}.` : '') +
        (officerNotes?.trim() ? ` Notes: ${officerNotes.trim()}.` : '')

      // Merge the recommendation into the existing case_study (keep the AI assessment).
      const existingStudy =
        rec.case_study && typeof rec.case_study === 'object'
          ? (rec.case_study as Record<string, unknown>)
          : {}
      const mergedStudy = {
        ...existingStudy,
        recommendation: 'Request Documents',
        documentsRequest: {
          by: consumer.name,
          at: new Date().toISOString(),
          requested: docsAsked || null,
          note: officerNotes?.trim() || null,
        },
      }

      await upsertCaseDecision(caseNumber, {
        status: 'escalated', // soft state; excluded from the pending queue via the recommendation
        decision_reason: officerRationale,
        case_study: mergedStudy,
        processed_at: new Date().toISOString(),
      })

      await createAuditLog({
        case_number: caseNumber,
        action: 'OFFICER_REQUEST_DOCS',
        decision: 'request_documents',
        rationale: officerRationale,
        processed_by: consumer.name,
        timestamp: new Date().toISOString(),
      })

      const message =
        `Your housing arrears rescheduling request ${caseNumber} needs additional documents before a MOEI officer can decide.` +
        (docsAsked ? ` Please provide: ${docsAsked}.` : '') +
        ` Log in to SADDAD and use "Submit Documents" on your application to upload. Ministry of Energy and Infrastructure — SADDAD.`
      const notify = await notifyApplicant({ phone, message, caseNumber })

      return NextResponse.json(
        successResponse({
          caseNumber,
          newStatus: 'request_documents',
          message: 'Additional documents requested from the applicant',
          notification: notify,
        }),
      )
    }

    // ── APPROVE / REJECT ─────────────────────────────────────────────────────────
    const newStatus = action === 'APPROVE' ? 'approved' : 'rejected'
    const officerRationale = officerNotes?.trim()
      ? `Officer ${consumer.name} manually ${action.toLowerCase()}d. Notes: ${officerNotes}`
      : `Officer ${consumer.name} manually ${action.toLowerCase()}d. No additional notes.`

    // Preserve original AI rationale — prepend officer decision
    const existingRationale = (rec.decision_reason as string) ?? ''
    const combinedRationale = officerRationale + (existingRationale ? `\n\n[AI Analysis]\n${existingRationale}` : '')

    await upsertCaseDecision(caseNumber, {
      status: newStatus,
      decision_reason: combinedRationale,
      processed_at: new Date().toISOString(),
    })

    // Sync applicants.status so the beneficiary registry reflects the real decision.
    // Re-submissions run under a `-rN` case id; the applicant row keeps the base id.
    await supabaseAdmin
      .from('applicants')
      .update({ status: newStatus })
      .eq('case_number', baseCaseNumber)

    await createAuditLog({
      case_number: caseNumber,
      action: `OFFICER_${action}`,
      decision: newStatus,
      rationale: officerRationale,
      processed_by: consumer.name,
      timestamp: new Date().toISOString(),
    })

    // WhatsApp/SMS via the shared, sandbox-aware path (DEMO_NOTIFY_PHONE override + SMS
    // fallback + logging), so an officer reject actually reaches the citizen.
    const mp = rec.monthly_payment as number | null | undefined
    const message = action === 'APPROVE'
      ? `Your housing arrears rescheduling request ${caseNumber} has been APPROVED by a MOEI officer. Monthly payment: AED ${mp?.toLocaleString() ?? 'TBD'}. Ministry of Energy and Infrastructure — SADDAD.`
      : `Your housing arrears rescheduling request ${caseNumber} has been reviewed by a MOEI officer and could not be approved at this time. Please contact your nearest service center. Ministry of Energy and Infrastructure — SADDAD.`
    const notify = await notifyApplicant({ phone, message, caseNumber })

    return NextResponse.json(
      successResponse({
        caseNumber,
        newStatus,
        message: `Case ${action.toLowerCase()}d by officer`,
        notification: notify,
      })
    )
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
