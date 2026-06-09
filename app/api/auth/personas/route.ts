import { NextResponse } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getAllApplicants } from '@/lib/integrations/source-systems'

// GET /api/auth/personas
// Public (pre-login) list of the demo "log in as a citizen" personas, read from
// the seeded `applicants` table. Returns only what the login cards need — no
// salary or financials — so nothing sensitive is exposed before authentication.
// Gated behind DEMO_MODE: disabled in production, where UAE PASS would replace it.
export async function GET() {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(errorResponse('Persona login is disabled', 403), { status: 403 })
  }

  try {
    const applicants = await getAllApplicants()
    const personas = applicants
      .map((a: Record<string, unknown>) => ({
        case_number: String(a.case_number ?? ''),
        full_name: String(a.full_name ?? ''),
        full_name_ar: a.full_name_ar ? String(a.full_name_ar) : null,
        emirates_id: a.emirates_id ? String(a.emirates_id) : null,
        reschedule_reason: String(a.reschedule_reason ?? 'other'),
        property_address: a.property_address ? String(a.property_address) : null,
      }))
      .filter((p) => p.case_number && p.full_name)
      .sort((a, b) => a.case_number.localeCompare(b.case_number))

    return NextResponse.json(successResponse({ personas }))
  } catch (error) {
    console.error('[personas] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
