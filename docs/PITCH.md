# SADDAD — A Template for the UAE Federal 50% AI Directive

## The opportunity

The UAE Federal Government has set a directive that **AI must handle 50% of government services**. Today, most federal services follow the same pattern:

> A citizen submits an application → an officer reviews it manually against a published rulebook → a decision is issued within an SLA measured in working days.

Across federal entities, that pattern repeats for hundreds of services: housing arrears rescheduling, visa renewals, business permits, subsidy claims, vehicle registration transfers, professional licensing, and on and on. Each currently has its own workflow, its own backlog, its own officer team.

Building a bespoke AI system for each of these would take 3-6 months of engineering per service. At hundreds of services, the math doesn't work. The directive needs a **template**, not a backlog of build projects.

## What SADDAD is

SADDAD is the template.

It solves the **MOEI Housing Arrears Rescheduling** service today — turning the official 5-working-day manual process into a sub-10-second AI decision with full audit trail. But the architecture is service-agnostic: the same 11-agent pipeline, the same tool layer, the same compliance machinery, the same dashboard.

Onboarding a new federal service to SADDAD is not a rebuild. It's a rule translation — see [`governance/visa-renewal.ts`](../governance/visa-renewal.ts), a second federal service that implements the same `ServiceModule` contract and runs through the same shared `evaluateRules()` engine. [`tests/service-registry.test.ts`](../tests/service-registry.test.ts) proves a visa case flows through the identical engine — extensibility that is verified, not just claimed.

**Estimated onboarding effort per new service: 2-3 engineer weeks.**

## Why "agents" instead of "one LLM call"

A naive approach to this problem would be: send the case to GPT-4, get a decision back, write it to the database. That fails for two reasons:

1. **Auditability.** A regulator cannot accept "the AI decided" as a defensible answer. Every decision must be traceable to specific rules, specific data, and specific reasoning.
2. **Determinism where it matters.** The 20% MOEI installment rule must produce identical math on every run. An LLM that occasionally hallucinates a different number will fail the first compliance audit.

SADDAD's 11-agent pipeline mixes:
- **Deterministic math** for financial calculations (Financial Agent, Risk Forecaster) — reproducible, auditable
- **LLM judgment** at three specific decision points where human-like reasoning adds value (Planner, Rules+AI, Critic) — but constrained so it cannot violate hard rules
- **Tool-using LLM** in the Critic agent — it autonomously decides whether to look up similar past decisions or audit history before forming its verdict
- **Independent fairness check** that can override an APPROVED decision if it differs from precedent at similar debt-to-income ratios

This architecture is what makes the system **defensible**. Every agent records its inputs, outputs, duration, and reasoning to `agent_steps`. Every final decision lands in an immutable `audit_logs` row. An officer asked "why did the AI approve this case?" can produce the entire decision graph in 30 seconds.

## The federal impact pitch

| Dimension | Today (manual) | SADDAD (per case) | At MOEI scale | At federal scale (50% directive) |
|---|---|---|---|---|
| Time to decision | 5 working days (official SLA) | <10 seconds | 100,000+ cases/year processed instantly | Millions of citizen interactions/year |
| Officer hours per case | ~2 hours | 0 (automatic) or ~15 min (officer-reviewed escalations only) | Officer time redirected to genuine edge cases | Federal HR capacity unlocked for higher-judgment work |
| Decision consistency | Variable across officers | 100% rule-consistent + fairness-checked against precedent | Auditable per-case decision graph | UAE Federal AI sovereignty story |
| Citizen experience | Submit, wait up to 10 days, hope | Instant decision + bilingual rationale via WhatsApp | "Government that works at internet speed" | Brand-defining shift in citizen-government interaction |

## What we're not pretending

This is a **production-ready prototype**, not a deployed federal system. There is real work between this repo and a live MOEI deployment:

- UAE PASS federated identity (currently demo username/password — see [`docs/SECURITY.md`](SECURITY.md))
- Sovereign LLM (currently Groq/Llama 3.3 — we should evaluate Falcon-Arabic and G42 Jais for production)
- Horizontally-scaled worker (currently runs inside Next.js — see [`docs/SCALING.md`](SCALING.md))
- Full PDPL compliance audit
- Real applicant database integration with MOEI's existing systems
- Officer training + change management

[`docs/PILOT_PLAN.md`](PILOT_PLAN.md) lays out the 90-day path from this repo to a live pilot at one MOEI branch.

## What we are demonstrating

1. **A working 11-agent AI decision pipeline** running in under 10 seconds end-to-end with real LLM calls (Groq), real document parsing (pdfjs-dist), real database (Supabase), and real audit trails
2. **Three genuinely agentic decision points** — Planner picks strategy (conditional graph routing), Rules Agent provides constrained judgment, and the Critic is a LangGraph tool subgraph that gathers context before vetoing
3. **A service-agnostic architecture** that scales to other federal services with a 2-3 week onboarding rather than a 3-6 month rebuild
4. **A defensible decision graph** for every case, satisfying regulator-grade auditability
5. **A bilingual (English + Arabic) citizen experience** with WhatsApp/SMS notifications
6. **51 passing unit tests** covering every governance rule, the financial math, a cross-service registry test proving a second federal service runs through the same decision engine, and the LLM-client layer

## The ask

Treat SADDAD as the **reference architecture** for the federal 50% AI directive. Pilot it first on MOEI Housing Arrears (the use case it was purpose-built for), then use the same agent platform — with new `governance/` modules — to onboard the next three federal services within a year.

The cost of bespoke per-service AI is a backlog the directive cannot afford. The value of a shared platform is the federal government moves at agent-pipeline speed, not procurement speed.
