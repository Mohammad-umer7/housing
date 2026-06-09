import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { upsertCaseDecision, createAuditLog } from '@/lib/data-layer'
import { executeNotificationTool } from '@/tools/notification-tools'
import { getCaseByCaseNumber } from '@/lib/data-layer'

// PATCH /api/officer/cases/[caseNumber] — officer approves or rejects an escalated case
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
    const officerRationale = `Officer ${consumer.name} manually ${action.toLowerCase()}d this case. Notes: ${officerNotes || 'No notes provided.'}`

    await upsertCaseDecision(caseNumber, {
      status: newStatus,
      decision_reason: officerRationale,
      processed_at: new Date().toISOString(),
    })

    await createAuditLog({
      case_number: caseNumber,
      action: `OFFICER_${action}`,
      decision: newStatus,
      rationale: officerRationale,
      processed_by: consumer.name,
      timestamp: new Date().toISOString(),
    })

    // Send WhatsApp notification to applicant
    const phone = (caseRecord as Record<string, unknown>).phone as string | undefined
    if (phone) {
      const message = action === 'APPROVE'
        ? `Your housing arrears rescheduling request ${caseNumber} has been APPROVED by a MOEI officer. Monthly payment: AED ${(caseRecord as Record<string, unknown>).monthly_payment?.toLocaleString() ?? 'TBD'}. Ministry of Energy and Infrastructure — SADDAD.`
        : `Your housing arrears rescheduling request ${caseNumber} has been reviewed by a MOEI officer and could not be approved at this time. Please contact your nearest service center. Ministry of Energy and Infrastructure — SADDAD.`

      try {
        await executeNotificationTool('send_whatsapp', { phone, message, caseNumber })
      } catch {
        // Non-fatal — notification failure doesn't block the update
      }
    }

    return NextResponse.json(
      successResponse({ caseNumber, newStatus, message: `Case ${action.toLowerCase()}d by officer` })
    )
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
