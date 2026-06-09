# SADDAD — 90-Day Pilot Plan

## Goal

From the current prototype (this repository) to a **live MOEI Housing Arrears AI pilot** processing real citizen submissions at one MOEI branch, with officer oversight, by **day 90**.

---

## Success criteria for the pilot

| Metric | Baseline (manual today) | Pilot target (day 90) |
|---|---|---|
| Median time from submission to decision | 5 working days (official SLA) | < 60 seconds |
| % of cases auto-resolved (no officer touch) | 0% | ≥ 60% |
| Officer hours per case (auto path) | ~2 hours | 0 |
| Officer hours per case (escalated path) | ~2 hours | ≤ 30 minutes (officer reviews pre-built AI report) |
| Decisions overturned on review | n/a | < 3% (target consistency) |
| Citizen NPS for the digital channel | n/a | ≥ +40 |

---

## Phase 1 — Weeks 1-2: Security + compliance review

**Owners:** MOEI IT Security + Legal + External Reviewer

### Deliverables
- [ ] PDPL compliance review of the codebase against UAE Federal Decree-Law 45 of 2021 (Personal Data Protection Law) — see [`SECURITY.md`](SECURITY.md) for the current self-assessment
- [ ] Penetration test of the Next.js app + Supabase RLS posture
- [ ] Approval to deploy in MOEI's UAE-region cloud (Azure UAE North or AWS me-central-1)
- [ ] Replace demo username/password auth with **UAE PASS OIDC integration** for citizen + officer login (spec: [`UAEPASS.md`](UAEPASS.md))
- [ ] **Initiate the external data-sharing agreements — these are the long pole, so they start Week 1**, in parallel with everything else: the loan-servicer (bank) loan/arrears feed, **WPS** (MOHRE/CBUAE) salary verification, and **CBUAE Open Finance** account access. The code is a contained adapter swap behind `lib/integrations/` (see [`INTEGRATION.md`](INTEGRATION.md)); the timeline driver is the inter-entity agreements, not the integration code.
- [ ] Replace Groq with a sovereign-LLM evaluation: **G42 Jais 70B** or **Falcon-Arabic** — accuracy benchmarks against the 51-test regression suite
- [ ] Secrets management: move all env vars into Azure Key Vault / AWS Secrets Manager
- [ ] Encrypt the existing `audit_logs` table at the column level for `rationale` (free-text PII risk)

### Exit criteria
- Security sign-off from MOEI IT Security
- Legal sign-off from MOEI compliance
- Deployment approved for the staging environment

---

## Phase 2 — Weeks 3-6: Shadow mode + officer training

**Owners:** MOEI Finance & Collections Department + IT delivery team

### What "shadow mode" means
For 4 weeks, every real housing-arrears case is processed both ways in parallel:
- The **officer** makes the decision the existing manual way (production)
- **SADDAD** processes the same case in the background and records its decision
- Officers do **not** see SADDAD's output — this prevents anchoring bias
- At end of each week, an analyst compares SADDAD's decisions to officer decisions and flags every disagreement for root-cause analysis

### Deliverables
- [ ] Land the production integrations behind [`lib/integrations/source-systems.ts`](../lib/integrations/source-systems.ts) (read-only) as the agreements clear: the **loan-servicer feed** (loan, arrears, installment, Auto DDA), **WPS** salary verification (which replaces PDF OCR as the trusted salary signal — see [`INTEGRATION.md`](INTEGRATION.md)), and **CBUAE Open Finance** account access for affordability. Until each clears, the seeded mock adapter keeps the system fully testable.
- [ ] Officer training program (2 sessions × 4 hours) covering:
  - When SADDAD's decision can be trusted as-is
  - How to read an escalated case's pre-built AI report
  - How to override / annotate a decision in the Officer portal
  - PDPL handling for the AI rationale text
- [ ] Weekly disagreement review — every case where SADDAD and the officer disagreed, classified as:
  - **AI wrong** (rules bug or hallucination — fix)
  - **Officer wrong** (AI caught something officer missed — celebrate)
  - **Both defensible** (edge case — document, refine rules)
