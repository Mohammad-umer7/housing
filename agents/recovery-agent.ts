// Recovery Agent (graph node) — runs ONLY when a case is not approved. It turns a
// rejection/escalation into a concrete, citizen-facing path back to eligibility:
// "here is exactly what to fix and how to get approved."
//
// Genuinely agentic: implemented as a LangGraph SUBGRAPH where the LLM autonomously
// calls two real tools — compute_affordable_targets (the math of what would pass) and
// lookup_remediation (the official guidance per blocker). A deterministic plan is
// always computed first as the ground-truth fallback if the LLM is unavailable.

import { z } from 'zod'
import { StateGraph, MessagesAnnotation, START } from '@langchain/langgraph'
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt'
import { getChatModel, getStructuredModel } from '@/lib/llm/client'
import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import {
  RECOVERY_TOOLS,
  computeAffordableTargets,
  lookupRemediation,
  type AffordableTargets,
} from '@/tools/recovery-tools'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { RecoveryPlan, RecoveryStep } from './types'

const BLOCKER_LABEL: Record<string, string> = {
  'G-00': 'An active application already exists (duplicate)',
  'G-01': 'Missing income proof',
  'G-02': 'Salary certificate not recent (30 days)',
  'G-03': 'No room under the 20% deduction rule',
  'G-04': 'Arrears cannot clear within the loan term',
  'G-05': 'Previous rescheduling default',
  'G-06': 'Priority / hardship review',
  mismatch: 'Certificate details do not match the issuing authority record',
  suspicious: 'Document flagged as likely not genuine by the AI vision review',
  tampered: 'Certificate shows signs of editing / tampering',
  invalid: 'Uploaded file is not a valid salary certificate',
  unverifiable: 'Income proof could not be verified — additional document needed',
  default: 'Officer review required',
}

// Which blockers stopped this case — drawn from the certificate-authenticity verdict
// AND the governance rule that triggered. De-duplicated, most actionable first.
function identifyBlockers(state: SaddadStateType): string[] {
  const blockers: string[] = []
  const auth = String(state.applicant?.document_authenticity ?? 'skipped')
  if (auth === 'mismatch' || auth === 'suspicious' || auth === 'tampered' || auth === 'invalid' || auth === 'unverifiable') blockers.push(auth)

  const ruleId = state.govResult?.rule_triggered?.match(/G-\d+/)?.[0]
  if (ruleId && state.govResult?.decision !== 'APPROVED') blockers.push(ruleId)

  if (blockers.length === 0) blockers.push('default')
  return [...new Set(blockers)]
}

// Deterministic, always-correct plan (also the LLM fallback). Numbers come from the
// shared compute so the guidance never invents figures.
function buildDeterministicPlan(blockers: string[], t: AffordableTargets, requiredDocs: string[] = []): RecoveryPlan {
  const steps: RecoveryStep[] = blockers.map((b) => {
    const rem = lookupRemediation(b)
    let action = rem.en
    // For a missing/unverifiable income proof, ask for the EXACT document this case needs.
    if ((b === 'G-01' || b === 'unverifiable') && requiredDocs.length > 0) {
      action = `Please upload: ${requiredDocs.join('; ')}.`
    }
    if (b === 'G-04' && t.arrearsReductionNeeded > 0) {
      action += ` Pay about AED ${t.arrearsReductionNeeded.toLocaleString()} toward the arrears (bringing them to AED ${t.maxArrearsForTerm.toLocaleString()}) so they clear within your remaining term.`
    }
    if (b === 'G-03' && t.installmentReductionFor20 > 0) {
      action += ` Reduce your existing monthly installment by about AED ${t.installmentReductionFor20.toLocaleString()} to bring it under 20% of income and free room to reschedule.`
    }
    return { issue: BLOCKER_LABEL[b] ?? b, action }
  })
  const summary = `To move your application forward: ${steps.map((s) => s.action).join(' ')}`
  const summaryAr = `لإكمال طلبك: ${blockers.map((b) => lookupRemediation(b).ar).join(' ')}`
  return { needed: true, blockers, steps, summary, summaryAr }
}

const RecoverySchema = z.object({
  steps: z.array(z.object({ issue: z.string(), action: z.string() })),
  summary: z.string(),
  summary_ar: z.string(),
})

function buildRecoverySubgraph() {
  const model = getChatModel({ temperature: 0.2, maxTokens: 700 }).bindTools(RECOVERY_TOOLS)
  const toolNode = new ToolNode(RECOVERY_TOOLS)
  async function agentNode(s: typeof MessagesAnnotation.State) {
    const res = await model.invoke(s.messages)
    return { messages: [res] }
  }
  return new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', toolsCondition)
    .addEdge('tools', 'agent')
    .compile()
}

