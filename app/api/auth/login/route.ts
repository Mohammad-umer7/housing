import { NextRequest, NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_DURATION_MS, type Role } from '@/lib/auth/session'
import { successResponse, errorResponse } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/middleware/auth'
import { logLogin } from '@/lib/data-layer'
import { isDemoMode } from '@/lib/demo/config'

type User = { username: string; password: string; role: Role }

// Credentials come from env vars. In a keyless demo checkout, fall back to the
// standard demo credentials (admin / officer, password "saddad-2026") so the staff
// portals are reachable out of the box. Production sets its own AUTH_* env pairs.
const DEMO = isDemoMode()
const USERS: User[] = []
if (process.env.AUTH_ADMIN_USERNAME && process.env.AUTH_ADMIN_PASSWORD) {
  USERS.push({
    username: process.env.AUTH_ADMIN_USERNAME,
    password: process.env.AUTH_ADMIN_PASSWORD,
    role: 'admin',
  })
} else if (DEMO) {
  USERS.push({ username: 'admin', password: 'saddad-2026', role: 'admin' })
}
if (process.env.AUTH_OFFICER_USERNAME && process.env.AUTH_OFFICER_PASSWORD) {
  USERS.push({
    username: process.env.AUTH_OFFICER_USERNAME,
    password: process.env.AUTH_OFFICER_PASSWORD,
    role: 'officer',
  })
} else if (DEMO) {
  USERS.push({ username: 'officer', password: 'saddad-2026', role: 'officer' })
}

export async function POST(req: NextRequest) {
  // Rate-limit by client IP to slow down brute force
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(`login:${ip}`, 10)) {
    return NextResponse.json(errorResponse('Too many login attempts. Try again in 1 minute.', 429), { status: 429 })
  }

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResponse('Invalid request body', 400), { status: 400 })
  }

  const { username, password } = body
  if (!username || !password) {
    return NextResponse.json(errorResponse('Username and password are required', 400), { status: 400 })
  }

  const user = USERS.find(u => u.username === username && u.password === password)
  if (!user) {
    return NextResponse.json(errorResponse('Invalid credentials', 401), { status: 401 })
  }

  void logLogin({ username: user.username, role: user.role, ipAddress: ip })

  const token = await signSession({ role: user.role, username: user.username })
  const response = NextResponse.json(successResponse({ role: user.role, username: user.username }))
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  })
  return response
}
