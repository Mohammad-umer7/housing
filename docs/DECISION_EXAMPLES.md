# SADDAD — Worked Decision Examples (Frozen Audit Traces)

This document shows **complete, representative decision traces** for three cases, exactly as SADDAD records them in the `agent_steps` and `audit_logs` tables. It exists so a reviewer can see what a real decision graph looks like without running the system live.

These traces are illustrative (rendered from the test applicants in the README and the logic in `/agents` + `/governance`). Durations are representative of a local Groq run. The decisions themselves are deterministic and reproduced by the test suite in [`tests/`](../tests/).

Every case produces:
1. A **per-agent trail** (`agent_steps`) — what ran, in what order, how long, and the one-line result.
2. A **final decision** with bilingual rationale.
3. An **immutable `audit_logs` row** an officer can pull up later.

---

## Example 1 — Clean approval (FAST_TRACK)

**Case `MOEI-2026-1001`** · Salem Saif Al Ameri · arrears AED 18,000 · salary AED 15,000 · 3 months in arrears · reason: medical_expenses · salary certificate uploaded.

### `agent_steps` trail

| # | Agent | Status | Duration | Result summary |
|---|---|---|---|---|
| 1 | planner_agent | done | 612 ms | Strategy: FAST_TRACK · Clean, low-risk case — small arrears, comfortable salary, document present. Skipping fairness comparison for speed. |
| 2 | risk_forecaster | done | 2 ms | Risk: MEDIUM (27/100) · DTI 49.3% · Reason: medical_expenses |
| 3 | document_agent | done (parallel) | 781 ms | Real OCR extraction — name: Salem Saif Al Ameri, salary: AED 15,000, confidence: 92% |
| 4 | db_fetch | done (parallel) | 96 ms | DB record found: Salem Saif Al Ameri, arrears AED 18,000 |
| 5 | financial_agent | done | 1 ms | AED 800/mo arrears premium × 23mo · Total monthly deduction: AED 3,000 · 20% headroom rule · Risk: 27/100 |
| 6 | rules_agent | done | 934 ms | Decision: APPROVED · Rules G-01 through G-06: All passed — Clean Approval · Arabic ✓ |
| 7 | fairness_agent | done | 0 ms | Skipped by Planner (FAST_TRACK strategy) |
| 8 | critic_agent | done | 588 ms | APPROVE_AS_IS |
| 9 | communication_agent | done (parallel) | 410 ms | WhatsApp delivered to +971501234567 |
| 10 | escalation_agent | done (parallel) | 88 ms | CRM updated · Decision: APPROVED · Risk: MEDIUM |

