-- Run this in Supabase SQL Editor to set up the database

-- Applicants table (pre-populated with demo data)
CREATE TABLE IF NOT EXISTS applicants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  full_name_ar TEXT,
  emirates_id TEXT,
  phone TEXT,
  arrears_amount NUMERIC NOT NULL,
  monthly_salary NUMERIC NOT NULL,
  monthly_expenses NUMERIC NOT NULL,
  property_address TEXT,
  previous_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Loan details
  loan_bank_name TEXT DEFAULT 'Emirates Development Bank',
  loan_account_number TEXT,
  total_loan_amount NUMERIC,
  remaining_loan_balance NUMERIC,
  current_installment NUMERIC,
  remaining_loan_months INTEGER,
  payment_history JSONB DEFAULT '[]'::jsonb,
  auto_dda BOOLEAN DEFAULT TRUE,
  reschedule_reason TEXT DEFAULT 'other',
  months_in_arrears INTEGER DEFAULT 0,
  -- Brief Rule 3: existing active application signal (MOEI "previous applications")
  has_active_application BOOLEAN NOT NULL DEFAULT FALSE
);

-- Cases table (AI decisions)
CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  full_name TEXT,
  emirates_id TEXT,
  phone TEXT,
  arrears_amount NUMERIC,
  monthly_salary NUMERIC,
  monthly_expenses NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'escalated', 'pending')),
  decision_reason TEXT,
  monthly_payment NUMERIC,
  duration_months INTEGER,
  risk_score INTEGER,
  debt_to_income_ratio NUMERIC,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Extended fields added post-launch
  reschedule_reason TEXT,
  months_in_arrears INTEGER,
  rationale_ar TEXT,
  consistency_score INTEGER,
  similar_cases_found INTEGER,
  fairness_note TEXT,
  risk_level TEXT,
  loan_bank_name TEXT,
  loan_account_number TEXT,
  total_loan_amount NUMERIC,
  remaining_loan_balance NUMERIC,
  current_installment NUMERIC,
  remaining_loan_months INTEGER,
  total_new_monthly_payment NUMERIC,
  case_study JSONB,
  recovery_guidance TEXT,
  recovery_guidance_ar TEXT
);

-- Audit logs (immutable trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT,
  rule_triggered TEXT,
  rationale TEXT,
  financial_snapshot JSONB,
  agent_model TEXT,
  processed_by TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Policy model: all reads/writes go through the API (server-side, service-role
-- key bypasses RLS). The anon key gets ZERO access to PII tables.
-- Realtime is allowed only on cases + agent_steps (live dashboard); see below.

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop any legacy "Allow all" policies from earlier deployments
DROP POLICY IF EXISTS "Allow all" ON applicants;
DROP POLICY IF EXISTS "Allow all" ON cases;
DROP POLICY IF EXISTS "Allow all" ON audit_logs;

-- applicants: contains PII (Emirates ID, salary, loan details). Service-role only.
-- No policies created → anon/authenticated keys cannot read or write.

-- audit_logs: immutable compliance trail. Service-role only.
-- No policies created → anon/authenticated keys cannot read or write.

-- cases: anon may read ONLY non-PII columns, and only for the live dashboard.
-- Emirates ID, phone, salary, expenses, names and free-text rationale are NEVER
-- granted to the public anon key. Column-level GRANTs enforce this even against a
-- direct REST query with a leaked anon key.
-- (Realtime WAL payloads are not column-filtered, so the client additionally does
-- not trust them — components/Dashboard.tsx treats a realtime event as a refetch
-- trigger and reloads authoritative data via the service-role API. Production moves
-- the live feed to authenticated Realtime — see docs/SECURITY.md.)
-- All writes go through the server using the service-role key.
REVOKE SELECT ON cases FROM anon;
GRANT SELECT (
  id, case_number, status, arrears_amount,
  monthly_payment, duration_months, total_new_monthly_payment,
  risk_score, risk_level, consistency_score, similar_cases_found,
  processed_at, created_at
) ON cases TO anon;
CREATE POLICY "cases_anon_select_for_realtime" ON cases
  FOR SELECT TO anon USING (true);

-- Job queue (async processing)
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  form_data JSONB NOT NULL,
  document_paths JSONB,
  worker_id TEXT,
  attempt_count INTEGER DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON job_queue;
-- job_queue: internal worker queue with form data. Service-role only.
-- No policies created → anon/authenticated keys cannot read or write.

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, queued_at);

