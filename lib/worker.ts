// Queue manager â€” claims jobs and delegates to the main case agent.
// Production: extract into a separate worker service with Redis/Bull.

import { runMainCaseAgent } from '@/agents/main-case-agent'
import {
  countProcessingJobs,
  claimJob,
  updateJobStatus,
  upsertCaseDecision,
  createAuditLog,
} from '@/lib/data-layer'

const MAX_CONCURRENT_JOBS = 5

export async function processCase(caseNumber: string): Promise<void> {
  console.log(`[Worker] processCase START case=${caseNumber}`)
  const jobStart = Date.now()

  try {
    // Concurrency gate â€” wait if already at MAX_CONCURRENT_JOBS
    for (let i = 0; i < 30; i++) {
      const count = await countProcessingJobs()
      if (count < MAX_CONCURRENT_JOBS) break
      console.log(`[Worker] Concurrency limit (${MAX_CONCURRENT_JOBS}) reached, waiting 1s...`)
      await new Promise(r => setTimeout(r, 1000))
    }

    // Claim the job atomically (update-and-return). If another invocation already
    // claimed it (e.g. a duplicate after() call), `claimed` is null — skip quietly;
    // this is NOT a failure and must not escalate the case.
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const claimed = await claimJob(caseNumber, workerId)
    if (!claimed) {
      console.log(`[Worker] case=${caseNumber} already claimed/processed — skipping this invocation`)
      return
    }

    const formData = claimed.form_data as Record<string, unknown>

    await runMainCaseAgent(caseNumber, formData)

    await updateJobStatus(caseNumber, 'completed')

    console.log(`[Worker] processCase DONE case=${caseNumber} total=${Date.now() - jobStart}ms`)
  } catch (err) {
    console.error(`[Worker] processCase FAILED case=${caseNumber}`, err)
    await updateJobStatus(caseNumber, 'failed', String(err))
    // Ensure the case never stays stuck as 'pending' â€” route it to a human officer (a transient failure must never auto-reject a citizen)
    try {
      await upsertCaseDecision(caseNumber, {
        status: 'escalated',
        decision_reason: 'A technical issue interrupted automated processing. Your case has been referred to a specialist officer for manual review — no decision has been made against you.',
        processed_at: new Date().toISOString(),
        // Clear any structured panels left over from a prior run so a technical
        // failure never shows a stale/misleading verification or assessment.
        case_study: null,
        verification_report: null,
        recovery_guidance: null,
        recovery_guidance_ar: null,
      })
      // Even a failure is auditable — record why this case was escalated.
      await createAuditLog({
        case_number: caseNumber,
        action: 'SYSTEM_ESCALATION',
        decision: 'ESCALATED',
        rationale: `Automated processing failed and the case was routed to an officer. Error: ${String(err)}`,
        processed_by: 'SADDAD Worker (failure safety net)',
      })
    } catch { /* secondary failure â€” at least the job_queue was updated */ }
  }
}
