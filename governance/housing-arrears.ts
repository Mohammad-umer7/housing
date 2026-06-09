import { evaluateRules, type GovernanceRule, type ServiceModule } from './types'

export type GovernanceDecision = 'APPROVED' | 'REJECTED' | 'ESCALATED'

// The recommendation taxonomy required by the challenge brief (§8 + Decide step):
// Approve · Request additional information (Request Documents) · Reject · Refer to a
// human officer (Refer to Employee). All four are distinct outcomes.
export type Recommendation = 'Approve' | 'Request Documents' | 'Reject' | 'Refer to Employee'

export type PlanType = 'UPDATE_INSTALLMENT' | 'TRANSFER_ARREARS'

export type FinancialAnalysis = {
  monthly_capacity: number
  debt_to_income_ratio: number
  risk_score: number
  proposed_duration: number
  proposed_monthly_payment: number // = arrears premium (the headroom amount), alias kept for back-compat
  raw_duration: number
  months_in_arrears: number
  // Brief Key Rule 1 (20% of income) — modelled as the real headroom mechanism:
  // total salary deduction (existing installment + arrears premium) must not exceed 20%.
  total_new_monthly: number // = proposed_total_deduction (existing installment + premium)
  affordability_ratio: number // = proposed_deduction_rate (alias kept for back-compat)
  within_loan_period: boolean
  remaining_loan_months: number
  current_installment: number
  // ── Brief §5/§6: family / social + variable deduction rate ──────────────────
  family_size: number
  per_member_income: number
  is_hardship: boolean
  income_changed: boolean
  target_deduction_rate: number // 0.20 normally, 0.15 for hardship families
  arrears_premium: number // monthly amount toward arrears (fills headroom up to the cap)
  proposed_total_deduction: number // existing installment + arrears_premium (≤ 20% of salary)
  proposed_deduction_rate: number // proposed_total_deduction / salary
  new_emi: number // the new monthly installment under an UPDATE_INSTALLMENT plan
  plan_type: PlanType
  // Brief Assessment Matrix — circumstances read from the request / free-text:
  unemployment: boolean // no stable income → defer arrears to loan end, don't raise installment
  temporary_circumstance: boolean // medical abroad / official assignment → defer / postpone increase
  arrears_deferred: boolean // a TRANSFER_ARREARS deferral plan (minimal monthly increase) was chosen
  additional_months: number
  additional_premium: number
  remaining_loan_balance: number
  // Brief §8 compliance flags (the two Key Rules)
  twenty_percent_rule_pass: boolean
  period_rule_pass: boolean
  // CBUAE Debt-Burden-Ratio (Article 7 + SZHP 2022 carve-out) — secondary context
  dbr: number
  dbr_cap: number
  dbr_within_limit: boolean
  is_retiree: boolean
}

export type GovernanceResult = {
  decision: GovernanceDecision
  reason: string
  rule_triggered: string
  financial_analysis: FinancialAnalysis
}

export type RescheduleReason =
  | 'job_loss'
  | 'business_failure'
  | 'salary_reduction'
  | 'family_circumstances'
  | 'medical_expenses'
  | 'other'

