import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key
    )
  }
  return _supabaseAdmin
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop]
  }
})

// Best-effort: create the system_settings table if it doesn't exist yet.
// Called once at startup — silently no-ops if the table already exists or if
// the service-role key lacks DDL permissions (managed Supabase free tier).
let _settingsEnsured = false
export async function ensureSystemSettings(): Promise<void> {
  if (_settingsEnsured) return
  _settingsEnsured = true
  try {
    const admin = getSupabaseAdmin()
    // A select is cheaper than DDL — if it succeeds the table exists.
    const { error } = await admin.from('system_settings').select('key').limit(1)
    if (!error) return
    // Table missing — try to create it via rpc (requires pg_execute or similar).
    // On Supabase free tier this will fail silently; the data-layer functions are
    // already fail-open so the app works fine without the table.
    await admin.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`
    }).throwOnError()
  } catch { /* silently ignore — table creation is optional */ }
}

export type Applicant = {
  id: string
  case_number: string
  full_name: string
  full_name_ar: string
  emirates_id: string
  phone: string
  arrears_amount: number
  monthly_salary: number
  monthly_expenses: number
  property_address: string
  previous_default: boolean
  status: string
  created_at: string
}

export type Case = {
  id: string
  case_number: string
  applicant_id: string
  status: 'pending' | 'approved' | 'rejected' | 'escalated'
  decision_reason: string
  monthly_payment: number | null
  duration_months: number | null
  audit_log: string
  processed_at: string
  created_at: string
}
