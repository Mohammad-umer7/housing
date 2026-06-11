-- ============================================================================
-- MOE Strategist – Full Database Schema
-- AI-Powered Global Country Intelligence Platform
-- Run this in the Supabase SQL Editor (in order)
-- ============================================================================

-- ── 0. Extensions ────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "vector";          -- pgvector for RAG embeddings
create extension if not exists "pg_trgm";         -- trigram for fast text search

-- ── 1. User Profiles ─────────────────────────────────────────────────────────

create table if not exists public.user_profiles (
  id              uuid primary key default uuid_generate_v4(),
  auth_user_id    uuid references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text,
  role            text not null default 'analyst'
                    check (role in ('analyst', 'minister', 'admin', 'viewer')),
  ministry_dept   text,                           -- e.g. "Energy Planning", "International Relations"
  avatar_url      text,
  language_pref   text not null default 'en'
                    check (language_pref in ('en', 'ar')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 2. Countries (Master Table) ───────────────────────────────────────────────

create table if not exists public.countries (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,           -- ISO 3166-1 alpha-3 e.g. 'NOR'
  code_2          text not null unique,           -- ISO 3166-1 alpha-2 e.g. 'NO'
  name            text not null,
  name_ar         text,
  flag_emoji      text,
  region          text,                           -- e.g. 'Europe', 'Middle East', 'Asia'
  sub_region      text,
  energy_minister text,
  energy_minister_ar text,
  primary_energy  text,                           -- e.g. '88% Hydro'
  net_zero_target integer,                        -- year e.g. 2050
  credit_rating   text,                           -- e.g. 'AAA', 'A1/A+'
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 3. Country Metrics (Time-Series Economic Data) ────────────────────────────

create table if not exists public.country_metrics (
  id                        uuid primary key default uuid_generate_v4(),
  country_id                uuid not null references public.countries(id) on delete cascade,
  metric_year               integer not null,
  gdp_usd_billions          numeric(14, 2),
  gdp_growth_pct            numeric(6, 3),
  inflation_rate_pct        numeric(6, 3),
  unemployment_rate_pct     numeric(6, 3),
  trade_uae_usd_billions    numeric(14, 2),
  fdi_inflows_usd_billions  numeric(14, 2),
  renewable_energy_pct      numeric(6, 2),
  co2_emissions_mt          numeric(14, 2),
  population_millions       numeric(10, 3),
  source                    text default 'manual',   -- 'manual','worldbank','imf','live'
  created_at                timestamptz not null default now(),
  unique (country_id, metric_year)
);

-- ── 4. Bilateral Agreements ────────────────────────────────────────────────────

create table if not exists public.bilateral_agreements (
  id              uuid primary key default uuid_generate_v4(),
  country_id      uuid not null references public.countries(id) on delete cascade,
  title           text not null,
  title_ar        text,
  agreement_type  text not null
                    check (agreement_type in (
                      'MOU', 'Treaty', 'Framework', 'JointDeclaration',
                      'CEPA', 'DefenceAgreement', 'EnergyPact', 'Other'
                    )),
  signed_date     date,
  expiry_date     date,
  status          text not null default 'active'
                    check (status in ('active', 'expired', 'under_negotiation', 'suspended')),
  key_sectors     text[],                         -- e.g. {'Energy','Trade','Technology'}
  summary         text,
  full_text       text,
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 5. Ministry Documents (for RAG ingestion) ─────────────────────────────────

create table if not exists public.ministry_documents (
  id              uuid primary key default uuid_generate_v4(),
  uploaded_by     uuid references public.user_profiles(id) on delete set null,
  country_id      uuid references public.countries(id) on delete set null,
  document_name   text not null,
  document_type   text not null default 'report'
                    check (document_type in (
                      'briefing', 'report', 'transcript', 'press_release',
                      'policy', 'agreement', 'research', 'other'
                    )),
  content_text    text,                           -- extracted raw text (OCR / PDF)
  file_url        text,                           -- Supabase Storage URL
  language        text default 'en'
                    check (language in ('en', 'ar', 'both')),
  classification  text default 'internal'
                    check (classification in ('public', 'internal', 'confidential', 'restricted')),
  metadata        jsonb default '{}'::jsonb,      -- arbitrary extra fields
  is_embedded     boolean not null default false, -- true once vectors are stored
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 6. Document Embeddings (pgvector RAG Core) ────────────────────────────────

create table if not exists public.document_embeddings (
  id              uuid primary key default uuid_generate_v4(),
  document_id     uuid not null references public.ministry_documents(id) on delete cascade,
  chunk_index     integer not null,               -- chunk position within document
  chunk_text      text not null,                  -- the text fragment that was embedded
  embedding       vector(1536) not null,          -- OpenAI text-embedding-3-small
  token_count     integer,
  created_at      timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- ── 7. Intelligence Sessions (MIRA audit log) ────────────────────────────────

create table if not exists public.intelligence_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_email      text,
  capability      text not null
                    check (capability in (
                      'profile', 'insights', 'briefing', 'search',
                      'predict', 'comparison'
                    )),
  phase           text not null default 'standard'
                    check (phase in ('alert', 'urgent', 'standard', 'research')),
  language        text not null default 'en'
                    check (language in ('en', 'ar')),
  country_code    text,
  country_code_2  text,                           -- for comparison mode
  query_text      text,
  response_sections jsonb,                        -- full structured output
  agent_log       text[],                         -- terminal lines captured
  tokens_used     integer,
  latency_ms      integer,
  groq_model      text,
  rag_chunks_used integer default 0,
  created_at      timestamptz not null default now()
);

-- ── 8. Live Metrics Cache (WebSocket tick store) ──────────────────────────────

create table if not exists public.live_metrics_cache (
  id              uuid primary key default uuid_generate_v4(),
  country_id      uuid references public.countries(id) on delete cascade,
  ts              timestamptz not null default now(),
  seq             integer,
  gdp_raw         numeric(14, 4),
  gdp_ema         numeric(14, 4),
  trade_vol       numeric(14, 4),
  inflation       numeric(8, 4),
  sustain_score   numeric(6, 4),
  cagr_1yr        numeric(8, 6),
  latency_ms      integer,
  source          text default 'mock'
                    check (source in ('mock', 'worldbank', 'imf', 'bloomberg'))
);

-- ── 9. Processing Sessions (existing, kept for backward compat) ───────────────

create table if not exists public.processing_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_email      text,
  session_type    text not null
                    check (session_type in ('scenario', 'economic', 'meeting', 'upload')),
  status          text not null default 'pending'
                    check (status in ('pending', 'processing', 'complete', 'error')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.scenario_inputs (
  id                          uuid primary key default uuid_generate_v4(),
  session_id                  uuid references public.processing_sessions(id) on delete cascade,
  trade_volumes               jsonb,
  gdp_growth_rates            jsonb,
  infrastructure_investments  jsonb,
  news_articles               text,
  press_releases              text,
  diplomatic_transcripts      text,
  policy_announcements        text,
  created_at                  timestamptz not null default now()
);

create table if not exists public.economic_inputs (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid references public.processing_sessions(id) on delete cascade,
  country         text,
  year_from       integer,
  year_to         integer,
  gdp             numeric(14, 2),
  trade_balance   numeric(14, 2),
  inflation_rate  numeric(6, 3),
  fdi_inflows     numeric(14, 2),
  created_at      timestamptz not null default now()
);

create table if not exists public.meeting_concierge (
  id                  uuid primary key default uuid_generate_v4(),
  session_id          uuid references public.processing_sessions(id) on delete cascade,
  meeting_date        date,
  meeting_time        time,
  attendees           jsonb,
  country_of_interest text,
  bilateral_summaries text,
  created_at          timestamptz not null default now()
);

create table if not exists public.processing_results (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid references public.processing_sessions(id) on delete cascade,
  result_type     text,
  result_data     jsonb,
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Trigram index for fast country name search
create index if not exists idx_countries_name_trgm
  on public.countries using gin (name gin_trgm_ops);

-- pgvector HNSW index for fast approximate nearest-neighbour search
-- HNSW is faster at query time than IVFFlat (better for <1M rows)
create index if not exists idx_document_embeddings_vector
  on public.document_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Composite index for time-series queries
create index if not exists idx_country_metrics_country_year
  on public.country_metrics (country_id, metric_year desc);

-- Index for bilateral agreement lookups
create index if not exists idx_bilateral_country_status
  on public.bilateral_agreements (country_id, status);

-- Index for live cache time queries
create index if not exists idx_live_metrics_ts
  on public.live_metrics_cache (country_id, ts desc);

-- Index for intelligence session history
create index if not exists idx_intel_sessions_user
  on public.intelligence_sessions (user_email, created_at desc);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create or replace trigger trg_countries_updated_at
  before update on public.countries
  for each row execute function public.handle_updated_at();

create or replace trigger trg_bilateral_updated_at
  before update on public.bilateral_agreements
  for each row execute function public.handle_updated_at();

create or replace trigger trg_documents_updated_at
  before update on public.ministry_documents
  for each row execute function public.handle_updated_at();

create or replace trigger trg_processing_sessions_updated_at
  before update on public.processing_sessions
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.user_profiles          enable row level security;
alter table public.countries              enable row level security;
alter table public.country_metrics        enable row level security;
alter table public.bilateral_agreements   enable row level security;
alter table public.ministry_documents     enable row level security;
alter table public.document_embeddings    enable row level security;
alter table public.intelligence_sessions  enable row level security;
alter table public.live_metrics_cache     enable row level security;
alter table public.processing_sessions    enable row level security;
alter table public.scenario_inputs        enable row level security;
alter table public.economic_inputs        enable row level security;
alter table public.meeting_concierge      enable row level security;
alter table public.processing_results     enable row level security;

-- Public read on reference tables (countries, metrics, bilateral)
create policy "Public read countries"
  on public.countries for select using (true);

create policy "Public read country_metrics"
  on public.country_metrics for select using (true);

create policy "Public read bilateral_agreements"
  on public.bilateral_agreements for select using (true);

-- Authenticated users can read documents
create policy "Auth read documents"
  on public.ministry_documents for select
  using (auth.role() = 'authenticated');

-- Authenticated users can insert documents
create policy "Auth insert documents"
  on public.ministry_documents for insert
  with check (auth.role() = 'authenticated');

-- Authenticated users can read embeddings
create policy "Auth read embeddings"
  on public.document_embeddings for select
  using (auth.role() = 'authenticated');

-- Service role can do everything (used by Python backend)
create policy "Service role all documents"
  on public.ministry_documents for all
  using (auth.role() = 'service_role');

create policy "Service role all embeddings"
  on public.document_embeddings for all
  using (auth.role() = 'service_role');

create policy "Service role all live_metrics"
  on public.live_metrics_cache for all
  using (auth.role() = 'service_role');

-- Intelligence sessions: users see only their own
create policy "Own intel sessions"
  on public.intelligence_sessions for all
  using (user_email = auth.jwt() ->> 'email');

-- Admin bypass policy (using custom claim)
create policy "Admin all access"
  on public.ministry_documents for all
  using ((auth.jwt() ->> 'role') = 'admin');