// Verified against the official challenge brief + sources (June 2026):
//   • Challenge brief (SZHP / MOEI) — Key Rule 1: the deduction rate must not exceed
//     20% of the beneficiary's income; Key Rule 2: the repayment period must not exceed
//     the original approved loan repayment period. Manual process ≈ 5 working days.
//   • Real dataset (RescheduleArrears): the 20% is the cap on the TOTAL salary deduction
//     (existing installment + arrears premium); the premium fills the headroom up to 20%
//     and the arrears are spread over additional months within the loan period.
//   • §6: families with a low average income per member (< AED 2,500) get a lighter plan.
//   • CBUAE Article 7 + SZHP 2022 notice: total bank DBR ≤ 60% (50% retirees) — secondary.
//
// Deliberately NOT modelled (these belong to a NEW SZHP grant/loan APPLICATION, not to
// arrears rescheduling): the AED 15,000 income band, AED 100,000 cap, AED 800,000 loan
// cap, 10-year property check, 25-year/300-month tenure cap.
export const OFFICIAL_MOEI_RULES = {
  MAX_DEDUCTION_PERCENT: 0.20, // total salary deduction ceiling — Key Rule 1
  MAX_INSTALLMENT_PERCENT: 0.20, // alias (kept for callers/UI)
  HARDSHIP_DEDUCTION_PERCENT: 0.15, // lighter target for hardship families (§6)
  HARDSHIP_PER_MEMBER_INCOME: 2500, // avg income per family member threshold (§6)
  DBR_CAP_SALARIED: 0.60, // secondary: total bank deductions ≤ 60% (CBUAE/SZHP 2022)
  DBR_CAP_RETIREE: 0.50, // secondary: retirees/seniors ≤ 50%
  CERT_FRESHNESS_DAYS: 30, // salary certificate must be issued within 30 days
  DEFAULT_REMAINING_LOAN_MONTHS: 60, // fallback when the servicer record has no term
}

export function dbrCapFor(isRetiree: boolean): number {
  return isRetiree ? OFFICIAL_MOEI_RULES.DBR_CAP_RETIREE : OFFICIAL_MOEI_RULES.DBR_CAP_SALARIED
}

export function computePerMemberIncome(salary: number, familySize: number): number {
  const size = Math.max(1, Math.floor(Number(familySize) || 1))
  return (Number(salary) || 0) / size
}

// The fields each governance rule evaluates. Assembled in applyGovernanceRules.
export type RuleData = {
  hasActiveApplication: boolean
  documentsValid: boolean
  documentFresh: boolean
  twentyPercentRulePass: boolean
  periodRulePass: boolean
  previousDefault: boolean
}

// Ordered as checked. The first failing rule decides (REJECT > ESCALATE), else APPROVED.
// G-03 and G-04 are the brief's two Key Rules; the rest are document + governance gates.
export const GOVERNANCE_RULES: GovernanceRule<RuleData>[] = [
  {
    id: 'G-00',
    name: 'No Existing Active Application',
    description: 'The beneficiary must not already have an active rescheduling application in the Programme (Brief Rule 3)',
    check: (data: RuleData) => !data.hasActiveApplication,
    failOutcome: 'REJECT', // a genuine denial — surfaced to the citizen as "Rejected"
    failReason: 'An active rescheduling application already exists for this beneficiary — duplicate request automatically rejected',
  },
  {
    id: 'G-01',
    name: 'Required Income Proof',
    description: 'A recent salary certificate (or a notarised non-work letter for the unemployed) must be present',
    check: (data: RuleData) => data.documentsValid,
    failOutcome: 'REJECT', // surfaced to the citizen as "Request Documents"
    failReason: 'Missing required salary certificate / income proof',
  },
  {
    id: 'G-02',
    name: 'Salary Certificate Freshness',
    description: 'The salary certificate must be issued within the last 30 days',
    check: (data: RuleData) => data.documentFresh,
    failOutcome: 'ESCALATE',
    failReason: 'Salary certificate older than 30 days — officer review required',
  },
  {
    id: 'G-03',
    name: '20% Deduction Rule',
    description: 'A rescheduling plan must exist where the total deduction stays within 20% of income (Key Rule 1)',
    check: (data: RuleData) => data.twentyPercentRulePass,
    failOutcome: 'ESCALATE',
    failReason: 'Existing installment already consumes 20% of income — no headroom to reschedule within the rule; officer review required',
  },
  {
    id: 'G-04',
    name: 'Loan Repayment Period Rule',
    description: 'Arrears must clear within the remaining/original loan repayment period (Key Rule 2)',
    check: (data: RuleData) => data.periodRulePass,
    failOutcome: 'ESCALATE',
    failReason: 'Arrears cannot clear within the remaining loan period — officer review required',
  },
  {
    id: 'G-05',
    name: 'Prior Rescheduling Default',
    description: 'A previous rescheduling default / record of intentional negligence requires officer review',
    check: (data: RuleData) => !data.previousDefault,
    failOutcome: 'ESCALATE',
    failReason: 'Previous rescheduling default on record — officer review required',
  },
  // NOTE: a beneficiary's PRIORITY social category (widow / orphan / senior /
  // person of determination, from UAE PASS) is deliberately NOT a governance rule.
  // It must never escalate a case on its own — priority beneficiaries are assessed
  // exactly like everyone else. Priority only changes HANDLING once a case is already
  // escalated for a genuine reason: it is then flagged as a fast-track referral and
  // routed to the officer console's priority lane (see escalation-agent + officer page).
]

