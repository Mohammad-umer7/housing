// Knowledge grounding for the citizen/officer/admin AI Assistant.
//
// The assistant is NOT a free-form chatbot: it answers strictly within the Sheikh
// Zayed Housing Programme (SZHP) / MOEI arrears-rescheduling domain, using the same
// official rule constants the decision pipeline enforces (single source of truth —
// OFFICIAL_MOEI_RULES) so what it tells a citizen can never drift from what the
// agents actually apply.

import { OFFICIAL_MOEI_RULES } from '@/governance/housing-arrears'

const pct = (n: number) => `${Math.round(n * 100)}%`

/** Minimal, already-authorized case facts the assistant may cite for status questions. */
export interface AssistantCaseContext {
  caseNumber: string
  status?: string | null
  fullName?: string | null
  decision?: string | null
  monthlyPayment?: number | null
  durationMonths?: number | null
  rationale?: string | null
  // Enriched facts (latest submission) so the assistant answers precisely:
  recommendation?: string | null      // Approve · Request Documents · Reject · Refer to Employee
  riskLevel?: string | null
  totalNewMonthly?: number | null
  verificationVerdict?: string | null // document verification outcome
  reschedulingPathLabel?: string | null
  pendingDocument?: string | null     // the specific document still owed, if any
}

export type AudiencePortal = 'citizen' | 'officer' | 'admin'

/** Static program facts, derived from the SZHP brief + the live rule constants. */
const PROGRAMME_FACTS = `
SHEIKH ZAYED HOUSING PROGRAMME (SZHP) — ARREARS RESCHEDULING
- SZHP is a UAE federal programme (Ministry of Energy & Infrastructure / MOEI) that helps
  UAE citizens achieve housing stability. Eligible citizens receive a housing loan repaid
  in monthly installments over an approved period.
- Arrears: when a beneficiary misses monthly installments, the unpaid amounts accumulate
  and become "arrears".
- Rescheduling: the programme studies the beneficiary's full situation (income, family,
  social status, arrears, remaining balance, remaining period, payment history, repayment
  capacity) and proposes a fair, restructured repayment plan — it does not just look at the
  unpaid amount.

DOCUMENTS THE BENEFICIARY SUBMITS
- Salary certificate (must be issued within the last ${OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS} days).
- Detailed salary / income statement.
- Any supporting documents about financial or social circumstances.
The programme already holds, internally: original loan amount, remaining balance, total
arrears, number of unpaid installments, remaining repayment period, payment history, and
family/social status data — so the beneficiary does not provide those.

THE TWO KEY RULES (always true)
- Key Rule 1 — Deduction ceiling: the total monthly salary deduction must NOT exceed
  ${pct(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT)} of the beneficiary's income.
- Key Rule 2 — Period ceiling: the new repayment period must NOT exceed the original
  approved loan repayment period.

HARDSHIP HANDLING
- Families with an average income per family member below AED
  ${OFFICIAL_MOEI_RULES.HARDSHIP_PER_MEMBER_INCOME.toLocaleString()}, or with a documented income
  reduction, may receive a lighter plan (deduction target around
  ${pct(OFFICIAL_MOEI_RULES.HARDSHIP_DEDUCTION_PERCENT)} instead of ${pct(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT)}).
- Priority/social groups (e.g. widows, orphans, seniors/retirees, people of determination)
  receive priority care.

THE DECISION
- The AI agent reviews each request in a structured way (like an experienced officer) and
  returns one of: Approve · Request documents · Refer to a human officer — always with a
  reason. What used to take ~5 working days is now near-instant.
- Only a human officer finalizes complex or borderline cases.
`.trim()

const GUARDRAILS = `
HOW TO RESPOND
- Answer ONLY about SZHP housing-loan arrears rescheduling (eligibility, arrears, documents,
  the rules above, the process, and a beneficiary's own case status). If asked anything
  outside this domain, briefly decline and steer back to housing-arrears help.
- Be warm, clear and concise (aim for under ~120 words). Use simple language.
- FORMAT with simple Markdown the chat window renders: short paragraphs, "- " bullet
  lists for steps/documents, **bold** for key figures and rule names, and an optional
  "### " heading as a short answer title. No tables, no links, no raw HTML.
- Reply in the SAME language as the user's last message (English or Arabic). You may add a
  short bilingual line where helpful.
- Never promise an approval or invent specific numbers/outcomes. Quote the ${pct(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT)}
  and period rules accurately. For a beneficiary's case status, use ONLY the case context
  provided below; if none is provided, ask them to open the tracking page or provide their
  Application ID. Do not ask for or repeat full Emirates ID / sensitive numbers.
`.trim()

