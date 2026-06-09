import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getRecentCases } from '@/lib/data-layer'

// GET /api/officer/cases
// Admin → all cases (optional ?status= filter; ?status=all or omitted = everything)
// Officer → escalated only (the officer portal IS the manual-review queue)
export async function GET(req: NextRequest) {
  let consumer
  try {
    consumer = await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // optional, admin-only

    const allCases = await getRecentCases(500)
    let cases = allCases as Record<string, unknown>[]

    if (consumer.role === 'admin') {
      // Admin sees everything; honour an optional status filter.
      if (statusFilter && statusFilter !== 'all') {
        cases = cases.filter(c => c.status === statusFilter)
      }
    } else {
      // Officer escalation queue — escalated cases awaiting a manual decision.
      cases = cases.filter(c => c.status === 'escalated')
    }

    return NextResponse.json(successResponse({ cases, total: cases.length }))
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
