import { NextResponse } from 'next/server'
import { healthReport } from '@/lib/llm/rotation-manager'

/**
 * GET /api/health/llm
 * Internal health check for the LLM rotation manager.
 * Returns key/model availability without exposing key values.
 */
export async function GET() {
  const report = healthReport()

  const status = !report.configured
    ? 'down'
    : report.keys.available === 0
    ? 'degraded'
    : 'ok'

  return NextResponse.json(
    { status, ...report },
    { status: status === 'down' ? 503 : 200 },
  )
}
