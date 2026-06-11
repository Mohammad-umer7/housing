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
  // The official decision-matrix path this case follows (Assessment Matrix)
  rescheduling_path: string
}

export type GovernanceResult = {
  decision: GovernanceDecision
  reason: string
  rule_triggered: string
  financial_analysis: FinancialAnalysis
}

// ── Official decision-matrix paths (challenge brief Assessment Matrix) ──────────
// The five paths the agent must explicitly choose between, named so the citizen,
// officer and judges can see WHICH path was taken and why.
export type ReschedulingPath =
  | 'RAISE_INSTALLMENT'         // headroom exists → raise deduction up to the 20% cap
  | 'REDUCE_INCREASE'           // income down / hardship → lighter (~15%) increase
  | 'MAINTAIN_INSTALLMENT'      // no headroom for an increase → keep installment
  | 'ROLL_ARREARS_TO_END'       // unemployment → arrears deferred to loan end, no raise
  | 'DEFER_TO_CIRCUMSTANCE_END' // temporary (medical/assignment) → defer until it ends
  | 'REFER_HUMAN'               // obligations breach the DBR ceiling → officer decides

export const RESCHEDULING_PATH_LABELS: Record<ReschedulingPath, { en: string; ar: string }> = {
  RAISE_INSTALLMENT:         { en: 'Installment adjusted upward (within 20% cap)', ar: 'رفع قيمة القسط الشهري (ضمن سقف 20%)' },
  REDUCE_INCREASE:           { en: 'Lighter increase applied (hardship household)', ar: 'تخفيض نسبة الرفع (أسرة ذات دخل منخفض)' },
  MAINTAIN_INSTALLMENT:      { en: 'Current installment maintained', ar: 'الإبقاء على القسط الحالي' },
  ROLL_ARREARS_TO_END:       { en: 'Arrears deferred to end of loan term', ar: 'تأجيل المتأخرات إلى نهاية مدة القرض' },
  DEFER_TO_CIRCUMSTANCE_END: { en: 'Payment deferred until circumstance ends', ar: 'تأجيل السداد حتى انتهاء الظرف' },
  REFER_HUMAN:               { en: 'Referred to a specialist officer', ar: 'الإحالة إلى الموظف المختص' },
}

export function selectReschedulingPath(input: {
  unemployment: boolean
  temporaryCircumstance: boolean
  isHardship: boolean
  incomeChanged: boolean
  dbrWithinLimit: boolean
  twentyPercentRulePass: boolean
  arrearsPremium: number
}): ReschedulingPath {
  if (input.unemployment) return 'ROLL_ARREARS_TO_END'
  if (input.temporaryCircumstance) return 'DEFER_TO_CIRCUMSTANCE_END'
  if (!input.dbrWithinLimit) return 'REFER_HUMAN'
  if (!input.twentyPercentRulePass || input.arrearsPremium <= 0) return 'MAINTAIN_INSTALLMENT'
  if (input.isHardship || input.incomeChanged) return 'REDUCE_INCREASE'
  return 'RAISE_INSTALLMENT'
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
  SALARY_DISCREPANCY_THRESHOLD_PCT: 0.15, // tolerance for cert vs authority salary match (15%)
}

export type ActiveRules = typeof OFFICIAL_MOEI_RULES

// Admin-configurable rule overrides. Cached for 5 minutes to avoid a DB hit on every
// case. Cache resets when admin saves new values via the settings panel.
let _rulesCache: ActiveRules | null = null
let _rulesCacheAt = 0
const RULES_CACHE_TTL_MS = 5 * 60 * 1000

export function invalidateRulesCache() {
  _rulesCache = null
  _rulesCacheAt = 0
}

