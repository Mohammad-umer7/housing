// Rules Agent (graph node) — runs the hard governance rules (G-01…G-06) as
// deterministic guardrails first, then asks the LLM for judgment + bilingual
// rationale ON TOP. The guardrails are sticky: the LLM may upgrade an APPROVED to
// ESCALATED, but can NEVER soften a hard REJECTED or downgrade an ESCALATED.
//
// reconcileNode is the reflection step: when the Critic vetoes downstream, the
// Rules Agent revisits its own rationale and reconciles it with the Critic's
// concern — a genuine agent-to-agent exchange, recorded against rules_agent.

import { z } from 'zod'
import { applyGovernanceRules } from '@/governance/housing-arrears'
import type { GovernanceResult } from '@/governance/housing-arrears'
import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import { getStructuredModel } from '@/lib/llm/client'
import { arabicOrFallback, markFallback } from '@/lib/i18n'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'

const RulesSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'ESCALATED']),
  confidence: z.number(),
  reasoning: z.string(),
  rationale: z.string(),
  rationale_ar: z.string(),
  additionalRiskFactors: z.array(z.string()),
  recommendedAction: z.string(),
})

const ReconcileSchema = z.object({
  rationale: z.string(),
  rationale_ar: z.string(),
})

export async function rulesNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant, financials } = state
  console.log(`[RulesAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'rules_agent'

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const hardRules = applyGovernanceRules(
      Number(applicant.arrears_amount),
      Number(applicant.monthly_salary),
      Boolean(applicant.previous_default),
      financials,
      Boolean(applicant.document_valid),
      {
        documentFresh: applicant.document_fresh !== false,
        hasActiveApplication: Boolean(applicant.has_active_application),
        // Direct Debit Authority required (G-06): no DDA → reject + enrol with EDB.
        hasDda: applicant.auto_dda !== false,
        // When the document agent bounced the upload back (wrong document / details do
        // not match), surface its specific reason as the G-01 citizen-facing message.
        documentRequestReason: String(applicant.document_authority_reason || '') || undefined,
      },
    )

    const systemPrompt = `You are SADDAD, an expert AI decision agent for the UAE Ministry of Energy and Infrastructure housing arrears rescheduling platform.

OFFICIAL SZHP / MOEI GOVERNANCE RULES (rescheduling an EXISTING housing loan in arrears):
- G-00: KEY RULE 3 — the beneficiary must not already have an active rescheduling application → REJECT (genuine denial, "Reject") if a duplicate active request exists
- G-01: A recent salary certificate (or notarised non-work letter if unemployed) must be present → REJECT if missing (Request Documents)
- G-02: Salary certificate must be issued within the last 30 days → ESCALATE if stale
- G-03: KEY RULE 1 — the TOTAL salary deduction (existing installment + arrears premium) must not exceed 20% of income. The premium fills the headroom up to 20%. If the existing installment already uses 20%+, there is no room → ESCALATE
- G-04: KEY RULE 2 — the arrears must clear within the remaining/original loan repayment period → ESCALATE if exceeded
- G-05: No previous rescheduling default / intentional negligence → ESCALATE if found
- SOCIAL CATEGORY (widow, orphan, senior, person of determination, from UAE PASS) is NOT a reason to escalate. A priority beneficiary is assessed exactly like everyone else. Do NOT escalate a case merely because the applicant is a priority category. (If a case escalates for one of the rules above, it is separately fast-tracked to the officer — but that is a handling step, not your decision.)
- §6 PERSONALISATION: families with average income per member < AED 2,500 (or a recent income drop) get a LIGHTER plan (target ~15% deduction), not a rejection.

CASE DATA:
${JSON.stringify({
  applicantName: applicant.full_name,
  caseNumber,
  monthlySalary: applicant.monthly_salary,
  familySize: financials.family_size,
  numberOfChildren: applicant.number_of_children,
  maritalStatus: applicant.marital_status,
  socialStatus: applicant.social_status,        // UAE PASS: none | widow | orphan | senior | determination
  priorityGroup: Boolean(applicant.priority_group),
  perMemberIncome: financials.per_member_income,
  isHardship: financials.is_hardship,
  incomeChanged: financials.income_changed,
  unemployment: financials.unemployment,
  temporaryCircumstance: financials.temporary_circumstance,
  arrearsDeferred: financials.arrears_deferred,
  hasActiveApplication: Boolean(applicant.has_active_application),
  arrearsAmount: applicant.arrears_amount,
  unpaidInstallments: applicant.months_in_arrears,
  previousDefault: applicant.previous_default,
  rescheduleReason: applicant.reschedule_reason,
  documentValid: applicant.document_valid,
  currentInstallment: financials.current_installment,
  proposedDeductionRate: financials.proposed_deduction_rate,
  arrearsPremium: financials.arrears_premium,
  proposedDuration: financials.proposed_duration,
  planType: financials.plan_type,
  remainingLoanMonths: financials.remaining_loan_months,
  twentyPercentRulePass: financials.twenty_percent_rule_pass,
  periodRulePass: financials.period_rule_pass,
  riskScore: financials.risk_score,
}, null, 2)}

RULES ENGINE DECISION: ${hardRules.decision}
TRIGGERED RULE: ${hardRules.rule_triggered}

Your task:
1. Review this case holistically considering all available information
2. You may UPGRADE an APPROVED decision to ESCALATED if you identify risks the rules missed
3. You may NEVER soften a hard-rules REJECTED decision to ESCALATED or APPROVED — hard rejections are final
4. You may NEVER downgrade an ESCALATED decision to APPROVED
5. If the rules engine already rejected or escalated, confirm it — your job is to provide rationale, not override
6. Per brief §4/§10, factor in the beneficiary's family status (family size + average income per family member): a low per-member income warrants a lighter plan. You MAY note the social category for context, but it must NOT change the decision (it is not grounds to escalate or reject)
7. Provide formal rationale in English (rationale) and Arabic (rationale_ar) for the applicant. CRITICAL: "rationale_ar" MUST be written in the ARABIC language using Arabic script (العربية) — never English, Vietnamese, Chinese, or any other language.`

    let aiRationale = hardRules.reason
    let rationaleAr = ''
    let finalDecision = hardRules.decision

    try {
      const model = getStructuredModel(RulesSchema, { temperature: 0.1, maxTokens: 800 })
      const llmResult = await model.invoke([
        ['system', systemPrompt],
        ['human', 'Analyze this case and provide your decision and bilingual rationale.'],
      ])

      if (hardRules.decision === 'REJECTED') {
        finalDecision = 'REJECTED'
      } else if (hardRules.decision === 'ESCALATED') {
        finalDecision = 'ESCALATED'
      } else {
        finalDecision = llmResult.decision === 'ESCALATED' ? 'ESCALATED' : 'APPROVED'
      }

      aiRationale = llmResult.rationale || hardRules.reason
      // Only keep the model's Arabic if it is genuinely Arabic (the model sometimes
      // returns the wrong language); otherwise leave it empty so no non-Arabic text shows.
      rationaleAr = arabicOrFallback(llmResult.rationale_ar, '')
    } catch {
      console.warn(`[RulesAgent] LLM call failed for case=${caseNumber}, using hard rules result`)
      aiRationale = markFallback(aiRationale)
    }

    const govResult: GovernanceResult = {
      ...hardRules,
      decision: finalDecision as GovernanceResult['decision'],
      reason: aiRationale,
    }

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `Decision: ${finalDecision} · ${hardRules.rule_triggered}${rationaleAr ? ' · Arabic ✓' : ''}`,
    })

    console.log(`[RulesAgent] DONE case=${caseNumber} decision=${finalDecision} duration=${duration}ms`)
    return { govResult, aiRationale, rationaleAr }
  } catch (err) {
    await updateAgentStep(caseNumber, agent, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result_summary: String(err),
    })
    throw err
  }
}

// Reflection node — reached only when the Critic vetoed (overrodeRules).
export async function reconcileNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, aiRationale, rationaleAr, critique } = state
  const fallback = {
    finalRationale: `${aiRationale}\n\nThis case has been referred to a specialist officer following independent compliance review: ${critique.reasoning}`,
    finalRationaleAr: rationaleAr,
  }

  try {
    const systemPrompt = `You are SADDAD's Rules Agent performing a RECONCILIATION step.
The independent Compliance Critic vetoed the proposed decision and forced escalation to a human officer.
Revise the applicant-facing rationale so that it (a) clearly states the case is now referred to a specialist officer for review, and (b) respectfully reflects the compliance concern raised. Do NOT contradict the escalation. Keep it to 2 sentences per language (rationale = English, rationale_ar = Arabic).

ORIGINAL RATIONALE (EN): ${aiRationale}
ORIGINAL RATIONALE (AR): ${rationaleAr || '(none)'}
CRITIC CONCERN: ${critique.reasoning}
CRITIC FLAGS: ${critique.complianceFlags.join(', ') || 'none'}`

    const model = getStructuredModel(ReconcileSchema, { temperature: 0.1, maxTokens: 400 })
    const parsed = await model.invoke([
      ['system', systemPrompt],
      ['human', 'Produce the reconciled rationale.'],
    ])

    await updateAgentStep(caseNumber, 'rules_agent', {
      result_summary: `Rationale revised after Critic veto · ${critique.complianceFlags.join(', ') || 'compliance concern'}`,
    })

    return {
      finalRationale: parsed.rationale || fallback.finalRationale,
      finalRationaleAr: arabicOrFallback(parsed.rationale_ar, rationaleAr),
    }
  } catch {
    console.warn(`[RulesAgent] reconciliation LLM failed for case=${caseNumber}, using fallback`)
    return { ...fallback, finalRationale: markFallback(fallback.finalRationale) }
  }
}
