import { NextRequest, NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_DURATION_MS } from '@/lib/auth/session'
import { successResponse, errorResponse } from '@/lib/api-response'
import { logLogin } from '@/lib/data-layer'
import { isDemoMode } from '@/lib/demo/config'

// One-click demo login. Issues an officer session WITHOUT credentials, but only
// when demo mode is enabled (DEMO_MODE, or any keyless demo backend). In production
// (real backend, DEMO_MODE unset) this returns 403 so credential login is the only way in.
export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(errorResponse('Demo login is disabled', 403), { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  void logLogin({ username: 'demo-officer', role: 'officer', ipAddress: ip })

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
