import { computeAffordableTargets, lookupRemediation } from '../tools/recovery-tools'

describe('computeAffordableTargets - what would make a case eligible', () => {
  test('G-04 loan-period target: arrears too large to clear within the term', () => {
    const t = computeAffordableTargets({
      salary: 5000,
      currentInstallment: 0,
      arrears: 200000,
      remainingLoanMonths: 36,
    })

    expect(t.twentyPctMax).toBe(1000)
    expect(t.headroom).toBe(1000)
    expect(t.twentyPercentRulePass).toBe(true)
    expect(t.maxArrearsForTerm).toBe(36000)
    expect(t.arrearsReductionNeeded).toBe(164000)
    expect(t.installmentReductionFor20).toBe(0)
  })

  test('G-03 headroom target: existing installment must drop below the 20% ceiling', () => {
    const t = computeAffordableTargets({
      salary: 5000,
      currentInstallment: 3000,
      arrears: 10000,
      remainingLoanMonths: 120,
    })

    expect(t.twentyPctMax).toBe(1000)
    expect(t.headroom).toBe(-2000)
    expect(t.twentyPercentRulePass).toBe(false)
    expect(t.installmentReductionFor20).toBe(2000)
    expect(t.maxArrearsForTerm).toBe(0)
    expect(t.arrearsReductionNeeded).toBe(10000)
  })

  test('exactly 20% existing installment leaves no arrears-payment headroom', () => {
    const t = computeAffordableTargets({
      salary: 10000,
      currentInstallment: 2000,
      arrears: 5000,
      remainingLoanMonths: 60,
    })

    expect(t.twentyPctMax).toBe(2000)
    expect(t.headroom).toBe(0)
    expect(t.twentyPercentRulePass).toBe(false)
    expect(t.installmentReductionFor20).toBe(0)
    expect(t.maxArrearsForTerm).toBe(0)
    expect(t.arrearsReductionNeeded).toBe(5000)
  })
})

describe('lookupRemediation', () => {
  test('returns bilingual guidance for known blockers', () => {
    expect(lookupRemediation('G-04').en).toMatch(/arrears/i)
    expect(lookupRemediation('G-04').ar.length).toBeGreaterThan(0)
    expect(lookupRemediation('mismatch').en).toMatch(/match/i)
    expect(lookupRemediation('tampered').en).toMatch(/edit|tamper/i)
    expect(lookupRemediation('unverifiable').en).toMatch(/record/i)
  })

  test('falls back to default for an unknown key', () => {
    expect(lookupRemediation('nonsense')).toEqual(lookupRemediation('default'))
  })
})
