// Client for DB-2 — the Document Authority (a SEPARATE Supabase project from the
// loan/applicants DB). Holds the authoritative salary-certificate registry that
// SADDAD verifies uploaded certificates against. Configured via its own env vars so
// the two systems of record stay genuinely independent.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function isDocRegistryConfigured(): boolean {
  return Boolean(process.env.DOC_REGISTRY_SUPABASE_URL && process.env.DOC_REGISTRY_SUPABASE_KEY)
}

export function getDocRegistry(): SupabaseClient | null {
  if (!isDocRegistryConfigured()) return null
  if (!_client) {
    _client = createClient(
      process.env.DOC_REGISTRY_SUPABASE_URL!,
      process.env.DOC_REGISTRY_SUPABASE_KEY!,
    )
  }
  return _client
}