-- Agent steps (live progress tracking)
CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result_summary TEXT,
  ran_in_parallel BOOLEAN DEFAULT FALSE
);

ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON agent_steps;
-- agent_steps: anon may read only non-PII progress columns. result_summary can
-- contain an applicant name, so it is NOT granted to anon. Writes via service-role only.
REVOKE SELECT ON agent_steps FROM anon;
GRANT SELECT (
  id, case_number, agent_name, status,
  started_at, completed_at, duration_ms, ran_in_parallel
) ON agent_steps TO anon;
CREATE POLICY "agent_steps_anon_select_for_realtime" ON agent_steps
  FOR SELECT TO anon USING (true);

-- Enable realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE job_queue;

-- ── New columns (run after initial setup) ─────────────────────────────────────

ALTER TABLE cases ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS months_in_arrears INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS car_loan_payment NUMERIC DEFAULT 0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS personal_loan_payment NUMERIC DEFAULT 0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_obligations NUMERIC DEFAULT 0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS rationale_ar TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS consistency_score INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS similar_cases_found INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS fairness_note TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS risk_level TEXT;

-- ── Loan details columns (MOEI official data) ────────────────────────────────

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS loan_bank_name TEXT DEFAULT 'Emirates Development Bank';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS loan_account_number TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS total_loan_amount NUMERIC;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS remaining_loan_balance NUMERIC;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS current_installment NUMERIC;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS remaining_loan_months INTEGER;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS auto_dda BOOLEAN DEFAULT TRUE;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS loan_bank_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS loan_account_number TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS total_loan_amount NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS remaining_loan_balance NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_installment NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS remaining_loan_months INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS total_new_monthly_payment NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recovery_guidance TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recovery_guidance_ar TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_study JSONB;
-- Layered document-forensics report (QR + field cross-check + structure + arithmetic + metadata).
ALTER TABLE cases ADD COLUMN IF NOT EXISTS verification_report JSONB;
-- UAE PASS social signal + fast-track flag. priority_escalation = TRUE only when a
-- PRIORITY beneficiary's case was escalated for a genuine rule (priority alone never escalates).
ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_status TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS priority_escalation BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_cases_priority_escalation
  ON cases (priority_escalation) WHERE priority_escalation = TRUE;

-- ── Feedback ────────────────────────────────────────────────────────────────
-- Citizen feedback after a decision: 1-5 star rating + optional comment + name.
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT,
  name        TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);

-- ── Applicants additional columns (seed data fields) ─────────────────────────

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS reschedule_reason TEXT DEFAULT 'other';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS months_in_arrears INTEGER DEFAULT 0;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS family_size INTEGER DEFAULT 1;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS income_changed BOOLEAN DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS car_loan_payment NUMERIC DEFAULT 0;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS personal_loan_payment NUMERIC DEFAULT 0;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS other_obligations NUMERIC DEFAULT 0;
-- Brief Rule 3 — existing active application (duplicate) detection signal.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS has_active_application BOOLEAN NOT NULL DEFAULT FALSE;

-- ── System Settings (admin-configurable key-value store) ─────────────────────
-- Persists the admin portal's chatbot custom instructions (assistant_* keys)
-- and governance rule overrides (rule_* keys).

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed with empty custom instructions so the rows exist from day 1.
INSERT INTO system_settings (key, value) VALUES
  ('assistant_citizen_instructions', ''),
  ('assistant_officer_instructions', ''),
  ('assistant_admin_instructions',   '')
ON CONFLICT (key) DO NOTHING;

-- ── Login Log (admin user-activity tracking) ────────────────────────────────
-- Records every successful login for audit and user-management visibility.

CREATE TABLE IF NOT EXISTS login_log (
  id           BIGSERIAL PRIMARY KEY,
  username     TEXT,
  role         TEXT NOT NULL,
  case_number  TEXT,
  display_name TEXT,
  ip_address   TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_log_logged_in_at ON login_log (logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_log_role         ON login_log (role);
CREATE INDEX IF NOT EXISTS idx_login_log_case_number  ON login_log (case_number);
