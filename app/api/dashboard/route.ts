import { NextRequest, NextResponse } from 'next/server'
import { getRecentCases, getCaseStats, getQueueStats } from '@/lib/data-layer'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const [cases, stats, jobs] = await Promise.all([
      getRecentCases(50),
      getCaseStats(),
      getQueueStats(),
    ])

    type Job = { status: string; queued_at?: string; started_at?: string; completed_at?: string }

    const completedJobs = jobs.filter(
      (j: Job) => j.status === 'completed' && j.started_at && j.completed_at
    )
    const avgProcessingMs =
      completedJobs.length > 0
        ? completedJobs.reduce((sum: number, j: Job) => {
            return sum + (new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime())
          }, 0) / completedJobs.length
        : 0

    const longestWaitMs = jobs.reduce((max: number, j: Job) => {
      if (!j.started_at || !j.queued_at) return max
      const wait = new Date(j.started_at).getTime() - new Date(j.queued_at).getTime()
      return Math.max(max, wait)
    }, 0)

    const queue = {
      queued: jobs.filter((j: Job) => j.status === 'queued').length,
      processing: jobs.filter((j: Job) => j.status === 'processing').length,
      avgProcessingMs: Math.round(avgProcessingMs),
      longestWaitMs,
    }

    return NextResponse.json(successResponse({ cases, stats, queue }))
  } catch (error) {
    console.error('[dashboard] error:', error)
    return NextResponse.json(
      successResponse({
        cases: [],
        stats: { total: 0, approved: 0, rejected: 0, escalated: 0 },
        queue: { queued: 0, processing: 0, avgProcessingMs: 0, longestWaitMs: 0 },
      })
    )
  }
}
