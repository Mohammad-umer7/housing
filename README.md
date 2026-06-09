# SADDAD

**An 11-agent AI decision system for the UAE Ministry of Energy and Infrastructure** — built on **LangGraph + LangChain** — that turns the official **5-working-day** manual process into a **sub-10-second** auditable decision, and is architected as a template for the UAE Federal Government's 50% AI directive.

> **Track:** AI Agent for Rescheduling Housing Arrears (GovAI / MOEI Finance & Collections)

---

## What this is

Today, when a UAE citizen falls behind on their MOEI housing loan and requests rescheduling, an officer manually reviews the application against a 6-rule governance rulebook over the official **5 working day** service window. SADDAD compresses that into a multi-agent AI pipeline that:

- Verifies the salary certificate via **real PDF parsing + LLM field extraction**
- Looks up the applicant's loan record from MOEI's database
- Applies the **MOEI 20% total-deduction rule** with deterministic math
- Runs the 6 governance rules (G-01 through G-06) as hard guardrails
- Uses an LLM to provide bilingual (English + Arabic) rationale
- Performs a **fairness check** against historical decisions at similar debt-to-income ratios
- Runs an **independent Compliance Critic** (a LangGraph tool subgraph) that can autonomously veto and force escalation
- Sends a WhatsApp notification with the decision
- Writes an immutable audit log row

Total wall-clock time: **< 10 seconds** per case.

Every step is recorded in an `agent_steps` table that an officer can pull up later. Every decision is defensible to a regulator.

---

## Why this matters beyond MOEI

The UAE Federal Government directive that **AI must handle 50% of government services** creates a build-vs-buy problem at scale. Building a bespoke AI system for each federal service is not feasible — it would take 3-6 months per service.

SADDAD is architected so that **onboarding a new federal service is a 2-3 week rule translation**, not a 3-6 month rebuild. The agent pipeline (`/agents`), tool layer (`/tools`), auth, audit, dashboard, and worker are service-agnostic. Only the per-service rules in `/governance` change.

See [`governance/visa-renewal.ts`](governance/visa-renewal.ts) for a second federal service (MOI Visa Renewal) that runs through the **same** shared decision engine — proven by a passing test in [`tests/service-registry.test.ts`](tests/service-registry.test.ts), not just asserted.

**The full strategic argument lives in [`docs/PITCH.md`](docs/PITCH.md).**

---

## The 11-agent pipeline

```
1. Planner          → LLM picks strategy (FAST_TRACK | STANDARD | DEEP_REVIEW | IMMEDIATE_ESCALATE)
2. Risk Forecaster  → Deterministic weighted score (DTI, arrears, delinquency, reason stability)
3. Document Agent   → extract salary cert + scan QR, verify vs the issuing authority (DB-2)
4. DB Fetch         → Supabase lookup of applicant + loan details
5. Financial        → MOEI 20% total-deduction rule: arrears-payment headroom + duration
6. Rules + AI       → G-01 through G-06 + LLM bilingual rationale
7. Fairness Check   → Compare against historical decisions at similar DTI
8. Critic           → LangGraph tool subgraph; can VETO and force ESCALATED
9. Recovery Agent   → (only if not approved) tells the citizen how to become eligible
10. Communication   → Twilio WhatsApp / SMS incl. recovery guidance (non-fatal)
11. Escalation/Audit → Commit decision + write immutable audit log
```

Built as a **LangGraph `StateGraph`** ([`agents/graph.ts`](agents/graph.ts)): each agent is a node, with parallel fan-out (Document ‖ DB-Fetch, Communication ‖ Escalation) and conditional edges for the planner / fairness-skip / veto / recovery routing.

**Four genuinely agentic points** — Planner picks the path (conditional routing), Rules Agent constrains LLM judgment within hard rules, the Critic is a **LangGraph tool subgraph** that autonomously gathers context before it can veto, and the Recovery Agent is a **second tool subgraph** that computes how a rejected citizen can become eligible. Full breakdown in [`agents/README.md`](agents/README.md).

---

## Screenshots

| Submission + auto-lookup | Live 11-agent pipeline |
|---|---|
| ![Submission form](screenshots/01-submission.png) | ![Live pipeline](screenshots/02-pipeline.png) |
| **Decision + bilingual rationale** | **Operations dashboard** |
| ![Decision card](screenshots/03-decision.png) | ![Dashboard](screenshots/04-dashboard.png) |

> Drop the PNGs into [`screenshots/`](screenshots/) — see [`screenshots/README.md`](screenshots/README.md) for the capture list.
>
> **Prefer to read the actual output?** [`docs/DECISION_EXAMPLES.md`](docs/DECISION_EXAMPLES.md) shows three full decision traces — the per-agent `agent_steps` trail and the `audit_logs` row for each — as text proof of the pipeline end-to-end.

---

## Quick start — try it locally

```bash
git clone https://github.com/your-org/housing-arrears-agent
cd housing-arrears-agent
npm install
cp .env.example .env.local
# fill in your Supabase + Groq keys, set SESSION_SECRET to a random string
npm run dev
```

Open http://localhost:3000