// Map the internal decision to the brief's four-way recommendation taxonomy.
// A REJECTED decision is either a HARD denial (G-00 duplicate active application ⇒
// "Reject") or a recoverable documents request (G-01 missing income proof ⇒
// "Request Documents"). The rule id is parsed from rule_triggered; we only reach
// here for a non-approved decision, so matching the approved "G-00 through G-05"
// summary string is not a risk (APPROVED returns first).
export function toRecommendation(decision: GovernanceDecision, ruleTriggered?: string): Recommendation {
  if (decision === 'APPROVED') return 'Approve'
  if (decision === 'ESCALATED') return 'Refer to Employee'
  const ruleId = ruleTriggered ? (ruleTriggered.match(/G-\d+/)?.[0] ?? '') : ''
  if (ruleId === 'G-00') return 'Reject' // genuine denial (duplicate active application)
  return 'Request Documents' // G-01 (and any other recoverable REJECT) ⇒ ask for documents
}

// Brief "Assessment Matrix" circumstance detection. Reads the structured reschedule
// reason AND the beneficiary's free-text request (remarks / justifications, Arabic or
// English) to classify the situation the way a reviewing officer would:
//   • income_changed       — salary reduced / changed (lighter plan)
//   • unemployment          — no stable income (defer arrears to loan end, keep installment)
//   • temporary_circumstance— medical treatment abroad, official assignment/mission, etc.
//                             (defer / postpone any increase until the circumstance ends)
export type RequestCircumstances = {
  income_changed: boolean
  unemployment: boolean
  temporary_circumstance: boolean
}

export function classifyRequestCircumstances(reason: string, freeText = ''): RequestCircumstances {
  const text = `${reason ?? ''} ${freeText ?? ''}`
  const incomeChange =
    reason === 'salary_reduction' ||
    /salary\s*(reduction|reduced|cut|drop|decrease)|income\s*(reduction|reduced|changed|drop|decrease)|انخفاض|انخفض|خفض|تخفيض\s*الراتب/i.test(text)
  const unemployment =
    reason === 'job_loss' ||
    /job\s*loss|unemploy|laid\s*off|lost\s*my\s*job|no\s*(stable\s*)?income|out\s*of\s*work|terminated|فقدان\s*العمل|عاطل|بدون\s*دخل|لا\s*اعمل|فقدت\s*وظيفتي|إنهاء\s*الخدمة/i.test(text)
  const temporary_circumstance =
    /medical\s*(treatment|leave)?\s*(abroad|overseas)?|treatment\s*abroad|hospitali|official\s*(assignment|mission|duty)|deployment|secondment|on\s*assignment|study\s*leave|maternity|علاج\s*(بالخارج|في\s*الخارج)?|مهمة\s*رسمية|ابتعاث|إجازة\s*مرضية|انتداب/i.test(text)
  return {
    income_changed: incomeChange || unemployment,
    unemployment,
    temporary_circumstance,
  }
}

// Brief §2 — the agent decides WHICH supporting document THIS case needs and asks for
// exactly that when it is missing (it must NEVER reject for a missing document — it
// routes back to the citizen as "Request Documents"). The required document depends on
// the beneficiary's situation, read from the structured reason + free-text.
export type DocumentType = 'salary_certificate' | 'non_work_letter' | 'income_statement' | 'supporting_document'

export type RequiredDocuments = {
  labels: string[]        // citizen-facing, specific asks
  requiresUpload: boolean // true when an uploaded document is needed beyond on-record income
  primaryType: DocumentType
}

