// Seeds DB-3 (UAE PASS) — the federal identity + social-status registry.
//
// Reads the live applicants from DB-1 (so the identity fields — name, Emirates ID,
// phone, family size, marital status — stay IDENTICAL to what the loan record shows)
// and derives, stably per Application ID, the two UAE-PASS-only fields the brief asks
// the agent to analyse for differentiated handling:
//   • number_of_children
//   • social_status  — none | widow | orphan | senior | determination (G-06 priority)
//
// Run: node tools/seed-uae-pass.mjs            -> writes supabase/uae-pass-profiles.json
// Run: node tools/seed-uae-pass.mjs --apply    -> writes directly to DB-3
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const applyDirectly = process.argv.includes('--apply')

const env = readFileSync('.env.local', 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1] ?? '').trim()

const { createClient } = require('@supabase/supabase-js')

// DB-1 (loan/applicants) — source of the identity fields, read with the service key.
const db1Url = get('NEXT_PUBLIC_SUPABASE_URL')
const db1Key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!db1Url || !db1Key) throw new Error('Missing DB-1 Supabase creds in .env.local')
const db1 = createClient(db1Url, db1Key)

// ── deterministic, stable-per-ID generators ──────────────────────────────────
function hashInt(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}

const SOCIAL_AR = {
  none: 'مستفيد عادي',
  widow: 'أرملة',
  orphan: 'يتيم',
  senior: 'كبار المواطنين / متقاعد',
  determination: 'أصحاب الهمم',
}

// Stable social-status distribution: ~70% regular, the rest spread across the four
// priority/hardship categories so G-06 fast-tracking is exercised for a meaningful
// minority (not everyone) — keyed off a salted hash so it never changes for an ID.
function socialStatusFor(caseNumber) {
  const b = hashInt(`${caseNumber}:social`) % 100
  if (b < 70) return 'none'
  if (b < 78) return 'widow'        // 8%
  if (b < 85) return 'orphan'       // 7%
  if (b < 93) return 'senior'       // 8%
  return 'determination'            // 7%
}

function childrenFor(familySize, maritalStatus) {
  const size = Math.max(1, Math.floor(Number(familySize) || 1))
  const base = maritalStatus === 'married' ? 2 : 1 // self (+ spouse) before children
  return Math.max(0, size - base)
}

// ── Read every applicant from DB-1 (paginated past the 1000-row default) ──────
async function fetchAllApplicants() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db1
      .from('applicants')
      .select('case_number, full_name, full_name_ar, emirates_id, phone, family_size, marital_status')
      .order('case_number', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`DB-1 read error: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const applicants = await fetchAllApplicants()

const profiles = applicants.map((a) => {
  const caseNumber = String(a.case_number)
  const familySize = Math.max(1, Math.floor(Number(a.family_size) || 1))
  const marital = String(a.marital_status || (familySize > 1 ? 'married' : 'single'))
  const social = socialStatusFor(caseNumber)
  // A senior with no spouse reads as 'single'; otherwise keep the loan record's status.
  return {
    case_number: caseNumber,
    emirates_id: String(a.emirates_id ?? ''),
    full_name: String(a.full_name ?? ''),
    full_name_ar: a.full_name_ar ?? null,
    phone: a.phone ?? null,
    marital_status: marital,
    family_size: familySize,
    number_of_children: childrenFor(familySize, marital),
    social_status: social,
    social_status_ar: SOCIAL_AR[social],
    is_priority: social !== 'none',
  }
})

const counts = profiles.reduce((m, p) => ((m[p.social_status] = (m[p.social_status] || 0) + 1), m), {})
console.log(`Prepared ${profiles.length} UAE PASS profiles. Social-status mix:`, counts)

if (!applyDirectly) {
  writeFileSync('supabase/uae-pass-profiles.json', JSON.stringify(profiles, null, 2))
  console.log('Wrote supabase/uae-pass-profiles.json (no DB changes). Re-run with --apply to load.')
  process.exit(0)
}

// ── Apply to DB-3 (UAE PASS) — anon key, RLS still open during seeding ────────
const dbUrl = get('UAE_PASS_SUPABASE_URL')
const dbKey = get('UAE_PASS_SUPABASE_KEY')
if (!dbUrl || !dbKey) throw new Error('Missing UAE PASS (DB-3) creds in .env.local')
const db3 = createClient(dbUrl, dbKey)

let n = 0
for (let i = 0; i < profiles.length; i += 400) {
  const batch = profiles.slice(i, i + 400)
  const { error } = await db3.from('uae_pass_profiles').upsert(batch, { onConflict: 'case_number' })
  if (error) { console.error('uae_pass batch error:', error.message); process.exitCode = 1; break }
  n += batch.length; console.log(`  uae_pass_profiles ${n}/${profiles.length}`)
}
console.log('Done seeding UAE PASS (DB-3).')