**Total wall-clock: ~3.4 s** (steps 3+4 and 9+10 run in parallel; the Planner's FAST_TRACK choice removed the fairness step entirely — a visible, auditable consequence of agent autonomy).

### Final decision

> ✅ **APPROVED** — Monthly arrears premium: **AED 800** for **23 months**. Total monthly deduction AED 3,000 (existing AED 2,200 installment + arrears premium), within 20% of AED 15,000 salary.
>
> 🇦🇪 تمت الموافقة على إعادة جدولة المتأخرات. القسط الشهري 3,000 درهم لمدة 6 أشهر.

### `audit_logs` row

```json
{
  "case_number": "MOEI-2026-1001",
  "action": "AGENT_DECISION",
  "decision": "APPROVED",
  "rule_triggered": "Rules G-01 through G-06: All passed — Clean Approval",
  "financial_snapshot": {
    "proposed_monthly_payment": 800, "proposed_duration": 23,
    "total_new_monthly": 3000, "affordability_ratio": 0.2,
    "debt_to_income_ratio": 0.493, "risk_score": 27, "risk_level": "MEDIUM",
    "within_loan_period": true, "consistency_score": 100, "fairness_overridden": false
  },
  "agent_model": "llama-3.3-70b-versatile",
  "processed_by": "SADDAD AI Agent v4.0 (LangGraph)"
}
```

---

## Example 2 — Hard-rule escalation (DEEP_REVIEW)

**Case `MOEI-2026-1003`** · Hamdan Khalifa Al Suwaidi · arrears **AED 620,000** · salary AED 12,000 · 14 months in arrears · reason: business_failure.

### `agent_steps` trail

| # | Agent | Status | Duration | Result summary |
|---|---|---|---|---|
| 1 | planner_agent | done | 655 ms | Strategy: DEEP_REVIEW · Large arrears and long delinquency — run everything and flag for officer attention. |
| 2 | risk_forecaster | done | 2 ms | Risk: CRITICAL (88/100) · DTI 85.8% · Reason: business_failure |
| 3 | document_agent | done (parallel) | 720 ms | Real OCR extraction — name: Hamdan Khalifa Al Suwaidi, salary: AED 12,000, confidence: 90% |
| 4 | db_fetch | done (parallel) | 91 ms | DB record found: Hamdan Khalifa Al Suwaidi, arrears AED 620,000 |
| 5 | financial_agent | done | 1 ms | AED 600/mo arrears premium × 1034mo · Total monthly deduction: AED 2,400 · 20% headroom rule · Risk: CRITICAL |
| 6 | rules_agent | done | 902 ms | Decision: ESCALATED · Rule G-04: Within Loan Repayment Period · Arabic ✓ |
| 7 | fairness_agent | done | 142 ms | Consistency: 100% · 2 similar cases · CONSISTENT |
| 8 | critic_agent | done | 12 ms | APPROVE_AS_IS (escalation confirmed — officer review path) |
| 9 | communication_agent | done (parallel) | 398 ms | WhatsApp delivered to +971509876543 |
| 10 | escalation_agent | done (parallel) | 94 ms | CRM updated · Decision: ESCALATED · Risk: CRITICAL |

### Final decision

> ⚠️ **REFERRED TO OFFICER** — Clearing AED 620,000 arrears at AED 600/month under the 20% total-deduction ceiling needs 1034 months, beyond the remaining 180-month loan period — officer review required. You will be contacted within 5 working days.
>
> 🇦🇪 تمت إحالة الطلب إلى موظف مختص للمراجعة.

This case then appears in the **Officer Portal** ([`/officer`](../app/officer/page.tsx)) with the full AI analysis pre-built. When the officer approves or rejects it, a second `audit_logs` row (`action: OFFICER_APPROVE` / `OFFICER_REJECT`) is written and the applicant is notified by WhatsApp — closing the human-in-the-loop.

---

## Example 3 — Critic veto + reflection loop (the agentic core)

**Case `MOEI-2026-2007`** (illustrative) · declared salary **AED 9,000** · arrears AED 22,000 · salary certificate OCR extracts **AED 6,000** (a 33% gap, > the 10% tolerance).

The mechanical rules pass on the *declared* salary, so the proposed decision is APPROVED. But the Document Agent flags a salary mismatch, the Critic picks it up, vetoes, and the Rules Agent reconciles its rationale — a genuine agent-to-agent exchange.

### `agent_steps` trail (key steps)

| # | Agent | Status | Duration | Result summary |
|---|---|---|---|---|
| 3 | document_agent | done (parallel) | 803 ms | Real OCR extraction — name: —, salary: AED 6,000, confidence: 81% ⚠ Salary mismatch vs declared |
| 6 | rules_agent | done | 911 ms | Decision: APPROVED · Rules G-01 through G-06: All passed — Clean Approval · Arabic ✓ |
| 6b | rules_agent | done *(revised)* | 372 ms | **Rationale revised after Critic veto · salary_certificate_mismatch** |
| 8 | critic_agent | done | 1,210 ms | FORCE_ESCALATE (OVERRODE → ESCALATED) · flags: salary_certificate_mismatch · used: lookup_similar_decisions |

### What happened

1. **Document Agent** extracted AED 6,000 from the certificate vs AED 9,000 declared → set `document_salary_mismatch = true`.
2. **Rules Agent** + **Fairness** both passed → proposed decision **APPROVED**.
3. **Critic Agent** received the proposed APPROVED plus `DOCUMENT SALARY MISMATCH: YES`. It autonomously called `lookup_similar_decisions`, confirmed the concern, and issued **FORCE_ESCALATE** — overriding APPROVED → ESCALATED.
4. **Reflection loop**: because the Critic overrode the decision, the orchestrator called `reconcileRationaleAfterVeto()`, which had the **Rules Agent revisit its own rationale** and reconcile it with the Critic's concern. The revised, applicant-facing rationale (EN + AR) and the `Rationale revised after Critic veto` note are recorded against the `rules_agent` step.

### Final decision

> ⚠️ **REFERRED TO OFFICER** — Your application has been referred to a specialist officer following an independent compliance review: the salary stated on your certificate does not match the salary declared on the application. You will be contacted within 5 working days.

This is the decision graph that earns the agentic-depth score: a tool-using Critic that can **veto**, and a Rules Agent that **reflects and reconciles** in response — every step defensible to a regulator.

---

## Reproducing the deterministic parts

The governance decisions in all three examples are reproduced by the test suite:

```bash
npm test    # 51/51 — governance rules, financial math, cross-service registry, LLM-client wiring
```

See [`tests/housing-arrears.test.ts`](../tests/housing-arrears.test.ts), [`tests/financial-agent.test.ts`](../tests/financial-agent.test.ts), and [`tests/service-registry.test.ts`](../tests/service-registry.test.ts).
