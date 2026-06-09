// The LangGraph state schema for the SADDAD decision pipeline.
//
// Every channel below is a slot in the shared state that flows through the graph.
// Nodes read the slots they need and return a partial state with the slots they
// produce. The two parallel pairs (Document ∥ DB-Fetch, Communication ∥ Escalation)
// write DISTINCT channels, so the default last-value reducer never conflicts.

import { Annotation } from '@langchain/langgraph'
import type {
  PlannerDecision,
  RiskForecast,
  DocResult,
  FairnessResult,
  CriticReview,
  RecoveryPlan,
  FinancialAnalysis,
  GovernanceResult,
} from './types'

export const SaddadState = Annotation.Root({
  // Inputs
  caseNumber: Annotation<string>,
  formData: Annotation<Record<string, unknown>>,

  // Agent outputs (filled as the graph runs)
  plan: Annotation<PlannerDecision>,
  riskForecast: Annotation<RiskForecast>,
  docResult: Annotation<DocResult>,
  dbApplicant: Annotation<Record<string, unknown>>,
  applicant: Annotation<Record<string, unknown>>,
  financials: Annotation<FinancialAnalysis>,
  govResult: Annotation<GovernanceResult>,
  aiRationale: Annotation<string>,
  rationaleAr: Annotation<string>,
  fairnessResult: Annotation<FairnessResult>,
  proposedDecision: Annotation<string>,
  critique: Annotation<CriticReview>,
  finalDecision: Annotation<string>,
  finalRationale: Annotation<string>,
  finalRationaleAr: Annotation<string>,
  recoveryPlan: Annotation<RecoveryPlan>,
})

export type SaddadStateType = typeof SaddadState.State
// What a node receives and returns a partial of.
export type SaddadNodeUpdate = Partial<SaddadStateType>
