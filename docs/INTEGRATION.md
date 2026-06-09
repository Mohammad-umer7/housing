# SADDAD — Integration Architecture (Consumed vs Owned Data)

The Supabase database in this repo is a **prototype stand-in**. The single most important thing to understand about productionising SADDAD is that its data splits into two categories with *opposite* ownership rules — and they are handled by two separate ports in the code.

| | **Consumed data** | **Owned data** |
|---|---|---|
| Examples | Applicant identity, loan + arrears balances, salary | Decisions, agent trail, audit log |
| Source of truth | Other systems (banks, UAE PASS, MOEI core) | **SADDAD itself** — it doesn't exist until SADDAD creates it |
| In production | Replaced by integration adapters | Stays, hardens, goes UAE-region + immutable |
| Code port | [`lib/integrations/source-systems.ts`](../lib/integrations/source-systems.ts) | [`lib/data-layer.ts`](../lib/data-layer.ts) |

> The dangerous mistake is to say "the database is a placeholder, prod swaps it out." That accidentally waves away the **audit/decision store**, which is the regulated output the entire federal pitch rests on. Be precise: applicant/loan/salary is *borrowed*; the decision + audit data is *ours*.

---

## 1. Consumed data — the inbound integration boundary

These live behind [`lib/integrations/source-systems.ts`](../lib/integrations/source-systems.ts). Today every one is backed by the Supabase `applicants` table so the prototype runs end-to-end. In production each becomes an adapter over a different owner's system. **Nothing in `/agents`, `/tools`, or the rest of `/lib` changes when these are swapped** — that's the point of the port.

| Function | Consumed entity | Real UAE source of truth | Production integration pattern |
|---|---|---|---|
| `getApplicant` / `getLoanDetails` | Loan, arrears, installment, remaining term | The loan servicer's core system (e.g. **Emirates Development Bank**, ADIB, FAB) | API behind a data-sharing agreement, or a read-only nightly sync into a replica. **Not** direct DB access. |
| identity (`full_name`, `emirates_id`) | Citizen identity | **UAE PASS** (federal identity provider) | OIDC at login + identity attributes; replaces the demo username/password. |
| `verifySalary` *(prod)* | Salary verification | **WPS** (Wage Protection System) / a salary-certificate authority | Authoritative API lookup. In production this **replaces PDF OCR** as the trusted salary signal, removing the fraud surface the Document Agent currently flags. |

A key UAE reality: federal entities almost never grant **direct database access** to each other or to banks. Integration goes through **APIs behind an MOU**, often via a government service/integration bus. "Replace the database with the govt's" really means "replace these reads with authenticated API adapters."

---

## 2. Owned data — SADDAD's system of record

These live in [`lib/data-layer.ts`](../lib/data-layer.ts) and are the data SADDAD is **accountable** for:

| Table | What it is | Production requirement |
|---|---|---|
| `cases` | The decision per case | UAE-region managed Postgres |
| `agent_steps` | The live, per-agent decision trail | UAE-region; powers the auditable decision graph |
| `audit_logs` | Immutable record of every decision + officer action | **7-year retention**, write-once cold-storage replication (Azure Immutable Blob / S3 Object Lock), column encryption on free-text rationale |
| `job_queue` | Async work queue | In prod, replaced by a real broker (Redis Streams / SQS) — see [`SCALING.md`](SCALING.md) |

This store does **not** get "replaced by what the govt has" — it is new, regulated output. It moves to government-controlled UAE infrastructure and hardens (see [`SECURITY.md`](SECURITY.md)).

---

## 3. Outbound write-back — instructing the system of record

Approval is not just a status change. When SADDAD approves a rescheduling, the new installment / **direct-debit (DDA)** instruction must be posted **back** to the loan servicer's core system so the deduction actually changes.

This is modelled today by `submitApprovalToLoanServicer()` in [`lib/integrations/source-systems.ts`](../lib/integrations/source-systems.ts), called (non-fatally) from the Escalation/Audit agent on an approved decision. It's a stub that logs the instruction and returns a stub reference; production replaces the body with the servicer's API call. The architecture — *an approved decision emits an outbound instruction* — is in place.

---

## 4. What changes for production, what doesn't

**Changes:** the bodies of `lib/integrations/source-systems.ts` (read adapters + the write-back), auth → UAE PASS, the owned store → UAE-region managed Postgres + immutable audit tier.

**Doesn't change:** the agent pipeline (`/agents`), the tool layer (`/tools`), the governance rule engine (`/governance`), the decision/audit schema shape, the dashboard, the officer portal.

---

## 5. Honest note on effort

The AI decisioning is the fast part. **Integration is the genuinely hard, slow part** of any government deployment — data-sharing agreements between entities, security reviews, legacy feed formats, UAE PASS onboarding. [`PILOT_PLAN.md`](PILOT_PLAN.md) scopes this as Phase 2 (a read-only applicant feed from MOEI's systems) precisely because it's where these projects live or die. Naming it honestly is the point: SADDAD is architected so the integration is *contained to one port*, not smeared across the system.
