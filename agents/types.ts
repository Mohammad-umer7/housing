// Shared types for the SADDAD agent graph. Kept in one place so the graph state
// schema and the individual node modules can import them without import cycles.

import type { FinancialAnalysis, GovernanceResult } from '@/governance/housing-arrears'
import type { RiskLevel } from '@/governance/housing-arrears'
import type { VerificationReport, VerificationVerdict } from '@/lib/document-forensics'

export type { FinancialAnalysis, GovernanceResult, RiskLevel }
export type { VerificationReport, VerificationCheck } from '@/lib/document-forensics'

// ── Planner ───────────────────────────────────────────────────────────────────
export type PlannerStrategy = 'FAST_TRACK' | 'STANDARD' | 'DEEP_REVIEW' | 'IMMEDIATE_ESCALATE'

export type PlannerDecision = {
  strategy: PlannerStrategy
  reasoning: string
  skipFairnessCheck: boolean
  immediateEscalationReason: string | null
  priorityFlags: string[]
}

// ── Risk Forecaster ─────────────────────────────────────────────────────────��─
export type RiskForecast = {
  riskLevel: RiskLevel
  riskScore: number
}

// ── Document Agent ──────────────────────────────────────────────────────────��─
// The verdict is the single source of truth in lib/document-forensics.
export type DocAuthenticity = VerificationVerdict

export type DocResult = {
  documents: string[]
  complete: boolean
  missing: string[]
  salaryMismatch: boolean
  extractedSalary: number | null
  confidence: number
  // Layered verification (doc-type gate + DB field cross-check + arithmetic + vision)
  authenticity: DocAuthenticity
  authorityName: string | null
  authoritySalary: number | null
  authorityReason: string
  verificationReport: VerificationReport | null
  // The specific document(s) this case needs — surfaced when something is missing.
  requiredDocuments: string[]
}

// ── Fairness ────────────────────────────────────────────────────────────────��─
export type FairnessResult = {
  consistencyFlag: boolean
  consistencyScore: number
  similarCasesFound: number
  fairnessNote: string
}

// ── Recovery ──────────────────────────────────────────────────────────────────
export type RecoveryStep = { issue: string; action: string }

export type RecoveryPlan = {
  needed: boolean
  blockers: string[]
  steps: RecoveryStep[]
  summary: string
  summaryAr: string
}

// ── Critic ────────────────────────────────────────────────────────────────────
export type CriticVerdict = 'APPROVE_AS_IS' | 'FORCE_ESCALATE'

export type CriticReview = {
  verdict: CriticVerdict
  complianceFlags: string[]
  reasoning: string
  finalDecision: string
  overrodeRules: boolean
  toolsUsed: string[]
}