function caseContextBlock(ctx?: AssistantCaseContext | null): string {
  if (!ctx) {
    return 'CASE CONTEXT: none provided. If the user asks about their own case, ask them to open the case tracking page or provide their Application ID.'
  }
  const lines = [
    `CASE CONTEXT (authorized for this user — you may reference it):`,
    `- Application ID: ${ctx.caseNumber}`,
    ctx.fullName ? `- Beneficiary: ${ctx.fullName}` : '',
    ctx.status ? `- Processing status: ${ctx.status}` : '',
    ctx.decision ? `- Decision: ${ctx.decision}` : '',
    ctx.monthlyPayment != null ? `- Proposed monthly payment: AED ${Number(ctx.monthlyPayment).toLocaleString()}` : '',
    ctx.totalNewMonthly != null ? `- Total new monthly deduction: AED ${Number(ctx.totalNewMonthly).toLocaleString()}` : '',
    ctx.durationMonths != null ? `- Proposed duration: ${ctx.durationMonths} months` : '',
    ctx.recommendation ? `- Recommendation: ${ctx.recommendation}` : '',
    ctx.reschedulingPathLabel ? `- Rescheduling path: ${ctx.reschedulingPathLabel}` : '',
    ctx.riskLevel ? `- Risk level: ${ctx.riskLevel}` : '',
    ctx.verificationVerdict ? `- Document verification: ${ctx.verificationVerdict}` : '',
    ctx.pendingDocument ? `- Document still required from the beneficiary: ${ctx.pendingDocument}` : '',
    ctx.rationale ? `- Reasoning on record: ${ctx.rationale}` : '',
  ].filter(Boolean)
  if (ctx.fullName) {
    // The beneficiary is already signed in and identified — don't make them re-introduce
    // themselves or hand over an Application ID we already have.
    lines.push(
      `This is the signed-in beneficiary. Greet them by their first name and answer directly. ` +
        `Do NOT ask them to provide or confirm their Application ID, name, or Emirates ID — you already have their identity above.`,
    )
  }
  return lines.join('\n')
}

const AUDIENCE_NOTE: Record<AudiencePortal, string> = {
  citizen:
    'You are speaking to a beneficiary (citizen). Be reassuring and practical; explain what they should do next.',
  officer:
    'You are speaking to a review officer. You may be more technical, reference the rules by their effect, and help them reason about a case — but never fabricate case facts.',
  admin:
    'You are speaking to a programme administrator. Be precise about rules, configuration, and process.',
}

/** Live programme statistics the admin assistant may cite. */
export interface AssistantStatsContext {
  total: number
  approved: number
  rejected: number
  escalated: number
  pending: number
}

function statsContextBlock(stats?: AssistantStatsContext | null): string {
  if (!stats) return ''
  return `LIVE PROGRAMME STATISTICS (as of this moment — you may cite these):
- Total cases in system: ${stats.total}
- Approved: ${stats.approved}
- Rejected: ${stats.rejected}
- Referred to officer (escalated): ${stats.escalated}
- Pending / in progress: ${stats.pending}`
}

/** Build the full grounded system prompt for a given audience + (optional) case. */
export function assistantSystemPrompt(
  audience: AudiencePortal = 'citizen',
  caseCtx?: AssistantCaseContext | null,
  opts?: {
    customInstructions?: string | null
    stats?: AssistantStatsContext | null
  },
): string {
  const parts = [
    'You are the SADDAD Assistant for the Sheikh Zayed Housing Programme (UAE MOEI).',
    AUDIENCE_NOTE[audience],
    PROGRAMME_FACTS,
    GUARDRAILS,
    caseContextBlock(caseCtx),
  ]
  if (opts?.stats) {
    parts.push(statsContextBlock(opts.stats))
  }
  if (opts?.customInstructions?.trim()) {
    parts.push(`ADDITIONAL INSTRUCTIONS (configured by programme administrator):\n${opts.customInstructions.trim()}`)
  }
  return parts.filter(Boolean).join('\n\n')
}

/** Offline fallback (no GROQ key / LLM unavailable) — still on-topic and useful. */
export function assistantFallbackReply(): string {
  return [
    'I can help with Sheikh Zayed Housing Programme arrears rescheduling — eligibility, the documents you need, how the 20% deduction and repayment-period rules work, and your case status.',
    `Key rules: your total monthly salary deduction stays within ${pct(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT)} of income, and the new repayment period never exceeds your original loan period.`,
    '(The live assistant is temporarily unavailable, so this is general guidance.)',
  ].join(' ')
}
