import { analyzeFinancials } from '../governance/housing-arrears'

// Note: runFinancialAgent has DB side-effects (updates agent_steps table).
// These tests cover the pure deterministic financial calculation.

describe('analyzeFinancials - MOEI 20% total-deduction rule', () => {
  test('uses only the headroom below 20% of salary as the arrears premium', () => {
    const result = analyzeFinancials(40000, 10000, 0, 0, 'other', 60, 1500)

    expect(result.proposed_monthly_payment).toBe(500)
    expect(result.proposed_duration).toBe(80)
    expect(result.total_new_monthly).toBe(2000)
    expect(result.twenty_percent_rule_pass).toBe(true)
    expect(result.within_loan_period).toBe(false)
  })

  test('fails the 20% rule when the existing installment already reaches the ceiling', () => {
    const result = analyzeFinancials(100000, 5000, 0, 0, 'other', 36, 1000)

    expect(result.proposed_monthly_payment).toBe(0)
    expect(result.proposed_duration).toBe(999)
    expect(result.total_new_monthly).toBe(1000)
    expect(result.twenty_percent_rule_pass).toBe(false)
    expect(result.within_loan_period).toBe(false)
  })

  test('total new monthly is arrears premium plus existing installment', () => {
    const result = analyzeFinancials(32000, 8000, 0, 0, 'other', 60, 1200)
    expect(result.total_new_monthly).toBe(result.proposed_monthly_payment + 1200)
  })

  test('Ahmed scenario: AED 600 arrears premium for 40 months', () => {
    const result = analyzeFinancials(24000, 12000, 0, 3, 'medical_expenses', 180, 1800)

    expect(result.proposed_monthly_payment).toBe(600)
    expect(result.proposed_duration).toBe(40)
    expect(result.total_new_monthly).toBe(2400)
    expect(result.within_loan_period).toBe(true)
  })

  test('Fatima scenario: no headroom because current installment exceeds 20%', () => {
    const result = analyzeFinancials(52000, 6500, 0, 8, 'salary_reduction', 96, 1400)

    expect(result.proposed_monthly_payment).toBe(0)
    expect(result.proposed_duration).toBe(999)
    expect(result.twenty_percent_rule_pass).toBe(false)
    expect(result.within_loan_period).toBe(false)
  })

  test('Mohammed scenario: escalated because current installment exceeds the ceiling', () => {
    const result = analyzeFinancials(156000, 4200, 0, 18, 'job_loss', 72, 2200)

    expect(result.proposed_monthly_payment).toBe(0)
    expect(result.proposed_duration).toBe(999)
    expect(result.twenty_percent_rule_pass).toBe(false)
    expect(result.within_loan_period).toBe(false)
  })

  test('clean case with no existing installment uses the full 20% ceiling', () => {
    const result = analyzeFinancials(24000, 12000, 0, 0, 'other', 60, 0)

    expect(result.proposed_monthly_payment).toBe(2400)
    expect(result.proposed_duration).toBe(10)
    expect(result.total_new_monthly).toBe(2400)
    expect(result.within_loan_period).toBe(true)
  })

  test('hardship household uses the lighter 15% target when it can still clear arrears', () => {
    const result = analyzeFinancials(5000, 10000, 0, 0, 'other', 60, 1000, false, 5)

    expect(result.is_hardship).toBe(true)
    expect(result.target_deduction_rate).toBe(0.15)
    expect(result.proposed_monthly_payment).toBe(500)
    expect(result.proposed_duration).toBe(10)
    expect(result.total_new_monthly).toBe(1500)
  })
})
