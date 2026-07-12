// Central switch for the portable "demo" mode.
//
// The app runs in one of two backends:
//   • REAL   — a real Supabase project is used (must be EXPLICITLY opted into).
//   • DEMO   — the in-memory mock store backs every data-layer call, so the whole
//              system works with zero external dependencies (self-contained demo /
//              hackathon build). This is the DEFAULT unless you opt into the real DB.
//
// isDemoBackend() is the single gate lib/supabase.ts consults to pick the client.
//
// Why demo is the default: this build is deployed as a public demo (Vercel), where the
// real Supabase project may be paused/unreachable. Requiring an explicit opt-in for the
// real DB means the demo "just works" everywhere without extra env-var wiring. To use a
// real Supabase project, set DEMO_DB=false (and configure the SUPABASE_* keys).

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}

// The in-memory demo store is used UNLESS the real DB is explicitly opted into.
// Opt into the real Supabase project with DEMO_DB=false (or USE_REAL_DB=true) AND
// real SUPABASE_* keys present. Any demo flag, or DEMO_DB=true, or no keys → demo.
export function isDemoBackend(): boolean {
  // Explicit opt-out — use the real Supabase project (only honoured if keys exist).
  if ((process.env.DEMO_DB === 'false' || process.env.USE_REAL_DB === 'true') && isSupabaseConfigured()) {
    return false
  }
  // Otherwise the demo mock backs everything.
  return true
}

// Demo-mode UX (one-click officer/admin login, UAE PASS persona picker). ON whenever
// the demo backend is active (which is the default), or when DEMO_MODE is set.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true' || isDemoBackend()
}

// A stable demo secret so session cookies can be signed even with no .env at all.
// Only used when SESSION_SECRET is unset (demo/dev). Production MUST set its own.
export const DEMO_SESSION_SECRET = 'saddad-demo-session-secret-not-for-production-0f3a9c7b1e5d'
