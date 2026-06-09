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

  // The recommendation always mirrors the final decision so the citizen card is never
  // self-contradictory. The document agent already routed the case correctly upstream:
  //   • a wrong / missing / invalid / mismatched document → REJECTED (G-01) → "Request
  //     Documents" (the citizen re-uploads the right file)
  //   • a VALID document with an authenticity concern (vision-suspicious / tampered) →
  //     APPROVED-then-escalated by the Critic → "Refer to Employee" (a human reviews it)
  // So: APPROVED→Approve, ESCALATED→Refer to Employee, REJECTED→Reject (G-00 duplicate)
  // or Request Documents (G-01).
  const recommendation = toRecommendation(decision, govResult.rule_triggered)

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
