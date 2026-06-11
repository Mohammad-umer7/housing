import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getRecentCases } from '@/lib/data-layer'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/officer/cases
// Admin → all cases (optional ?status= filter; ?status=all or omitted = everything)
// Officer → escalated only (the officer portal IS the manual-review queue)
export async function GET(req: NextRequest) {
  let consumer
  try {
    consumer = await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // optional, admin-only

    const allCases = await getRecentCases(500)
    let cases = allCases as Record<string, unknown>[]

    if (consumer.role === 'admin') {
      // Admin sees everything; honour an optional status filter.
      if (statusFilter && statusFilter !== 'all') {
        cases = cases.filter(c => c.status === statusFilter)
      }
    } else {
      // Officer escalation queue — escalated cases STILL awaiting a manual decision. A case
      // the officer already returned to the citizen for more documents (case_study
      // recommendation 'Request Documents') drops out of the queue; it re-enters when the
      // citizen resubmits as a fresh -rN case.
      cases = cases.filter(c => {
        if (c.status !== 'escalated') return false
        const cs = c.case_study
        const recommendation = cs && typeof cs === 'object'
          ? String((cs as { recommendation?: unknown }).recommendation ?? '')
          : ''
        return recommendation !== 'Request Documents'
      })
    }

    // Attach the GOVERNANCE RULE that caused each decision (rule_triggered lives in
    // the immutable audit log, not the case row) so the officer sees exactly WHY the
    // AI did not auto-approve. One batched query for all listed cases.
    const caseNumbers = cases.map(c => String(c.case_number)).filter(Boolean).slice(0, 200)
    if (caseNumbers.length > 0) {
      const { data: logs } = await supabaseAdmin
        .from('audit_logs')
        .select('case_number, rule_triggered, timestamp')
        .in('case_number', caseNumbers)
        .eq('action', 'AGENT_DECISION')
        .order('timestamp', { ascending: false })
      const ruleByCase = new Map<string, string>()
      for (const row of (logs ?? []) as { case_number: string; rule_triggered: string | null }[]) {
        if (row.rule_triggered && !ruleByCase.has(row.case_number)) {
          ruleByCase.set(row.case_number, row.rule_triggered)
        }
      }
      cases = cases.map(c => ({ ...c, rule_triggered: ruleByCase.get(String(c.case_number)) ?? null }))
    }

    return NextResponse.json(successResponse({ cases, total: cases.length }))
  } catch (error) {
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
