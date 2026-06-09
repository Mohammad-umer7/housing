import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { getSystemSetting, saveSystemSetting } from '@/lib/data-layer'
import { ensureSystemSettings } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-response'

const ROLES = ['citizen', 'officer', 'admin'] as const
type PortalRole = typeof ROLES[number]

// GET /api/admin/settings/assistant
// Returns custom instructions for all three audience roles.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['admin'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }
  await ensureSystemSettings()
  const entries = await Promise.all(
    ROLES.map(async (role) => {
      const value = await getSystemSetting(`assistant_${role}_instructions`)
      return [role, value ?? ''] as [PortalRole, string]
    })
  )
  return NextResponse.json(successResponse(Object.fromEntries(entries)))
}

// PUT /api/admin/settings/assistant
// Body: { citizen?: string, officer?: string, admin?: string }
// Saves whichever roles are present in the body (partial update is fine).
export async function PUT(req: NextRequest) {
  try {
    await requireAuth(req, ['admin'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResponse('Invalid JSON', 400), { status: 400 })
  }

  const MAX_LEN = 4000
  const saves: Promise<void>[] = []
  for (const role of ROLES) {
    if (typeof body[role] === 'string') {
      const text = (body[role] as string).slice(0, MAX_LEN)
      saves.push(saveSystemSetting(`assistant_${role}_instructions`, text))
    }
  }
  await Promise.all(saves)
  return NextResponse.json(successResponse({ saved: true }))
}