export async function recoveryNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant, financials, govResult, finalDecision } = state
  console.log(`[RecoveryAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'recovery_agent'

  const salary = Number(applicant.monthly_salary) || 0
  const targets = computeAffordableTargets({
    salary,
    currentInstallment: Number(applicant.current_installment) || 0,
    arrears: Number(applicant.arrears_amount) || 0,
    remainingLoanMonths: Number(applicant.remaining_loan_months) || financials.remaining_loan_months,
  })
  const blockers = identifyBlockers(state)
  const requiredDocs = Array.isArray(applicant.document_missing) ? (applicant.document_missing as string[]) : []
  let plan = buildDeterministicPlan(blockers, targets, requiredDocs)

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const systemPrompt = `You are SADDAD's Recovery Agent. A citizen's housing-arrears rescheduling request was ${finalDecision} (not approved). Your job is to give them a clear, encouraging, ACTIONABLE path back to eligibility — what to fix and how.

You have two tools you may call:
  - compute_affordable_targets: the exact figures (20% total-deduction ceiling, arrears-payment headroom, and how much to reduce arrears or the existing installment) that would make the case pass.
  - lookup_remediation: the official bilingual guidance for a specific blocker key.

Rules:
- Be concrete and use EXACT numbers from the tools — never invent figures.
- One step per blocker. Be respectful and practical; this is a citizen, not an adversary.
- If the only path is officer review (e.g. priority/hardship or a prior default), say so plainly and reassure them.
- Output the final guidance in English (summary) and Arabic (summary_ar) plus a list of steps.`

    const userContext = `CASE: ${caseNumber}
DECISION: ${finalDecision}
RULE TRIGGERED: ${govResult?.rule_triggered ?? 'n/a'}
CERTIFICATE AUTHENTICITY: ${applicant.document_authenticity ?? 'skipped'}${applicant.document_authority_reason ? ` — ${applicant.document_authority_reason}` : ''}
REQUIRED DOCUMENTS (tell the citizen to provide EXACTLY these if income proof is missing): ${requiredDocs.length ? requiredDocs.join('; ') : 'none missing'}
BLOCKERS: ${blockers.join(', ')}
FIGURES: salary AED ${salary.toLocaleString()}, existing installment AED ${(Number(applicant.current_installment) || 0).toLocaleString()}, arrears AED ${(Number(applicant.arrears_amount) || 0).toLocaleString()}, remaining loan months ${Number(applicant.remaining_loan_months) || financials.remaining_loan_months}, 20% total-deduction ceiling AED ${targets.twentyPctMax.toLocaleString()}, arrears-payment headroom AED ${Math.max(0, targets.headroom).toLocaleString()}, installment reduction needed for 20% rule AED ${targets.installmentReductionFor20.toLocaleString()}, arrears reduction needed for term AED ${targets.arrearsReductionNeeded.toLocaleString()}.

Call the tools as needed, then produce the recovery guidance.`

    try {
      const sub = buildRecoverySubgraph()
      const result = await sub.invoke(
        { messages: [['system', systemPrompt], ['human', userContext]] },
        { recursionLimit: 8 },
      )
      const model = getStructuredModel(RecoverySchema, { temperature: 0.2, maxTokens: 600 })
      const parsed = await model.invoke([
        ...result.messages,
        ['human', 'Now output the final recovery guidance as structured data.'],
      ])
      const steps = Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : plan.steps
      plan = {
        needed: true,
        blockers,
        steps,
        summary: parsed.summary || plan.summary,
        summaryAr: parsed.summary_ar || plan.summaryAr,
      }
    } catch (llmErr) {
      console.warn(`[RecoveryAgent] LLM failed for case=${caseNumber}, using deterministic plan`, llmErr)
    }

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `${plan.steps.length} recovery step(s) for citizen · blockers: ${blockers.join(', ')}`,
    })
    console.log(`[RecoveryAgent] DONE case=${caseNumber} steps=${plan.steps.length} duration=${duration}ms`)
    return { recoveryPlan: plan }
  } catch (err) {
    console.error(`[RecoveryAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'done',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Recovery guidance (fallback) · blockers: ${blockers.join(', ')}`,
      })
    } catch { /* ignore */ }
    return { recoveryPlan: plan }
  }
}

// Reached when the decision is APPROVED — no recovery needed.
export async function recoverySkippedNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  await updateAgentStep(state.caseNumber, 'recovery_agent', {
    status: 'done',
    completed_at: new Date().toISOString(),
    duration_ms: 0,
    result_summary: 'No recovery needed — application approved',
  })
  return {
    recoveryPlan: { needed: false, blockers: [], steps: [], summary: '', summaryAr: '' },
  }
}
