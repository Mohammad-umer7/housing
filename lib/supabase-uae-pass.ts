// Client for DB-3 — UAE PASS (a SEPARATE Supabase project from the loan/applicants
// DB). Holds the federal identity + social-status registry that SADDAD retrieves a
// beneficiary's verified identity, family, and social situation from. Configured via
// its own env vars so the two systems of record stay genuinely independent — exactly
// like the brief's "assume the AI Agent can access UAE PASS" challenge assumption.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function isUaePassConfigured(): boolean {
  return Boolean(process.env.UAE_PASS_SUPABASE_URL && process.env.UAE_PASS_SUPABASE_KEY)
}

export function getUaePass(): SupabaseClient | null {
  if (!isUaePassConfigured()) return null
  if (!_client) {
    _client = createClient(
      process.env.UAE_PASS_SUPABASE_URL!,
      process.env.UAE_PASS_SUPABASE_KEY!,
    )
  }
  return _client
}
