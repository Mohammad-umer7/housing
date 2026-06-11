-- ============================================================================
-- MOE Strategist – pgvector RAG Functions
-- Run AFTER schema.sql
-- ============================================================================

-- ── 1. Semantic similarity search ────────────────────────────────────────────
-- Called by the Python RAG Analyst Agent with the query embedding.
-- Returns the most relevant document chunks with metadata.

create or replace function public.match_documents (
  query_embedding   vector(1536),
  match_count       int     default 5,
  filter_country    text    default null,   -- optional ISO-3 country code filter
  filter_doc_type   text    default null,   -- optional document_type filter
  min_similarity    float   default 0.70    -- cosine similarity threshold (0-1)
)
returns table (
  chunk_id        uuid,
  document_id     uuid,
  document_name   text,
  document_type   text,
  country_code    text,
  chunk_index     int,
  chunk_text      text,
  similarity      float
)
language sql stable as $$
  select
    de.id                     as chunk_id,
    de.document_id,
    md.document_name,
    md.document_type,
    c.code                    as country_code,
    de.chunk_index,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) as similarity
  from public.document_embeddings de
  join public.ministry_documents md on md.id = de.document_id
  left join public.countries c on c.id = md.country_id
  where
    (filter_country is null or c.code = filter_country)
    and (filter_doc_type is null or md.document_type = filter_doc_type)
    and 1 - (de.embedding <=> query_embedding) >= min_similarity
  order by de.embedding <=> query_embedding
  limit match_count;
$$;

-- ── 2. Country context bundle ─────────────────────────────────────────────────
-- One-call function that returns everything the LLM needs about a country:
-- latest metrics + active bilateral agreements + recent document chunks.

create or replace function public.get_country_context (
  p_country_code    text,
  query_embedding   vector(1536) default null,
  doc_chunk_count   int          default 3
)
returns jsonb
language plpgsql stable as $$
declare
  v_country_id  uuid;
  v_result      jsonb;
  v_metrics     jsonb;
  v_agreements  jsonb;
  v_doc_chunks  jsonb;
begin
  -- Resolve country
  select id into v_country_id
  from public.countries
  where code = upper(p_country_code) or code_2 = upper(p_country_code)
  limit 1;

  if v_country_id is null then
    return jsonb_build_object('error', 'Country not found: ' || p_country_code);
  end if;

  -- Latest metrics
  select jsonb_build_object(
    'year',             metric_year,
    'gdp_usd_billions', gdp_usd_billions,
    'gdp_growth_pct',   gdp_growth_pct,
    'inflation_pct',    inflation_rate_pct,
    'trade_uae_bn',     trade_uae_usd_billions,
    'renewable_pct',    renewable_energy_pct,
    'co2_mt',           co2_emissions_mt
  ) into v_metrics
  from public.country_metrics
  where country_id = v_country_id
  order by metric_year desc
  limit 1;

  -- Active bilateral agreements
  select jsonb_agg(jsonb_build_object(
    'title',   title,
    'type',    agreement_type,
    'signed',  signed_date,
    'sectors', key_sectors,
    'summary', summary
  )) into v_agreements
  from public.bilateral_agreements
  where country_id = v_country_id and status = 'active'
  order by signed_date desc
  limit 10;

  -- Relevant document chunks (if embedding provided)
  if query_embedding is not null then
    select jsonb_agg(jsonb_build_object(
      'source',     document_name,
      'type',       document_type,
      'chunk',      chunk_text,
      'similarity', similarity
    )) into v_doc_chunks
    from public.match_documents(query_embedding, doc_chunk_count, upper(p_country_code));
  end if;

  return jsonb_build_object(
    'country_code', upper(p_country_code),
    'metrics',      coalesce(v_metrics, '{}'::jsonb),
    'agreements',   coalesce(v_agreements, '[]'::jsonb),
    'rag_chunks',   coalesce(v_doc_chunks, '[]'::jsonb)
  );
end;
$$;

-- ── 3. Live metrics upsert helper ─────────────────────────────────────────────
-- Called by the Python WebSocket Ingestion Agent on each tick.

create or replace function public.upsert_live_tick (
  p_country_code  text,
  p_seq           integer,
  p_gdp_raw       numeric,
  p_gdp_ema       numeric,
  p_trade_vol     numeric,
  p_inflation     numeric,
  p_sustain       numeric,
  p_cagr          numeric,
  p_latency_ms    integer,
  p_source        text default 'mock'
)
returns uuid
language plpgsql as $$
declare
  v_country_id uuid;
  v_id         uuid;
begin
  select id into v_country_id
  from public.countries
  where code = upper(p_country_code) or code_2 = upper(p_country_code)
  limit 1;

  insert into public.live_metrics_cache
    (country_id, seq, gdp_raw, gdp_ema, trade_vol, inflation,
     sustain_score, cagr_1yr, latency_ms, source)
  values
    (v_country_id, p_seq, p_gdp_raw, p_gdp_ema, p_trade_vol, p_inflation,
     p_sustain, p_cagr, p_latency_ms, p_source)
  returning id into v_id;

  -- Keep only last 200 ticks per country to prevent unbounded growth
  delete from public.live_metrics_cache
  where country_id = v_country_id
    and id not in (
      select id from public.live_metrics_cache
      where country_id = v_country_id
      order by ts desc
      limit 200
    );

  return v_id;
end;
$$;

-- ── 4. Session intelligence summary ──────────────────────────────────────────

create or replace function public.get_session_stats (
  p_user_email text,
  p_days       int default 30
)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'total_sessions',   count(*),
    'top_country',      mode() within group (order by country_code),
    'top_capability',   mode() within group (order by capability),
    'avg_latency_ms',   round(avg(latency_ms)::numeric, 0),
    'total_tokens',     sum(tokens_used),
    'rag_chunks_used',  sum(rag_chunks_used)
  )
  from public.intelligence_sessions
  where user_email = p_user_email
    and created_at >= now() - (p_days || ' days')::interval;
$$;
