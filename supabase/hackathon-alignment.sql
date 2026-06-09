-- Handoff SQL only. Do not assume this has been run.
-- Applies the app changes needed for the June 2026 hackathon alignment:
-- family/social fields, remaining loan balance, payment history, case-study output,
-- and recovery guidance persistence.

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS remaining_loan_balance NUMERIC;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS family_size INTEGER DEFAULT 1;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS income_changed BOOLEAN DEFAULT FALSE;
-- Brief Rule 3 — existing active application (duplicate) detection signal.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS has_active_application BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS remaining_loan_balance NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recovery_guidance TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recovery_guidance_ar TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_study JSONB;
-- Layered document-forensics report (QR + field cross-check + structure + arithmetic + metadata).
ALTER TABLE cases ADD COLUMN IF NOT EXISTS verification_report JSONB;

UPDATE applicants
SET current_installment = 2200,
    family_size = 4,
    marital_status = 'married',
    income_changed = FALSE,
    remaining_loan_balance = 410000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1001';

UPDATE applicants
SET current_installment = 1200,
    family_size = 3,
    marital_status = 'married',
    income_changed = TRUE,
    remaining_loan_balance = 250000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1002';

UPDATE applicants
SET current_installment = 1800,
    family_size = 6,
    marital_status = 'married',
    income_changed = FALSE,
    remaining_loan_balance = 800000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1003';

UPDATE applicants
SET current_installment = 400,
    family_size = 5,
    marital_status = 'married',
    income_changed = TRUE,
    remaining_loan_balance = 170000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1004';

UPDATE applicants
SET current_installment = 1500,
    family_size = 4,
    marital_status = 'married',
    income_changed = FALSE,
    remaining_loan_balance = 360000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1005';

UPDATE applicants
SET current_installment = 3000,
    family_size = 2,
    marital_status = 'single',
    income_changed = FALSE,
    remaining_loan_balance = 540000,
    payment_history = COALESCE(payment_history, '[]'::jsonb)
WHERE case_number = 'MOEI-2026-1006';
