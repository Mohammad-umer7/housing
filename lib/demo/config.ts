// Central switch for the portable "demo" mode.
//
// The app runs in one of two backends:
//   • REAL   — a Supabase project is configured (NEXT_PUBLIC_SUPABASE_URL set).
//   • DEMO   — no Supabase configured (or DEMO_DB=true forces it). The in-memory
//              mock store backs every data-layer call, so the whole system works
//              with zero external dependencies (self-contained demo / hackathon build).
//
// isDemoBackend() is the single gate lib/supabase.ts consults to pick the client.

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}

// Use the in-memory demo store when Supabase isn't configured, or when explicitly
// forced with DEMO_DB=true (lets you test demo mode even with real keys present).
export function isDemoBackend(): boolean {
  return process.env.DEMO_DB === 'true' || !isSupabaseConfigured()
}

// Demo-mode UX (one-click officer/admin login, UAE PASS persona picker). Explicitly
// enabled via DEMO_MODE, and implicitly ON whenever there's no real backend — so a
// keyless checkout still signs in and runs.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true' || isDemoBackend()
}

// A stable demo secret so session cookies can be signed even with no .env at all.
// Only used when SESSION_SECRET is unset (demo/dev). Production MUST set its own.
export const DEMO_SESSION_SECRET = 'saddad-demo-session-secret-not-for-production-0f3a9c7b1e5d'