export function determineRequiredDocuments(input: {
  reschedule_reason?: string
  unemployment?: boolean
  income_changed?: boolean
  temporary_circumstance?: boolean
  hasIncomeRecord?: boolean
}): RequiredDocuments {
  const reason = String(input.reschedule_reason || 'other')
  if (input.unemployment || reason === 'job_loss') {
    return {
      primaryType: 'non_work_letter',
      requiresUpload: true,
      labels: ['An official non-work / termination letter from your employer or the labour authority (proof you no longer earn a salary)'],
    }
  }
  if (reason === 'business_failure') {
    return {
      primaryType: 'income_statement',
      requiresUpload: true,
      labels: ['A recent bank statement or income statement covering the last 3 months'],
    }
  }
  if (input.temporary_circumstance) {
    return {
      primaryType: 'supporting_document',
      requiresUpload: true,
      labels: ['A supporting document for your circumstance (e.g. a medical report or an official assignment / secondment letter)'],
    }
  }
  if (input.income_changed || reason === 'salary_reduction') {
    return {
      primaryType: 'salary_certificate',
      requiresUpload: true,
      labels: ['A recent salary certificate (issued within the last 30 days) showing your current reduced salary'],
    }
  }
  // Stable employment: a recent salary certificate is ALWAYS required so the
  // forensic + vision authenticity check always runs (even though the on-record
  // Programme income could otherwise validate it). The on-record salary is still
  // cross-checked against the uploaded certificate during verification.
  return {
    primaryType: 'salary_certificate',
    requiresUpload: true,
    labels: ['A recent salary certificate (issued within the last 30 days)'],
  }
}

// Reschedule-reason stability weighting (higher = more financially destabilising).
export const STABILITY_SCORES: Record<string, number> = {
  job_loss: 100,
  business_failure: 75,
  salary_reduction: 50,
  family_circumstances: 30,
  medical_expenses: 25,
  other: 20,
}

export function computeDebtToIncomeRatio(
  currentInstallment: number,
  expenses: number,
  salary: number
): number {
  if (!(salary > 0)) return 1
  const obligations = (Number(currentInstallment) || 0) + (Number(expenses) || 0)
  return obligations / salary
}

export type RiskInputs = {
  dti: number
  arrears: number
  monthsInArrears: number
  rescheduleReason: string
}

export function computeRiskScore({ dti, arrears, monthsInArrears, rescheduleReason }: RiskInputs): number {
  const stabilityScore = STABILITY_SCORES[rescheduleReason] ?? STABILITY_SCORES.other
  return Math.min(100, Math.round(
    Math.min(dti, 1) * 100 * 0.40 +
    Math.min(arrears / 500000, 1) * 100 * 0.25 +
    Math.min(monthsInArrears / 24, 1) * 100 * 0.20 +
    stabilityScore * 0.15
  ))
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MEDIUM'
  return 'LOW'
}

// Core rescheduling math — the real headroom model. The arrears premium is the room
// under the deduction cap (existing installment + premium ≤ cap × salary); arrears are
// spread over the months needed, which must fit the remaining loan period.
export type ReschedulePlan = {
  arrearsPremium: number
  monthlyPayment: number
  durationMonths: number
  totalDeduction: number
  deductionRate: number
  withinLoanPeriod: boolean
  twentyPercentRulePass: boolean
  planType: PlanType
}

