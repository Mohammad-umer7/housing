import { NextRequest, NextResponse } from 'next/server'
import {
  getJobStatus,
  getAgentSteps,
  getCaseByCaseNumber,
  getJobsAheadCount,
} from '@/lib/data-layer'
import { requireAuth } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  try {
    await requireAuth(req)
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { caseNumber } = await params

    const [job, steps, caseRecord] = await Promise.all([
      getJobStatus(caseNumber),
      getAgentSteps(caseNumber),
      getCaseByCaseNumber(caseNumber),
    ])

    // Queue position (how many queued jobs are ahead of this one)
    let queuePosition: number | null = null
    if (job?.status === 'queued' && job.queued_at) {
      queuePosition = await getJobsAheadCount(job.queued_at)
    }

    // Processing time
    let processingTimeMs: number | null = null
    if (job?.started_at && job?.completed_at) {
      processingTimeMs =
        new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
    } else if (job?.started_at) {
      processingTimeMs = Date.now() - new Date(job.started_at).getTime()
    }

    // Only expose a decision once the case record is terminal
    const terminalStatuses = ['approved', 'rejected', 'escalated']
    const decision =
      caseRecord && terminalStatuses.includes(caseRecord.status)
        ? {
            outcome: caseRecord.status,
            monthlyPayment: caseRecord.monthly_payment ?? null,
            durationMonths: caseRecord.duration_months ?? null,
            rationale: caseRecord.decision_reason ?? '',
            rationaleAr: caseRecord.rationale_ar ?? '',
            riskLevel: caseRecord.risk_level ?? '',
            consistencyScore: caseRecord.consistency_score ?? null,
            similarCasesFound: caseRecord.similar_cases_found ?? null,
            fairnessNote: caseRecord.fairness_note ?? '',
            totalNewMonthly: caseRecord.total_new_monthly_payment ?? null,
            currentInstallment: caseRecord.current_installment ?? null,
            monthlySalary: caseRecord.monthly_salary ?? null,
            recoveryGuidance: caseRecord.recovery_guidance ?? '',
            recoveryGuidanceAr: caseRecord.recovery_guidance_ar ?? '',
            caseStudy: caseRecord.case_study ?? null,
            verificationReport: caseRecord.verification_report ?? null,
          }
        : null

    return NextResponse.json(
      successResponse({
        caseNumber,
        status: job?.status ?? 'queued',
        agentSteps: steps.map((s: {
          agent_name: string
          status: string
          duration_ms: number | null
          ran_in_parallel: boolean | null
          result_summary: string | null
        }) => ({
          agentName: s.agent_name,
          status: s.status,
          durationMs: s.duration_ms ?? null,
          ranInParallel: s.ran_in_parallel ?? false,
          resultSummary: s.result_summary ?? '',
        })),
        decision,
        processingTimeMs,
        queuePosition,
      })
    )
  } catch (error) {
    console.error('[case-status] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
