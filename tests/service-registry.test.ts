import { getServiceModule, listServices } from '../governance/registry'
import { evaluateRules } from '../governance/types'
import { GOVERNANCE_RULES } from '../governance/housing-arrears'
import { VISA_GOVERNANCE_RULES } from '../governance/visa-renewal'

// Proves the platform claim from docs/PITCH.md: the SAME decision engine
// (evaluateRules) processes a second federal service (MOI visa renewal) with no
// changes to the engine — only a different rulebook. Onboarding a new federal
// service is a governance module + a registry entry, not a pipeline rebuild.

function mod(id: string) {
  const m = getServiceModule(id)
  if (!m) throw new Error(`service "${id}" not registered`)
  return m
}

describe('service registry — platform extensibility', () => {
  test('registry resolves both federal services and rejects unknown ids', () => {
    expect(getServiceModule('housing-arrears')).not.toBeNull()
    expect(getServiceModule('visa-renewal')).not.toBeNull()
    expect(getServiceModule('does-not-exist')).toBeNull()
    expect(listServices().map((s) => s.id).sort()).toEqual(['housing-arrears', 'visa-renewal'])
  })

  // ── Service A: housing arrears ──────────────────────────────────────────────

  test('housing-arrears: clean case is APPROVED through the module', () => {
    const result = mod('housing-arrears').decide({
      arrears_amount: 25000,
      monthly_salary: 10000,
      monthly_expenses: 2000,
      months_in_arrears: 6,
      reschedule_reason: 'medical_expenses',
      remaining_loan_months: 60,
      current_installment: 1500,
      previous_default: false,
      document_valid: true,
    })
    expect(result.decision).toBe('APPROVED')
  })

  test('housing-arrears: no 20% headroom ESCALATES (G-03)', () => {
    // Existing installment already exceeds the 20% salary-deduction ceiling.
    const result = mod('housing-arrears').decide({
      arrears_amount: 30000,
      monthly_salary: 10000,
      monthly_expenses: 2000,
      months_in_arrears: 6,
      reschedule_reason: 'other',
      remaining_loan_months: 120,
      current_installment: 6000,
      previous_default: false,
      document_valid: true,
    })
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-03')
  })

  test('housing-arrears: arrears that cannot clear within the loan period ESCALATES (G-04)', () => {
    // 600000 at 20% of 10000 (=2000/mo) needs 300 months, beyond the 24-month term
    const result = mod('housing-arrears').decide({
      arrears_amount: 600000,
      monthly_salary: 10000,
      monthly_expenses: 2000,
      months_in_arrears: 6,
      reschedule_reason: 'other',
      remaining_loan_months: 24,
      current_installment: 0,
      previous_default: false,
      document_valid: true,
    })
    expect(result.decision).toBe('ESCALATED')
    expect(result.rule_triggered).toContain('G-04')
  })

  test('housing-arrears: missing salary certificate is REJECTED (G-01)', () => {
    const result = mod('housing-arrears').decide({
      arrears_amount: 50000,
      monthly_salary: 10000,
      monthly_expenses: 2000,
      months_in_arrears: 6,
      reschedule_reason: 'other',
      remaining_loan_months: 60,
      current_installment: 0,
      previous_default: false,
      document_valid: false,
    })
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('G-01')
  })

  // ── Service B: visa renewal (SAME engine, different rulebook) ────────────────

  test('visa-renewal: valid employment renewal is APPROVED through the module', () => {
    const result = mod('visa-renewal').decide({
      applicant_age: 34,
      sponsor_status: 'employed',
      sponsor_monthly_salary: 12000,
      visa_type: 'employment',
      current_visa_expires_in_days: 20,
      previous_overstay_days: 0,
      medical_fitness_valid: true,
      emirates_id_valid: true,
    })
    expect(result.decision).toBe('APPROVED')
  })

  test('visa-renewal: expired medical fitness is REJECTED (V-02)', () => {
    const result = mod('visa-renewal').decide({
      applicant_age: 34,
      sponsor_status: 'employed',
      sponsor_monthly_salary: 12000,
      visa_type: 'employment',
      current_visa_expires_in_days: 20,
      previous_overstay_days: 0,
      medical_fitness_valid: false,
      emirates_id_valid: true,
    })
    expect(result.decision).toBe('REJECTED')
    expect(result.rule_triggered).toContain('V-02')
  })

  test('visa-renewal: unemployed family-visa sponsor ESCALATES', () => {
    const result = mod('visa-renewal').decide({
      applicant_age: 40,
      sponsor_status: 'unemployed',
      sponsor_monthly_salary: 3000,
      visa_type: 'family',
      current_visa_expires_in_days: 10,
      previous_overstay_days: 0,
      medical_fitness_valid: true,
      emirates_id_valid: true,
    })
    expect(result.decision).toBe('ESCALATED')
  })

  // ── The genuinely shared part ───────────────────────────────────────────────

  test('the same evaluateRules engine drives both rulebooks (different rules, identical control flow)', () => {
    const housing = evaluateRules(GOVERNANCE_RULES, {
      hasActiveApplication: false,
      hasDda: true,
      documentsValid: false,
      documentFresh: true,
      twentyPercentRulePass: true,
      periodRulePass: true,
      previousDefault: false,
    })
    expect(housing.decision).toBe('REJECTED') // G-01

    const visa = evaluateRules(VISA_GOVERNANCE_RULES, {
      applicant_age: 34,
      sponsor_status: 'employed',
      sponsor_monthly_salary: 3000,
      visa_type: 'family',
      current_visa_expires_in_days: 10,
      previous_overstay_days: 0,
      medical_fitness_valid: true,
      emirates_id_valid: true,
    })
    expect(visa.decision).toBe('ESCALATED') // V-03 sponsor income below family minimum
  })
})
