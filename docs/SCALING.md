# SADDAD — Scaling from Prototype to Production

This document is the explicit path from the prototype in this repository to a federal-scale production deployment. It exists because code reviewers correctly observe that the current shape of the system is **a prototype on production rails**, not a production deployment. This document specifies what changes.

---

## What the prototype gets right

These don't need to change for production:

| Concern | Current implementation | Production-ready? |
|---|---|---|
| Schema design | `cases`, `applicants`, `audit_logs`, `agent_steps`, `job_queue` in Supabase Postgres | ✅ Yes |
| Auth model | Session cookie (officer UI) + x-api-key (server-to-server) | ✅ Yes (UAE PASS OIDC replaces the demo creds — see SECURITY.md) |
| Audit trail | Immutable `audit_logs` row per decision + full `agent_steps` history | ✅ Yes |
| Decision determinism | Hard rules are pure functions, 51/51 unit tests | ✅ Yes |
| LLM constraint model | Hard REJECTED/ESCALATED are sticky; LLM only escalates APPROVED | ✅ Yes |
| Schema-evolution safety | Two-step `upsertCaseDecision` (core then extended) tolerates missing columns | ✅ Yes |
| Realtime UI | Supabase realtime subscriptions on `cases` and `agent_steps` | ✅ Yes |
| Bilingual rationale | Every approval/rejection ships with English + Arabic | ✅ Yes |

---

## What changes for production

### 1. Queue worker — move out of `next/after()`

**Today:** The queue worker runs inside Next.js via `after()`. It works for low throughput because each submission triggers its own background task in the same Next.js process.

**Production:**
- Extract `lib/worker.ts` into its own Node.js process (or container)
- Replace `next/after()` invocation in `/api/process-application` with a queue push (Redis Streams, AWS SQS, or Supabase Realtime trigger)
- Run N worker pods horizontally; scale via metrics (queue depth, P95 latency)

**Why it matters:** Next.js processes are designed to handle HTTP requests, not long-running background work. At scale, a single Next.js pod gets killed mid-pipeline during a deploy. A dedicated worker pool with graceful shutdown is the standard pattern.

**Migration code path:** Replace `import { runMainCaseAgent }` in `lib/worker.ts` with a queue consumer loop. The agent pipeline itself stays unchanged.

### 2. Queue claim atomicity — move to `SELECT FOR UPDATE SKIP LOCKED`

**Today:** `claimJob()` does an `UPDATE ... WHERE status='queued'` which is atomic at the row level in Postgres — only one worker wins the row. The losing worker's `getClaimedJob` returns null and it logs a "lost race" message.

**Production:**
- Use `SELECT id FROM job_queue WHERE status='queued' ORDER BY queued_at FOR UPDATE SKIP LOCKED LIMIT 1` followed by the UPDATE
- This pattern is the textbook Postgres queue approach used by Rails ActiveJob, Sidekiq's Postgres adapter, and Solid Queue
- Add a `worker_heartbeat` timestamp and a reaper job that requeues jobs whose worker died mid-processing

**Why it matters:** At low concurrency the current UPDATE pattern is correct. At high concurrency, the workers waste cycles colliding on the same row. `SKIP LOCKED` lets each worker claim a different row in a single query.

### 3. Rate limiter — move from in-memory Map to Redis

**Today:** `lib/middleware/auth.ts` uses an in-memory `Map` to track requests per API key per minute. Works in a single-process deployment.

**Production:**
- Replace the Map with a Redis-backed sliding window (Upstash Redis is the trivial fit for Vercel deployments)
- Distributed rate limit applies across all serverless invocations / worker pods
- Add per-IP rate limiting on `/api/auth/login` (already coded but needs the Redis store)

### 4. Sovereign LLM — move from Groq to G42 Jais or Falcon-Arabic

**Today:** All LLM calls go to Groq Cloud (US-based) using Llama 3.3 70B.

**Production:**
- Evaluate **G42 Jais 30B / 70B** and **TII Falcon-Arabic** on the 51-test regression suite + a held-out set of real MOEI cases
- Acceptance criteria: ≤ 5% accuracy delta vs Groq Llama on the regression suite
- Route LLM traffic through an internal abstraction (`lib/llm/client.ts`) so swapping providers is a one-file change
- Production deploys default to the sovereign model; Groq becomes the fallback for outages

**Why it matters:** A federal AI system processing citizen PII must be reviewable on data residency, model provenance, and supply-chain security. A US-hosted commercial model is hard to defend for production federal use; UAE-sovereign models are the right answer.

