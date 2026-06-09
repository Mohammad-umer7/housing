// The SADDAD decision pipeline as a LangGraph StateGraph.
//
// Topology (mirrors the original orchestrator exactly):
//
//   START → planner → risk_forecaster ─┬→ document ─┐
//                                       └→ db_fetch ─┴→ merge → financial → rules
//        → (plan.skipFairnessCheck ? fairness_skipped : fairness)
//        → decide_proposed → critic
//        → (critique.overrodeRules ? reconcile → finalize : finalize)
//        → (communication ‖ escalation) → END
//
// The two parallel pairs write DISTINCT state channels, so the default reducer
// never conflicts. Plumbing nodes (merge / decide_proposed / finalize) are NOT
// agents — they don't write agent_steps, keeping the 11-agent audit trail clean.

import { StateGraph, START, END } from '@langchain/langgraph'
import { SaddadState, type SaddadStateType, type SaddadNodeUpdate } from './graph-state'
import { plannerNode } from './planner-agent'
import { riskForecasterNode } from './risk-forecaster-agent'
import { documentNode } from './document-agent'
import { dbFetchNode } from './db-fetch-agent'
import { financialNode } from './financial-agent'
import { rulesNode, reconcileNode } from './rules-agent'
import { fairnessNode, fairnessSkippedNode } from './fairness-agent'
import { criticNode } from './critic-agent'
import { communicationNode } from './communication-agent'
import { escalationNode } from './escalation-agent'
import { recoveryNode, recoverySkippedNode } from './recovery-agent'

// ── Plumbing nodes (not agents) ──────────────────────────────────────────────

// Fan-in after Document ‖ DB-Fetch: DB record wins for core fields; form data wins
// for the user-provided fields. Identical merge to the original orchestrator.
function mergeApplicantNode(state: SaddadStateType): SaddadNodeUpdate {
  const db = (state.dbApplicant ?? {}) as Record<string, unknown>
  const doc = state.docResult
  const formData = state.formData
  const applicant: Record<string, unknown> = {
    ...db,
    // The judge edits Monthly Salary + Amount Due; those (plus expenses) are the
    // values under test, so they win over the DB record. The DB record only
    // supplies loan CONTEXT (bank, installment, remaining term) below.
    monthly_salary: formData.monthly_salary ?? db.monthly_salary,
    arrears_amount: formData.arrears_amount ?? db.arrears_amount,
    monthly_expenses: formData.monthly_expenses ?? db.monthly_expenses ?? 0,
    documents: doc.documents,
    document_valid: doc.complete,
    document_salary_mismatch: doc.salaryMismatch,
    document_extracted_salary: doc.extractedSalary,
    document_authenticity: doc.authenticity,
    document_authority_salary: doc.authoritySalary,
    document_authority_name: doc.authorityName,
    document_authority_reason: doc.authorityReason,
    document_required: doc.requiredDocuments,
    document_missing: doc.missing,
    months_in_arrears: formData.months_in_arrears ?? db.months_in_arrears ?? 0,
    reschedule_reason: formData.reschedule_reason ?? db.reschedule_reason ?? 'other',
    remaining_loan_months: formData.remaining_loan_months ?? db.remaining_loan_months ?? 60,
    current_installment: formData.current_installment ?? db.current_installment ?? 0,
    loan_bank_name: formData.loan_bank_name ?? db.loan_bank_name ?? '',
    loan_account_number: formData.loan_account_number ?? db.loan_account_number ?? '',
    total_loan_amount: formData.total_loan_amount ?? db.total_loan_amount ?? 0,
    remaining_loan_balance: formData.remaining_loan_balance ?? db.remaining_loan_balance ?? null,
    family_size: formData.family_size ?? db.family_size ?? 1,
    marital_status: formData.marital_status ?? db.marital_status ?? '',
    // UAE PASS (DB-3) identity + social signal — retrieved in db_fetch. Drives the
    // brief's differentiated handling (G-06 priority care, lighter hardship plans).
    full_name_ar: db.full_name_ar ?? '',
    number_of_children: db.number_of_children ?? 0,
    social_status: db.social_status ?? 'none',
    social_status_ar: db.social_status_ar ?? '',
    priority_group: db.priority_group ?? false,
    is_retiree: db.is_retiree ?? formData.is_retiree ?? false,
    income_changed: formData.income_changed ?? db.income_changed ?? false,
    payment_history: formData.payment_history ?? db.payment_history ?? null,
    // The officer's typed remarks win; otherwise fall back to the beneficiary's
    // retrieved request text (|| so an empty form field uses the on-record text).
    remarks: formData.remarks || db.remarks || '',
    justifications: formData.justifications || db.justifications || '',
    // Rule 3 — computed in db_fetch (seeded flag + live duplicate check); preserve it.
    has_active_application: db.has_active_application ?? false,
    auto_dda: formData.auto_dda ?? db.auto_dda ?? true,
  }
  return { applicant }
}

