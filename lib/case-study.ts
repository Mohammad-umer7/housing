// Assembles the structured recommendation the challenge brief mandates (§8): the
// "case study" an officer (or the citizen) reads. Pure function over the merged
// applicant + financial analysis + governance result.

import {
  toRecommendation,
  type FinancialAnalysis,
  type GovernanceResult,
  type Recommendation,
} from '@/governance/housing-arrears'

export type CaseStudy = {
  applicationStatus: 'Complete' | 'Incomplete'
  caseSummary: string
  incomeAnalysis: { salary: number; stability: string; perMemberAverage: number; familySize: number }
  arrearsAmount: number
  remainingLoanBalance: number
  remainingRepaymentPeriodMonths: number
  unpaidInstallments: number
  proposedDeductionRate: number // percent
  proposedRepaymentPlan: { durationMonths: number; monthlyInstallment: number; planType: string; newEmi: number }
  twentyPercentRule: 'Pass' | 'Fail'
  periodRule: 'Pass' | 'Fail'
  recommendation: Recommendation
  reasoning: string
}

export function buildCaseStudy(params: {
  applicant: Record<string, unknown>
  financials: FinancialAnalysis
  govResult: GovernanceResult
  finalDecision: string
  reasoning: string
  documentsComplete: boolean
}): CaseStudy {
  const { applicant, financials: f, govResult, finalDecision, reasoning, documentsComplete } = params
  const marital = String(applicant.marital_status || '').trim()
  const maritalLabel = marital ? `${marital[0].toUpperCase()}${marital.slice(1)}` : 'UAE national'
  const decision = (finalDecision || govResult.decision) as 'APPROVED' | 'REJECTED' | 'ESCALATED'

  // Distinguish a FRAUD/authenticity concern (mismatch / vision-suspicious / tampered)
  // from a RECOVERABLE document gap (missing or invalid/unverifiable). Fraud must go to a
  // HUMAN ("Refer to Employee" — don't just ask the citizen to resubmit); a recoverable
  // gap becomes "Request Documents" so the citizen can upload the right file. A REJECTED
  // decision is a hard "Reject" only for a duplicate active application (G-00); a
  // missing-documents rejection (G-01) is a recoverable "Request Documents".
  const auth = String(applicant.document_authenticity ?? 'skipped')
  const fraudDocIssue = auth === 'mismatch' || auth === 'suspicious' || auth === 'tampered'
  const recoverableDocIssue = !documentsComplete || auth === 'invalid' || auth === 'unverifiable'
  let recommendation = toRecommendation(decision, govResult.rule_triggered)
  if (decision === 'ESCALATED' && recoverableDocIssue && !fraudDocIssue) recommendation = 'Request Documents'

  return {
    applicationStatus: documentsComplete ? 'Complete' : 'Incomplete',
    caseSummary:
      `${maritalLabel} beneficiary, household of ${f.family_size}, salary AED ${(Number(applicant.monthly_salary) || 0).toLocaleString()}` +
      `${f.is_hardship ? ' (hardship — low per-member income / income change)' : ''}. ` +
      `Arrears AED ${(Number(applicant.arrears_amount) || 0).toLocaleString()} over ${f.months_in_arrears} unpaid installments; existing installment AED ${f.current_installment.toLocaleString()}.`,
    incomeAnalysis: {
      salary: Number(applicant.monthly_salary) || 0,
      stability: f.unemployment
        ? 'Unemployed / no stable income'
        : f.temporary_circumstance
        ? 'Temporary supporting circumstance'
        : f.income_changed
        ? 'Income reduced / changed'
        : 'Stable',
      perMemberAverage: f.per_member_income,
      familySize: f.family_size,
    },
    arrearsAmount: Number(applicant.arrears_amount) || 0,
    remainingLoanBalance: f.remaining_loan_balance,
    remainingRepaymentPeriodMonths: f.remaining_loan_months,
    unpaidInstallments: f.months_in_arrears,
    proposedDeductionRate: Math.round(f.proposed_deduction_rate * 100),
    proposedRepaymentPlan: {
      durationMonths: decision === 'APPROVED' ? f.proposed_duration : 0,
      monthlyInstallment: decision === 'APPROVED' ? f.arrears_premium : 0,
      planType: f.plan_type,
      newEmi: decision === 'APPROVED' ? f.new_emi : 0,
    },
    twentyPercentRule: f.twenty_percent_rule_pass ? 'Pass' : 'Fail',
    periodRule: f.period_rule_pass ? 'Pass' : 'Fail',
    recommendation,
    reasoning,
  }
}
