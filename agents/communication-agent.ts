// Communication Agent (graph node) — composes a professional, plain-language WhatsApp
// message for the citizen and delivers it (WhatsApp first, SMS fallback). Non-fatal: a
// delivery or LLM failure must never fail the pipeline. Runs in parallel with Escalation.
//
// It gathers everything the citizen needs — greeting, their application reference + name,
// the final verdict, a jargon-free explanation, and the next-steps/recovery guidance the
// Recovery Agent already produced — and makes ONE LLM call to turn it into a warm, clear
// message. It NEVER exposes internal rule codes (G-01…) or system internals to the citizen.
// A deterministic, equally clean message is always built as the fallback.

import { z } from 'zod'
import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import { executeNotificationTool } from '@/tools/notification-tools'
import { getStructuredModel } from '@/lib/llm/client'
import { markFallback } from '@/lib/i18n'
import { toRecommendation, type GovernanceDecision } from '@/governance/housing-arrears'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'

// Citizen-facing message parts the LLM writes (the factual header/plan figures are added
// deterministically so the application reference, name and amounts are always exact).
const MessageSchema = z.object({
  greeting: z.string().describe('A warm, professional 1-2 sentence thank-you and greeting addressed to the applicant.'),
  explanation: z.string().describe('A plain-language explanation of the decision the applicant can understand. NEVER mention internal rule codes (e.g. G-01), debt-burden ratios, or system internals. 2-4 sentences.'),
  next_steps: z.string().describe('Clear, encouraging next steps. For an approval: a brief congratulations and what happens next. Otherwise: the practical actions to take, paraphrased from the provided guidance. 1-3 sentences.'),
})

// Remove any internal rule codes ("Rule G-01:", "G-03") from text shown to the citizen.
const stripRuleCodes = (s: string) =>
  String(s ?? '').replace(/\b(rule\s+)?G-\d+\b:?/gi, '').replace(/\s{2,}/g, ' ').trim()

// Plain, citizen-facing label + emoji for the decision (no internal jargon).
function decisionLabel(decision: string, recommendation: string): string {
  if (decision === 'APPROVED') return '✅ Approved'
  if (decision === 'ESCALATED') return '🔍 Under review by a specialist officer'
  if (recommendation === 'Request Documents') return '📄 Additional documents needed'
  return '❌ Not approved'
}