export function calculateReschedulingPlan(
  arrears: number,
  salary: number,
  remainingLoanMonths: number,
  currentInstallment = 0,
  targetRate: number = OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT,
  opts: { deferArrears?: boolean } = {}
): ReschedulePlan {
  const cap = OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT
  const headroom20 = Math.round(cap * salary) - currentInstallment // max premium under the 20% ceiling
  const twentyPercentRulePass = headroom20 > 0

  if (!twentyPercentRulePass) {
    return {
      arrearsPremium: 0,
      monthlyPayment: 0,
      durationMonths: 999,
      totalDeduction: currentInstallment,
      deductionRate: salary > 0 ? currentInstallment / salary : 1,
      withinLoanPeriod: false,
      twentyPercentRulePass: false,
      planType: 'UPDATE_INSTALLMENT',
    }
  }

  let arrearsPremium: number
  let durationMonths: number
  if (opts.deferArrears && remainingLoanMonths > 0) {
    // Brief Assessment Matrix — unemployment / temporary circumstances: move the
    // arrears to the end of the repayment period with the SMALLEST possible monthly
    // increase (spread thinly across the full remaining term), never above the 20%
    // headroom. This is the TRANSFER_ARREARS deferral, not an installment hike.
    const minPremium = Math.max(1, Math.ceil(arrears / remainingLoanMonths))
    arrearsPremium = Math.min(minPremium, headroom20)
    durationMonths = Math.ceil(arrears / arrearsPremium)
    const totalDeductionD = currentInstallment + arrearsPremium
    return {
      arrearsPremium,
      monthlyPayment: arrearsPremium,
      durationMonths,
      totalDeduction: totalDeductionD,
      deductionRate: salary > 0 ? totalDeductionD / salary : 1,
      withinLoanPeriod: durationMonths <= remainingLoanMonths,
      twentyPercentRulePass: true,
      planType: 'TRANSFER_ARREARS',
    }
  }

  // Preferred (possibly lighter) premium at the target rate; fall back to the full
  // 20% headroom if the lighter premium can't clear the arrears within the term.
  const preferred = Math.max(0, Math.round(Math.min(targetRate, cap) * salary) - currentInstallment)
  const preferredPremium = preferred > 0 ? preferred : headroom20
  const durPreferred = Math.ceil(arrears / preferredPremium)

  if (durPreferred <= remainingLoanMonths) {
    arrearsPremium = preferredPremium
    durationMonths = durPreferred
  } else {
    arrearsPremium = headroom20
    durationMonths = Math.ceil(arrears / headroom20)
  }

  const totalDeduction = currentInstallment + arrearsPremium
  const withinLoanPeriod = durationMonths <= remainingLoanMonths
  // TRANSFER_ARREARS when the plan rides to (near) the end of the loan; otherwise a
  // recalculated installment (UPDATE_INSTALLMENT) — both seen in the real dataset.
  const planType: PlanType = durationMonths >= Math.floor(remainingLoanMonths * 0.9) ? 'TRANSFER_ARREARS' : 'UPDATE_INSTALLMENT'

  return {
    arrearsPremium,
    monthlyPayment: arrearsPremium,
    durationMonths,
    totalDeduction,
    deductionRate: salary > 0 ? totalDeduction / salary : 1,
    withinLoanPeriod,
    twentyPercentRulePass: true,
    planType,
  }
}

