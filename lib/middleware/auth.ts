// Authentication middleware — supports two paths:
//   1. Session cookie (officer UI, set by /api/auth/login)
//   2. x-api-key header (server-to-server external consumers)
// Both yield the same Consumer shape so route handlers stay simple.

import { readSessionFromCookieHeader, type Role } from '@/lib/auth/session'

type Consumer = { role: Role; name: string }

const API_KEYS: Record<string, Consumer> = {}
if (process.env.API_KEY_ADMIN) API_KEYS[process.env.API_KEY_ADMIN] = { role: 'admin', name: 'MOEI Admin Portal' }
if (process.env.API_KEY_OFFICER) API_KEYS[process.env.API_KEY_OFFICER] = { role: 'officer', name: 'Officer Dashboard' }
if (process.env.API_KEY_READONLY) API_KEYS[process.env.API_KEY_READONLY] = { role: 'readonly', name: 'Analytics Consumer' }

const rateLimiter = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string, limit = 100): boolean {
  const now = Date.now()
  const window = 60_000 // 1 minute
  const entry = rateLimiter.get(identifier)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(identifier, { count: 1, resetAt: now + window })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}

export function validateApiKey(request: Request): Consumer | null {
  const key = request.headers.get('x-api-key')
  if (!key) return null
  return API_KEYS[key] ?? null
}

export async function requireAuth(
  request: Request,
  allowedRoles: Role[] = ['admin', 'officer', 'readonly']
): Promise<Consumer> {
  // 1. Session cookie (officer UI)
  const session = await readSessionFromCookieHeader(request.headers.get('cookie'))
  if (session) {
    if (!allowedRoles.includes(session.role)) throw new Error('Insufficient permissions')
    return { role: session.role, name: session.username }
  }

  // 2. API key (external consumers — documented in /api-docs)
  const consumer = validateApiKey(request)
  if (consumer) {
    if (!allowedRoles.includes(consumer.role)) throw new Error('Insufficient permissions')
    return consumer
  }

  throw new Error('Invalid or missing authentication')
}
