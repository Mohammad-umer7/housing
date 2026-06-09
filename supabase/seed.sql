-- SADDAD demo seed data.
-- Run this in the Supabase SQL editor AFTER supabase/schema.sql.
--
-- It loads two things:
--   1. Six citizen "personas" into `applicants` — these power the "log in as a
--      citizen" cards on the login page and the auto-filled submission form.
--   2. ~40 historical decided cases into `cases` — past decisions across a spread
--      of debt-to-income ratios and outcomes, so the Fairness agent and the
--      Critic's lookup_similar_decisions tool have real precedent to compare to.
--
-- Safe to re-run: personas upsert on case_number; historical rows are cleared and
-- re-inserted.

-- ── 1. Citizen personas (login cards + form auto-fill) ───────────────────────

INSERT INTO applicants (
  case_number, full_name, full_name_ar, emirates_id, phone,
  arrears_amount, monthly_salary, monthly_expenses, property_address,
  previous_default, loan_bank_name, loan_account_number, total_loan_amount,
  current_installment, remaining_loan_months, auto_dda, reschedule_reason,
  months_in_arrears, family_size, marital_status, income_changed, remaining_loan_balance
) VALUES
  ('MOEI-2026-1001', 'Salem Saif Al Ameri', 'سالم سيف العامري', '784-1988-2341567-3', '+971501234567',
   18000, 15000, 4200, 'Villa 42, Al Bateen, Abu Dhabi',
   FALSE, 'Emirates Development Bank', 'EDB-2021-104587', 480000, 2200, 240, TRUE, 'medical_expenses', 3, 4, 'married', FALSE, 410000),
  ('MOEI-2026-1002', 'Aisha Mohammed Al Marri', 'عائشة محمد المري', '784-1992-7651234-8', '+971507654321',
   34000, 8500, 2800, 'Apt 1204, Al Reem Island, Abu Dhabi',
   FALSE, 'Abu Dhabi Islamic Bank', 'ADIB-2020-388291', 320000, 1200, 120, TRUE, 'salary_reduction', 6, 3, 'married', TRUE, 250000),
  ('MOEI-2026-1003', 'Hamdan Khalifa Al Suwaidi', 'حمدان خليفة السويدي', '784-1979-4523678-1', '+971509876543',
   620000, 12000, 5500, 'Villa 17, Mohammed Bin Zayed City',
   FALSE, 'First Abu Dhabi Bank', 'FAB-2019-665491', 850000, 1800, 180, TRUE, 'business_failure', 14, 6, 'married', FALSE, 800000),
  ('MOEI-2026-1004', 'Latifa Ahmed Al Falasi', 'لطيفة أحمد الفلاسي', '784-1995-9988776-5', '+971502233445',
   15000, 2800, 1100, 'Apt 305, Al Nahda, Sharjah',
   FALSE, 'Emirates Development Bank', 'EDB-2022-552103', 180000, 400, 144, TRUE, 'job_loss', 8, 5, 'married', TRUE, 170000),
  ('MOEI-2026-1005', 'Rashid Obaid Al Mazrouei', 'راشد عبيد المزروعي', '784-1985-1122334-2', '+971554466778',
   45000, 10000, 3500, 'Villa 88, Khalifa City A, Abu Dhabi',
   TRUE, 'Emirates NBD', 'ENBD-2018-774512', 410000, 1500, 96, TRUE, 'family_circumstances', 9, 4, 'married', FALSE, 360000),
  ('MOEI-2026-1006', 'Mariam Yousef Al Hosani', 'مريم يوسف الحوسني', '784-1990-5566778-9', '+971563344556',
   24000, 20000, 3000, 'Villa 5, Al Maqtaa, Abu Dhabi',
   FALSE, 'Emirates Development Bank', 'EDB-2023-771902', 600000, 3000, 200, TRUE, 'medical_expenses', 2, 2, 'single', FALSE, 540000)
