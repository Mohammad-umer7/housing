// Shared contract for every federal service that runs on the SADDAD pipeline.
//
// Onboarding a new federal service = add a governance module that implements
// ServiceModule and register it in registry.ts. The agents, tools, auth, audit
// trail and dashboard are all service-agnostic — only this governance layer
// changes per service. This is what makes SADDAD a *platform* rather than a
// one-off app (see docs/PITCH.md).

export type ServiceDecision = 'APPROVED' | 'REJECTED' | 'ESCALATED'
export type RuleOutcome = 'REJECT' | 'ESCALATE'

export interface GovernanceRule<TData> {
  id: string
  name: string
  description: string
  check: (data: TData) => boolean
  failOutcome: RuleOutcome
  failReason: string
}

export interface ServiceRuleResult {
  decision: ServiceDecision
  reason: string
  rule_triggered: string
}

// The shared decision engine. Identical control flow for every service: the first
// failing rule decides the outcome (a REJECT rule rejects; an ESCALATE rule
// escalates), otherwise APPROVED. This is the part that does NOT change when a new
// federal service is onboarded — only the `rules` array passed in does.
export function evaluateRules<TData>(
  rules: GovernanceRule<TData>[],
  data: TData,
  approvedReason = 'All governance rules satisfied — auto-approved.'
): ServiceRuleResult {
  for (const rule of rules) {
    if (!rule.check(data)) {
      return {
        decision: rule.failOutcome === 'REJECT' ? 'REJECTED' : 'ESCALATED',
        reason: rule.failReason,
        rule_triggered: `Rule ${rule.id}: ${rule.name}`,
      }
    }
  }
  const first = rules[0]?.id ?? ''
  const last = rules[rules.length - 1]?.id ?? ''
  return {
    decision: 'APPROVED',
    reason: approvedReason,
    rule_triggered: `Rules ${first} through ${last}: All passed`,
  }
}

// The contract the SADDAD pipeline needs to process one federal service. Inputs are
// passed as a loose record (the same shape the API route already produces); each
// module coerces the fields it cares about and returns a governance decision plus
// its service-specific analysis payload.
export interface ServiceModule {
  id: string
  displayName: string
  displayNameAr: string
  ruleCount: number
  decide: (input: Record<string, unknown>) => ServiceRuleResult & { analysis: unknown }
}