// Compute the proposed decision before the Critic: fairness can override an
// APPROVED to ESCALATED, and the Planner's IMMEDIATE_ESCALATE forces escalation
// (but never overrides a hard REJECTED).
function decideProposedNode(state: SaddadStateType): SaddadNodeUpdate {
  const { fairnessResult, govResult, plan } = state
  // Fairness may only UPGRADE a clean APPROVED to ESCALATED (flag an approval that is
  // inconsistent with precedent for human review). It must never touch a hard REJECTED
  // (e.g. G-00 duplicate application) or an already-ESCALATED decision.
  let proposedDecision =
    !fairnessResult.consistencyFlag && govResult.decision === 'APPROVED'
      ? 'ESCALATED'
      : govResult.decision
  if (plan.strategy === 'IMMEDIATE_ESCALATE' && proposedDecision !== 'REJECTED') {
    proposedDecision = 'ESCALATED'
  }
  return { proposedDecision }
}

// Settle the final decision + rationale. If the reflection node ran it already set
// finalRationale/finalRationaleAr; otherwise fall back to the Rules agent rationale.
function finalizeNode(state: SaddadStateType): SaddadNodeUpdate {
  return {
    finalDecision: state.critique.finalDecision,
    finalRationale: state.finalRationale ?? state.aiRationale,
    finalRationaleAr: state.finalRationaleAr ?? state.rationaleAr,
  }
}

// ── Conditional routers ──────────────────────────────────────────────────────
function fairnessRoute(state: SaddadStateType): 'fairness' | 'fairness_skipped' {
  return state.plan?.skipFairnessCheck ? 'fairness_skipped' : 'fairness'
}

function criticRoute(state: SaddadStateType): 'reconcile' | 'finalize' {
  return state.critique?.overrodeRules ? 'reconcile' : 'finalize'
}

// Recovery guidance is only generated when the citizen was NOT approved.
function recoveryRoute(state: SaddadStateType): 'recovery' | 'recovery_skipped' {
  return state.finalDecision === 'APPROVED' ? 'recovery_skipped' : 'recovery'
}

// ── Graph assembly ───────────────────────────────────────────────────────────
function buildGraph() {
  return new StateGraph(SaddadState)
    .addNode('planner', plannerNode)
    .addNode('risk_forecaster', riskForecasterNode)
    .addNode('document', documentNode)
    .addNode('db_fetch', dbFetchNode)
    .addNode('merge', mergeApplicantNode)
    .addNode('financial', financialNode)
    .addNode('rules', rulesNode)
    .addNode('fairness', fairnessNode)
    .addNode('fairness_skipped', fairnessSkippedNode)
    .addNode('decide_proposed', decideProposedNode)
    .addNode('critic', criticNode)
    .addNode('reconcile', reconcileNode)
    .addNode('finalize', finalizeNode)
    .addNode('recovery', recoveryNode)
    .addNode('recovery_skipped', recoverySkippedNode)
    .addNode('communication', communicationNode)
    .addNode('escalation', escalationNode)
    // Linear head
    .addEdge(START, 'planner')
    .addEdge('planner', 'risk_forecaster')
    // Fan-out: Document ‖ DB-Fetch, then fan-in at merge
    .addEdge('risk_forecaster', 'document')
    .addEdge('risk_forecaster', 'db_fetch')
    .addEdge('document', 'merge')
    .addEdge('db_fetch', 'merge')
    .addEdge('merge', 'financial')
    .addEdge('financial', 'rules')
    // Planner may skip fairness
    .addConditionalEdges('rules', fairnessRoute, {
      fairness: 'fairness',
      fairness_skipped: 'fairness_skipped',
    })
    .addEdge('fairness', 'decide_proposed')
    .addEdge('fairness_skipped', 'decide_proposed')
    .addEdge('decide_proposed', 'critic')
    // Critic veto → reflection, else straight to finalize
    .addConditionalEdges('critic', criticRoute, {
      reconcile: 'reconcile',
      finalize: 'finalize',
    })
    .addEdge('reconcile', 'finalize')
    // Recovery runs only when the citizen was NOT approved (turns a rejection into a
    // concrete path back to eligibility), before the notify/audit fan-out.
    .addConditionalEdges('finalize', recoveryRoute, {
      recovery: 'recovery',
      recovery_skipped: 'recovery_skipped',
    })
    // Fan-out: Communication ‖ Escalation/Audit
    .addEdge('recovery', 'communication')
    .addEdge('recovery', 'escalation')
    .addEdge('recovery_skipped', 'communication')
    .addEdge('recovery_skipped', 'escalation')
    .addEdge('communication', END)
    .addEdge('escalation', END)
    .compile()
}

// Compile once and reuse across cases.
let compiled: ReturnType<typeof buildGraph> | null = null
export function getSaddadGraph() {
  if (!compiled) compiled = buildGraph()
  return compiled
}
