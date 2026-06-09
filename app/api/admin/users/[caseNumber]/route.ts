import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getAgentSteps, getAuditLogsByCaseNumber } from '@/lib/data-layer'

// GET /api/admin/users/[caseNumber]
// Full applicant + case detail for admin. Combines applicants + cases + agent steps + audit.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  try {
    await requireAuth(req, ['admin'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }

  const { caseNumber } = await params

  const [{ data: applicant }, { data: caseRow }] = await Promise.all([
    supabaseAdmin.from('applicants').select('*').eq('case_number', caseNumber).maybeSingle(),
    supabaseAdmin.from('cases').select('*').eq('case_number', caseNumber).maybeSingle(),
  ])

  if (!applicant) {
    return NextResponse.json(errorResponse('Beneficiary not found', 404), { status: 404 })
  }

  const [agentSteps, auditLogs] = await Promise.all([
    caseRow ? getAgentSteps(caseNumber) : Promise.resolve([]),
    caseRow ? getAuditLogsByCaseNumber(caseNumber) : Promise.resolve([]),
  ])

  return NextResponse.json(successResponse({
    applicant,
    case: caseRow ?? null,
    agentSteps: (agentSteps as Record<string, unknown>[]).map(s => ({
      agentName: s.agent_name,
      status: s.status,
      durationMs: s.duration_ms ?? null,
      resultSummary: s.result_summary ?? '',
    })),
    auditLogs: (auditLogs as Record<string, unknown>[]).map(l => ({
      id: l.id,
      action: l.action,
      decision: l.decision,
      rationale: l.rationale,
      processedBy: l.processed_by,
      timestamp: l.timestamp,
    })),
  }))
}