/** Load the active governance rules: DB overrides merged on top of the statutory defaults. */
export async function loadActiveRules(): Promise<ActiveRules> {
  if (_rulesCache && Date.now() - _rulesCacheAt < RULES_CACHE_TTL_MS) return _rulesCache
  try {
    // Lazy import to avoid a circular-dependency between governance and data-layer.
    const { getGovernanceRuleOverrides } = await import('@/lib/data-layer')
    const ov = await getGovernanceRuleOverrides()
    _rulesCache = {
      MAX_DEDUCTION_PERCENT:    ov.maxDeductionPercent    ?? OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT,
      MAX_INSTALLMENT_PERCENT:  ov.maxDeductionPercent    ?? OFFICIAL_MOEI_RULES.MAX_INSTALLMENT_PERCENT,
      HARDSHIP_DEDUCTION_PERCENT: ov.hardshipDeductionPercent ?? OFFICIAL_MOEI_RULES.HARDSHIP_DEDUCTION_PERCENT,
      HARDSHIP_PER_MEMBER_INCOME: ov.hardshipPerMemberIncome  ?? OFFICIAL_MOEI_RULES.HARDSHIP_PER_MEMBER_INCOME,
      DBR_CAP_SALARIED:         ov.dbrCapSalaried         ?? OFFICIAL_MOEI_RULES.DBR_CAP_SALARIED,
      DBR_CAP_RETIREE:          ov.dbrCapRetiree          ?? OFFICIAL_MOEI_RULES.DBR_CAP_RETIREE,
      CERT_FRESHNESS_DAYS:      ov.certFreshnessDays      ?? OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS,
      DEFAULT_REMAINING_LOAN_MONTHS: OFFICIAL_MOEI_RULES.DEFAULT_REMAINING_LOAN_MONTHS,
      SALARY_DISCREPANCY_THRESHOLD_PCT: ov.salaryDiscrepancyThresholdPct ?? OFFICIAL_MOEI_RULES.SALARY_DISCREPANCY_THRESHOLD_PCT,
    }
    _rulesCacheAt = Date.now()
    return _rulesCache
  } catch {
    return OFFICIAL_MOEI_RULES
  }
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
  hasDda: boolean
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
    id: 'G-06',
    name: 'Direct Debit Authority Required',
    description: 'The beneficiary must have an active Direct Debit Authority (DDA) so the rescheduled installment can be auto-collected. No DDA → rejected with guidance to enrol with Emirates Development Bank (EDB).',
    check: (data: RuleData) => data.hasDda,
    failOutcome: 'REJECT', // a genuine denial — surfaced to the citizen as "Reject" (enrol DDA, then re-apply)
    failReason: 'No active Direct Debit Authority (DDA) on file — please enrol for Direct Debit with Emirates Development Bank (EDB), then re-apply.',
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
  // Genuine denials: duplicate active application (G-00) and no Direct Debit Authority (G-06).
  if (ruleId === 'G-00' || ruleId === 'G-06') return 'Reject'
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
export type DocumentType =
  | 'salary_certificate'
  | 'non_work_letter'
  | 'income_statement'
  | 'supporting_document'
  | 'business_failure_certificate'
  | 'salary_reduction_certificate'
  | 'family_circumstances_certificate'
  | 'medical_certificate'

// A single citizen-facing document ask (the type SADDAD validates against + the label shown).
export type DocSpec = { type: DocumentType; label: string }

// Two-document model: a mandatory PRIMARY document (always the salary certificate, except
// Job Loss where the non-work letter replaces it) and, for certain reasons, a reason-specific
// SUPPORTING document requested via a Request-Documents round-trip AFTER the primary is valid.
export type RequiredDocuments = {
  primary: DocSpec
  supporting: DocSpec | null
  // ── Back-compat (point at the PRIMARY doc) — kept so existing callers keep working. ──
  labels: string[]        // citizen-facing, specific asks
  requiresUpload: boolean // the primary document is always required
  primaryType: DocumentType
}

const DOC_LABELS: Record<DocumentType, string> = {
  salary_certificate: 'A recent salary certificate (issued within the last 30 days)',
  non_work_letter: 'A Job Loss Certificate — employer confirmation of termination, redundancy, contract completion or involuntary job loss (company letterhead, HR reference number, employment details, termination date, authorized signatory)',
  income_statement: 'A recent bank statement or income statement covering the last 3 months',
  supporting_document: 'A supporting document for your circumstance (e.g. an official assignment / secondment letter)',
  business_failure_certificate: 'A Business Failure Certificate — official declaration of business closure, insolvency or financial distress (trade licence information, company details, reason for closure, authorized signatory)',
  salary_reduction_certificate: 'A Salary Reduction Certificate from your employer (previous salary, revised salary, effective date, reason for reduction, HR authorization)',
  family_circumstances_certificate: 'A Family Circumstances Certificate — supporting document explaining the exceptional family circumstances affecting your finances (family details, financial impact statement, issuing authority or organization details)',
  medical_certificate: 'A Medical Condition Certificate — medical report or physician-issued certificate (hospital/clinic information, physician details, diagnosis summary, treatment period, official stamp/signature)',
}

function withCompat(primary: DocSpec, supporting: DocSpec | null): RequiredDocuments {
  return { primary, supporting, labels: [primary.label], requiresUpload: true, primaryType: primary.type }
}

export function determineRequiredDocuments(input: {
  reschedule_reason?: string
  unemployment?: boolean
  income_changed?: boolean
  temporary_circumstance?: boolean
  hasIncomeRecord?: boolean
  uploadedDocType?: string
}): RequiredDocuments {
  const reason = String(input.reschedule_reason || 'other')

  // Job loss / unemployment:
  // - If the user uploaded a salary certificate (or a prior one was validated),
  //   the primary document is salary_certificate, and the non-work letter is the supporting document.
  // - Otherwise, the non-work/termination letter replaces the salary certificate directly.
  if (input.unemployment || reason === 'job_loss') {
    if (input.uploadedDocType === 'salary_certificate') {
      return withCompat(
        { type: 'salary_certificate', label: DOC_LABELS.salary_certificate },
        { type: 'non_work_letter', label: DOC_LABELS.non_work_letter }
      )
    }
    return withCompat({ type: 'non_work_letter', label: DOC_LABELS.non_work_letter }, null)
  }

  // Everyone else: a recent salary certificate is the MANDATORY primary document so the
  // forensic + vision authenticity check always runs (the on-record Programme income is
  // still cross-checked against it during verification).
  const salaryCert: DocSpec = { type: 'salary_certificate', label: DOC_LABELS.salary_certificate }

  // Reason-specific SUPPORTING document (requested only after the salary cert is
  // valid). EVERY circumstance has its own certificate type with its own
  // verification profile (anchors, OCR fields, vision brief) — see
  // DOC_TYPE_PROFILES in lib/document-forensics.ts.
  let supporting: DocSpec | null = null
  if (reason === 'business_failure') {
    supporting = { type: 'business_failure_certificate', label: DOC_LABELS.business_failure_certificate }
  } else if (reason === 'medical_expenses') {
    supporting = { type: 'medical_certificate', label: DOC_LABELS.medical_certificate }
  } else if (input.temporary_circumstance) {
    supporting = {
      type: 'supporting_document',
      label: 'A medical report or official supporting document for your circumstance (e.g. a hospital report or an official assignment / secondment letter)',
    }
  } else if (input.income_changed || reason === 'salary_reduction') {
    supporting = { type: 'salary_reduction_certificate', label: DOC_LABELS.salary_reduction_certificate }
  } else if (reason === 'family_circumstances') {
    supporting = { type: 'family_circumstances_certificate', label: DOC_LABELS.family_circumstances_certificate }
  }
  // Stable employment / other → salary certificate only.
  return withCompat(salaryCert, supporting)
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
  opts: { deferArrears?: boolean; rules?: ActiveRules } = {}
): ReschedulePlan {
  const cap = (opts.rules ?? OFFICIAL_MOEI_RULES).MAX_DEDUCTION_PERCENT

  // Brief Assessment Matrix — unemployment / temporary circumstances: move the arrears
  // to the END of the repayment period WITHOUT increasing the current monthly installment.
  // The loan term is extended by the months needed to clear arrears at the existing rate.
  // This path runs BEFORE the G-03 headroom check — adding zero premium is always within
  // the 20% ceiling regardless of salary (including salary = 0 for unemployment cases).
  if (opts.deferArrears && remainingLoanMonths > 0) {
    const durationMonths = currentInstallment > 0
      ? Math.ceil(arrears / currentInstallment)
      : remainingLoanMonths  // edge case: no prior installment, use remaining term
    return {
      arrearsPremium: 0,
      monthlyPayment: 0,
      durationMonths,
      totalDeduction: currentInstallment,
      deductionRate: salary > 0 ? currentInstallment / salary : 0,
      withinLoanPeriod: true,  // term extension is the explicit policy for these cases
      twentyPercentRulePass: true,
      planType: 'TRANSFER_ARREARS',
    }
  }

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
  temporary_circumstance = false,
  rules: ActiveRules = OFFICIAL_MOEI_RULES
): FinancialAnalysis {
  const per_member_income = Math.round(computePerMemberIncome(salary, family_size))
  const is_hardship =
    per_member_income < rules.HARDSHIP_PER_MEMBER_INCOME || income_changed
  const target_deduction_rate = is_hardship
    ? rules.HARDSHIP_DEDUCTION_PERCENT
    : rules.MAX_DEDUCTION_PERCENT

  // Unemployment or a verified temporary circumstance → defer arrears to the end of
  // the term with the smallest possible monthly increase (Brief Assessment Matrix).
  const defer_arrears = unemployment || temporary_circumstance
  const plan = calculateReschedulingPlan(
    arrears, salary, remaining_loan_months, current_installment, target_deduction_rate,
    { deferArrears: defer_arrears, rules }
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
  // DBR = total obligations (other debts + proposed housing deduction) / salary — CBUAE Article 7.
  // Using the full obligations ratio, not just this loan, matches the brief's assessment matrix:
  // "Total obligations compared with total income through system linkage or financial data."
  const dbr = salary > 0 ? (expenses + proposed_total_deduction) / salary : 1
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
    rescheduling_path: selectReschedulingPath({
      unemployment,
      temporaryCircumstance: temporary_circumstance,
      isHardship: is_hardship,
      incomeChanged: income_changed,
      dbrWithinLimit: dbr <= dbr_cap,
      twentyPercentRulePass: twenty_percent_rule_pass,
      arrearsPremium: arrears_premium,
    }),
  }
}

export type GovernanceOptions = {
  documentFresh?: boolean
  hasActiveApplication?: boolean
  // Direct Debit Authority on file (defaults to true when omitted — back-compat).
  hasDda?: boolean
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
    hasDda: opts.hasDda !== false, // default true when omitted (back-compat)
    documentsValid: document_valid,
    documentFresh: opts.documentFresh !== false,
    twentyPercentRulePass: financials.twenty_percent_rule_pass,
    periodRulePass: financials.period_rule_pass,
    previousDefault: previous_default,
  }

  const base = evaluateRules(GOVERNANCE_RULES, data)
  const ratePct = Math.round(financials.proposed_deduction_rate * 100)

  if (base.decision === 'APPROVED') {
    // DBR ceiling: total obligations (other debts + proposed deduction) exceed the CBUAE/SZHP
    // cap → reduce the increase, maintain the installment, or refer for human review.
    // Only applies to non-deferral cases (deferral adds 0 premium so DBR is unchanged).
    if (!financials.dbr_within_limit && !financials.arrears_deferred) {
      const totalPct = Math.round(financials.dbr * 100)
      const capPct = Math.round(financials.dbr_cap * 100)
      return {
        decision: 'ESCALATED',
        reason: `Total financial obligations (${totalPct}% of salary including existing debts and proposed deduction) exceed the ${capPct}% DBR ceiling — officer review required to reduce the installment increase or maintain the current installment.`,
        rule_triggered: 'G-07: DBR Ceiling — Total obligations exceed CBUAE/SZHP limit',
        financial_analysis: financials,
      }
    }

    let approvedReason: string
    if (financials.arrears_deferred) {
      const circumstance = financials.unemployment ? 'Unemployment' : 'Temporary circumstance'
      approvedReason = `All rules satisfied. ${circumstance} — arrears of AED ${arrears.toLocaleString()} deferred to the end of the loan term. Monthly installment remains unchanged at AED ${financials.current_installment.toLocaleString()}. Loan extends by approximately ${financials.proposed_duration} months (plan: TRANSFER_ARREARS).`
    } else {
      const lighter = financials.is_hardship ? ' (lighter plan applied for a hardship household)' : ''
      approvedReason = `All rules satisfied. Proposed deduction rate: ${ratePct}% of AED ${salary.toLocaleString()} salary${lighter} — total monthly deduction AED ${financials.proposed_total_deduction.toLocaleString()} (existing installment AED ${financials.current_installment.toLocaleString()} + arrears premium AED ${financials.arrears_premium.toLocaleString()}). Arrears of AED ${arrears.toLocaleString()} clear over ${financials.proposed_duration} months (plan: ${financials.plan_type}). Within the 20% rule and the loan period.`
    }
    return {
      decision: 'APPROVED',
      reason: approvedReason,
      rule_triggered: 'Rules G-00 through G-05: All passed — Clean Approval',
      financial_analysis: financials,
    }
  }

  const ruleId = base.rule_triggered.match(/G-\d+/)?.[0] ?? ''
  let reason = base.reason
  if (ruleId === 'G-00') {
    reason = 'An active rescheduling application already exists for this beneficiary. A duplicate request cannot be processed — please follow up on your existing application. Status: rejected (duplicate).'
  } else if (ruleId === 'G-06') {
    reason = 'You do not have an active Direct Debit Authority (DDA) for your housing loan. A DDA is required so the rescheduled installment can be collected automatically each month. Please enrol for Direct Debit with Emirates Development Bank (EDB), then submit your rescheduling request again. Status: rejected (no DDA).'
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
      hasDda: input.auto_dda !== false,
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
