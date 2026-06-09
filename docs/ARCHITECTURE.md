# SADDAD — System Architecture

## At a glance

```mermaid
flowchart TB
    Officer["👤 Officer<br/>(submission UI)"] -->|HTTPS + session cookie| Next
    External["🔌 External federal system<br/>(server-to-server)"] -->|x-api-key| Next

    Next["Next.js App<br/>(UI + API + middleware)"]

    Next --> Auth["lib/auth + middleware<br/>(session cookie / API key)"]
    Next --> Queue[(job_queue<br/>Supabase)]
    Next --> Worker["lib/worker.ts<br/>(claims job, runs pipeline)"]

    Worker --> Pipeline["agents/graph.ts<br/>LangGraph StateGraph · 11 agents"]

    Pipeline --> Tools["tools/<br/>(database, document, notification)"]
    Pipeline --> LLM["LangChain ChatGroq<br/>(Groq llama-3.3-70b-versatile)"]
    Pipeline --> PDF["pdfjs-dist<br/>(server-side PDF parse)"]
    Tools --> Supabase[(applicants<br/>cases<br/>agent_steps<br/>audit_logs)]
    Tools --> Twilio["Twilio<br/>WhatsApp / SMS"]

    Supabase -->|realtime subscription| OfficerUI["👤 Officer Dashboard<br/>(live updates)"]
```

## Folder structure as a story

```
housing-arrears-agent/
├── agents/             ← The 11-agent decision pipeline (LangGraph)
│   ├── graph.ts                compiled StateGraph (topology)
│   ├── graph-state.ts          typed shared state (Annotation)
│   ├── types.ts                shared agent types
│   ├── planner-agent.ts        decides strategy (node)
│   ├── critic-agent.ts         LangGraph tool subgraph with veto
│   ├── main-case-agent.ts      invokes the compiled graph
│   └── ...
├── governance/         ← Per-service rule engines (platform extensibility)
│   ├── types.ts                    ← ServiceModule contract + shared evaluateRules() engine
│   ├── registry.ts                 ← service id → module registry
│   ├── housing-arrears.ts          ← active rules (G-01 through G-06)
│   └── visa-renewal.ts             ← second federal service (wired + tested)
├── tools/              ← MCP-compatible external integrations
│   ├── database-tools.ts
│   ├── document-tools.ts
│   └── notification-tools.ts
├── lib/                ← Plumbing: auth, sessions, supabase client, queue worker
├── app/                ← Next.js routes (UI + API)
├── components/         ← React components
├── tests/              ← 36 unit tests covering governance, financial math, cross-service registry + LLM-client wiring
├── supabase/           ← Database schema + migrations
└── docs/               ← Strategic + operational documentation
```

The folder layout is intentional. The three folders that tell the story of what SADDAD is — `agents/`, `governance/`, `tools/` — live at the root, not buried inside `lib/`. A judge or new engineer opens the repo and sees the architecture in the file tree before reading a single line of code.

## Request lifecycle — submission to decision

```mermaid
sequenceDiagram
    participant U as Officer Browser
    participant N as Next.js API
    participant Q as job_queue (Supabase)
    participant W as Queue Worker
    participant P as Agent Pipeline
    participant DB as Supabase (cases, audit_logs, agent_steps)
    participant L as Groq LLM
    participant T as Twilio

    U->>N: POST /api/process-application (multipart, PDF)
    N->>N: requireAuth() — session cookie or x-api-key
    N->>DB: upsert cases (status=pending)
    N->>DB: extractTextFromPDF(file) + Groq extract salary fields
    N->>Q: insert job_queue row (queued)
    N->>U: 200 OK { caseId, queuePosition }
    Note over N,W: Next.js after() triggers worker in same process
    W->>Q: claimJob (atomic UPDATE WHERE status=queued)
    W->>P: runMainCaseAgent → invoke LangGraph StateGraph
    P->>L: Planner Agent — picks strategy (structured output)
    P->>P: Risk Forecaster (deterministic)
    P->>L: Document Agent (PDF field validation)
    P->>DB: DB Fetch (applicant + loan details)
    P->>P: Financial Analysis (20% rule, deterministic)
    P->>L: Rules + AI (bilingual rationale)
    P->>DB: Fairness Check (similar cases query)
    P->>L: Critic subgraph (LangGraph ToolNode — may lookup history)
    P->>T: Communication (WhatsApp / SMS, non-fatal)
    P->>DB: Escalation & Audit (final commit + audit log)
    DB-->>U: Realtime subscription pushes decision to UI
```

