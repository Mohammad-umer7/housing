# SADDAD — Security & UAE PDPL Compliance

This document is the self-assessment of SADDAD against the UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL) and standard government-system security requirements. It is **not** an audit certification — it is the engineering team's honest accounting of what's protected today and what must change for a federal pilot deployment.

---

## What constitutes Personal Data in this system

| Table | Personal Data fields | Retention category |
|---|---|---|
| `applicants` | `full_name`, `full_name_ar`, `emirates_id`, `phone`, `property_address`, `monthly_salary`, `monthly_expenses` | Operational — kept while case is open |
| `cases` | `full_name`, `emirates_id`, `phone`, `monthly_salary`, `arrears_amount`, `decision_reason`, `rationale_ar` | Operational + audit — kept per MOEI records policy |
| `audit_logs` | `rationale` (free text — may contain PII), `financial_snapshot` (JSONB with salary etc.) | Audit / compliance — 7-year retention recommended |
| `job_queue` | `form_data` JSONB (includes salary, phone, name) — short-lived | Operational — purge on `completed`/`failed` after 30 days |
| `agent_steps` | `result_summary` (may include applicant name) | Operational — purge with case |

---

## Current security posture

### ✅ What's in place

| Control | Implementation |
|---|---|
| HTTPS-only in production | Vercel / Azure / AWS managed TLS termination |
| Session cookies HTTP-only + Secure + SameSite=Lax | `lib/auth/session.ts` sets all three flags; `secure` enabled when `NODE_ENV=production` |
| HMAC-signed session tokens | SHA-256 with secret pulled from `SESSION_SECRET` env var (never in code) |
| Time-bounded sessions | 8-hour TTL, validated on every request |
| No auth secrets in browser bundle | `NEXT_PUBLIC_API_KEY_*` env vars were removed; the browser only knows the session cookie |
| RLS enabled on every table | All PII tables (`applicants`, `audit_logs`, `job_queue`) deny all anon access |
| Backend uses service-role key only | `SUPABASE_SERVICE_ROLE_KEY` is server-side only, never bundled to the browser |
| Rate limiting on login + API | Per-IP rate limit on `/api/auth/login` (10 req/min); per-key on data routes |
| Input validation on API routes | Every route validates body shape before touching the DB |
| Immutable audit log | `audit_logs` row written on every final decision; never updated or deleted by application code |
| Column-level anon access | `cases`/`agent_steps` use column-level `GRANT`s so the public anon key reads only non-PII columns; Emirates ID, phone, salary, names and free-text rationale are revoked from anon (see `supabase/schema.sql`) |
| Null-byte sanitization | LLM-generated `rationale` is stripped of `\x00` before audit-log insert (PostgreSQL TEXT rejects them) |

### ⚠️ What needs to change before federal pilot

| Gap | Mitigation plan |
|---|---|
| Demo username/password auth | Replace with **UAE PASS OIDC** integration before any pilot — full spec in [`UAEPASS.md`](UAEPASS.md). UAE PASS is the federal identity provider and the only acceptable production auth for citizen-facing federal services. |
| Plaintext `rationale` column | Encrypt-at-rest at the column level (Postgres `pgcrypto` or application-level via libsodium). Rationale text can reference applicant name + financial context — column-level encryption ensures DB administrators with table-read access cannot see PII. |
| Plaintext `form_data` JSONB | Same — encrypt before insert. |
| Secrets in `.env.local` | Move all secrets to **Azure Key Vault** or **AWS Secrets Manager** with IAM-scoped access. Rotate `SESSION_SECRET` and `API_KEY_*` quarterly. |
| LLM provider (Groq, US-hosted) | Migrate to **G42 Jais** or **Falcon-Arabic** for production. The LLM sees applicant PII in prompts; processing must happen in UAE-hosted infrastructure. |
| In-memory rate limiter | Move to Redis-backed sliding window for distributed enforcement across pods. |
| No audit-log replication | Replicate `audit_logs` to write-once cold storage (Azure Immutable Blob / AWS S3 Object Lock) for 7-year retention per UAE federal records policy. |
| No PII data subject access request flow | Implement `/api/dsar/<emirates_id>` (admin-only) returning the citizen's full decision graph + the right to request deletion of operational data. |
| No formal pen-test | Engage a CERT-accredited UAE security firm for pre-pilot penetration testing. |
| Realtime WAL payloads not column-filtered | Postgres logical-replication payloads carry all row columns regardless of column `GRANT`s. The dashboard mitigates today by treating realtime events as **refetch triggers only** — it never renders the payload ([`components/Dashboard.tsx`](../components/Dashboard.tsx)) and reloads PII via the service-role API. Production moves the live feed to **authenticated Realtime** (per-officer JWT) or a server-emitted PII-free broadcast channel. |

