import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getCaseByCaseNumber, upsertCaseDecision, createAuditLog } from '@/lib/data-layer'
import { supabaseAdmin } from '@/lib/supabase'
import { executeNotificationTool } from '@/tools/notification-tools'

// PATCH /api/admin/cases/[caseNumber] — ADMIN decision OVERRIDE.
// An administrator can override the AI/officer outcome to APPROVE, REJECT, or RETURN the
// case to the officer queue for reconsideration. The override updates the case (status +
// rationale + case_study recommendation/marker), syncs the applicant registry, writes an
// audit entry, and notifies the citizen via the SAME WhatsApp pipeline the officer uses.
// It propagates everywhere automatically because every UI reads the case record.

type Action = 'APPROVE' | 'REJECT' | 'RETURN_TO_OFFICER'

const STATUS: Record<Action, string> = {
  APPROVE: 'approved',
  REJECT: 'rejected',
  RETURN_TO_OFFICER: 'escalated',
}
const RECOMMENDATION: Record<Action, string> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  RETURN_TO_OFFICER: 'Refer to Employee',
}
const ACTION_LABEL: Record<Action, string> = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  RETURN_TO_OFFICER: 'Returned to officer for reconsideration',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  let consumer
  try {
    consumer = await requireAuth(req, ['admin']) // admin-only override
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 403), { status: 403 })
  }

  try {
    const { caseNumber } = await params
    const body = await req.json()
    const action = body.action as Action
    const note = String(body.note ?? '').trim()

    if (!action || !['APPROVE', 'REJECT', 'RETURN_TO_OFFICER'].includes(action)) {
      return NextResponse.json(errorResponse('action must be APPROVE, REJECT or RETURN_TO_OFFICER', 400), { status: 400 })
    }
    if (!note) {
      return NextResponse.json(errorResponse('A note explaining the override is required', 400), { status: 400 })
    }

    const caseRecord = await getCaseByCaseNumber(caseNumber)
    if (!caseRecord) {
      return NextResponse.json(errorResponse('Case not found', 404), { status: 404 })
    }

    const fromStatus = String((caseRecord as Record<string, unknown>).status ?? 'unknown')
    const newStatus = STATUS[action]

    // Merge the override marker + matching recommendation into case_study (kept JSONB).
    const prevStudy =
      caseRecord.case_study && typeof caseRecord.case_study === 'object'
        ? (caseRecord.case_study as Record<string, unknown>)
        : {}
    const caseStudy = {
      ...prevStudy,
      recommendation: RECOMMENDATION[action],
      adminOverride: {
        by: consumer.name,
        at: new Date().toISOString(),
        note,
        from: fromStatus,
        to: newStatus,
      },
    }

    // Preserve the prior rationale (AI / officer) — prepend the admin override.
    const existingReason = String((caseRecord as Record<string, unknown>).decision_reason ?? '')
    const overrideReason =
      `Administrator ${consumer.name} overrode the decision — ${ACTION_LABEL[action]}. Note: ${note}` +
      (existingReason ? `\n\n[Previous decision]\n${existingReason}` : '')

    await upsertCaseDecision(caseNumber, {
      status: newStatus,
      decision_reason: overrideReason,
      processed_at: new Date().toISOString(),
      case_study: caseStudy,
    })

    // Sync applicants.status so the beneficiary registry reflects the override.
    const baseCaseNumber = caseNumber.replace(/-r\d+$/i, '')
    await supabaseAdmin.from('applicants').update({ status: newStatus }).eq('case_number', baseCaseNumber)

    await createAuditLog({
      case_number: caseNumber,
      action: `ADMIN_OVERRIDE_${action}`,
      decision: newStatus,
      rationale: `Admin override (${ACTION_LABEL[action]}). Note: ${note}`,
      processed_by: consumer.name,
      timestamp: new Date().toISOString(),
    })

    // Same WhatsApp pipeline the officer uses — citizen is notified on every override.
    const phone = (caseRecord as Record<string, unknown>).phone as string | undefined
    if (phone) {
      const mp = (caseRecord as Record<string, unknown>).monthly_payment as number | null | undefined
      const message =
        action === 'APPROVE'
          ? `Your housing arrears rescheduling request ${caseNumber} has been APPROVED following administrative review. Monthly payment: AED ${mp?.toLocaleString() ?? 'TBD'}. Ministry of Energy and Infrastructure — SADDAD.`
          : action === 'REJECT'
          ? `Your housing arrears rescheduling request ${caseNumber} has been reviewed by the Ministry administration and could not be approved at this time. Please contact your nearest service center. Ministry of Energy and Infrastructure — SADDAD.`
          : `Your housing arrears rescheduling request ${caseNumber} is under further review by a specialist officer. We will contact you within 5 working days. Ministry of Energy and Infrastructure — SADDAD.`
      try {
        await executeNotificationTool('send_whatsapp', { phone, message, caseNumber })
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(
      successResponse({ caseNumber, newStatus, action, message: `Decision overridden — ${ACTION_LABEL[action]}` })
    )
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