### What you need
- A free [Supabase](https://supabase.com) project (paste [`supabase/schema.sql`](supabase/schema.sql) into the SQL editor, then the realistic test applicants from the snippet below)
- A free [Groq](https://console.groq.com) API key
- (Optional) Twilio for WhatsApp notifications — system works without it

Full deployment guide including Vercel one-click: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

### Test applicants

Run [`supabase/seed.sql`](supabase/seed.sql) in the Supabase SQL editor after [`supabase/schema.sql`](supabase/schema.sql). It loads the six demo citizens plus historical precedent rows for the Fairness Agent.

### Expected outcomes for each test case

| Case | Expected decision | Why |
|---|---|---|
| `MOEI-2026-1001` | ✅ APPROVED · AED 800/mo arrears premium × 23mo | All rules pass · total deduction capped at AED 3,000 |
| `MOEI-2026-1002` | ✅ APPROVED · AED 500/mo arrears premium × 68mo | Income-change/hardship case, still within the loan period |
| `MOEI-2026-1003` | ⚠️ ESCALATED | G-04: AED 620,000 cannot clear within the remaining loan period under the 20% total-deduction ceiling |
| `MOEI-2026-1004` | ✅ APPROVED · AED 160/mo arrears premium × 94mo | Low-income hardship case, still within the term |
| `MOEI-2026-1005` | ⚠️ ESCALATED | G-05: Previous default on record |
| `MOEI-2026-1001` *(no PDF)* | ❌ REJECTED | G-01: Missing salary certificate |

---

## Repository structure

The folder tree itself tells the architecture story:

```
housing-arrears-agent/
├── agents/             ← The 11-agent decision pipeline (see agents/README.md)
├── governance/         ← Per-service rule engines — extensibility lives here
├── tools/              ← MCP-compatible tool layer (database, document, notification)
├── lib/                ← Plumbing: auth, sessions, supabase client, queue worker
├── app/                ← Next.js routes (UI + API)
├── components/         ← React components
├── tests/              ← 51 passing unit tests (governance, financial, cross-service registry + LLM-client wiring)
├── supabase/           ← Database schema
└── docs/               ← Strategic + operational documentation
```

---

## Documentation

| Document | What's in it |
|---|---|
| [`docs/PITCH.md`](docs/PITCH.md) | The federal-impact case — why this is a 50% directive template |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design + Mermaid diagrams + request lifecycle |
| [`docs/DECISION_EXAMPLES.md`](docs/DECISION_EXAMPLES.md) | Three full worked decision traces (`agent_steps` + audit log) — proof of the pipeline end-to-end |
| [`docs/PILOT_PLAN.md`](docs/PILOT_PLAN.md) | 90-day path from this repo to a live MOEI branch pilot |
| [`docs/SCALING.md`](docs/SCALING.md) | Explicit production-readiness gaps and the close-out plan |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | How SADDAD plugs into real government systems — consumed vs owned data, UAE sources, write-back |
| [`docs/UAEPASS.md`](docs/UAEPASS.md) | UAE PASS (OIDC) login integration spec — endpoints, flow, userinfo fields, routes, env |
| [`docs/SECURITY.md`](docs/SECURITY.md) | UAE PDPL Article-by-Article posture and threat model |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel quick-deploy + production deployment matrix |
| [`agents/README.md`](agents/README.md) | What each of the 11 agents does and why |
| [`governance/README.md`](governance/README.md) | How to add a new federal service in 2-3 weeks |
| [`tools/README.md`](tools/README.md) | MCP-compatible tool architecture |

---

## Tech stack

- **Next.js 16** (App Router, Server Components, Turbopack, middleware)
- **TypeScript** end-to-end, strict mode
- **Supabase** (Postgres + Realtime + RLS)
- **LangGraph** (`@langchain/langgraph`) — the 11-agent pipeline is a compiled `StateGraph`; the Critic is a tool-calling subgraph (`ToolNode`)
- **LangChain `ChatGroq`** (`@langchain/groq`) — all LLM calls + Zod-typed structured output (planner, rules rationale, document extraction, critic)
- **Groq Llama 3.3 70B Versatile** as the underlying model — swap to a sovereign model in one file (`lib/llm/client.ts`)
- **pdfjs-dist** for real server-side PDF text extraction
- **Twilio** for WhatsApp + SMS (optional)
- **Jest + ts-jest** for unit testing (51 tests, all passing)

---

## Verification

```bash
npm run lint    # zero errors
npm run build   # zero TypeScript errors, all routes compile
npm test        # 51/51 tests pass
```

---

## What's deliberately out of scope (and addressed in `docs/`)

- **UAE PASS federated identity** — the current demo username/password is a placeholder. Production replaces this with UAE PASS OIDC. See [`docs/SECURITY.md`](docs/SECURITY.md).
- **Sovereign LLM** — the current Groq dependency is replaced by G42 Jais or Falcon-Arabic for production. See [`docs/SCALING.md`](docs/SCALING.md).
- **Horizontally-scaled worker** — the current `next/after()` worker is replaced by dedicated worker pods at production scale. See [`docs/SCALING.md`](docs/SCALING.md).
- **CSV import for real applicants** — currently a one-shot SQL insert; production needs a sync feed from MOEI's existing systems. See [`docs/PILOT_PLAN.md`](docs/PILOT_PLAN.md).

These aren't oversights. They're the difference between a defensible 90-day pilot plan and pretending to be ready for federal production today.

---

## Credits

Built for the GovAI / MOEI track. Inspired by the directive that the UAE Federal Government must move 50% of services to AI — and the realization that getting there requires a platform, not a parade of bespoke projects.

For questions or to discuss the federal-template architecture, see [`docs/PITCH.md`](docs/PITCH.md).
