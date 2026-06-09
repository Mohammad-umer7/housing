# `/agents` — The SADDAD Agent System (LangGraph)

This folder contains the eleven agents that process a housing-arrears rescheduling case. The pipeline is a compiled **LangGraph `StateGraph`** ([`graph.ts`](graph.ts)); each agent is a **graph node**. LLM agents call **LangChain `ChatGroq`** via [`lib/llm/client.ts`](../lib/llm/client.ts). The graph runs the agents in phases, two of which fan out in parallel.

- [`graph.ts`](graph.ts) — builds + compiles the `StateGraph` (`getSaddadGraph()`).
- [`graph-state.ts`](graph-state.ts) — the typed shared state (`Annotation.Root`).
- [`types.ts`](types.ts) — shared agent types (no import cycles).
- [`main-case-agent.ts`](main-case-agent.ts) — `runMainCaseAgent(caseNumber, formData)` invokes the compiled graph. Same signature the worker/queue already call.

---

## Why "agents" and not "functions"?

A function takes input and returns output. An **agent** has three properties that matter for this system:

1. **Autonomy** — it makes decisions, not just calculations. The Planner picks a strategy that changes which nodes run. The Rules Agent escalates if it spots risk. The Critic vetoes if it finds compliance issues.
2. **Tool use** — it can reach databases, LLMs, and external APIs. The Critic in particular is a **LangGraph tool subgraph** (model ↔ `ToolNode`): the LLM autonomously decides whether to call lookup tools before forming its verdict.
3. **State observability** — every agent node records `agent_steps` rows showing what it did, how long it took, and its result summary. This is the audit trail an officer can defend in court.

A regulated government decision system needs all three. Functions give you speed; agents give you defensibility.

---

## The 11-agent pipeline

| # | Agent (node) | Type | What it does |
|---|---|---|---|
| 1 | [Planner](planner-agent.ts) | LLM (structured output) | Picks the pipeline strategy: `FAST_TRACK`, `STANDARD`, `DEEP_REVIEW`, or `IMMEDIATE_ESCALATE` |
| 2 | [Risk Forecaster](risk-forecaster-agent.ts) | Deterministic | Weighted risk score from DTI, arrears, delinquency, reason stability |
| 3 | [Document Agent](document-agent.ts) | LLM + PDF parser + QR scan | Interprets the salary-cert extraction, then **scans the QR and verifies the certificate against the issuing authority (DB-2)** — flags salary mismatch / tampering |
| 4 | [DB Fetch](db-fetch-agent.ts) | Tool call | Pulls applicant record + loan details from the source system |
| 5 | [Financial Analysis](financial-agent.ts) | Deterministic | MOEI 20% total-deduction rule: arrears-payment headroom, duration, and within-loan-period check |
| 6 | [Rules Engine + AI](rules-agent.ts) | Hard rules + LLM | Applies G-01 through G-06; LLM provides bilingual rationale, may escalate |
| 7 | [Fairness Check](fairness-agent.ts) | DB query + math | Compares against historical decisions at similar DTI; flags inconsistency |
| 8 | [Compliance Critic](critic-agent.ts) | LLM + LangGraph tool subgraph | Independent review with veto power; autonomously calls lookup tools; deterministically escalates an unverifiable/tampered certificate |
| 9 | [Recovery Agent](recovery-agent.ts) | LLM + LangGraph tool subgraph | **Runs only when not approved.** Tells the citizen exactly how to become eligible, calling tools to compute the real targets (installment/headroom or arrears reduction) per blocker |
| 10 | [Communication](communication-agent.ts) | Twilio API | WhatsApp + SMS notifications incl. the recovery guidance (fails gracefully if Twilio missing) |
| 11 | [Escalation & Audit](escalation-agent.ts) | DB write | Commits the final decision + recovery guidance and writes the immutable audit log |

Three nodes are **plumbing**, not agents (so they write no `agent_steps`): `merge` (fan-in after Document ‖ DB-Fetch), `decide_proposed` (fairness override + IMMEDIATE_ESCALATE), and `finalize` (settles final decision + rationale). The Recovery Agent is gated by a conditional edge — APPROVED cases route to `recovery_skipped`.

### Graph topology

```
START → planner → risk_forecaster ─┬→ document ─┐
                                    └→ db_fetch ─┴→ merge → financial → rules
   → (plan.skipFairnessCheck ? fairness_skipped : fairness)
   → decide_proposed → critic
   → (critique.overrodeRules ? reconcile → finalize : finalize)
   → (finalDecision === APPROVED ? recovery_skipped : recovery)
   → (communication ‖ escalation) → END
```