export function analyzeFinancials(
  arrears: number,
  salary: number,
  expenses: number,
  months_in_arrears = 0,
  reschedule_reason: string = 'other',
  remaining_loan_months = OFFICIAL_MOEI_RULES.DEFAULT_REMAINING_LOAN_MONTHS,
  current_installment = 0,
  is_retiree = false,
  family_size = 1,
  income_changed = false,
  remaining_loan_balance_override?: number | null,
  unemployment = false,
  temporary_circumstance = false
): FinancialAnalysis {
  const per_member_income = Math.round(computePerMemberIncome(salary, family_size))
  const is_hardship =
    per_member_income < OFFICIAL_MOEI_RULES.HARDSHIP_PER_MEMBER_INCOME || income_changed
  const target_deduction_rate = is_hardship
    ? OFFICIAL_MOEI_RULES.HARDSHIP_DEDUCTION_PERCENT
    : OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT

  // Unemployment or a verified temporary circumstance → defer arrears to the end of
  // the term with the smallest possible monthly increase (Brief Assessment Matrix).
  const defer_arrears = unemployment || temporary_circumstance
  const plan = calculateReschedulingPlan(
    arrears, salary, remaining_loan_months, current_installment, target_deduction_rate,
    { deferArrears: defer_arrears }
  )

  const arrears_premium = plan.arrearsPremium
  const proposed_duration = plan.durationMonths
  const proposed_total_deduction = plan.totalDeduction
  const proposed_deduction_rate = plan.deductionRate
  const within_loan_period = plan.withinLoanPeriod
  const twenty_percent_rule_pass = plan.twentyPercentRulePass
  const period_rule_pass = within_loan_period && twenty_percent_rule_pass

  // Use Programme DB balance when present; otherwise estimate from installment x term.
  const explicitBalance = Number(remaining_loan_balance_override)
  const remaining_loan_balance = Number.isFinite(explicitBalance) && explicitBalance > 0
    ? Math.round(explicitBalance)
    : Math.round(current_installment * remaining_loan_months)
  const new_emi = proposed_total_deduction

  const monthly_capacity = Math.max(0, salary - expenses - proposed_total_deduction)
  const debt_to_income_ratio = computeDebtToIncomeRatio(current_installment, expenses, salary)
  const dbr = salary > 0 ? proposed_total_deduction / salary : 1
  const dbr_cap = dbrCapFor(is_retiree)

  const risk_score = computeRiskScore({
    dti: debt_to_income_ratio, arrears, monthsInArrears: months_in_arrears, rescheduleReason: reschedule_reason,
  })

  return {
    monthly_capacity,
    debt_to_income_ratio: Math.round(debt_to_income_ratio * 1000) / 1000,
    risk_score,
    proposed_duration,
    proposed_monthly_payment: arrears_premium,
    raw_duration: proposed_duration,
    months_in_arrears,
    total_new_monthly: proposed_total_deduction,
    affordability_ratio: Math.round(proposed_deduction_rate * 1000) / 1000,
    within_loan_period,
    remaining_loan_months,
    current_installment,
    family_size: Math.max(1, Math.floor(Number(family_size) || 1)),
    per_member_income,
    is_hardship,
    income_changed,
    target_deduction_rate,
    arrears_premium,
    proposed_total_deduction,
    proposed_deduction_rate: Math.round(proposed_deduction_rate * 1000) / 1000,
    new_emi,
    plan_type: plan.planType,
    unemployment,
    temporary_circumstance,
    arrears_deferred: defer_arrears && plan.twentyPercentRulePass,
    additional_months: proposed_duration,
    additional_premium: arrears_premium,
    remaining_loan_balance,
    twenty_percent_rule_pass,
    period_rule_pass,
    dbr: Math.round(dbr * 1000) / 1000,
    dbr_cap,
    dbr_within_limit: dbr <= dbr_cap,
    is_retiree,
  }
}

export type GovernanceOptions = {
  documentFresh?: boolean
  hasActiveApplication?: boolean
  // Specific, citizen-facing reason for a G-01 documents request (e.g. "the uploaded
  // file is not a salary certificate" / "the details do not match your records").
  // Falls back to the generic missing-certificate message when not supplied.
  documentRequestReason?: string
}

