import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getApplicant } from '@/lib/integrations/source-systems'
import { getCasesByEmiratesId } from '@/lib/data-layer'

// GET /api/v1/cases/history?appId=X
// All submissions (history cards) for the beneficiary behind Application ID X. The
// person is keyed by Emirates ID, so each re-submission is returned as its own card.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const appId = new URL(req.url).searchParams.get('appId')
    if (!appId) {
      return NextResponse.json(errorResponse('appId query parameter is required', 400), { status: 400 })
    }

    const applicant = await getApplicant(appId)
    if (!applicant) {
      return NextResponse.json(errorResponse('Application ID not found in MOEI records', 404), { status: 404 })
    }

    const emiratesId = String(applicant.emirates_id ?? '')
    const rows = emiratesId ? await getCasesByEmiratesId(emiratesId) : []

    const cases = rows.map((c) => {
      const study = (c.case_study && typeof c.case_study === 'object' ? c.case_study : {}) as { recommendation?: unknown }
      return {
        case_number: String(c.case_number ?? ''),
        full_name: String(c.full_name ?? applicant.full_name ?? ''),
        status: String(c.status ?? 'pending'),
        recommendation: study.recommendation ? String(study.recommendation) : null,
        arrears_amount: Number(c.arrears_amount) || 0,
        monthly_salary: Number(c.monthly_salary) || 0,
        monthly_payment: c.monthly_payment != null ? Number(c.monthly_payment) : null,
        duration_months: c.duration_months != null ? Number(c.duration_months) : null,
        processed_at: c.processed_at ? String(c.processed_at) : null,
        created_at: c.created_at ? String(c.created_at) : null,
      }
    })

    return NextResponse.json(
      successResponse({
        applicant: {
          app_id: appId,
          full_name: String(applicant.full_name ?? ''),
          emirates_id: emiratesId,
        },
        cases,
      })
    )
  } catch (error) {
    console.error('[cases/history] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
