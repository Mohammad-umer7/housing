// Concurrency test for the SADDAD job queue (DB-1). Exercises the EXACT queries
// lib/data-layer.ts uses (claimJob = atomic conditional UPDATE … RETURNING;
// addToQueue = delete-then-insert) against the REAL database, with many callers
// racing, to prove:
//   A) the same queued job can be claimed by AT MOST ONE worker (no double-process),
//   B) N distinct cases (= N users) are all claimed exactly once, in parallel,
//   C) what a same-case double-submit race actually produces.
// No Groq / pipeline calls — this isolates the concurrency-critical layer.
//
// Run: node tools/test-concurrency.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')

const env = readFileSync('.env.local', 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1] ?? '').trim()
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

// ── exact replicas of the production queries ──────────────────────────────────
async function claimJob(caseNumber, workerId) {
  const { data, error } = await db
    .from('job_queue')
    .update({ status: 'processing', worker_id: workerId, started_at: new Date().toISOString(), attempt_count: 1 })
    .eq('case_number', caseNumber)
    .eq('status', 'queued')
    .select('form_data, worker_id')
  if (error) throw new Error(`claimJob: ${error.message}`)
  return data && data.length > 0 ? data : null
}
async function addToQueue(caseNumber, formData) {
  await db.from('job_queue').delete().eq('case_number', caseNumber)
  const { error } = await db.from('job_queue').insert({
    case_number: caseNumber, status: 'queued', form_data: formData, queued_at: new Date().toISOString(),
  })
  if (error) throw new Error(`addToQueue: ${error.message}`)
}
const cleanup = () => db.from('job_queue').delete().like('case_number', 'TEST_CONC%')

let pass = 0, fail = 0
const check = (name, ok, detail) => { ok ? (pass++, console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`)) : (fail++, console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)) }

console.log('\n=== SADDAD job-queue concurrency test (real DB) ===\n')
await cleanup()

// ── Test A: 12 workers race to claim ONE queued job ───────────────────────────
console.log('Test A — 12 workers race for the SAME queued job (the duplicate-after() scenario):')
await addToQueue('TEST_CONC_DUP', { n: 1 })
const aResults = await Promise.all(
  Array.from({ length: 12 }, (_, i) => claimJob('TEST_CONC_DUP', `w-${i}`).catch((e) => ({ err: String(e) })))
)
const aWinners = aResults.filter((r) => Array.isArray(r) && r.length > 0)
check('exactly ONE worker claims the job (no double-processing)', aWinners.length === 1, `${aWinners.length} winner(s) of 12`)

// ── Test B: 25 distinct cases (= 25 users), all claimed concurrently ──────────
const N = 25
console.log(`\nTest B — ${N} DISTINCT cases (${N} simultaneous users), claimed in parallel:`)
await Promise.all(Array.from({ length: N }, (_, i) => addToQueue(`TEST_CONC_${i}`, { user: i })))
const t0 = Date.now()
const bResults = await Promise.all(
  Array.from({ length: N }, (_, i) => claimJob(`TEST_CONC_${i}`, `w-${i}`).catch((e) => ({ err: String(e) })))
)
const bMs = Date.now() - t0
const bWon = bResults.filter((r) => Array.isArray(r) && r.length === 1).length
const bErr = bResults.filter((r) => r && r.err).length
check(`all ${N} distinct jobs claimed exactly once`, bWon === N && bErr === 0, `${bWon}/${N} claimed, ${bErr} errors, ${bMs}ms`)
// none left queued
const { count: leftQueued } = await db.from('job_queue').select('*', { count: 'exact', head: true })
  .like('case_number', 'TEST_CONC_%').eq('status', 'queued')
check('no distinct job left unclaimed', (leftQueued ?? 0) === 0, `${leftQueued} still queued`)

// ── Test C: same-case DOUBLE SUBMIT race (no getActiveJob dedup) ──────────────
console.log('\nTest C — 6 simultaneous addToQueue for the SAME case, then 2 workers claim:')
await db.from('job_queue').delete().eq('case_number', 'TEST_CONC_RACE')
await Promise.all(Array.from({ length: 6 }, (_, i) => addToQueue('TEST_CONC_RACE', { submit: i }).catch(() => {})))
const { count: rowsAfter } = await db.from('job_queue').select('*', { count: 'exact', head: true }).eq('case_number', 'TEST_CONC_RACE')
const cResults = await Promise.all([claimJob('TEST_CONC_RACE', 'wa'), claimJob('TEST_CONC_RACE', 'wb')].map((p) => p.catch((e) => ({ err: String(e) }))))
const cClaimedRows = cResults.reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0)
const cWorkersThatGotWork = cResults.filter((r) => Array.isArray(r) && r.length > 0).length
console.log(`     rows left by 6 concurrent submits: ${rowsAfter}; workers that received work: ${cWorkersThatGotWork}; total rows claimed: ${cClaimedRows}`)
check('a same-case double-submit is processed by at most one worker', cWorkersThatGotWork <= 1,
  cWorkersThatGotWork <= 1 ? 'safe (note: route also dedups via getActiveJob before this point)' : 'RACE: >1 worker would process the same case')

await cleanup()
console.log(`\n=== ${pass} passed, ${fail} failed ===\n`)
process.exit(fail > 0 ? 1 : 0)