---

## PDPL Article-by-Article Posture

### Article 5 — Lawful basis for processing
**Status: ✅ Compliant by design.** Processing is performed under the authority of MOEI for the purpose of administering housing arrears rescheduling — a documented government service. Applicants are notified of AI involvement at submission (the UI banner explicitly says "AI-powered").

### Article 6 — Consent
**Status: ✅ In place.** The submission form requires explicit consent to the 20% salary deduction. The system does not process cases without checked consent.

### Article 9 — Data subject rights
**Status: ⚠️ Partial.** Citizens can already receive their decision rationale (English + Arabic via WhatsApp). The right to **request human review** is implicit (every escalation reaches an officer). The right to **request a complete data extract (DSAR)** is not yet implemented — this is a pre-pilot deliverable.

### Article 10 — Data minimization
**Status: ✅ In place.** Each agent only receives the fields it needs (e.g. the Communication agent only sees phone + decision, not the full financial snapshot). The Critic agent's tool calls return only summary data, not raw rows.

### Article 12 — Cross-border data transfer
**Status: ⚠️ Currently violated by Groq.** Groq is US-hosted; PII enters US infrastructure in agent prompts. **Mitigation**: migrate to sovereign LLM (G42 Jais / Falcon-Arabic) before pilot.

### Article 18 — Data breach notification
**Status: ⚠️ Not yet operational.** Production deployment must include:
- Sentry / equivalent for error capture
- On-call rotation with documented breach response runbook
- 72-hour notification path to UAE Data Office

### Article 22 — Automated decision-making
**Status: ✅ Compliant by design.** PDPL Article 22 requires citizens to have the right not to be subject to a decision based solely on automated processing. SADDAD satisfies this in three ways:
1. Every escalated case reaches a human officer
2. Every auto-decision can be overridden by an officer within the existing 5-day SLA
3. The decision rationale is delivered to the citizen with their decision, so they can appeal

---

## Threat model summary

| Threat | Likelihood | Impact | Current mitigation | Residual risk |
|---|---|---|---|---|
| Stolen session cookie | Medium | High | HTTP-only + SameSite + 8h TTL + rotating secret | Acceptable; standard web auth posture |
| Stolen API key for server-to-server | Low | High | Rotate quarterly; per-key rate limit; revoke in env var | Acceptable post-Key Vault migration |
| Stolen Supabase service-role key | Low | Critical | Server-side only, never in repo; secret manager in production | Acceptable post-Key Vault migration |
| SQL injection | Very Low | Critical | Parameterized queries via Supabase client; no string interpolation | Low |
| LLM prompt injection (malicious PDF) | Medium | Medium | LLM output never directly executes; rationale is text-only; hard rules override LLM judgment | Acceptable |
| Insider PII access | Medium | High | RLS + service-role separation; pre-pilot: column-level encryption on rationale + form_data | Reduced post-encryption |
| Audit log tampering | Low | Critical | Application code never updates/deletes audit_logs; pre-pilot: write-once cold storage replication | Reduced post-replication |
| Decision bias from training data | Low | Medium | Fairness agent compares against precedent; weekly officer disagreement review during pilot | Monitored continuously |

---

## What this document is not

- This is not an external compliance certification
- This is not legal advice — the MOEI Legal and IT Security teams must conduct their own review
- This is the engineering team's honest accounting so reviewers can see exactly what's protected today and what the production gaps are

The point of being explicit about gaps is that you can close them. A document that claimed "fully PDPL compliant" without evidence would be less trustworthy than this one.
