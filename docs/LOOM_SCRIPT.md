# SADDAD — Loom Walkthrough Script (3 minutes)

This is the script for the demo video to embed at the top of the README. Time markers are targets, not strict cuts.

**Setup before recording:**
- Open the deployed SADDAD URL in a clean browser tab
- Have the GitHub repo open in a second tab
- Have Supabase SQL editor open in a third tab (for the audit-log reveal)
- Make sure you're logged out, so the recording starts at `/login`

---

## [0:00 – 0:25] Hook + problem statement

> "I'm going to show you SADDAD — an AI agent system for the UAE Ministry of Energy and Infrastructure that turns a 5-working-day manual decision into something instant.
>
> Today, when a citizen falls behind on their MOEI housing loan and needs to reschedule, an officer manually reviews the application against 6 governance rules over the official 5-working-day service window. The applicant waits. The officer is buried. This is the kind of high-volume, rulebook-driven service that the Federal Government's 50% AI directive is specifically about.
>
> Here's how SADDAD handles it."

*(Screen: GitHub repo file tree → highlight `agents/`, `governance/`, `tools/`, `docs/`)*

> "The architecture is in the folder names. Eleven agents, pluggable governance rules per service, MCP-compatible tools, proper docs. We'll come back to why that matters."

## [0:25 – 0:45] Login + officer perspective

*(Browser: login page)*

> "Officers log in with UAE PASS in production — for this demo it's a placeholder username and password, but the architecture is cookie-based session auth with no API keys in the browser."

*(Type credentials, log in. Land on Submit screen.)*

## [0:45 – 1:30] Live submission — clean approval path

> "I'm an officer submitting a case for citizen Salem Al Ameri. I enter the case number…"

*(Type `MOEI-2026-1001` in the case number field, tab out.)*

> "…and the loan details auto-populate from the MOEI database. Real lookup, real data. I add his name, his salary — 15,000 dirhams — I select the reschedule reason, and I tick the 20% deduction consent.
>
> Most importantly, I upload his salary certificate. SADDAD will actually parse this PDF and verify the salary matches.
>
> Now I submit."

*(Click Submit to SADDAD AI. The Processing screen appears.)*

> "Watch this. Eleven agents, several phases, three of them in parallel. Each one logs what it did and how long it took."

*(Let it run. Narrate as agents tick through.)*

> "Planner picks the strategy. Risk Forecaster runs deterministic math. Document Agent extracts the salary cert. DB Fetch pulls the loan record. Financial Analysis applies the MOEI 20% rule — 3,000 dirhams per month for 6 months. Rules Engine plus LLM checks all six governance rules and provides bilingual rationale. Fairness checks against historical decisions. Compliance Critic independently reviews — this one's a LangGraph tool subgraph, it can look up similar cases on its own. Communication tries WhatsApp. And Escalation writes the audit log.
>
> Total time: under 10 seconds. Approved at 3,000 dirhams a month for 6 months. With Arabic rationale."

## [1:30 – 2:00] The defensibility moment

*(Switch to Supabase SQL editor.)*

> "Here's why this is defensible. Every decision lands in two places. First, the audit_logs table — immutable, includes the rationale, the rule triggered, the financial snapshot."

*(Run `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1;`)*

> "Second, every agent step is in agent_steps — what ran, what it returned, how long it took."

*(Run `SELECT agent_name, status, duration_ms, result_summary FROM agent_steps WHERE case_number = 'MOEI-2026-1001' ORDER BY started_at;`)*

> "An officer asked 'why did the AI approve this case' can produce the entire decision graph in 30 seconds. That's the regulator answer."

## [2:00 – 2:25] The escalation path — show it's not a yes-machine

*(Back to the submission form. Type `MOEI-2026-1003`.)*

> "Now let's do a different case. Hamdan Al Suwaidi — 620,000 dirhams in arrears. At 20% of his salary that would take over 250 months to clear, well beyond the years left on his loan. Same form, same upload, same submit."

*(Run through it.)*

> "Pipeline runs the same way. But this time…"

*(Decision appears as ESCALATED.)*

> "Escalated. Rule G-04 triggered — the arrears can't be cleared within the remaining loan period. Routed to officer review with the AI's pre-built financial report. The officer's job goes from 2 hours of paperwork to a 15-minute decision they're equipped to make.
>
> And SADDAD doesn't just say 'no' — the Recovery Agent tells the citizen exactly how to qualify. Here it computes the partial payment that would bring the arrears within the loan term. Try uploading a salary certificate with a tampered amount and the Document Agent catches it against the issuing authority's QR record — that's real document verification, not blind trust."

## [2:25 – 2:55] The platform claim

*(Open `governance/visa-renewal.ts` and `tests/service-registry.test.ts` in the GitHub tab.)*

> "Here's the move. SADDAD isn't just a MOEI housing app. The agent pipeline, the tool layer, the auth, the audit, the dashboard — none of it cares whether this is a housing case, a visa renewal, or a permit approval.
>
> This file is a stub for MOI visa renewals. Same six-rule shape, different rules. Plug it into the pipeline and the same eleven agents process visa cases instead.
>
> Estimated effort to onboard a new federal service: 2 to 3 engineer weeks. Versus 3 to 6 months to build from scratch. That's the Federal 50% directive pitch — not a parade of bespoke AI projects, but one platform that scales."

## [2:55 – 3:00] Close

> "The full strategic argument, the 90-day pilot plan, the PDPL security review, the scaling matrix — all in the docs folder. Code is open. Tests pass. Build works. Thanks for watching."

---

## Recording tips

- **Pace:** Speak slightly faster than feels natural. Demo videos drag.
- **Cursor:** Use a cursor highlighter app so judges can see where you're pointing.
- **Audio:** Use a real mic, not your laptop's built-in. The bar for "professional polish" is set by 30-second AI startup pitches, not video calls.
- **Cuts:** It's fine to cut between sections if you stumble — keep the energy high.
- **Title card:** Open with a 3-second title card: "SADDAD — Federal AI Decision Template — [your name/team]"

## What to skip if running over

If you hit 3:30 and need to trim, drop the audit-log reveal (1:30-2:00). The pipeline visualization is enough proof of audit depth. Keep the platform claim section — that's the differentiator.
