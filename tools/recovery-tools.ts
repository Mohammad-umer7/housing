// MCP-compatible tools for the Recovery Agent.
//
// When a case is NOT approved, the Recovery Agent tells the citizen exactly how to
// become eligible. These tools do the deterministic math (what would need to change
// to pass each gate) and look up the official remediation text per blocker — so the
// guidance the agent gives is grounded in real numbers, not invented.
//
// The pure functions are exported for unit tests + the deterministic fallback; the
// LangChain `tool(...)` wrappers are what the agent's LLM calls autonomously.

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { OFFICIAL_MOEI_RULES } from '@/governance/housing-arrears'

export type AffordableTargets = {
  twentyPctMax: number // 20% of salary — the deduction ceiling
  headroom: number // room under the ceiling for an arrears premium (cap − existing installment)
  twentyPercentRulePass: boolean
  installmentReductionFor20: number // if no headroom, how much to cut the existing installment
  maxArrearsForTerm: number // largest arrears that clears within the term at full headroom
  arrearsReductionNeeded: number // partial payment needed to fit the term
}

// What would need to change for a rescheduling plan to pass the 20% deduction rule and
// the loan-period rule, using the real headroom model (total deduction = existing
// installment + arrears premium ≤ 20% of salary).
export function computeAffordableTargets(p: {
  salary: number
  currentInstallment: number
  arrears: number
  remainingLoanMonths: number
}): AffordableTargets {
  const salary = Number(p.salary) || 0
  const installment = Number(p.currentInstallment) || 0
  const arrears = Number(p.arrears) || 0
  const remaining = Number(p.remainingLoanMonths) || OFFICIAL_MOEI_RULES.DEFAULT_REMAINING_LOAN_MONTHS

  const twentyPctMax = Math.round(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT * salary)
  const headroom = twentyPctMax - installment
  const twentyPercentRulePass = headroom > 0
  const installmentReductionFor20 = Math.max(0, installment - twentyPctMax)
  const maxArrearsForTerm = Math.max(0, headroom) * remaining
  const arrearsReductionNeeded = Math.max(0, arrears - maxArrearsForTerm)

  return {
    twentyPctMax,
    headroom,
    twentyPercentRulePass,
    installmentReductionFor20,
    maxArrearsForTerm,
    arrearsReductionNeeded,
  }
}

