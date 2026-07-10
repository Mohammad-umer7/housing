import { NextRequest, NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_DURATION_MS } from '@/lib/auth/session'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getApplicant } from '@/lib/integrations/source-systems'
import { isDemoMode } from '@/lib/demo/config'

// POST /api/auth/persona-login  { caseNumber }
// Demo "log in as this citizen" entry point. Validates the applicant exists, then
// issues a session that carries the chosen caseNumber + name so the submission
// form can auto-load that person's record. Sessions get the `officer` role so the
// full app (Submit / Dashboard / Officer view) is usable in the demo. Gated behind
// DEMO_MODE — in production UAE PASS OIDC replaces this (see docs/SECURITY.md).
export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(errorResponse('Persona login is disabled', 403), { status: 403 })
  }

  let body: { caseNumber?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResponse('Invalid request body', 400), { status: 400 })
  }

  const caseNumber = String(body.caseNumber ?? '').trim()
  if (!caseNumber) {
    return NextResponse.json(errorResponse('caseNumber is required', 400), { status: 400 })
  }

  const applicant = await getApplicant(caseNumber)
  if (!applicant) {
    return NextResponse.json(errorResponse('Persona not found in records', 404), { status: 404 })
  }

  const name = String(applicant.full_name ?? caseNumber)
  const token = await signSession({
    role: 'officer',
    username: `persona:${caseNumber}`,
    caseNumber,
    name,
  })

  const response = NextResponse.json(successResponse({ caseNumber, name }))
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  })
  return response
}
