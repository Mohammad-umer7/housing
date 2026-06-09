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
import { executeNotificationTool } from '@/tools/notification-tools'

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
    const { action, officerNotes } = body

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(errorResponse('action must be APPROVE or REJECT', 400), { status: 400 })
    }

    const caseRecord = await getCaseByCaseNumber(caseNumber)
    if (!caseRecord) {
      return NextResponse.json(errorResponse('Case not found', 404), { status: 404 })
    }

    const newStatus = action === 'APPROVE' ? 'approved' : 'rejected'
    const officerRationale = officerNotes?.trim()
      ? `Officer ${consumer.name} manually ${action.toLowerCase()}d. Notes: ${officerNotes}`
      : `Officer ${consumer.name} manually ${action.toLowerCase()}d. No additional notes.`

    // Preserve original AI rationale — prepend officer decision
    const existingRationale = (caseRecord as Record<string, unknown>).decision_reason as string ?? ''
    const combinedRationale = officerRationale + (existingRationale ? `\n\n[AI Analysis]\n${existingRationale}` : '')

    await upsertCaseDecision(caseNumber, {
      status: newStatus,
      decision_reason: combinedRationale,
      processed_at: new Date().toISOString(),
    })

    // Sync applicants.status so the beneficiary registry reflects the real decision.
    // Re-submissions run under a `-rN` case id; the applicant row keeps the base id.
    const baseCaseNumber = caseNumber.replace(/-r\d+$/i, '')
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

    // WhatsApp notification
    const phone = (caseRecord as Record<string, unknown>).phone as string | undefined
    if (phone) {
      const mp = (caseRecord as Record<string, unknown>).monthly_payment
      const message = action === 'APPROVE'
        ? `Your housing arrears rescheduling request ${caseNumber} has been APPROVED by a MOEI officer. Monthly payment: AED ${mp?.toLocaleString() ?? 'TBD'}. Ministry of Energy and Infrastructure — SADDAD.`
        : `Your housing arrears rescheduling request ${caseNumber} has been reviewed by a MOEI officer and could not be approved at this time. Please contact your nearest service center. Ministry of Energy and Infrastructure — SADDAD.`
      try {
        await executeNotificationTool('send_whatsapp', { phone, message, caseNumber })
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(
      successResponse({ caseNumber, newStatus, message: `Case ${action.toLowerCase()}d by officer` })
    )
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
