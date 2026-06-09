import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookieHeader } from '@/lib/auth/session'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookieHeader(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json(errorResponse('Not authenticated', 401), { status: 401 })
  }
  return NextResponse.json(
    successResponse({
      role: session.role,
      username: session.username,
      caseNumber: session.caseNumber ?? null,
      name: session.name ?? null,
    })
  )
}