### 5. Database — keep Supabase or move to managed Postgres in UAE region

**Today:** Supabase project, US/Asia regions.

**Production:** Two paths:
- **A)** Stay on Supabase but pin the project to a UAE-compliant region. Supabase Enterprise supports custom regions.
- **B)** Migrate to Azure Database for PostgreSQL in UAE North, or AWS RDS Postgres in me-central-1. Lose Supabase Realtime; replace with a thin Postgres LISTEN/NOTIFY adapter.

The data layer abstraction in `lib/data-layer.ts` means migration is contained — only that one file changes.

### 6. Observability

**Today:** `console.log` everywhere. Useful for development, useless in production.

**Production:**
- **OpenTelemetry traces** spanning the full pipeline; each agent becomes a span
- **Structured logging** (pino or similar) writing JSON to stdout for cloud log aggregation
- **Sentry** for unhandled errors
- **Synthetic monitoring** — run a known-good case end-to-end every 5 minutes, alert on regression
- **Live dashboards** for ops:
  - Queue depth
  - P50/P95/P99 processing time
  - Per-agent latency breakdown
  - Decision distribution (approved / rejected / escalated)
  - Officer override rate

### 7. CI/CD

**Today:** Manual `npm run build`, `npm run lint`, `npm test`.

**Production:**
- GitHub Actions or Azure DevOps pipeline:
  - On PR: lint, type-check, test, build
  - On merge to main: deploy to staging, run smoke tests
  - Manual promotion gate from staging to production
- All Supabase schema changes go through versioned migrations (introduce a migration framework — e.g. `supabase migration new`)
- Pre-commit hooks for lint + format

### 8. Secrets and config

**Today:** `.env.local` file checked locally only.

**Production:**
- **Azure Key Vault** (or AWS Secrets Manager) for all secrets
- Rotate `SESSION_SECRET` and `API_KEY_*` quarterly
- No secret material in environment-variable dumps; secrets pulled at boot from KV with IAM-scoped access
- `GROQ_API_KEY` (or the sovereign LLM equivalent) rotated independently

### 9. Disaster recovery

**Today:** Supabase auto-backups; no formal DR plan.

**Production:**
- **RPO ≤ 15 minutes** — point-in-time restore on Postgres
- **RTO ≤ 4 hours** — documented runbook for full-region failover
- Quarterly DR drills
- Audit log replicated to a write-once cold storage tier (Azure Immutable Blob / AWS S3 Object Lock) for 7-year retention per UAE federal records policy

### 10. Observable LLM cost ceiling

**Today:** Groq calls are unbounded.

**Production:**
- Per-case LLM token budget (alert if any case exceeds 10× the median)
- Per-day spend ceiling with circuit breaker (degrade to hard-rules-only mode if exceeded, escalate to officer)
- Cost per case dashboarded to finance team

---

## Cost envelope (rough order of magnitude, monthly)

Assuming 50,000 cases/month, processed at < 60s P95:

| Item | Estimated cost |
|---|---|
| Sovereign LLM (G42 Jais, on-demand) | ~$3,000-8,000 (highly variable by provider pricing) |
| Postgres (UAE-region managed) | ~$500-1,500 |
| Redis (queue + rate limiter) | ~$100-300 |
| Worker pods (Cloud Run / Container Apps) | ~$200-600 |
| Twilio WhatsApp + SMS (50k messages) | ~$1,000-2,500 |
| Logging + monitoring | ~$300-800 |
| **Total monthly run cost** | **~$5,000-13,000** |

Compare to officer cost at 50k cases/month, 2 hours/case, AED 80/hour (illustrative): **AED 8M/month (~$2.2M/month)**. The AI is two orders of magnitude cheaper than the labor it replaces, even at the high-cost-envelope estimate.

---

## What we are NOT doing (and why)

- **Replacing the Next.js framework.** It's the right tool for the UI + API. The criticism that the worker shouldn't run inside it is fair, and addressed above by extracting the worker — but the front-end and API stay.
- **Microservices everywhere.** SADDAD is a single bounded context (one decision pipeline). Cutting it into 5 microservices would slow development without solving any real problem.
- **Switching to Python for the agents.** TypeScript + Next.js gives the team end-to-end type safety from form to database. Rewriting in Python "because AI" would lose that and add a deployment surface.

Production-readiness is not about technology change for its own sake — it's about closing the specific gaps that prevent a regulator from signing off. Each section above maps to one such gap.
