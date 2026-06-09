import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/admin/users
// Returns all applicants from the applicants table joined with their case record.
// Admin: full data.  Officer: same applicant list, stripped of sensitive fields.
export async function GET(req: NextRequest) {
  let consumer
  try {
    consumer = await requireAuth(req, ['admin', 'officer'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }

  const url = new URL(req.url)
  const page   = Math.max(0, Number(url.searchParams.get('page') ?? '0'))
  const limit  = Math.min(200, Math.max(10, Number(url.searchParams.get('limit') ?? '100')))
  const search = (url.searchParams.get('search') ?? '').trim()
  const status = url.searchParams.get('status') ?? ''

  // Build applicants query
  let q = supabaseAdmin
    .from('applicants')
    .select(`
      id,
      case_number,
      full_name,
      full_name_ar,
      emirates_id,
      phone,
      monthly_salary,
      arrears_amount,
      family_size,
      marital_status,
      status,
      previous_default,
      has_active_application,
      loan_bank_name,
      total_loan_amount,
      remaining_loan_balance,
      months_in_arrears,
      created_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

  if (search) {
    // Strip characters that carry meaning in PostgREST's .or() filter grammar
    // (comma = condition separator, parens = grouping, dot = field/op separator)
    // so a crafted search term can't inject extra filter conditions.
    const safe = search.replace(/[(),.*:]/g, ' ').replace(/\s+/g, ' ').trim()
    if (safe) {
      q = q.or(`full_name.ilike.%${safe}%,full_name_ar.ilike.%${safe}%,case_number.ilike.%${safe}%,emirates_id.ilike.%${safe}%`)
    }
  }
  if (status) {
    q = q.eq('status', status)
  }

  const { data: applicants, count, error } = await q

  if (error) {
    console.error('[admin/users] applicants query error:', error)
    return NextResponse.json(errorResponse('Failed to load users', 500), { status: 500 })
  }

  // Fetch matching case records for these applicants. Our cases table has no
  // separate `decision` column — the terminal status IS the decision.
  const caseNumbers = (applicants ?? []).map(a => a.case_number).filter(Boolean)
  const casesMap: Record<string, { status: string; decision: string | null; processed_at: string | null; priority_escalation: boolean | null }> = {}
  if (caseNumbers.length > 0) {
    const { data: cases } = await supabaseAdmin
      .from('cases')
      .select('case_number,status,processed_at,priority_escalation')
      .in('case_number', caseNumbers)
    const DECISION: Record<string, string> = { approved: 'APPROVE', rejected: 'REJECT', escalated: 'ESCALATE' }
    for (const c of cases ?? []) {
      casesMap[c.case_number] = {
        status: c.status,
        decision: DECISION[c.status] ?? null,
        processed_at: c.processed_at,
        priority_escalation: c.priority_escalation,
      }
    }
  }

  // Merge
  const rows = (applicants ?? []).map(a => ({
    ...a,
    // Strip sensitive fields for officers
    ...(consumer.role === 'officer' ? { emirates_id: null, phone: null } : {}),
    case: casesMap[a.case_number] ?? null,
  }))

  return NextResponse.json(successResponse({
    users: rows,
    total: count ?? 0,
    page,
    limit,
  }))
}
