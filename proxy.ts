import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookieHeader } from '@/lib/auth/session'

// Pages that anyone can access without a session.
const PUBLIC_PATHS = [
  '/login',
  '/settings',
  '/api/auth/login',
  '/api/auth/demo-login',
  '/api/auth/personas',
  '/api/auth/persona-login',
  '/api-docs',
]

// API routes that allow x-api-key (external consumers) instead of a session.
// requireAuth() inside the route handler does the actual validation.
const API_KEY_ENABLED_PREFIXES = [
  '/api/v1/',
  '/api/process-application',
  '/api/case-status/',
  '/api/dashboard',
  '/api/officer/',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // API routes: let them through — requireAuth() inside the handler checks
  // both the session cookie and x-api-key.
  if (API_KEY_ENABLED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // UI routes: must have a valid session, else redirect to /login.
  const session = await readSessionFromCookieHeader(req.headers.get('cookie'))
  if (session) return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except Next.js internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)'],
}