// Official remediation text per blocker, bilingual. Keys are governance rule ids plus
// the document-authenticity verdicts.
export const REMEDIATION: Record<string, { en: string; ar: string }> = {
  'G-00': {
    en: 'You already have an active rescheduling application on record. A second request cannot be processed in parallel. Please follow up on your existing application, or withdraw it before submitting a new one.',
    ar: 'لديك بالفعل طلب إعادة جدولة نشط مسجّل. لا يمكن معالجة طلب ثانٍ في الوقت نفسه. يرجى متابعة طلبك الحالي أو سحبه قبل تقديم طلب جديد.',
  },
  'G-01': {
    en: 'Upload your salary certificate — or, if you are not employed, a notarised non-work letter from a notary public.',
    ar: 'قم بتحميل شهادة الراتب، أو خطاب عدم عمل موثق من الكاتب العدل إذا كنت غير موظف.',
  },
  'G-02': {
    en: 'Your salary certificate is older than 30 days. Obtain a fresh certificate issued within the last 30 days and re-submit.',
    ar: 'شهادة الراتب أقدم من 30 يومًا. احصل على شهادة حديثة صادرة خلال آخر 30 يومًا وأعد التقديم.',
  },
  'G-03': {
    en: 'Your existing monthly installment already uses 20% or more of your income, leaving no room to add an arrears payment within the 20% rule. Reducing your existing monthly obligations would free room to reschedule.',
    ar: 'قسطك الشهري الحالي يستهلك 20% أو أكثر من دخلك، ولا يترك مجالاً لإضافة دفعة متأخرات ضمن قاعدة الـ20%. تقليل التزاماتك الشهرية الحالية يتيح مجالاً لإعادة الجدولة.',
  },
  'G-04': {
    en: 'Within the 20% deduction limit, the arrears would take longer than your remaining loan term to clear. A partial upfront payment of the arrears would bring it within your term.',
    ar: 'ضمن حد الخصم 20%، ستستغرق المتأخرات وقتًا أطول من المدة المتبقية للقرض. دفعة جزئية مقدمة من المتأخرات ستجعلها ضمن مدة قرضك.',
  },
  'G-05': {
    en: 'Your case needs officer review because of a previous rescheduling default. Prepare documents showing your changed circumstances; an officer will contact you within 5 working days.',
    ar: 'تحتاج حالتك إلى مراجعة موظف بسبب تعثّر سابق في إعادة الجدولة. جهّز مستندات تثبت تغيّر ظروفك؛ سيتواصل معك موظف خلال 5 أيام عمل.',
  },
  'G-06': {
    en: 'Your case has been routed to the priority human-care queue. A specialist officer will contact you within 5 working days — no further action is needed now.',
    ar: 'تمت إحالة حالتك إلى قائمة الرعاية ذات الأولوية. سيتواصل معك موظف مختص خلال 5 أيام عمل — لا حاجة لإجراء إضافي الآن.',
  },
  mismatch: {
    en: 'The salary on your certificate does not match the issuing authority’s record. Re-submit a genuine certificate whose salary matches your declared income.',
    ar: 'الراتب في شهادتك لا يطابق سجل الجهة المُصدِرة. أعد تقديم شهادة صحيحة يطابق راتبها دخلك المُعلن.',
  },
  suspicious: {
    en: 'Our AI verification flagged your uploaded document as possibly not genuine, so it has been sent to a specialist officer for manual review. If your document is authentic, no action is needed — the officer will confirm it. You may also upload a clearer original copy issued directly by your employer or the issuing authority.',
    ar: 'أشار نظام التحقق الذكي لدينا إلى أن المستند الذي رفعته قد لا يكون أصليًا، لذا تمت إحالته إلى موظف مختص للمراجعة اليدوية. إذا كان مستندك صحيحًا فلا حاجة لأي إجراء — سيؤكده الموظف. يمكنك أيضًا رفع نسخة أصلية أوضح صادرة مباشرةً من جهة عملك أو الجهة المُصدِرة.',
  },
  tampered: {
    en: 'Your certificate appears to have been edited after it was issued (its PDF metadata or layout shows changes). Please obtain a fresh, unedited certificate directly from your employer or the issuing authority and upload the original file.',
    ar: 'يبدو أن شهادتك قد تم تعديلها بعد إصدارها (تظهر بيانات ملف PDF أو تنسيقه تغييرات). يرجى الحصول على شهادة جديدة غير معدّلة مباشرةً من جهة العمل أو الجهة المُصدِرة ورفع الملف الأصلي.',
  },
  invalid: {
    en: 'The file you uploaded is not a recognized salary certificate. Please upload your official salary certificate (a PDF issued by your employer or the issuing authority) — not a different document.',
    ar: 'الملف الذي رفعته ليس شهادة راتب معتمدة. يرجى رفع شهادة الراتب الرسمية (ملف PDF صادر من جهة العمل أو الجهة المُصدِرة) وليس مستندًا آخر.',
  },
  unverifiable: {
    en: 'The issuing authority has no salary record on file for you, so your certificate cannot be validated. Ask your employer to register/update your salary record with the authority, then re-submit.',
    ar: 'لا يوجد لدى الجهة المُصدِرة سجل راتب باسمك، لذا لا يمكن التحقق من شهادتك. اطلب من جهة عملك تسجيل/تحديث سجل راتبك لدى الجهة المختصة ثم أعد التقديم.',
  },
  default: {
    en: 'Your case has been referred to a specialist officer. Please make sure all uploaded documents are valid and your declared figures are accurate.',
    ar: 'تمت إحالة حالتك إلى موظف مختص. يرجى التأكد من صحة جميع المستندات المرفوعة ودقة الأرقام المُعلنة.',
  },
}

export function lookupRemediation(key: string): { en: string; ar: string } {
  return REMEDIATION[key] ?? REMEDIATION.default
}

// ── LangChain tool wrappers (bound to the Recovery Agent's LLM) ───────────────
export const computeAffordableTargetsTool = tool(
  async (input) => JSON.stringify(computeAffordableTargets(input)),
  {
    name: 'compute_affordable_targets',
    description:
      'Computes what would make the case eligible: the 20% total-deduction ceiling, arrears-payment headroom, installment reduction needed for headroom, and arrears reduction needed to clear within the remaining loan term.',
    schema: z.object({
      salary: z.number(),
      currentInstallment: z.number(),
      arrears: z.number(),
      remainingLoanMonths: z.number(),
    }),
  },
)

export const lookupRemediationTool = tool(
  async ({ key }) => JSON.stringify(lookupRemediation(String(key))),
  {
    name: 'lookup_remediation',
    description:
      'Returns the official bilingual remediation guidance for a blocker. Keys: G-00..G-06 (governance rules), or mismatch / tampered / unverifiable (certificate verification), or default.',
    schema: z.object({ key: z.string().describe('Blocker key, e.g. "G-04" or "mismatch"') }),
  },
)

export const RECOVERY_TOOLS = [computeAffordableTargetsTool, lookupRemediationTool]