ON CONFLICT (case_number) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  full_name_ar = EXCLUDED.full_name_ar,
  emirates_id = EXCLUDED.emirates_id,
  phone = EXCLUDED.phone,
  arrears_amount = EXCLUDED.arrears_amount,
  monthly_salary = EXCLUDED.monthly_salary,
  monthly_expenses = EXCLUDED.monthly_expenses,
  property_address = EXCLUDED.property_address,
  previous_default = EXCLUDED.previous_default,
  loan_bank_name = EXCLUDED.loan_bank_name,
  loan_account_number = EXCLUDED.loan_account_number,
  total_loan_amount = EXCLUDED.total_loan_amount,
  current_installment = EXCLUDED.current_installment,
  remaining_loan_months = EXCLUDED.remaining_loan_months,
  auto_dda = EXCLUDED.auto_dda,
  reschedule_reason = EXCLUDED.reschedule_reason,
  months_in_arrears = EXCLUDED.months_in_arrears,
  family_size = EXCLUDED.family_size,
  marital_status = EXCLUDED.marital_status,
  income_changed = EXCLUDED.income_changed,
  remaining_loan_balance = EXCLUDED.remaining_loan_balance;

-- ── 2. Historical decided cases (precedent for the Fairness agent) ───────────
-- Spread across debt-to-income ratios 0.15–0.85 with realistic outcomes:
-- low DTI tends to APPROVED, high DTI tends to ESCALATED, with a mixed middle
-- band and a few REJECTED (missing-document) cases. Multiple cases land in each
-- DTI band so getSimilarCases() returns a meaningful consistency score.

DELETE FROM cases WHERE case_number LIKE 'MOEI-2025-%';

INSERT INTO cases (
  case_number, full_name, status, arrears_amount, monthly_salary,
  monthly_payment, duration_months, risk_score, debt_to_income_ratio,
  risk_level, reschedule_reason, months_in_arrears, decision_reason, processed_at
)
SELECT
  'MOEI-2025-' || LPAD(g::text, 4, '0'),
  (ARRAY[
    'Khalid Al Nuaimi','Noura Al Shamsi','Omar Al Balushi','Fatima Al Zaabi',
    'Saeed Al Ketbi','Hessa Al Dhaheri','Tariq Al Hammadi','Maitha Al Junaibi',
    'Ali Al Marzooqi','Shaikha Al Qubaisi','Yousef Al Rashedi','Amna Al Suwaidi'
  ])[1 + (g % 12)],
  CASE
    WHEN g % 9 = 0 THEN 'rejected'
    WHEN (0.15 + (g % 15) * 0.05) < 0.45 THEN 'approved'
    WHEN (0.15 + (g % 15) * 0.05) < 0.62 THEN (CASE WHEN g % 2 = 0 THEN 'approved' ELSE 'escalated' END)
    ELSE 'escalated'
  END,
  (20000 + (g % 18) * 5000)::numeric,
  (5000 + (g % 12) * 1200)::numeric,
  ROUND((5000 + (g % 12) * 1200) * 0.20)::numeric,
  CEIL((20000 + (g % 18) * 5000)::numeric / GREATEST(ROUND((5000 + (g % 12) * 1200) * 0.20), 1))::int,
  ROUND((0.15 + (g % 15) * 0.05) * 90)::int,
  ROUND((0.15 + (g % 15) * 0.05)::numeric, 3),
  CASE
    WHEN (0.15 + (g % 15) * 0.05) >= 0.75 THEN 'CRITICAL'
    WHEN (0.15 + (g % 15) * 0.05) >= 0.50 THEN 'HIGH'
    WHEN (0.15 + (g % 15) * 0.05) >= 0.25 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  (ARRAY['job_loss','salary_reduction','medical_expenses','business_failure','family_circumstances','other'])[1 + (g % 6)],
  (1 + (g % 22)),
  'Historical decision (seeded precedent for fairness comparison).',
  NOW() - ((g * 7) || ' hours')::interval
FROM generate_series(1, 40) AS g;
