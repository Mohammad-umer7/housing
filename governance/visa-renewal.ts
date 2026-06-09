// A SECOND federal service on the SADDAD platform — Ministry of Interior visa
// renewals — proving the architecture is a *platform*, not a one-off app.
//
// This module implements the exact same ServiceModule contract as
// housing-arrears.ts and runs through the identical shared rule engine
// (evaluateRules in governance/types.ts). It is registered in
// governance/registry.ts and exercised by tests/service-registry.test.ts, which
// proves a visa case flows through the same decision engine with ZERO changes to
// the engine — only a new rulebook.
//
// The rules below are ILLUSTRATIVE (not the real MOI Visa Terms & Conditions).
// To productionize: replace these six rules with the published MOI rulebook and
// point an intake route at this module's `decide()`. Estimated onboarding effort
// for a new federal service onto SADDAD: ~2-3 engineer weeks vs ~3-6 months to
// build from scratch.

import { evaluateRules, type GovernanceRule, type ServiceModule } from './types'

export type VisaDecision = 'APPROVED' | 'REJECTED' | 'ESCALATED'

export type VisaAnalysis = {
  applicant_age: number
  sponsor_status: 'employed' | 'unemployed' | 'business_owner' | 'retired'
  sponsor_monthly_salary: number
  visa_type: 'employment' | 'family' | 'investor' | 'student'
  current_visa_expires_in_days: number
  previous_overstay_days: number
  medical_fitness_valid: boolean
  emirates_id_valid: boolean
}

export type VisaGovernanceResult = {
  decision: VisaDecision
  reason: string
  rule_triggered: string
  analysis: VisaAnalysis
}

// Illustrative MOI Visa rules — same GovernanceRule shape as housing-arrears.
export const VISA_GOVERNANCE_RULES: GovernanceRule<VisaAnalysis>[] = [
  {
    id: 'V-01',
    name: 'Identity Verification',
    description: 'Valid Emirates ID must be on file',
    check: (data) => data.emirates_id_valid,
    failOutcome: 'REJECT',
    failReason: 'Emirates ID missing or expired — applicant must update ID first',
  },
  {
    id: 'V-02',
    name: 'Medical Fitness',
    description: 'Valid medical fitness certificate required for visa renewal',
    check: (data) => data.medical_fitness_valid,
    failOutcome: 'REJECT',
    failReason: 'Medical fitness certificate missing or expired',
  },
  {
    id: 'V-03',
    name: 'Sponsor Income Threshold',
    description: 'Family visa sponsor must earn at least AED 4,000/month',
    check: (data) =>
      data.visa_type !== 'family' || data.sponsor_monthly_salary >= 4000,
    failOutcome: 'ESCALATE',
    failReason: 'Sponsor income below family-visa minimum — officer review required',
  },
  {
    id: 'V-04',
    name: 'Overstay History',
    description: 'Previous overstay > 30 days requires officer review',
    check: (data) => data.previous_overstay_days <= 30,
    failOutcome: 'ESCALATE',
    failReason: 'Previous overstay history flagged — officer review required',
  },
  {
    id: 'V-05',
    name: 'Renewal Window',
    description: 'Visa must be within 60-day renewal window or already expired',
    check: (data) =>
      data.current_visa_expires_in_days <= 60 && data.current_visa_expires_in_days >= -30,
    failOutcome: 'ESCALATE',
    failReason: 'Renewal request outside standard 60-day window — officer review',
  },
  {
    id: 'V-06',
    name: 'Sponsor Employment Status',
    description: 'Unemployed sponsors cannot renew family visas without review',
    check: (data) =>
      data.visa_type !== 'family' || data.sponsor_status !== 'unemployed',
    failOutcome: 'ESCALATE',
    failReason: 'Sponsor unemployed — family visa renewal requires officer review',
  },
]

const APPROVED_REASON = 'All MOI visa-renewal rules satisfied — auto-approved.'

export function applyVisaGovernanceRules(analysis: VisaAnalysis): VisaGovernanceResult {
  // Same shared engine that housing-arrears uses — different rulebook, no new code.
  const result = evaluateRules(VISA_GOVERNANCE_RULES, analysis, APPROVED_REASON)
  return { ...result, analysis }
}

function toVisaAnalysis(input: Record<string, unknown>): VisaAnalysis {
  return {
    applicant_age: Number(input.applicant_age) || 0,
    sponsor_status: (input.sponsor_status as VisaAnalysis['sponsor_status']) ?? 'employed',
    sponsor_monthly_salary: Number(input.sponsor_monthly_salary) || 0,
    visa_type: (input.visa_type as VisaAnalysis['visa_type']) ?? 'employment',
    current_visa_expires_in_days: Number(input.current_visa_expires_in_days) || 0,
    previous_overstay_days: Number(input.previous_overstay_days) || 0,
    medical_fitness_valid: input.medical_fitness_valid !== false,
    emirates_id_valid: input.emirates_id_valid !== false,
  }
}

// ── ServiceModule wiring ──────────────────────────────────────────────────────
export const visaRenewalModule: ServiceModule = {
  id: 'visa-renewal',
  displayName: 'MOI Visa Renewal (illustrative)',
  displayNameAr: 'تجديد التأشيرة',
  ruleCount: VISA_GOVERNANCE_RULES.length,
  decide: (input) => {
    const analysis = toVisaAnalysis(input)
    const result = evaluateRules(VISA_GOVERNANCE_RULES, analysis, APPROVED_REASON)
    return { ...result, analysis }
  },
}