export function applyGovernanceRules(
  arrears: number,
  salary: number,
  previous_default: boolean,
  financials: FinancialAnalysis,
  document_valid = true,
  opts: GovernanceOptions = {}
): GovernanceResult {
  const data: RuleData = {
    hasActiveApplication: Boolean(opts.hasActiveApplication),
    documentsValid: document_valid,
    documentFresh: opts.documentFresh !== false,
    twentyPercentRulePass: financials.twenty_percent_rule_pass,
    periodRulePass: financials.period_rule_pass,
    previousDefault: previous_default,
  }

  const base = evaluateRules(GOVERNANCE_RULES, data)
  const ratePct = Math.round(financials.proposed_deduction_rate * 100)

  if (base.decision === 'APPROVED') {
    const lighter = financials.is_hardship ? ' (lighter plan applied for a hardship household)' : ''
    return {
      decision: 'APPROVED',
      reason: `All rules satisfied. Proposed deduction rate: ${ratePct}% of AED ${salary.toLocaleString()} salary${lighter} — total monthly deduction AED ${financials.proposed_total_deduction.toLocaleString()} (existing installment AED ${financials.current_installment.toLocaleString()} + arrears premium AED ${financials.arrears_premium.toLocaleString()}). Arrears of AED ${arrears.toLocaleString()} clear over ${financials.proposed_duration} months (plan: ${financials.plan_type}). Within the 20% rule and the loan period.`,
      rule_triggered: 'Rules G-00 through G-05: All passed — Clean Approval',
      financial_analysis: financials,
    }
  }

  const ruleId = base.rule_triggered.match(/G-\d+/)?.[0] ?? ''
  let reason = base.reason
  if (ruleId === 'G-00') {
    reason = 'An active rescheduling application already exists for this beneficiary. A duplicate request cannot be processed — please follow up on your existing application. Status: rejected (duplicate).'
  } else if (ruleId === 'G-01') {
    reason = opts.documentRequestReason?.trim()
      ? opts.documentRequestReason.trim()
      : 'Missing required salary certificate — please upload a recent salary certificate (or a notarised non-work letter if unemployed). Status: documents incomplete.'
  } else if (ruleId === 'G-02') {
    reason = `The uploaded salary certificate is older than ${OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS} days — please provide one issued within the last ${OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS} days. Referred to an officer.`
  } else if (ruleId === 'G-03') {
    reason = `The existing installment of AED ${financials.current_installment.toLocaleString()} already takes ${Math.round((financials.current_installment / (salary || 1)) * 100)}% of the AED ${salary.toLocaleString()} salary, leaving no room to reschedule arrears within the 20% deduction rule — referred to an officer.`
  } else if (ruleId === 'G-04') {
    reason = `Even at the maximum 20% deduction, clearing AED ${arrears.toLocaleString()} arrears (premium AED ${financials.arrears_premium.toLocaleString()}/month) needs ${financials.proposed_duration} months, beyond the remaining ${financials.remaining_loan_months}-month loan period — referred to an officer.`
  } else if (ruleId === 'G-05') {
    reason = 'Previous rescheduling default on record — officer review required for risk assessment and special-terms consideration.'
  }

  return {
    decision: base.decision,
    reason,
    rule_triggered: base.rule_triggered,
    financial_analysis: financials,
  }
}

// ── ServiceModule wiring ──────────────────────────────────────────────────────
export const housingArrearsModule: ServiceModule = {
  id: 'housing-arrears',
  displayName: 'MOEI Housing Arrears Rescheduling',
  displayNameAr: 'إعادة جدولة متأخرات السكن',
  ruleCount: GOVERNANCE_RULES.length,
  decide: (input) => {
    const isRetiree =
      Boolean(input.is_retiree) ||
      String(input.employment_status || '').toLowerCase() === 'retired'

    const reason = String(input.reschedule_reason || 'other')
    const freeText = `${input.remarks ?? ''} ${input.justifications ?? ''}`
    const circ = classifyRequestCircumstances(reason, freeText)
    const incomeChanged = Boolean(input.income_changed) || circ.income_changed

    const analysis = analyzeFinancials(
      Number(input.arrears_amount),
      Number(input.monthly_salary),
      Number(input.monthly_expenses) || 0,
      Number(input.months_in_arrears) || 0,
      reason,
      Number(input.remaining_loan_months) || OFFICIAL_MOEI_RULES.DEFAULT_REMAINING_LOAN_MONTHS,
      Number(input.current_installment) || 0,
      isRetiree,
      Number(input.family_size) || 1,
      incomeChanged,
      Number(input.remaining_loan_balance) || null,
      circ.unemployment,
      circ.temporary_circumstance,
    )
    const ruleData: RuleData = {
      hasActiveApplication: Boolean(input.has_active_application),
      documentsValid: input.document_valid !== false,
      documentFresh: input.document_fresh !== false,
      twentyPercentRulePass: analysis.twenty_percent_rule_pass,
      periodRulePass: analysis.period_rule_pass,
      previousDefault: Boolean(input.previous_default),
    }
    const result = evaluateRules(GOVERNANCE_RULES, ruleData)
    return { ...result, analysis }
  },
}
