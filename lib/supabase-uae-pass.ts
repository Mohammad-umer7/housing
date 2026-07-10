// Client for DB-3 — UAE PASS (a SEPARATE Supabase project from the loan/applicants
// DB). Holds the federal identity + social-status registry that SADDAD retrieves a
// beneficiary's verified identity, family, and social situation from. Configured via
// its own env vars so the two systems of record stay genuinely independent — exactly
// like the brief's "assume the AI Agent can access UAE PASS" challenge assumption.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { isDemoBackend } from './demo/config'
import { getMockSupabase } from './demo/mock-supabase'

let _client: SupabaseClient | null = null

export function isUaePassConfigured(): boolean {
  // In demo mode the mock store carries seeded uae_pass_profiles, so treat it as
  // configured — the identity/social-status signal (G-06 priority) works keyless.
  return isDemoBackend() || Boolean(process.env.UAE_PASS_SUPABASE_URL && process.env.UAE_PASS_SUPABASE_KEY)
}

export function getUaePass(): SupabaseClient | null {
  if (isDemoBackend()) return getMockSupabase() as unknown as SupabaseClient
  if (!process.env.UAE_PASS_SUPABASE_URL || !process.env.UAE_PASS_SUPABASE_KEY) return null
  if (!_client) {
    _client = createClient(
      process.env.UAE_PASS_SUPABASE_URL!,
      process.env.UAE_PASS_SUPABASE_KEY!,
    )
  }
  return _client
}
