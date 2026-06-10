import {
  applyGovernanceRules,
  calculateReschedulingPlan,
  analyzeFinancials,
  toRecommendation,
  classifyRequestCircumstances,
  GOVERNANCE_RULES,
} from '../governance/housing-arrears'

function makeFinancials(
  arrears: number,
  salary: number,
  monthsInArrears = 6,
  remainingLoanMonths = 60,
  currentInstallment = 0,
  isRetiree = false,
  familySize = 1,
  incomeChanged = false
) {
  return analyzeFinancials(
    arrears,
    salary,
    0,
    monthsInArrears,
    'other',
    remainingLoanMonths,
    currentInstallment,
    isRetiree,
    familySize,
    incomeChanged
  )
}

describe('applyGovernanceRules', () => {
  const baseSalary = 10000
  const baseArrears = 50000
  const baseFinancials = makeFinancials(baseArrears, baseSalary, 6, 60)

  test('G-00: rejects (hard) when an active application already exists', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true, {
      hasActiveApplication: true,
    })
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-00')
  })

  test('G-00 takes precedence over G-01 (duplicate beats missing docs)', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, false, {
      hasActiveApplication: true,
    })
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-00')
  })

  test('G-01: rejects when income proof missing', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, false)
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-01')
  })

  test('G-02: escalates when salary certificate is stale (>30 days)', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true, {
      documentFresh: false,
    })
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-02')
  })

  test('G-03: escalates when existing installment leaves no 20% headroom', () => {
    const f = makeFinancials(10000, 5000, 6, 120, 1000)
    const result = applyGovernanceRules(10000, 5000, false, f, true)
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-03')
  })

  test('G-04: escalates when arrears cannot clear within the remaining loan period', () => {
    const f = makeFinancials(200000, 5000, 6, 36)
    const result = applyGovernanceRules(200000, 5000, false, f, true)
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-04')
  })

  test('G-05: escalates when previous default on record', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, true, baseFinancials, true)
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-05')
  })

  test('rule set is G-00, G-06 (DDA), then G-01..G-05; priority social status is NOT a rule', () => {
    // G-06 is the Direct Debit Authority rule (no DDA → reject, enrol with EDB). A priority
    // beneficiary (widow/orphan/senior/person of determination) is still assessed like anyone
    // else — there is no priority-group rule.
    const ids = GOVERNANCE_RULES.map(r => r.id)
    expect(ids).toEqual(['G-00', 'G-06', 'G-01', 'G-02', 'G-03', 'G-04', 'G-05'])
    // A clean case (DDA present by default) approves.
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true)
    expect(result.decision).toBe('APPROVED')
  })

  test('G-06: rejects (hard) when the beneficiary has no Direct Debit Authority (→ enrol with EDB)', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true, { hasDda: false })
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-06')
    expect(result.reason).toMatch(/EDB|Emirates Development Bank|Direct Debit/i)
    expect(toRecommendation(result.decision, result.rule_triggered)).toBe('Reject')
  })

  test('G-06: DDA present (default when omitted) does not block an approvable case', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true, {})
    expect(result.rule_triggered).not.toContain('G-06')
    expect(result.decision).toBe('APPROVED')
  })

  test('approves clean case - all rules pass', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true)
    expect(result.decision).toBe('APPROVED')
  })

  test('G-01 takes precedence over G-03 when both fail', () => {
    const f = makeFinancials(10000, 5000, 6, 120, 1000)
    const result = applyGovernanceRules(10000, 5000, false, f, false)
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-01')
  })

  test('G-03 takes precedence over G-05 when both fail', () => {
    const f = makeFinancials(10000, 5000, 6, 120, 1000)
    const result = applyGovernanceRules(10000, 5000, true, f, true)
    expect(result.rule_triggered).toContain('G-03')
  })

  test('G-03 boundary: exactly 20% existing installment leaves no headroom', () => {
    const f = makeFinancials(10000, 10000, 6, 60, 2000)
    const result = applyGovernanceRules(10000, 10000, false, f, true)
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-03')
  })

  test('G-03 boundary: just below 20% can approve if arrears fit the term', () => {
    const f = makeFinancials(60, 10000, 1, 60, 1999)
    const result = applyGovernanceRules(60, 10000, false, f, true)
    expect(result.decision).toBe('APPROVED')
  })

  test('approved case includes payment + duration in reason', () => {
    const result = applyGovernanceRules(baseArrears, baseSalary, false, baseFinancials, true)
    expect(result.decision).toBe('APPROVED')
    expect(result.reason).toContain('2,000')
    expect(result.reason).toContain('25')
  })
})