## Auth model

Two paths in, one path of trust:

```mermaid
flowchart LR
    Browser["🌐 Officer browser"] -->|POST /api/auth/login| Login["/api/auth/login<br/>credentials → JWT"]
    Login -->|Set-Cookie: saddad_session<br/>HttpOnly Secure SameSite=Lax| Browser
    Browser -->|cookie sent automatically| Route["any /api/* route handler"]

    Server["🔌 External federal system"] -->|x-api-key header| Route

    Route --> RequireAuth["lib/middleware/auth.ts<br/>requireAuth()"]
    RequireAuth --> Consumer["Consumer { role, name }"]
    Consumer --> Handler["Route handler logic"]
```

- **Browser users** authenticate via cookie session (HTTP-only, signed JWT)
- **External federal systems** use the x-api-key header (server-to-server only)
- Both resolve to the same `Consumer { role, name }` shape so route handlers stay simple
- `NEXT_PUBLIC_API_KEY_*` env vars are deliberately gone — no auth secrets cross to the browser

## Data flow with RLS enforcement

```mermaid
flowchart TB
    UI["🌐 Officer UI"] -->|fetch with cookie| API["Next.js API routes"]
    API -->|service_role key<br/>bypasses RLS| Supabase[(Supabase)]
    UI -.->|anon key — realtime only| Realtime[Supabase Realtime]
    Realtime -.->|SELECT-only on cases + agent_steps| Supabase
```

- Backend uses `SUPABASE_SERVICE_ROLE_KEY` exclusively — bypasses RLS, full table access
- Browser only touches Supabase for realtime subscriptions, using the public anon key
- RLS policies allow anon SELECT on `cases` and `agent_steps` (needed for realtime) but block everything on PII tables (`applicants`, `audit_logs`, `job_queue`)
- A leaked anon key cannot read applicant PII or audit logs

## Pipeline strategy mapping

The Planner Agent chooses one of four strategies. Each maps to a different execution path:

```mermaid
flowchart TD
    Start([Case enters pipeline]) --> Planner[Planner Agent]
    Planner -->|FAST_TRACK| FT[Skip Fairness Check]
    Planner -->|STANDARD| ST[Run all agents]
    Planner -->|DEEP_REVIEW| DR[Run all agents + officer attention flag]
    Planner -->|IMMEDIATE_ESCALATE| IE[Force final decision to ESCALATED]

    FT --> Rules[Rules + Critic]
    ST --> Rules
    DR --> Rules
    IE --> Rules

    Rules --> Critic{Critic verdict}
    Critic -->|APPROVE_AS_IS| Final[Final decision]
    Critic -->|FORCE_ESCALATE| Esc[Override → ESCALATED]
    Esc --> Final

    Final --> Commit[Escalation & Audit:<br/>commit + audit log]
```

## Why this architecture is appropriate for regulated AI

| Concern | Architecture answer |
|---|---|
| Decisions must be defensible | Every agent writes to `agent_steps`; every final decision writes to immutable `audit_logs` |
| Hard rules must be deterministic | `governance/housing-arrears.ts` is pure functions, unit-tested 51/51 |
| LLM cannot override hard rules | Hard `REJECTED` and `ESCALATED` are sticky; LLM may only escalate `APPROVED` |
| PII must be protected at rest | RLS policies block all anon access to applicants/audit tables; service-role key never leaves the server |
| AI failures must not corrupt state | Communication agent is non-fatal; worker catch-block calls `upsertCaseDecision` with a base-columns fallback so cases never stick at `pending` |
| Schema evolution must not break writes | `upsertCaseDecision` writes core fields first (always succeed), extended fields second (silently skip if column missing) |
| Service must scale to other federal entities | Pipeline is service-agnostic; only `governance/<service>.ts` changes per service (~2-3 engineer weeks per new service) |
