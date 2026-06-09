// UAE PASS PORT (DB-3) — the federal identity + social-status system of record.
//
// This is the third system SADDAD *consumes*. In production it is UAE PASS exposing
// the beneficiary's verified identity, family, and social situation; you present the
// Application ID (or Emirates ID) and it returns the profile. Here it is backed by a
// separate Supabase project (lib/supabase-uae-pass) so the prototype runs end-to-end.
// Swapping to the real UAE PASS API means replacing `lookupUaePassProfile` — nothing
// else changes. The brief's §4/§7 ask the agent to "analyse the beneficiary's income,
// family status, and social situation"; this port supplies the family + social signal.

import { getUaePass, isUaePassConfigured } from '@/lib/supabase-uae-pass'

export { isUaePassConfigured }

// The four priority/hardship social categories the brief routes to fast-track human
// care (G-06): widow, orphan, senior/retiree, person of determination. Anyone else
// is 'none' (a regular beneficiary), handled by the automated pipeline.
export type SocialStatus = 'none' | 'widow' | 'orphan' | 'senior' | 'determination'

export const PRIORITY_SOCIAL_STATUSES: ReadonlySet<SocialStatus> = new Set([
  'widow', 'orphan', 'senior', 'determination',
])

export const SOCIAL_STATUS_LABELS: Record<SocialStatus, { en: string; ar: string }> = {
  none: { en: 'Regular beneficiary', ar: 'مستفيد عادي' },
  widow: { en: 'Widow', ar: 'أرملة' },
  orphan: { en: 'Orphan', ar: 'يتيم' },
  senior: { en: 'Senior / Retiree', ar: 'كبار المواطنين / متقاعد' },
  determination: { en: 'Person of Determination', ar: 'أصحاب الهمم' },
}

export function isPrioritySocialStatus(status: string | null | undefined): boolean {
  return PRIORITY_SOCIAL_STATUSES.has(String(status ?? '') as SocialStatus)
}

export type UaePassProfile = {
  case_number: string
  emirates_id: string
  full_name: string
  full_name_ar: string | null
  phone: string | null
  marital_status: string | null
  family_size: number
  number_of_children: number
  social_status: SocialStatus
  social_status_ar: string | null
  is_priority: boolean
}

// Retrieve a beneficiary's UAE PASS profile by Application ID (the link key SADDAD
// already holds). Returns the profile or null (no record / UAE PASS unreachable —
// callers fall back to the Programme record so the pipeline never hard-fails).
export async function lookupUaePassProfile(
  caseNumber: string | null
): Promise<UaePassProfile | null> {
  const id = String(caseNumber ?? '').trim()
  if (!id) return null
  const db = getUaePass()
  if (!db) return null
  const fetchOne = async (cn: string) => {
    const { data, error } = await db.from('uae_pass_profiles').select('*').eq('case_number', cn).maybeSingle()
    if (error) { console.error('[uae-pass] lookup error:', error.message); return null }
    return (data as UaePassProfile | null) ?? null
  }
  let profile = await fetchOne(id)
  // A re-submission case number ("…-rN") resolves to the base Application ID's profile.
  if (!profile) {
    const base = id.replace(/-r\d+$/i, '')
    if (base !== id) profile = await fetchOne(base)
  }
  return profile
}
