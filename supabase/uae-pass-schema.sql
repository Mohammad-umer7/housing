-- DB-3 — UAE PASS profile registry (a SEPARATE Supabase project from DB-1 loan/arrears
-- and DB-2 document registry). The federal identity + social-status system SADDAD
-- retrieves each beneficiary's verified identity, family, and social situation from,
-- keyed by Application ID. Models the brief's "assume the AI Agent can access UAE PASS"
-- challenge assumption. Seed with: node tools/seed-uae-pass.mjs --apply

CREATE TABLE IF NOT EXISTS uae_pass_profiles (
  case_number        TEXT PRIMARY KEY,            -- = Application ID (link key)
  emirates_id        TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  full_name_ar       TEXT,
  phone              TEXT,                          -- UAE format: +9715XXXXXXXX
  marital_status     TEXT,                          -- 'single' | 'married'
  family_size        INTEGER DEFAULT 1,
  number_of_children INTEGER DEFAULT 0,
  social_status      TEXT DEFAULT 'none',           -- none | widow | orphan | senior | determination
  social_status_ar   TEXT,
  is_priority        BOOLEAN DEFAULT FALSE,         -- a priority/hardship social category (Brief G-06)
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uae_pass_emirates_id ON uae_pass_profiles (emirates_id);

-- The app only ever READS UAE PASS; lock the anon key to read-only.
ALTER TABLE uae_pass_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read uae_pass_profiles" ON uae_pass_profiles;
CREATE POLICY "public read uae_pass_profiles"
  ON uae_pass_profiles FOR SELECT
  TO anon, authenticated
  USING (true);
