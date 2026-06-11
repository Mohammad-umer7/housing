import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase not configured.')
  return supabase
}
