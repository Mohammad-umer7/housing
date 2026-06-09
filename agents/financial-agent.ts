// Financial Agent (graph node) — applies the official MOEI 20% installment rule.
// Deterministic (no LLM) so the money math is identical on every run for audit
// reproducibility. Reads the merged applicant record from state.

import { analyzeFinancials, classifyRequestCircumstances, loadActiveRules } from '@/governance/housing-arrears'
import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'

export async function financialNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant } = state
  console.log(`[FinancialAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'financial_agent'

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const salary = Number(applicant.monthly_salary)
    const arrears = Number(applicant.arrears_amount)
    const expenses = Number(applicant.monthly_expenses) || 0
    const monthsInArrears = Number(applicant.months_in_arrears) || 0
    const rescheduleReason = String(applicant.reschedule_reason || 'other')
    const remainingLoanMonths = Number(applicant.remaining_loan_months) || 60
    const currentInstallment = Number(applicant.current_installment) || 0
    const isRetiree =
      Boolean(applicant.is_retiree) ||
      String(applicant.employment_status || '').toLowerCase() === 'retired'
    const familySize = Number(applicant.family_size) || 1
    // Read the beneficiary's request (structured reason + free-text remarks /
    // justifications) the way an officer would — income change, unemployment, or a
    // temporary supporting circumstance (Brief Assessment Matrix).
    const requestText = `${applicant.remarks ?? ''} ${applicant.justifications ?? ''}`
    const circ = classifyRequestCircumstances(rescheduleReason, requestText)
    const incomeChanged = Boolean(applicant.income_changed) || circ.income_changed
    const remainingLoanBalance =
      Number(applicant.remaining_loan_balance) > 0 ? Number(applicant.remaining_loan_balance) : null

    // Load admin-configured rule overrides (DB values override statutory defaults).
    // The cache means this is effectively free after the first call per deploy.
    const rules = await loadActiveRules()

    const financials = analyzeFinancials(
      arrears,
      salary,
      expenses,
      monthsInArrears,
      rescheduleReason,
      remainingLoanMonths,
      currentInstallment,
      isRetiree,
      familySize,
      incomeChanged,
      remainingLoanBalance,
      circ.unemployment,
      circ.temporary_circumstance,
      rules,
    )

    const duration = Date.now() - start
    const hardshipNote = financials.is_hardship ? ' · HARDSHIP (lighter)' : ''
    const deferNote = financials.arrears_deferred
      ? ` · DEFERRED (${financials.unemployment ? 'unemployment' : 'temporary circumstance'})`
      : ''
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `Deduction ${Math.round(financials.proposed_deduction_rate * 100)}% (premium AED ${financials.arrears_premium.toLocaleString()}/mo) × ${financials.proposed_duration}mo · ${financials.plan_type} · per-member AED ${financials.per_member_income.toLocaleString()}${hardshipNote}${deferNote} · 20%:${financials.twenty_percent_rule_pass ? 'PASS' : 'FAIL'} period:${financials.period_rule_pass ? 'PASS' : 'FAIL'} · Risk ${financials.risk_score}`,
    })

    console.log(`[FinancialAgent] DONE case=${caseNumber} duration=${duration}ms`)
    return { financials }
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
