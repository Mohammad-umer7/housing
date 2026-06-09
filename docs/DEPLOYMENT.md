# SADDAD — Deployment Guide

This guide walks through deploying SADDAD from this repository to a hosted environment. For a federal pilot deployment, see [`PILOT_PLAN.md`](PILOT_PLAN.md) for the security and compliance phases that come first.

---

## Quick Vercel deployment (recommended for demos)

### 1. Fork or clone the repo to your GitHub account

### 2. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New project. Note:
- **Project URL** (Settings → API)
- **Anon public key** (Settings → API)
- **Service role key** (Settings → API → reveal)

### 3. Run the database setup
In Supabase SQL Editor, paste and run the contents of [`supabase/schema.sql`](../supabase/schema.sql).

Then, for a demo deployment with test applicants, run the seed block from [README.md](../README.md#step-2--add-applicants) (the 5 realistic UAE test cases).

### 4. Get a Groq API key
Go to [console.groq.com](https://console.groq.com) → API Keys → Create. Free tier is sufficient for the demo.

### 5. (Optional) Twilio for WhatsApp notifications
Without Twilio, the Communication agent silently no-ops — the rest of the pipeline still works. To enable:
1. Create a Twilio account → Messaging → Try WhatsApp → join the sandbox
2. Note your Account SID, Auth Token, and WhatsApp From number

### 6. Deploy to Vercel
1. Click "Add New Project" in Vercel → Import your fork
2. Add environment variables (copy from `.env.example`):
   ```
   GROQ_API_KEY                    your Groq key
   NEXT_PUBLIC_SUPABASE_URL        from step 2
   NEXT_PUBLIC_SUPABASE_ANON_KEY   from step 2
   SUPABASE_SERVICE_ROLE_KEY       from step 2
   SESSION_SECRET                  generate: openssl rand -base64 48
   AUTH_ADMIN_USERNAME             admin
   AUTH_ADMIN_PASSWORD             pick something
   AUTH_OFFICER_USERNAME           officer
   AUTH_OFFICER_PASSWORD           pick something
   API_KEY_ADMIN                   generate: openssl rand -base64 32
   API_KEY_OFFICER                 generate: openssl rand -base64 32
   API_KEY_READONLY                generate: openssl rand -base64 32
   TWILIO_ACCOUNT_SID              (optional)
   TWILIO_AUTH_TOKEN               (optional)
   TWILIO_WHATSAPP_FROM            (optional)
   ```
3. Click Deploy

### 7. Verify
- Open the deployment URL → you should land on `/login`
- Log in with the credentials you set in step 6
- Go to Submit → enter `MOEI-2026-1001` → loan details should auto-populate
- Upload any PDF → tick consent → submit
- Watch the 11-agent pipeline run on the Processing screen

---

## Local development

```bash
git clone https://github.com/your-fork/housing-arrears-agent
cd housing-arrears-agent
npm install
cp .env.example .env.local
# fill in .env.local with real values
npm run dev
```

Open http://localhost:3000

### Verify the install

```bash
npm run lint    # should pass with no errors
npm run build   # should pass with no errors
npm test        # 36 tests, all passing
```

---

## Production deployment (UAE Federal Pilot)

For a real MOEI pilot, **do not** use the Vercel demo path. See [`PILOT_PLAN.md`](PILOT_PLAN.md) for the full security review, sovereign-LLM migration, UAE PASS integration, and worker-extraction work. The deployment target is:

- UAE-region cloud (Azure UAE North or AWS me-central-1)
- Sovereign LLM (G42 Jais or Falcon-Arabic) replacing Groq
- UAE PASS OIDC replacing demo username/password auth
- Azure Key Vault / AWS Secrets Manager for all secrets
- Dedicated worker pods replacing `next/after()`
- Redis for distributed rate limiting + queue claim
- Full observability stack (OTel + Sentry + structured logs)

See [`SCALING.md`](SCALING.md) for the migration matrix per concern.

---

## Smoke test for any deployment

After deploying, run this manual checklist to verify the system end-to-end:

| Check | How |
|---|---|
| Login flow works | Visit `/login`, enter credentials, redirected to `/` |
| Logged-out users redirected | Visit `/` in an incognito window, redirected to `/login` |
| Case lookup works | Submit form with `MOEI-2026-1001`, see auto-populated loan details |
| Hard rejection works | Submit `MOEI-2026-1001` without uploading PDF → expect REJECTED (G-01) |
| Approval works | Submit `MOEI-2026-1001` with any PDF → expect APPROVED |
| Escalation works | Submit `MOEI-2026-1003` (arrears can't clear within loan period) → expect ESCALATED (G-04) |
| No-headroom escalation | Submit a case where the existing installment is already at or above 20% of salary → expect ESCALATED (G-03) |
| Live processing visualization | All agents tick through in order on the Processing screen |
| Document verification | Upload `demo-certificates/MOEI-2026-1001_TAMPERED-salary.pdf` → expect ESCALATED with `salary_certificate_tampered` |
| Recovery guidance | Any non-approved case shows a "How to get approved" recovery message |
| Dashboard updates live | Submit a case, watch it appear in the Dashboard "Recent Cases" table |
| Officer view works | Visit `/officer`, see escalated cases listed |
| Audit log written | Check Supabase `audit_logs` table for one row per processed case |
| API key auth works | `curl -H "x-api-key: $API_KEY_ADMIN" https://your-deployment/api/dashboard` returns JSON |

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Could not find the 'consistency_score' column` | You haven't run `supabase/schema.sql` (or only ran part of it). Re-run the whole file. |
| Case stuck as "Processing" forever | Either Groq API key is invalid (check Vercel logs), or Supabase RLS policies are blocking the service-role write. Check `Postgres logs` in Supabase. |
| Login fails with valid credentials | `AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD` env vars not set, or `SESSION_SECRET` is missing. |
| Realtime updates don't appear | Supabase realtime publication missing — re-run the `ALTER PUBLICATION supabase_realtime ADD TABLE cases` line from `schema.sql`. |
| WhatsApp notification doesn't arrive | Either Twilio not configured (expected — pipeline still completes), or the recipient's phone hasn't joined your Twilio sandbox. |
