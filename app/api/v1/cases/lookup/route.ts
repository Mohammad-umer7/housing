import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getApplicant } from '@/lib/integrations/source-systems'
import { lookupUaePassProfile, SOCIAL_STATUS_LABELS } from '@/lib/integrations/uae-pass'
import { classifyRequestCircumstances, determineRequiredDocuments } from '@/governance/housing-arrears'
import { getCaseByCaseNumber, getResubmissionGate } from '@/lib/data-layer'

// GET /api/v1/cases/lookup?caseNumber=X
// Returns applicant loan details for pre-population in the submission form.
// Simulates the MOEI backend database lookup â€” the system already knows your loan.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const caseNumber = searchParams.get('caseNumber')

    if (!caseNumber) {
      return NextResponse.json(errorResponse('caseNumber query parameter is required', 400), { status: 400 })
    }

    const applicant = await getApplicant(caseNumber)

    if (!applicant) {
      return NextResponse.json(errorResponse('Case not found in MOEI records', 404), { status: 404 })
    }

    // If this beneficiary already has a terminal case whose recommendation was
    // "Request Documents" (Additional Information Required), the form should switch to
    // a documents-only re-upload — they only need to provide a valid certificate.
    // Retrieve the verified identity + social profile from UAE PASS (DB-3). The brief
    // assumes the agent can read UAE PASS; identity/family/social shown here come from
    // that system, the financials from the loan record.
    const uaePass = await lookupUaePassProfile(caseNumber)
    const socialLabel = uaePass ? SOCIAL_STATUS_LABELS[uaePass.social_status] : null

    const priorCase = await getCaseByCaseNumber(caseNumber)
    const priorRecommendation =
      priorCase?.case_study && typeof priorCase.case_study === 'object'
        ? String((priorCase.case_study as { recommendation?: unknown }).recommendation ?? '')
        : ''
    const needsDocuments =
      priorCase?.status === 'rejected' && priorRecommendation === 'Request Documents'

    // Re-submission gate: a case that is still being processed or is awaiting an
    // officer's decision cannot be re-submitted under the same App ID — the form shows
    // an "in process / under review" notice instead of letting them submit again.
    const resubmission = await getResubmissionGate(caseNumber)

    // Smart required-documents — whether THIS situation needs an uploaded document and,
    // if so, exactly which one. The form uses this to label the upload "required" vs
    // "optional" (income is otherwise validated from the Programme record).
    const reason = String(applicant.reschedule_reason ?? 'other')
    const circ = classifyRequestCircumstances(reason, `${applicant.remarks ?? ''} ${applicant.justifications ?? ''}`)
    const required = determineRequiredDocuments({
      reschedule_reason: reason,
      unemployment: circ.unemployment,
      income_changed: Boolean(applicant.income_changed) || circ.income_changed,
      temporary_circumstance: circ.temporary_circumstance,
      hasIncomeRecord: Number(applicant.monthly_salary) > 0,
    })

    return NextResponse.json(
      successResponse({
        case_number: applicant.case_number,
        // Identity from UAE PASS (DB-3) when available, else the Programme record.
        full_name: uaePass?.full_name ?? applicant.full_name,
        full_name_ar: uaePass?.full_name_ar ?? applicant.full_name_ar ?? null,
        emirates_id: uaePass?.emirates_id ?? applicant.emirates_id ?? null,
        phone: uaePass?.phone ?? applicant.phone ?? null,
        arrears_amount: applicant.arrears_amount,
        monthly_salary: applicant.monthly_salary,
        monthly_expenses: applicant.monthly_expenses ?? 0,
        loan_bank_name: applicant.loan_bank_name ?? 'Emirates Development Bank',
        loan_account_number: applicant.loan_account_number ?? null,
        total_loan_amount: applicant.total_loan_amount ?? null,
        remaining_loan_balance: applicant.remaining_loan_balance ?? null,
        current_installment: applicant.current_installment ?? 0,
        remaining_loan_months: applicant.remaining_loan_months ?? 60,
        auto_dda: applicant.auto_dda ?? true,
        reschedule_reason: applicant.reschedule_reason ?? 'other',
        months_in_arrears: applicant.months_in_arrears ?? 0,
        family_size: uaePass?.family_size ?? applicant.family_size ?? 1,
        marital_status: uaePass?.marital_status ?? applicant.marital_status ?? null,
        income_changed: applicant.income_changed ?? false,
        payment_history: applicant.payment_history ?? [],
        remarks: applicant.remarks ?? null,
        // UAE PASS social/family profile (the brief's §4 "social situation").
        uae_pass: uaePass
          ? {
              source: 'UAE PASS',
              number_of_children: uaePass.number_of_children,
              social_status: uaePass.social_status,
              social_status_label: socialLabel?.en ?? uaePass.social_status,
              social_status_label_ar: socialLabel?.ar ?? uaePass.social_status_ar,
              is_priority: uaePass.is_priority,
            }
          : null,
        needsDocuments,
        priorRecommendation: priorRecommendation || null,
        // Whether a NEW submission under this App ID is currently blocked (and why).
        resubmission,
        // Case-aware document requirement for the upload label / validation.
        requiredDocuments: {
          requiresUpload: required.requiresUpload,
          label: required.labels[0] ?? 'A recent salary certificate (issued within the last 30 days)',
          primaryType: required.primaryType,
        },
      })
    )
  } catch (error) {
    console.error('[lookup] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
