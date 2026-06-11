// Compliance Critic (graph node) — an independent reviewer that runs AFTER rules +
// fairness and BEFORE the decision is committed, with veto power.
//
// It is implemented as a real LangGraph SUBGRAPH: a model node that can call two
// read-only lookup tools, looped through a ToolNode via toolsCondition until the
// model stops requesting tools. The LLM autonomously decides which tools to call
// (or none) — this is the genuinely agentic step. Guards preserved exactly:
//   • it can FORCE_ESCALATE (veto) an APPROVED/REJECTED → ESCALATED
//   • it can NEVER downgrade an already-ESCALATED decision (escalation is one-way)

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { StateGraph, MessagesAnnotation, START } from '@langchain/langgraph'
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt'
import { getToolCallingModel, getStructuredModel } from '@/lib/llm/client'
import { markFallback } from '@/lib/i18n'
import { updateAgentStep, getSimilarCases, getAuditLogsByCaseNumber, type AgentName } from '@/lib/data-layer'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { CriticReview, CriticVerdict } from './types'

// ── Tools the LLM may autonomously call ──────────────────────────────────────
const lookupSimilarDecisions = tool(
  async ({ debt_to_income_ratio }) => {
    const dti = Number(debt_to_income_ratio) || 0
    const similar = await getSimilarCases(dti, 5)
    return JSON.stringify({
      cases_found: similar.length,
      decisions: similar.map((c: { status: string; arrears_amount: number }) => ({ status: c.status, arrears: c.arrears_amount })),
    })
  },
  {
    name: 'lookup_similar_decisions',
    description:
      'Returns recent SADDAD decisions for cases with a similar debt-to-income ratio. Use this to verify the proposed decision aligns with precedent.',
    schema: z.object({ debt_to_income_ratio: z.number().describe('DTI ratio of the case under review (0.0 to 1.0)') }),
  },
)

const lookupCaseAuditHistory = tool(
  async ({ case_number }) => {
    const logs = await getAuditLogsByCaseNumber(String(case_number ?? ''))
    return JSON.stringify({
      prior_entries: logs.length,
      summary: logs.slice(0, 3).map((l: { action: string; decision: string; timestamp: string }) => ({ action: l.action, decision: l.decision, at: l.timestamp })),
    })
  },
  {
    name: 'lookup_case_audit_history',
    description:
      'Returns prior audit log entries for this case_number. Use this to check whether the case has been processed or escalated before, which is a compliance concern.',
    schema: z.object({ case_number: z.string().describe('Case number to look up') }),
  },
)

const CRITIC_TOOLS = [lookupSimilarDecisions, lookupCaseAuditHistory]

const CriticVerdictSchema = z.object({
  verdict: z.enum(['APPROVE_AS_IS', 'FORCE_ESCALATE']),
  complianceFlags: z.array(z.string()),
  reasoning: z.string(),
})