The two parallel pairs write **distinct** state channels, so the default reducer never conflicts. `compile()` validates that every edge references a declared node — and because LangGraph 1.x types edge targets to node names, a mis-wired edge fails `tsc`.

---

## Where the real agentic reasoning lives

The pipeline has **three genuine decision points** where the LLM has autonomy:

### 1. Planner (start) — conditional routing
The Planner reads the case shape and returns a structured strategy. The graph's **conditional edges** respect it: `FAST_TRACK` routes to `fairness_skipped` (skipping the Fairness node); `IMMEDIATE_ESCALATE` forces the final decision to ESCALATED in `decide_proposed`. The Planner's choice **changes which nodes run** — the textbook definition of an autonomous agent.

### 2. Rules Agent (middle) — constrained judgment
Hard rules G-01–G-06 run first as deterministic guardrails. The LLM then provides judgment on top, within guardrails:
- It **cannot** soften a hard `REJECTED` (e.g. missing salary cert) into `ESCALATED`
- It **cannot** downgrade an `ESCALATED` to `APPROVED`
- It **can** upgrade an `APPROVED` to `ESCALATED` if it spots risks rules missed

### 3. Critic Agent (end) — a LangGraph tool subgraph
The Critic is its own compiled subgraph: an `agent` node bound to two tools, looped through a `ToolNode` via `toolsCondition` until the model stops requesting tools.
- `lookup_similar_decisions(dti)` — recent decisions at similar DTI
- `lookup_case_audit_history(case_number)` — prior processing on this case

The LLM **chooses autonomously** which tools to call (or none), then a structured-output pass yields the verdict. It can **VETO** an APPROVED/REJECTED → ESCALATED, but **never downgrades** an already-ESCALATED decision. When it vetoes, the graph routes to the `reconcile` node, where the **Rules Agent revises its own rationale** to reflect the Critic's concern — a genuine agent-to-agent exchange recorded against `rules_agent`.

### 4. Recovery Agent (on non-approval) — a LangGraph tool subgraph
Reached only when the final decision isn't APPROVED. It's a second tool-using subgraph: the LLM autonomously calls `compute_affordable_targets` (the math of what would pass: 20% headroom, installment reduction, or arrears reduction needed) and `lookup_remediation` (official guidance per blocker), then produces a bilingual, citizen-facing "how to get approved" plan. A deterministic plan built from the same tools is the fallback, so the numbers are always exact.

---

## Why the other agents are deterministic

**Risk Forecaster** and **Financial Analysis** don't use LLMs. This is deliberate:

> A regulated government system cannot have LLM hallucinations in its money calculations. The 20% MOEI rule must produce identical output on every run for audit reproducibility. An LLM that occasionally rounds differently will fail a compliance audit.

Mixing LLM judgment (where it adds value) with deterministic math (where it must be reproducible) is the right architecture for regulated AI. See [`docs/SECURITY.md`](../docs/SECURITY.md) for the PDPL audit posture this enables.

---

## How to add a new agent (node)

1. Create `agents/your-agent.ts` exporting a node `yourNode(state: SaddadStateType): Promise<SaddadNodeUpdate>`.
2. Add any new output slots to the `Annotation.Root` schema in [`graph-state.ts`](graph-state.ts) (and shared types to [`types.ts`](types.ts)).
3. Add `'your_agent'` to the `AGENT_NAMES` tuple in [`lib/data-layer.ts`](../lib/data-layer.ts) if it writes `agent_steps`.
4. Add the visual entry in the `PIPELINE` array in [`components/AgentProcessing.tsx`](../components/AgentProcessing.tsx).
5. Wire it into the `StateGraph` in [`graph.ts`](graph.ts) with `addNode` + the right `addEdge` / `addConditionalEdges`.

Every agent node should:
- Call `updateAgentStep(caseNumber, name, { status: 'running', ... })` at start.
- Call `updateAgentStep(caseNumber, name, { status: 'done', ..., result_summary })` at end.
- Catch errors and mark `status: 'failed'` — comms-style agents return gracefully and never throw; data-integrity nodes (DB Fetch, Financial, Rules, Escalation) re-throw so `graph.invoke` rejects and the worker safety-net escalates the case.
