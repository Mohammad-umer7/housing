# `/governance` — Per-Service Rule Engines

This folder is where SADDAD becomes a **platform**, not a single-purpose app.

Each file in here is a self-contained rule set for one federal service. The agent pipeline in [`/agents`](../agents/) is service-agnostic — it doesn't care whether it's processing a housing arrears case, a visa renewal, or a permit application. The governance file plugs into the pipeline and tells it the rules of that particular service.

This is how SADDAD addresses the UAE Federal Government's **50% AI directive** — by being a template that scales across services, not a one-off MOEI tool.

---

## What's in here

| File | Status | Service | Owner |
|---|---|---|---|
| [`types.ts`](types.ts) | **Shared engine** | The `ServiceModule` contract + `evaluateRules()` decision engine used by every service | Platform |
| [`registry.ts`](registry.ts) | **Shared** | Maps a service id → its `ServiceModule` | Platform |
| [`housing-arrears.ts`](housing-arrears.ts) | **Live** | MOEI Housing Arrears Rescheduling | MOEI Finance & Collections |
| [`visa-renewal.ts`](visa-renewal.ts) | **Wired + tested** | MOI Visa Renewal (illustrative rulebook) | — |

`housing-arrears.ts` and `visa-renewal.ts` both implement the same `ServiceModule` contract and run through the same `evaluateRules()` engine in `types.ts`. [`tests/service-registry.test.ts`](../tests/service-registry.test.ts) proves a visa case flows through the identical engine — the visa rulebook is illustrative, but the extensibility is real and verified, not just asserted.

---

## The shape of a governance module

Every governance file exports:

1. **A typed `Analysis` shape** — the per-service data fields (salary, arrears, sponsor_status, visa_type, etc.)
2. **A `Result` shape** with `decision`, `reason`, `rule_triggered`, and the analysis
3. **A `RULES` array** — ordered list of rules, each with `id`, `name`, `description`, `check`, `failOutcome`, and `failReason`
4. **An `apply…GovernanceRules(analysis)` function** that runs the rules in order, returning on first failure
5. **A `ServiceModule`** (`id`, `displayName`, `ruleCount`, `decide(input)`) registered in [`registry.ts`](registry.ts). `decide()` calls the shared `evaluateRules()` engine in [`types.ts`](types.ts) — no service re-implements the control flow.

Hard rules either `REJECT` (terminal — applicant must fix something) or `ESCALATE` (route to officer). The order matters: rules are evaluated top-to-bottom, first failure wins.

---

## How to add a new federal service

Estimated effort: **~2-3 engineer weeks** from rulebook in hand to running pipeline.

1. **Get the official rulebook PDF** from the owning federal entity
2. **Create `governance/your-service.ts`** mirroring the shape of `housing-arrears.ts`
3. **Translate each rule** from the PDF into a typed `check` function with a clear `failOutcome`
4. **Add unit tests** in `tests/your-service.test.ts` — one per rule, both pass and fail paths
5. **Export a `ServiceModule`** and register it in [`registry.ts`](registry.ts) — one line
6. **Point an intake route at `getServiceModule('your-service').decide(input)`** (or parameterize the existing orchestrator)

The pipeline (Planner, Risk, Documents, Financial, Rules, Fairness, Critic, Communication, Escalation) stays unchanged. Only the rule definitions and the per-service financial calculation change.

### What's reused across every service

- All 11 agents in [`/agents`](../agents/)
- All 3 tool layers in [`/tools`](../tools/)
- Auth, session, middleware (`/lib`)
- Job queue + worker
- Audit log infrastructure
- Officer dashboard + escalation UI
- Realtime processing visualization

### What changes per service

- The governance file (rules + analysis shape)
- Per-service financial analysis (if the math differs from the 20% rule)
- The data fields surfaced in the submission form
- The applicant database schema (or a new one entirely)

---

## Why this matters for the 50% directive

The UAE Federal Government's directive that AI must handle 50%+ of government services creates a build-vs-buy problem at scale. Building a bespoke AI system for every federal service is not feasible — it would take years per service.

The SADDAD architecture solves this by treating "AI agent system" as the platform and "governance rules" as the per-service plug-in. Onboarding a new service goes from a 3-6 month rebuild to a 2-3 week rule translation.

[`visa-renewal.ts`](visa-renewal.ts) + [`tests/service-registry.test.ts`](../tests/service-registry.test.ts) are the proof: a second federal service runs through the identical `evaluateRules()` engine, verified by a passing test — same pipeline, different rules, no architectural changes required.

See [`docs/PITCH.md`](../docs/PITCH.md) for the full strategic argument.