// The Critic's tool-using subgraph: agent ↔ tools loop.
function buildCriticSubgraph() {
  const model = getToolCallingModel(CRITIC_TOOLS, { temperature: 0, maxTokens: 600 })
  const toolNode = new ToolNode(CRITIC_TOOLS)

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

export async function criticNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant, govResult, financials, fairnessResult, proposedDecision, plan } = state
  const plannerStrategy = plan?.strategy ?? 'STANDARD'
  console.log(`[CriticAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'critic_agent'

  const defaultReview: CriticReview = {
    verdict: 'APPROVE_AS_IS',
    complianceFlags: [],
    reasoning: markFallback('Critic unavailable — proposed decision stands.'),
    finalDecision: proposedDecision,
    overrodeRules: false,
    toolsUsed: [],
  }

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    // Critic never downgrades an already-escalated decision.
    if (proposedDecision === 'ESCALATED') {
      await updateAgentStep(caseNumber, agent, {
        status: 'done',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: 'Compliance review: escalation confirmed · officer review path',
      })
      return {
        critique: {
          verdict: 'APPROVE_AS_IS',
          complianceFlags: [],
          reasoning: 'Decision already routed to officer — critic confirms.',
          finalDecision: 'ESCALATED',
          overrodeRules: false,
          toolsUsed: [],
        },
      }
    }

    const systemPrompt = `You are the SADDAD Compliance Critic Agent.
Your job: independently review a proposed housing-arrears decision against MOEI
Terms and Conditions and UAE PDPL data-handling requirements.

You receive the output of the rules engine + fairness check. You do NOT recompute
the math. You look for compliance edge cases, data-quality red flags, and
affordability concerns the mechanical 20% rule passes but a human would question.

You have access to TWO tools you can call autonomously if you want more context:
  - lookup_similar_decisions: pull recent decisions with similar DTI ratio
  - lookup_case_audit_history: check if this case_number was processed before
Use them only when relevant. You may call zero, one, or both.

Decision options:
- APPROVE_AS_IS: proposed decision stands. No compliance concerns found.
- FORCE_ESCALATE: veto. Route to an officer. Use sparingly — only when you
  identify a concrete compliance/risk issue rules + fairness did not catch.

IMPORTANT — do NOT escalate a hardship household just for being low-income. A low
salary, a high debt-to-income ratio, a recent income drop, or a low average income
per family member is HANDLED automatically by a lighter repayment plan — that is the
intended outcome (the Programme studies each case and gives a suitable plan), NOT a
reason to escalate. The two binding limits are the 20% deduction rule and the
loan-period rule; if BOTH pass, approve. Reserve FORCE_ESCALATE for a concrete,
specific risk: a certificate authenticity failure, a salary-certificate mismatch, a
prior rescheduling default, a fairness inconsistency, or a clear data anomaly.
After gathering whatever context you need, state your final verdict in plain words.`

    const userContext = `CASE: ${caseNumber}
PROPOSED DECISION: ${proposedDecision}
RULE TRIGGERED: ${govResult.rule_triggered}
RULE RATIONALE: ${govResult.reason}
FAIRNESS: ${fairnessResult.consistencyScore}% consistency across ${fairnessResult.similarCasesFound} similar cases (${fairnessResult.consistencyFlag ? 'CONSISTENT' : 'FLAGGED'})
PLANNER STRATEGY: ${plannerStrategy}${plannerStrategy === 'DEEP_REVIEW' ? ' — scrutinise aggressively; prefer to call your lookup tools before approving' : ''}
DOCUMENT SALARY MISMATCH: ${applicant.document_salary_mismatch ? 'YES — the document salary disagrees with the beneficiary record. This is a concrete data-quality / fraud red flag the mechanical rules did not catch; treat it as strong grounds to FORCE_ESCALATE.' : 'no'}
DOCUMENT VERIFICATION (uploaded document vs Programme/authority record + AI vision review): ${applicant.document_authenticity ?? 'skipped'}${applicant.document_authenticity && applicant.document_authenticity !== 'verified' && applicant.document_authenticity !== 'skipped' ? ` — ${applicant.document_authority_reason}. The document FAILED verification; this is strong grounds to FORCE_ESCALATE.` : ''}

FINANCIALS:
- Salary: AED ${(applicant.monthly_salary as number)?.toLocaleString?.() ?? '?'}
- Arrears: AED ${(applicant.arrears_amount as number)?.toLocaleString?.() ?? '?'}
- Proposed monthly payment: AED ${financials.proposed_monthly_payment.toLocaleString()}
- Proposed duration: ${financials.proposed_duration} months
- Affordability ratio: ${(financials.affordability_ratio * 100).toFixed(1)}%
- Debt-to-income ratio: ${(financials.debt_to_income_ratio * 100).toFixed(1)}%
- Within remaining loan period: ${financials.within_loan_period}
${financials.arrears_deferred ? `
DEFERRAL PLAN — THIS IS THE INTENDED OUTCOME, NOT A DATA ERROR: the beneficiary has a verified ${financials.unemployment ? 'unemployment' : 'temporary'} circumstance, so under the MOEI Assessment Matrix the arrears are DEFERRED to the end of the loan term. The existing monthly installment of AED ${financials.current_installment.toLocaleString()} stays UNCHANGED and the added arrears premium is AED 0 BY DESIGN — the citizen's salary is deliberately NOT deducted any further while the circumstance lasts. A "proposed monthly payment" of AED 0 is therefore CORRECT and fully consistent with the rule rationale; it is NOT a data inconsistency or a mismatch. Both binding rules (20% deduction, loan period) already pass, so do NOT FORCE_ESCALATE on these grounds.
` : ''}
Review the case, calling tools if useful, then give your verdict.`

    let review: CriticReview = defaultReview
    const toolsUsed: string[] = []

    try {
      const sub = buildCriticSubgraph()
      const result = await sub.invoke(
        { messages: [['system', systemPrompt], ['human', userContext]] },
        { recursionLimit: 10 },
      )

      for (const m of result.messages) {
        const tc = (m as { tool_calls?: Array<{ name: string }> }).tool_calls
        if (Array.isArray(tc)) for (const c of tc) toolsUsed.push(c.name)
      }

      // Final structured verdict from the gathered conversation (history ends on a
      // clean AI message because toolsCondition only routes to END with no pending
      // tool calls).
      const verdictModel = getStructuredModel(CriticVerdictSchema, { temperature: 0, maxTokens: 300 })
      const parsed = await verdictModel.invoke([
        ...result.messages,
        ['human', 'Now output your final verdict as structured data.'],
      ])

      // The Critic only vetoes a risky APPROVAL → officer review. It must NOT turn a
      // documents-request or a rejection into an officer escalation — a "Request
      // Documents" (G-01: wrong / missing / mismatched document) and a hard "Reject"
      // (G-00 duplicate) are final citizen-facing outcomes the citizen acts on, not
      // cases for an officer. (An already-ESCALATED decision is confirmed earlier and
      // never reaches here.) So a veto only takes effect when the proposal is APPROVED.
      const wantsEscalate = parsed.verdict === 'FORCE_ESCALATE' && proposedDecision === 'APPROVED'
      // Guard against a spurious veto of a CLEAN DEFERRAL. A verified unemployment /
      // temporary-circumstance case defers arrears to the loan end (installment unchanged,
      // AED 0 premium) — the intended Assessment-Matrix outcome, NOT a data anomaly. When
      // both binding rules pass, the document is authentic, and fairness is consistent, the
      // only legitimate escalation grounds left (document fraud) are enforced by the
      // deterministic guard below — so the LLM must not turn this approvable deferral into
      // officer review just because the AED 0 premium "looks like" a mismatch.
      const authOk = ['verified', 'skipped'].includes(String(applicant.document_authenticity ?? 'skipped'))
      const cleanDeferral =
        financials.arrears_deferred === true &&
        financials.within_loan_period === true &&
        financials.twenty_percent_rule_pass === true &&
        fairnessResult.consistencyFlag === true &&
        authOk
      if (wantsEscalate && cleanDeferral) {
        console.log(`[CriticAgent] suppressing spurious veto of a clean deferral case=${caseNumber}`)
      }
      const effectiveEscalate = wantsEscalate && !cleanDeferral
      const verdict: CriticVerdict = effectiveEscalate ? 'FORCE_ESCALATE' : 'APPROVE_AS_IS'
      const finalDecision = effectiveEscalate ? 'ESCALATED' : proposedDecision
      review = {
        verdict,
        complianceFlags: Array.isArray(parsed.complianceFlags) ? parsed.complianceFlags.slice(0, 5) : [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        finalDecision,
        overrodeRules: finalDecision !== proposedDecision,
        toolsUsed,
      }
    } catch (llmErr) {
      console.warn(`[CriticAgent] subgraph/LLM failed for case=${caseNumber}, approving as-is`, llmErr)
    }

    // Deterministic guard: a document that FAILED verification (DB cross-check
    // mismatch, vision flagged it as fabricated, internally inconsistent figures, or
    // no record to validate an income document against) must escalate to a HUMAN
    // OFFICER regardless of what the LLM concluded — the citizen is never auto-
    // rejected for a document-authenticity problem. Only upgrades APPROVED →
    // ESCALATED; never softens a hard REJECTED/ESCALATED. overrodeRules=true triggers
    // the reconcile rationale step so the citizen-facing rationale explains the
    // referral, and the officer sees the same reasoning + full verification report.
    const authenticity = String(applicant.document_authenticity ?? 'skipped')
    if (proposedDecision === 'APPROVED' && authenticity !== 'verified' && authenticity !== 'skipped') {
      const flag =
        authenticity === 'mismatch' ? 'document_content_mismatch_vs_record'
        : authenticity === 'suspicious' ? 'document_appears_fabricated_vision'
        : authenticity === 'tampered' ? 'document_tampering_detected'
        : authenticity === 'invalid' ? 'not_the_requested_document'
        : authenticity === 'unverifiable' ? 'no_authority_salary_record'
        : 'document_verification_failed'
      review = {
        verdict: 'FORCE_ESCALATE',
        complianceFlags: Array.from(new Set([flag, ...review.complianceFlags])).slice(0, 5),
        reasoning: String(
          applicant.document_authority_reason ||
          'The uploaded document could not be authenticated against the issuing authority.'
        ),
        finalDecision: 'ESCALATED',
        overrodeRules: true,
        toolsUsed: review.toolsUsed,
      }
    }

    const flagsText = review.complianceFlags.length > 0 ? ` · flags: ${review.complianceFlags.join(', ')}` : ''
    const toolsText = review.toolsUsed.length > 0 ? ` · used: ${review.toolsUsed.join(', ')}` : ''
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result_summary: `${review.verdict}${review.overrodeRules ? ' (OVERRODE → ESCALATED)' : ''}${flagsText}${toolsText}`,
    })

    console.log(`[CriticAgent] DONE case=${caseNumber} verdict=${review.verdict} tools=${toolsUsed.length} duration=${Date.now() - start}ms`)
    return { critique: review }
  } catch (err) {
    console.error(`[CriticAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Non-fatal error: ${String(err)}`,
      })
    } catch { /* ignore secondary failure */ }
    return { critique: defaultReview }
  }
}