describe('calculateReschedulingPlan', () => {
  test('applies the 20% salary rule correctly when there is no existing installment', () => {
    const plan = calculateReschedulingPlan(24000, 12000, 180)
    expect(plan.monthlyPayment).toBe(2400)
    expect(plan.durationMonths).toBe(10)
    expect(plan.withinLoanPeriod).toBe(true)
  })

  test('flags when duration exceeds remaining loan months without capping the real duration', () => {
    const plan = calculateReschedulingPlan(200000, 5000, 24)
    expect(plan.monthlyPayment).toBe(1000)
    expect(plan.withinLoanPeriod).toBe(false)
    expect(plan.durationMonths).toBe(200)
  })

  test('Salem scenario: AED 800 arrears premium under AED 3,000 total deduction', () => {
    const plan = calculateReschedulingPlan(18000, 15000, 240, 2200)
    expect(plan.monthlyPayment).toBe(800)
    expect(plan.totalDeduction).toBe(3000)
    expect(plan.durationMonths).toBe(23)
  })

  test('Aisha scenario: AED 500 arrears premium for 68 months', () => {
    const plan = calculateReschedulingPlan(34000, 8500, 120, 1200)
    expect(plan.monthlyPayment).toBe(500)
    expect(plan.totalDeduction).toBe(1700)
    expect(plan.durationMonths).toBe(68)
  })

  test('rounds monthly payment to nearest dirham', () => {
    const plan = calculateReschedulingPlan(10000, 7333, 60)
    expect(plan.monthlyPayment).toBe(1467)
  })

  test('rounds duration up so arrears are fully covered', () => {
    const plan = calculateReschedulingPlan(25000, 10000, 60)
    expect(plan.durationMonths).toBe(13)
  })

  test('deferArrears moves arrears to end with zero monthly add (TRANSFER_ARREARS)', () => {
    const plan = calculateReschedulingPlan(24000, 12000, 180, 0, 0.2, { deferArrears: true })
    expect(plan.planType).toBe('TRANSFER_ARREARS')
    expect(plan.monthlyPayment).toBe(0)   // assessment matrix: no increase to monthly installment
    expect(plan.arrearsPremium).toBe(0)
    expect(plan.withinLoanPeriod).toBe(true)
  })
})

describe('toRecommendation (brief 4-way taxonomy)', () => {
  test('APPROVED → Approve', () => {
    expect(toRecommendation('APPROVED')).toBe('Approve')
  })
  test('ESCALATED → Refer to Employee', () => {
    expect(toRecommendation('ESCALATED', 'Rule G-05: Prior Rescheduling Default')).toBe('Refer to Employee')
  })
  test('REJECTED + G-00 → Reject (hard denial)', () => {
    expect(toRecommendation('REJECTED', 'Rule G-00: No Existing Active Application')).toBe('Reject')
  })
  test('REJECTED + G-01 → Request Documents (recoverable)', () => {
    expect(toRecommendation('REJECTED', 'Rule G-01: Required Income Proof')).toBe('Request Documents')
  })
})

describe('classifyRequestCircumstances (free-text / Assessment Matrix)', () => {
  test('detects unemployment from the structured reason', () => {
    const c = classifyRequestCircumstances('job_loss', '')
    expect(c.unemployment).toBe(true)
    expect(c.income_changed).toBe(true)
  })
  test('detects unemployment from free-text (Arabic)', () => {
    const c = classifyRequestCircumstances('other', 'فقدت وظيفتي ولا أعمل حالياً')
    expect(c.unemployment).toBe(true)
  })
  test('detects a temporary supporting circumstance (medical treatment abroad)', () => {
    const c = classifyRequestCircumstances('other', 'I am receiving medical treatment abroad for six months')
    expect(c.temporary_circumstance).toBe(true)
  })
  test('detects a salary reduction as an income change without unemployment', () => {
    const c = classifyRequestCircumstances('salary_reduction', '')
    expect(c.income_changed).toBe(true)
    expect(c.unemployment).toBe(false)
  })
  test('stable employment with no free-text → no circumstances', () => {
    const c = classifyRequestCircumstances('other', 'Requesting a more comfortable schedule')
    expect(c.income_changed).toBe(false)
    expect(c.unemployment).toBe(false)
    expect(c.temporary_circumstance).toBe(false)
  })
})

describe('analyzeFinancials — circumstance-driven deferral', () => {
  test('unemployment defers arrears (TRANSFER_ARREARS) with a minimal premium', () => {
    const f = analyzeFinancials(24000, 12000, 0, 6, 'job_loss', 180, 0, false, 1, true, null, true, false)
    expect(f.unemployment).toBe(true)
    expect(f.arrears_deferred).toBe(true)
    expect(f.plan_type).toBe('TRANSFER_ARREARS')
    expect(f.period_rule_pass).toBe(true)
  })
})
