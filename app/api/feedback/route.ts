import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { submitFeedback, getRecentFeedback, getFeedbackStats } from '@/lib/data-layer'

// POST /api/feedback — a citizen rates the experience after a decision (1-5 stars +
// optional comment + name). Any authenticated session may submit.
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rating = Number(body.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(errorResponse('A star rating between 1 and 5 is required', 400), { status: 400 })
    }
    if (!String(body.name ?? '').trim()) {
      return NextResponse.json(errorResponse('Your name is required', 400), { status: 400 })
    }

    await submitFeedback({
      case_number: body.case_number ?? null,
      name: body.name,
      rating,
      comment: body.comment ?? null,
    })

    return NextResponse.json(successResponse({ submitted: true }))
  } catch (error) {
    console.error('[feedback] submit error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}

// GET /api/feedback — the officer Feedback section: all feedback + aggregate stats.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const [feedback, stats] = await Promise.all([getRecentFeedback(200), getFeedbackStats()])
    return NextResponse.json(successResponse({ feedback, stats }))
  } catch (error) {
    console.error('[feedback] list error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
