// Escalation & Audit (graph node) — commits the final decision to the case record
// and writes the immutable audit log. Runs in parallel with Communication.
// The audit write is REQUIRED, not best-effort: if it fails, the error propagates
// so the worker safety-net escalates the case (no decision is committed without an
// audit trail). An approved decision also posts the write-back to the loan servicer.

import { updateAgentStep, createAuditLog, type AgentName } from '@/lib/data-layer'
import { executeDatabaseTool } from '@/tools/database-tools'
import { submitApprovalToLoanServicer } from '@/lib/integrations/source-systems'
import { LLM_MODEL } from '@/lib/llm/client'
import { buildCaseStudy } from '@/lib/case-study'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'

// Postgres TEXT rejects NUL bytes; AI-generated text occasionally contains them.
// Built from a char code so the source file stays pure ASCII (no literal NUL).
const NUL = String.fromCharCode(0)
const stripNul = (s: string) => s.split(NUL).join('')

export async function escalationNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant, govResult, financials, fairnessResult, recoveryPlan, docResult } = state
  const aiRationale = state.finalRationale
  const rationaleAr = state.finalRationaleAr
  const riskLevel = state.riskForecast?.riskLevel ?? 'MEDIUM'
  const finalDecision = state.finalDecision
  console.log(`[EscalationAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'escalation_agent'

  try {
    await updateAgentStep(caseNumber, agent, {
      status: 'running',
      started_at: new Date().toISOString(),
      ran_in_parallel: true,
    })

    const decisionStatus = finalDecision.toLowerCase()
    const isApproved = decisionStatus === 'approved'

    // §8 structured recommendation (the brief's required output format).
    const caseStudy = buildCaseStudy({
      applicant,
      financials,
      govResult,
      finalDecision,
      reasoning: aiRationale,
      documentsComplete: applicant.document_valid !== false,
    })

    await executeDatabaseTool('update_case', {
      caseNumber,
      caseData: {
        full_name: applicant.full_name,
        emirates_id: applicant.emirates_id,
        phone: applicant.phone,
        arrears_amount: Number(applicant.arrears_amount),
        monthly_salary: Number(applicant.monthly_salary),
        monthly_expenses: Number(applicant.monthly_expenses) || 0,
        status: decisionStatus,
        decision_reason: aiRationale,
        monthly_payment: isApproved ? financials.proposed_monthly_payment : null,
        duration_months: isApproved ? financials.proposed_duration : null,
        risk_score: financials.risk_score,
        debt_to_income_ratio: financials.debt_to_income_ratio,
        processed_at: new Date().toISOString(),
        rationale_ar: rationaleAr,
        risk_level: riskLevel,
        consistency_score: fairnessResult.consistencyScore,
        similar_cases_found: fairnessResult.similarCasesFound,
        fairness_note: fairnessResult.fairnessNote,
        loan_bank_name: String(applicant.loan_bank_name || ''),
        loan_account_number: String(applicant.loan_account_number || ''),
        total_loan_amount: Number(applicant.total_loan_amount) || null,
        remaining_loan_balance: financials.remaining_loan_balance || null,
        current_installment: Number(applicant.current_installment) || null,
        remaining_loan_months: Number(applicant.remaining_loan_months) || null,
        total_new_monthly_payment: isApproved ? financials.total_new_monthly : null,
        recovery_guidance: recoveryPlan?.needed ? stripNul(recoveryPlan.summary) : null,
        recovery_guidance_ar: recoveryPlan?.needed ? stripNul(recoveryPlan.summaryAr) : null,
        case_study: caseStudy,
        verification_report: docResult?.verificationReport ?? null,
        // UAE PASS social signal — stored for the officer view. `priority_escalation`
        // is the fast-track flag: TRUE only when a PRIORITY beneficiary's case was
        // escalated for a genuine reason (priority never escalates on its own).
        social_status: String(applicant.social_status || 'none'),
        is_priority: Boolean(applicant.priority_group),
        priority_escalation: Boolean(applicant.priority_group) && decisionStatus === 'escalated',
      },
    })

    await createAuditLog({
      case_number: caseNumber,
      action: 'AGENT_DECISION',
      decision: finalDecision,
      rule_triggered: govResult.rule_triggered,
      rationale: stripNul(aiRationale),
      financial_snapshot: {
        ...financials,
        risk_level: riskLevel,
        consistency_score: fairnessResult.consistencyScore,
        fairness_overridden: finalDecision !== govResult.decision,
      },
      agent_model: LLM_MODEL,
      processed_by: 'SADDAD AI Agent v4.0 (LangGraph)',
    })

    if (isApproved) {
      try {
        await submitApprovalToLoanServicer(caseNumber, {
          monthlyPayment: financials.proposed_monthly_payment,
          durationMonths: financials.proposed_duration,
        })
      } catch (wbErr) {
        console.warn(`[EscalationAgent] loan-servicer write-back stub failed (non-fatal) case=${caseNumber}`, wbErr)
      }
    }

    const duration = Date.now() - start
    const overrideNote = finalDecision !== govResult.decision ? ` (overridden from ${govResult.decision})` : ''
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `CRM updated - Decision: ${finalDecision}${overrideNote} - Risk: ${riskLevel}`,
    })

    console.log(`[EscalationAgent] DONE case=${caseNumber} decision=${finalDecision} duration=${duration}ms`)
    return {}
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
