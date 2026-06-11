'use client'
// ============================================================================
// MOE Strategist – RAG (Retrieval-Augmented Generation) Client Operations
//
// This module provides all Supabase interactions for the RAG pipeline:
//  1. Inserting documents + embeddings
//  2. Similarity search (match_documents RPC)
//  3. Country context retrieval (get_country_context RPC)
//  4. Intelligence session logging
//  5. Live metrics persistence
// ============================================================================

import { supabase as supabaseClient, isSupabaseConfigured } from './supabase'
const supabase = supabaseClient as any
import type {
  MinistryDocument,
  DocumentEmbedding,
  MatchDocumentsRow,
  CountryContextResult,
  IntelligenceSession,
  IntelCapability,
  IntelPhase,
  LanguagePref,
  DocumentType,
  Classification,
  SessionStats,
} from '@/types/database'

// ── Constants ────────────────────────────────────────────────────────────────

// Chunk size for splitting documents before embedding
export const CHUNK_SIZE      = 800    // characters per chunk
export const CHUNK_OVERLAP   = 100    // overlap between consecutive chunks
export const EMBEDDING_DIM   = 1536   // OpenAI text-embedding-3-small
export const DEFAULT_TOP_K   = 5      // default number of RAG chunks to retrieve
export const MIN_SIMILARITY  = 0.70   // minimum cosine similarity threshold

// ── Text Chunking ─────────────────────────────────────────────────────────────

/**
 * Split a long text into overlapping chunks for embedding.
 * Uses sentence-aware boundaries where possible.
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // Try to break at sentence boundary within last 200 chars of chunk
    if (end < text.length) {
      const boundary = text.lastIndexOf('. ', end)
      if (boundary > start + chunkSize - 200) {
        end = boundary + 1
      }
    }

    chunks.push(text.slice(start, Math.min(end, text.length)).trim())
    start = end - overlap
  }

  return chunks.filter(c => c.length > 20) // discard tiny trailing chunks
}

// ── Document Ingestion ────────────────────────────────────────────────────────

export interface IngestDocumentOptions {
  documentName:   string
  documentType:   DocumentType
  contentText:    string
  countryCode?:   string           // ISO-3 code, e.g. 'NOR'
  uploadedBy?:    string           // user_profile id
  language?:      LanguagePref | 'both'
  classification?: Classification
  metadata?:      Record<string, unknown>
  fileUrl?:       string
}

export interface IngestResult {
  documentId:  string | null
  chunksCount: number
  error:       string | null
}

/**
 * Save document text to ministry_documents.
 * Embedding is handled by the Python backend (POST /api/embed).
 * This function only stores the raw text — the backend will call
 * upsertEmbeddingChunks() after generating embeddings via Groq/OpenAI.
 */
export async function ingestDocument(opts: IngestDocumentOptions): Promise<IngestResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { documentId: null, chunksCount: 0, error: 'Supabase not configured' }
  }

  // Resolve country_id from code if provided
  let countryId: string | null = null
  if (opts.countryCode) {
    const { data: country } = (await supabase
      .from('countries')
      .select('id')
      .eq('code', opts.countryCode.toUpperCase())
      .single()) as any
    countryId = country?.id ?? null
  }

  // Insert document record
  const { data: doc, error: docError } = await supabase
    .from('ministry_documents')
    .insert({
      document_name:  opts.documentName,
      document_type:  opts.documentType,
      content_text:   opts.contentText,
      country_id:     countryId,
      uploaded_by:    opts.uploadedBy ?? null,
      language:       opts.language ?? 'en',
      classification: opts.classification ?? 'internal',
      metadata:       opts.metadata ?? {},
      file_url:       opts.fileUrl ?? null,
      is_embedded:    false,
    })
    .select('id')
    .single()

  if (docError || !doc) {
    return { documentId: null, chunksCount: 0, error: docError?.message ?? 'Insert failed' }
  }

  const chunks = chunkText(opts.contentText)
  return { documentId: doc.id, chunksCount: chunks.length, error: null }
}

// ── Embedding Upsert (called by Python backend result) ────────────────────────

export interface EmbeddingChunk {
  chunkIndex:  number
  chunkText:   string
  embedding:   number[]  // float32 array of dim 1536
  tokenCount?: number
}

/**
 * Store pre-computed embedding vectors for a document.
 * Called after the Python backend has run OpenAI embeddings.
 */
export async function upsertEmbeddingChunks(
  documentId: string,
  chunks: EmbeddingChunk[]
): Promise<{ count: number; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { count: 0, error: 'Supabase not configured' }
  }

  const rows: Omit<DocumentEmbedding, 'id' | 'created_at'>[] = chunks.map(c => ({
    document_id: documentId,
    chunk_index: c.chunkIndex,
    chunk_text:  c.chunkText,
    embedding:   c.embedding,
    token_count: c.tokenCount ?? null,
  }))

  const { error } = await supabase
    .from('document_embeddings')
    .upsert(rows, { onConflict: 'document_id,chunk_index' })

  if (error) return { count: 0, error: error.message }

  // Mark document as embedded
  await supabase
    .from('ministry_documents')
    .update({ is_embedded: true })
    .eq('id', documentId)

  return { count: rows.length, error: null }
}

// ── Similarity Search ─────────────────────────────────────────────────────────

export interface SearchOptions {
  queryEmbedding: number[]
  topK?:          number
  countryCode?:   string | null
  docType?:       string | null
  minSimilarity?: number
}

