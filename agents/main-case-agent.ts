// Pipeline entry point. Same signature the worker/queue already call —
// runMainCaseAgent(caseNumber, formData): Promise<void> — but the orchestration is
// now a compiled LangGraph StateGraph (see graph.ts) instead of hand-sequenced
// awaits. Behaviour is identical: same 11 agents, same parallelism, same
// guardrails, same agent_steps audit trail.
//
// If a data-integrity node (db_fetch / financial / rules / escalation) throws,
// graph.invoke rejects and the error propagates to the worker's safety-net, which
// escalates the case to an officer — so no decision is ever committed without an
// audit trail.

import { getSaddadGraph } from './graph'

export async function runMainCaseAgent(
  caseNumber: string,
  formData: Record<string, unknown>,
): Promise<void> {
  const graph = getSaddadGraph()
  await graph.invoke({ caseNumber, formData })
}
