import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { successResponse } from '@/lib/api-response'

export async function POST() {
  const response = NextResponse.json(successResponse({ loggedOut: true }))
  response.cookies.delete(SESSION_COOKIE)
  return response
}