export async function communicationNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, applicant, financials, govResult } = state
  const decision = state.finalDecision
  const rationale = stripRuleCodes(state.finalRationale || govResult?.reason || '')
  const recovery = state.recoveryPlan?.needed ? stripRuleCodes(state.recoveryPlan.summary) : ''
  const name = String(applicant.full_name || 'Applicant')
  const recommendation = toRecommendation(decision as GovernanceDecision, govResult?.rule_triggered)
  const label = decisionLabel(decision, recommendation)
  console.log(`[CommunicationAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'communication_agent'

  try {
    await updateAgentStep(caseNumber, agent, {
      status: 'running',
      started_at: new Date().toISOString(),
      ran_in_parallel: true,
    })

    // Approved-plan figures (deterministic — never invented by the LLM).
    const approvedPlanLine =
      decision === 'APPROVED'
        ? `💰 Your plan: AED ${financials.proposed_monthly_payment.toLocaleString()} per month for ${financials.proposed_duration} months (total monthly commitment AED ${financials.total_new_monthly.toLocaleString()}).`
        : ''

    // ── One LLM pass to write the human parts (greeting / explanation / next steps).
    // Reuses the Recovery Agent's guidance, so the LLM is NOT called twice for recovery.
    let parts = {
      greeting: `Dear ${name}, thank you for submitting your housing arrears rescheduling request to the Sheikh Zayed Housing Programme.`,
      explanation: rationale || 'Your request has been reviewed.',
      next_steps:
        decision === 'APPROVED'
          ? 'Congratulations — your rescheduling plan is now in place and will be applied to your account.'
          : decision === 'ESCALATED'
          ? 'Your case has been referred to a specialist officer who will review it and contact you within 5 working days.'
          : recovery || 'Please visit your nearest service center for assistance.',
    }

    try {
      const systemPrompt = `You are the citizen-communication writer for SADDAD, the UAE Ministry of Energy and Infrastructure (Sheikh Zayed Housing Programme) housing-arrears service.
Write a warm, respectful, PROFESSIONAL message that a beneficiary will receive on WhatsApp about their rescheduling request.
STRICT RULES:
- Plain language a normal citizen understands. NEVER mention internal rule codes (e.g. "G-01"), "DBR", "debt-burden ratio", confidence scores, agents, or any system internals.
- Be honest about the outcome but encouraging and human.
- Do NOT invent any numbers — only refer to figures given to you.
- Keep each field concise.`

      const userContext = `APPLICANT NAME: ${name}
APPLICATION REFERENCE: ${caseNumber}
DECISION (plain label to convey): ${label}
INTERNAL DECISION: ${decision} (recommendation: ${recommendation})
REVIEW REASONING (rewrite for the citizen, remove any jargon): ${rationale || 'n/a'}
${approvedPlanLine ? `APPROVED PLAN FIGURES (already shown separately, do not repeat verbatim): ${approvedPlanLine}` : ''}
NEXT-STEPS / RECOVERY GUIDANCE (paraphrase warmly for the citizen): ${recovery || (decision === 'APPROVED' ? 'Approved — no further action needed.' : 'n/a')}

Write greeting, explanation and next_steps for this applicant.`

      const model = getStructuredModel(MessageSchema, { temperature: 0.3, maxTokens: 500 })
      const llm = await model.invoke([
        ['system', systemPrompt],
        ['human', userContext],
      ])
      parts = {
        greeting: stripRuleCodes(llm.greeting) || parts.greeting,
        explanation: stripRuleCodes(llm.explanation) || parts.explanation,
        next_steps: stripRuleCodes(llm.next_steps) || parts.next_steps,
      }
    } catch {
      console.warn(`[CommunicationAgent] LLM compose failed for case=${caseNumber}, using deterministic message`)
      parts = { ...parts, greeting: markFallback(parts.greeting) }
    }

    // ── Assemble the final, professional WhatsApp message (deterministic structure).
    const message = [
      parts.greeting,
      '',
      `📋 Application Reference: ${caseNumber}`,
      `👤 Applicant: ${name}`,
      `📌 Decision: ${label}`,
      '',
      parts.explanation,
      ...(approvedPlanLine ? ['', approvedPlanLine] : []),
      '',
      parts.next_steps,
      '',
      'Sheikh Zayed Housing Programme',
      'Ministry of Energy and Infrastructure',
    ].join('\n')

    // Demo override: always notify the configured demo phone (so the judge receives every
    // decision on their own WhatsApp), falling back to the applicant's real phone.
    const recipient = process.env.DEMO_NOTIFY_PHONE || String(applicant.phone || '')

    // Credit safety: send EXACTLY ONE message per decision. The pipeline already runs
    // once per submission (the worker claims each job atomically), and only a SINGLE
    // channel is ever used — WhatsApp first, and SMS solely as a fallback if WhatsApp
    // throws (never both). Set NOTIFICATIONS_ENABLED=false to run the full pipeline
    // during testing WITHOUT spending any Twilio credit (the message is still composed
    // and logged, just not delivered).
    const notificationsEnabled = process.env.NOTIFICATIONS_ENABLED !== 'false'

    let sent = false
    let channel = ''
    if (!notificationsEnabled) {
      channel = 'disabled'
    } else if (recipient) {
      try {
        await executeNotificationTool('send_whatsapp', { phone: recipient, message, caseNumber })
        sent = true
        channel = 'WhatsApp'
      } catch {
        try {
          await executeNotificationTool('send_sms', { phone: recipient, message })
          sent = true
          channel = 'SMS'
        } catch {
          /* both channels failed — log and continue, never crash the pipeline */
        }
      }
    }

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: sent
        ? `${channel} delivered to ${recipient} (1 message)`
        : !notificationsEnabled
        ? `Notifications disabled (NOTIFICATIONS_ENABLED=false) — message composed but not sent (0 credit used)`
        : `Notification not sent — ${recipient || 'no recipient'} (check Twilio creds / sandbox join)`,
    })

    console.log(`[CommunicationAgent] DONE case=${caseNumber} sent=${sent} duration=${duration}ms`)
    return {}
  } catch (err) {
    console.error(`[CommunicationAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    await updateAgentStep(caseNumber, agent, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result_summary: `Non-fatal error: ${String(err)}`,
    })
    return {}
  }
}