- [ ] Refined governance rules based on shadow-mode learnings (expect 2-3 rule additions for edge cases seen in real data)

### Exit criteria
- ≥ 90% agreement between SADDAD and officers across 4 weeks of cases
- Officer team confident operating the Officer portal
- All identified AI errors fixed and re-tested

---

## Phase 3 — Weeks 7-12: Limited live pilot at one MOEI branch

**Owners:** MOEI branch team + IT delivery team

### Pilot scope
- **One MOEI branch** (recommend: a high-volume location for meaningful data)
- **All housing-arrears submissions** at that branch routed through SADDAD
- **Officer override always available** — every AI decision can be overturned within 48 hours by the assigned officer
- **Citizen disclosure** — submission form clearly states "AI-assisted decision; you may request human review"

### Deliverables
- [ ] Deploy SADDAD to production environment (UAE-region)
- [ ] Cut over the pilot branch's submission intake to the SADDAD portal
- [ ] Daily monitoring dashboard:
  - Throughput (cases/hour)
  - Approval / Rejection / Escalation rates
  - Officer override rate
  - P50 / P95 / P99 processing time
  - Error rate + tail-latency tracking
- [ ] Weekly officer-feedback session — what's working, what's confusing, what's missing
- [ ] PDPL-compliant data subject access procedure (citizen can request their decision graph)
- [ ] Citizen NPS survey via WhatsApp after each decision

### Exit criteria
- ≥ 60% of cases auto-resolved without officer touch
- ≤ 3% officer-override rate
- Median end-to-end < 60 seconds
- Citizen NPS ≥ +40
- Zero PDPL incidents

---

## Phase 4 — Days 90+: Federal expansion

After a successful MOEI pilot, the same architecture extends to additional federal services by writing new `governance/<service>.ts` modules. See [`PITCH.md`](PITCH.md) for the platform argument and [`governance/visa-renewal.ts`](../governance/visa-renewal.ts) (with [`tests/service-registry.test.ts`](../tests/service-registry.test.ts)) for a worked, tested example of the next service.

Recommended sequence:
1. **Q2 post-pilot**: Roll SADDAD to all MOEI branches (housing arrears across the country)
2. **Q3**: Onboard one MOI service (e.g. Visa Renewal) using the same agent platform
3. **Q4**: Onboard one MOHRE service (e.g. work permit approvals) — same platform
4. **End of year 1**: SADDAD is operating across three federal entities, processing N×10^5 cases/year, demonstrating the 50% directive at scale

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM provider outage | Multi-provider fallback in the LLM client (Groq → Jais → cached responses for non-novel cases) |
| Sovereign-LLM accuracy drop vs Groq | Mandatory accuracy testing on the 51-test regression suite during Phase 1; rollback path to Groq if delta > 5% |
| Officer resistance to AI decisions | Shadow mode in Phase 2 ensures buy-in; officers see SADDAD agree with them 90% of the time before going live |
| PDPL incident from rationale leakage | Encrypt `rationale` column; quarterly PII audit of audit-log content; rationale templates reviewed by Legal |
| Citizen complaint about "AI decided" | Every escalation routes to a human officer within the existing 5-day SLA; AI decisions can always be appealed |
| Schema drift between pilot branches | Single source of truth in `supabase/schema.sql`; migration discipline enforced via CI |
| Inter-entity data-sharing agreements slip (the real long pole) | Kick off MOUs / API access for UAE PASS, WPS, Open Finance and the loan servicer in **Week 1**; the [`lib/integrations/`](../lib/integrations/source-systems.ts) mock adapters keep the system demoable and shadow-testable until each real feed lands, so integration delay never blocks build progress |

---

## What we are NOT doing in 90 days

- Full federal rollout — Phase 4 is post-pilot
- Multi-language beyond Arabic + English (Urdu, Hindi etc. are post-pilot work)
- Citizen-direct submission (Phase 1-3 keeps officer-mediated submission to retain accountability)
- Replacing the officer dashboard — augmenting, not replacing, the current officer workflow
