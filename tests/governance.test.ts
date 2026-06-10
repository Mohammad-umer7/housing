// Tests for the rescheduling decision criteria shown in the Brief Assessment Matrix:
//   Income/Salary  · Financial Obligations (DBR)  · Unemployment  · Temporary Circumstances

import {
  calculateReschedulingPlan,
  analyzeFinancials,
  applyGovernanceRules,
  classifyRequestCircumstances,
} from '@/governance/housing-arrears'

// ---------------------------------------------------------------------------
// 1. UNEMPLOYMENT — "Move arrears to end WITHOUT increasing the monthly installment"
// ---------------------------------------------------------------------------
describe('Unemployment — zero premium, term extension, G-04 waived', () => {
  it('produces zero arrears premium for deferArrears plan', () => {
    const plan = calculateReschedulingPlan(30_000, 8_000, 60, 1_000, 0.20, { deferArrears: true })
    expect(plan.arrearsPremium).toBe(0)
    expect(plan.monthlyPayment).toBe(0)
    expect(plan.planType).toBe('TRANSFER_ARREARS')
  })

  it('keeps totalDeduction equal to currentInstallment (no extra monthly charge)', () => {
    const plan = calculateReschedulingPlan(30_000, 8_000, 60, 1_000, 0.20, { deferArrears: true })
    expect(plan.totalDeduction).toBe(1_000)
  })

  it('withinLoanPeriod is true even when arrears need more months than remaining term', () => {
    // 50_000 arrears at AED 1_000/month needs 50 months but only 30 remain — still deferred
    const plan = calculateReschedulingPlan(50_000, 8_000, 30, 1_000, 0.20, { deferArrears: true })
    expect(plan.withinLoanPeriod).toBe(true)
    expect(plan.twentyPercentRulePass).toBe(true)
  })

  it('works when salary is 0 (truly unemployed — no income)', () => {
    const plan = calculateReschedulingPlan(20_000, 0, 60, 800, 0.20, { deferArrears: true })
    expect(plan.arrearsPremium).toBe(0)
    expect(plan.twentyPercentRulePass).toBe(true)
    expect(plan.withinLoanPeriod).toBe(true)
  })

  it('analyzeFinancials with job_loss → unemployment flag + zero premium', () => {
    const fin = analyzeFinancials(30_000, 8_000, 500, 3, 'job_loss', 60, 1_000, false, 3, true, null, true, false)
    expect(fin.unemployment).toBe(true)
    expect(fin.arrears_premium).toBe(0)
    expect(fin.plan_type).toBe('TRANSFER_ARREARS')
    expect(fin.total_new_monthly).toBe(1_000)  // installment unchanged
    expect(fin.arrears_deferred).toBe(true)
    expect(fin.twenty_percent_rule_pass).toBe(true)
    expect(fin.period_rule_pass).toBe(true)
  })

  it('job_loss case fully approves when documents valid', () => {
    const fin = analyzeFinancials(30_000, 8_000, 500, 3, 'job_loss', 60, 1_000, false, 3, true, null, true, false)
    const gov = applyGovernanceRules(30_000, 8_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('APPROVED')
    expect(gov.reason).toContain('Unemployment')
    expect(gov.reason).toContain('Monthly installment remains unchanged')
  })

  it('classifyRequestCircumstances detects job loss from free text', () => {
    const c = classifyRequestCircumstances('other', 'I was laid off last month')
    expect(c.unemployment).toBe(true)
  })

  it('classifyRequestCircumstances detects unemployment from structured reason', () => {
    const c = classifyRequestCircumstances('job_loss', '')
    expect(c.unemployment).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. TEMPORARY SUPPORTING CIRCUMSTANCES — "Move arrears to end / postpone increase"
// ---------------------------------------------------------------------------
describe('Temporary circumstance (medical/official assignment) — same deferral policy', () => {
  it('produces zero premium for temporary_circumstance', () => {
    const fin = analyzeFinancials(25_000, 7_000, 500, 2, 'medical_expenses', 80, 600, false, 4, false, null, false, true)
    expect(fin.temporary_circumstance).toBe(true)
    expect(fin.arrears_premium).toBe(0)
    expect(fin.plan_type).toBe('TRANSFER_ARREARS')
    expect(fin.total_new_monthly).toBe(600)  // unchanged
    expect(fin.arrears_deferred).toBe(true)
  })

  it('temporary circumstance case approves when documents valid', () => {
    const fin = analyzeFinancials(25_000, 7_000, 500, 2, 'medical_expenses', 80, 600, false, 4, false, null, false, true)
    const gov = applyGovernanceRules(25_000, 7_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('APPROVED')
    expect(gov.reason).toContain('Temporary circumstance')
    expect(gov.reason).toContain('Monthly installment remains unchanged')
  })

  it('classifyRequestCircumstances detects medical leave from free text', () => {
    const c = classifyRequestCircumstances('other', 'Son needs medical treatment abroad for 6 months')
    expect(c.temporary_circumstance).toBe(true)
  })

  it('classifyRequestCircumstances detects official assignment', () => {
    const c = classifyRequestCircumstances('other', 'I am on an official assignment overseas')
    expect(c.temporary_circumstance).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. INCOME / SALARY — income down → lighter plan; income stable → normal plan
// ---------------------------------------------------------------------------
describe('Income / salary certificate — plan adjusts to income change', () => {
  it('salary_reduction → lighter deduction target (15%)', () => {
    const fin = analyzeFinancials(15_000, 7_000, 300, 2, 'salary_reduction', 84, 800, false, 2, true)
    expect(fin.is_hardship).toBe(true)
    expect(fin.target_deduction_rate).toBe(0.15)
  })

  it('stable income, normal family → full 20% target', () => {
    const fin = analyzeFinancials(15_000, 10_000, 300, 1, 'other', 84, 1_000, false, 2, false)
    expect(fin.is_hardship).toBe(false)
    expect(fin.target_deduction_rate).toBe(0.20)
  })

  it('income increased (higher salary) → larger headroom → lower duration', () => {
    const planHigh = calculateReschedulingPlan(20_000, 12_000, 60, 1_000)
    const planLow  = calculateReschedulingPlan(20_000, 6_000,  60, 1_000)
    // With more salary, headroom is larger → arrears clear faster
    expect(planHigh.durationMonths).toBeLessThan(planLow.durationMonths)
  })

  it('income decreased below 20% ceiling → G-03 escalates', () => {
    // currentInstallment already at 22% of new (reduced) salary → no room
    const fin = analyzeFinancials(20_000, 5_000, 0, 2, 'salary_reduction', 60, 1_100, false, 1, true)
    expect(fin.twenty_percent_rule_pass).toBe(false)
    const gov = applyGovernanceRules(20_000, 5_000, false, fin, true)
    expect(gov.decision).toBe('ESCALATED')
    expect(gov.rule_triggered).toMatch(/G-03/)
  })

  it('hardship household (per-member income < 2500) → lighter plan even without salary_reduction', () => {
    // Salary 4000, family 3 → per-member 1333 < 2500
    const fin = analyzeFinancials(10_000, 4_000, 200, 1, 'other', 60, 500, false, 3, false)
    expect(fin.per_member_income).toBeLessThan(2_500)
    expect(fin.is_hardship).toBe(true)
    expect(fin.target_deduction_rate).toBe(0.15)
  })
})

// ---------------------------------------------------------------------------
// 4. FINANCIAL OBLIGATIONS > 60% DBR — reduce increase / maintain / refer to officer
// ---------------------------------------------------------------------------
describe('Financial obligations > 60% DBR → escalate to officer', () => {
  it('dbr_within_limit is false when total obligations exceed 60%', () => {
    // salary 5000, expenses 2500 other debts, proposed deduction ~1000 → total (3500/5000 = 70%)
    const fin = analyzeFinancials(10_000, 5_000, 2_500, 1, 'other', 60, 600, false, 1, false)
    expect(fin.dbr).toBeGreaterThan(0.60)
    expect(fin.dbr_within_limit).toBe(false)
  })

  it('governance escalates when DBR > cap (non-deferral case)', () => {
    const fin = analyzeFinancials(10_000, 5_000, 2_500, 1, 'other', 60, 600, false, 1, false)
    const gov = applyGovernanceRules(10_000, 5_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('ESCALATED')
    expect(gov.rule_triggered).toMatch(/G-07/)
  })

  it('DBR check does NOT fire for deferral cases (premium = 0, burden unchanged)', () => {
    // Even with high expenses, unemployment deferral adds 0 so burden doesn't grow
    const fin = analyzeFinancials(10_000, 5_000, 2_500, 1, 'job_loss', 60, 600, false, 1, true, null, true, false)
    expect(fin.arrears_deferred).toBe(true)
    const gov = applyGovernanceRules(10_000, 5_000, false, fin, true, { documentFresh: true })
    // Deferral exempted — should be APPROVED (or escalated only for another rule, not G-07)
    expect(gov.rule_triggered).not.toMatch(/G-07/)
  })

  it('retiree DBR cap is 50% not 60%', () => {
    // salary 5000, expenses 2000, proposed ~600 → total 2600/5000 = 52% > retiree cap 50%
    const fin = analyzeFinancials(5_000, 5_000, 2_000, 1, 'other', 60, 500, true, 1, false)
    expect(fin.dbr_cap).toBe(0.50)
    expect(fin.dbr).toBeGreaterThan(0.50)
    expect(fin.dbr_within_limit).toBe(false)
  })

  it('normal case with low expenses stays within DBR limit', () => {
    // salary 8000, expenses 500, proposed deduction 1200 → total 1700/8000 = 21%
    const fin = analyzeFinancials(5_000, 8_000, 500, 1, 'other', 60, 1_000, false, 2, false)
    expect(fin.dbr_within_limit).toBe(true)
    const gov = applyGovernanceRules(5_000, 8_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('APPROVED')
    expect(gov.rule_triggered).not.toMatch(/G-07/)
  })
})

// ---------------------------------------------------------------------------
// 5. FINAL RECOMMENDATION — the five output paths
// ---------------------------------------------------------------------------
describe('Final recommendation output paths', () => {
  it('APPROVED: clean case', () => {
    const fin = analyzeFinancials(10_000, 8_000, 200, 1, 'other', 60, 800, false, 2, false)
    const gov = applyGovernanceRules(10_000, 8_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('APPROVED')
  })

  it('Request Documents: missing salary certificate', () => {
    const fin = analyzeFinancials(10_000, 8_000, 200, 1, 'other', 60, 800, false, 2, false)
    const gov = applyGovernanceRules(10_000, 8_000, false, fin, false)  // document_valid = false
    expect(gov.decision).toBe('REJECTED')
    expect(gov.rule_triggered).toMatch(/G-01/)
  })

  it('Refer to Employee: G-04 loan period exceeded', () => {
    // arrears so large they can't clear within remaining term
    const fin = analyzeFinancials(200_000, 4_000, 0, 12, 'other', 24, 600, false, 1, false)
    const gov = applyGovernanceRules(200_000, 4_000, false, fin, true, { documentFresh: true })
    expect(gov.decision).toBe('ESCALATED')
    expect(gov.rule_triggered).toMatch(/G-04/)
  })

  it('Reject: duplicate active application', () => {
    const fin = analyzeFinancials(10_000, 8_000, 200, 1, 'other', 60, 800, false, 2, false)
    const gov = applyGovernanceRules(10_000, 8_000, false, fin, true, { hasActiveApplication: true })
    expect(gov.decision).toBe('REJECTED')
    expect(gov.rule_triggered).toMatch(/G-00/)
  })
})