/**
 * Find the most semantically similar document chunks.
 * queryEmbedding must be generated by the same model (dim=1536).
 */
export async function searchDocuments(
  opts: SearchOptions
): Promise<{ results: MatchDocumentsRow[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { results: [], error: 'Supabase not configured' }
  }

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding:  opts.queryEmbedding,
    match_count:      opts.topK      ?? DEFAULT_TOP_K,
    filter_country:   opts.countryCode ?? null,
    filter_doc_type:  opts.docType   ?? null,
    min_similarity:   opts.minSimilarity ?? MIN_SIMILARITY,
  })

  if (error) return { results: [], error: error.message }
  return { results: (data as MatchDocumentsRow[]) ?? [], error: null }
}

// ── Country Context (RAG bundle for LLM) ──────────────────────────────────────

/**
 * Get a complete country intelligence context bundle.
 * Used by MIRA before passing context to the Groq LLM.
 */
export async function getCountryContext(
  countryCode: string,
  queryEmbedding?: number[]
): Promise<{ context: CountryContextResult | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { context: null, error: 'Supabase not configured' }
  }

  const { data, error } = await supabase.rpc('get_country_context', {
    p_country_code:  countryCode.toUpperCase(),
    query_embedding: queryEmbedding ?? null,
    doc_chunk_count: DEFAULT_TOP_K,
  })

  if (error) return { context: null, error: error.message }
  return { context: data as CountryContextResult, error: null }
}

// ── Countries Lookup ──────────────────────────────────────────────────────────

/**
 * Fetch all active countries with latest metrics.
 */
export async function getCountries() {
  if (!isSupabaseConfigured || !supabase) return { data: [], error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('countries')
    .select(`
      *,
      country_metrics (
        metric_year, gdp_usd_billions, gdp_growth_pct,
        trade_uae_usd_billions, renewable_energy_pct
      )
    `)
    .eq('is_active', true)
    .order('name')

  return { data: data ?? [], error: error?.message ?? null }
}

/**
 * Fetch bilateral agreements for a country.
 */
export async function getBilateralAgreements(countryCode: string) {
  if (!isSupabaseConfigured || !supabase) return { data: [], error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('bilateral_agreements')
    .select('*, countries!inner(code)')
    .eq('countries.code', countryCode.toUpperCase())
    .eq('status', 'active')
    .order('signed_date', { ascending: false })

  return { data: data ?? [], error: error?.message ?? null }
}

// ── Intelligence Session Logging ──────────────────────────────────────────────

export interface LogSessionOptions {
  userEmail?:        string
  capability:        IntelCapability
  phase:             IntelPhase
  language:          LanguagePref
  countryCode?:      string
  countryCode2?:     string
  queryText?:        string
  responseSections?: Record<string, unknown>
  agentLog?:         string[]
  tokensUsed?:       number
  latencyMs?:        number
  groqModel?:        string
  ragChunksUsed?:    number
}

/**
 * Persist a MIRA intelligence session for audit and analytics.
 */
export async function logIntelligenceSession(
  opts: LogSessionOptions
): Promise<{ id: string | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { id: null, error: 'Supabase not configured' }
  }

  const row: Omit<IntelligenceSession, 'id' | 'created_at'> = {
    user_email:        opts.userEmail ?? null,
    capability:        opts.capability,
    phase:             opts.phase,
    language:          opts.language,
    country_code:      opts.countryCode ?? null,
    country_code_2:    opts.countryCode2 ?? null,
    query_text:        opts.queryText ?? null,
    response_sections: opts.responseSections ?? null,
    agent_log:         opts.agentLog ?? null,
    tokens_used:       opts.tokensUsed ?? null,
    latency_ms:        opts.latencyMs ?? null,
    groq_model:        opts.groqModel ?? null,
    rag_chunks_used:   opts.ragChunksUsed ?? 0,
  }

  const { data, error } = await supabase
    .from('intelligence_sessions')
    .insert(row)
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data?.id ?? null, error: null }
}

/**
 * Get session analytics for a user.
 */
export async function getSessionStats(
  userEmail: string,
  days = 30
): Promise<{ stats: SessionStats | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { stats: null, error: 'Supabase not configured' }
  }

  const { data, error } = await supabase.rpc('get_session_stats', {
    p_user_email: userEmail,
    p_days:       days,
  })

  if (error) return { stats: null, error: error.message }
  return { stats: data as SessionStats, error: null }
}

// ── Live Metrics ──────────────────────────────────────────────────────────────

/**
 * Fetch the last N ticks for a country from the live cache.
 */
export async function getLiveTicks(countryCode: string, limit = 20) {
  if (!isSupabaseConfigured || !supabase) return { data: [], error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('live_metrics_cache')
    .select('*, countries!inner(code)')
    .eq('countries.code', countryCode.toUpperCase())
    .order('ts', { ascending: false })
    .limit(limit)

  return { data: data ?? [], error: error?.message ?? null }
}

// ── Uploaded Documents List ───────────────────────────────────────────────────

export async function getDocuments(countryCode?: string) {
  if (!isSupabaseConfigured || !supabase) return { data: [], error: 'Supabase not configured' }

  let query = supabase
    .from('ministry_documents')
    .select('id, document_name, document_type, language, classification, is_embedded, created_at, countries(code, name, flag_emoji)')
    .order('created_at', { ascending: false })

  if (countryCode) {
    query = query.eq('countries.code', countryCode.toUpperCase())
  }

  const { data, error } = await query
  return { data: data ?? [], error: error?.message ?? null }
}
