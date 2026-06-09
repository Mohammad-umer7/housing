// Planner Agent (graph node) — examines the incoming case and chooses the
// pipeline strategy. This is the agentic-reasoning entry point: the LLM decides
// HOW the case is processed, and the graph's conditional edges respect that
// choice (FAST_TRACK skips fairness; IMMEDIATE_ESCALATE forces escalation).

import { z } from 'zod'
import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import { getStructuredModel } from '@/lib/llm/client'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { PlannerDecision } from './types'

const PlannerSchema = z.object({
  strategy: z.enum(['FAST_TRACK', 'STANDARD', 'DEEP_REVIEW', 'IMMEDIATE_ESCALATE']),
  reasoning: z.string(),
  skipFairnessCheck: z.boolean(),
  immediateEscalationReason: z.string().nullable(),
  priorityFlags: z.array(z.string()),
})

const DEFAULT_DECISION: PlannerDecision = {
  strategy: 'STANDARD',
  reasoning: 'Planner unavailable — defaulting to standard pipeline.',
  skipFairnessCheck: false,
  immediateEscalationReason: null,
  priorityFlags: [],
}

export async function plannerNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, formData } = state
  console.log(`[PlannerAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'planner_agent'

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const arrears = Number(formData.arrears_amount) || 0
    const salary = Number(formData.monthly_salary) || 0
    const monthsInArrears = Number(formData.months_in_arrears) || 0
    const hasDocument = Boolean(formData.documentUploaded)

    const systemPrompt = `You are the SADDAD Planner Agent for MOEI housing arrears.
Your job: examine an incoming case and decide HOW it should be processed.

CASE SUMMARY:
- Arrears: AED ${arrears.toLocaleString()}
- Monthly salary: AED ${salary.toLocaleString()}
- Months in arrears: ${monthsInArrears}
- Salary certificate uploaded: ${hasDocument}
- Reschedule reason: ${formData.reschedule_reason}

YOUR DECISION OPTIONS:
- FAST_TRACK: case is clearly clean and low-risk. Recommend skipping the fairness comparison agent for speed. Use when arrears are small, salary comfortable, all docs present.
- STANDARD: default flow. Run every agent. Use when nothing stands out.
- DEEP_REVIEW: risk flags present (high arrears, long delinquency, missing data). Run everything AND mark the case for extra officer attention.
- IMMEDIATE_ESCALATE: a deal-breaker is already obvious (e.g. arrears clearly cannot be cleared within the remaining loan period even at the 20% installment, or the debt burden is far above the 60% limit). Provide the reason.

Set skipFairnessCheck=true only for FAST_TRACK. Set immediateEscalationReason only when strategy is IMMEDIATE_ESCALATE (else null). priorityFlags are short tags for downstream agents.`

    let decision: PlannerDecision = DEFAULT_DECISION

    try {
      const model = getStructuredModel(PlannerSchema, { temperature: 0.1, maxTokens: 300 })
      const parsed = await model.invoke([
        ['system', systemPrompt],
        ['human', 'Pick the strategy for this case.'],
      ])
      decision = {
        strategy: parsed.strategy,
        reasoning: parsed.reasoning || 'No reasoning provided',
        skipFairnessCheck: Boolean(parsed.skipFairnessCheck),
        immediateEscalationReason:
          parsed.strategy === 'IMMEDIATE_ESCALATE'
            ? parsed.immediateEscalationReason || 'Planner flagged this case for immediate review'
            : null,
        priorityFlags: Array.isArray(parsed.priorityFlags) ? parsed.priorityFlags.slice(0, 5) : [],
      }
    } catch (llmErr) {
      console.warn(`[PlannerAgent] LLM call failed for case=${caseNumber}, defaulting to STANDARD`, llmErr)
    }

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `Strategy: ${decision.strategy} · ${decision.reasoning}`,
    })

    console.log(`[PlannerAgent] DONE case=${caseNumber} strategy=${decision.strategy} duration=${duration}ms`)
    return { plan: decision }
  } catch (err) {
    console.error(`[PlannerAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Non-fatal error: ${String(err)}`,
      })
    } catch { /* ignore secondary failure */ }
    return { plan: DEFAULT_DECISION }
  }
}
