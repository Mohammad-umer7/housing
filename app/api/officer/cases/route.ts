import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getRecentCases } from '@/lib/data-layer'

// GET /api/officer/cases â€” returns all escalated cases with full AI analysis
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const allCases = await getRecentCases(200)
    const escalated = allCases.filter(
      (c: Record<string, unknown>) => c.status === 'escalated'
    )
    return NextResponse.json(successResponse({ cases: escalated, total: escalated.length }))
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
