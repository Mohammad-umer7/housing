import { NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_DURATION_MS } from '@/lib/auth/session'
import { successResponse, errorResponse } from '@/lib/api-response'

// One-click demo login. Issues an officer session WITHOUT credentials, but only
// when DEMO_MODE is explicitly enabled. In production (DEMO_MODE unset) this
// endpoint returns 403, so the real credential login is the only way in.
export async function POST() {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(errorResponse('Demo login is disabled', 403), { status: 403 })
  }

  const token = await signSession({ role: 'officer', username: 'demo-officer' })
  const response = NextResponse.json(successResponse({ role: 'officer', username: 'demo-officer' }))
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  })
  return response
}
