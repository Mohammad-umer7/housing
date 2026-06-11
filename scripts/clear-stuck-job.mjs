// One-off maintenance: release a job stuck in queued/processing (worker crashed or
// an upstream call hung) and route its case to an officer, mirroring the worker's
// failure safety-net. Usage:
//   node --env-file=.env.local scripts/clear-stuck-job.mjs <CASE_NUMBER>
import { createClient } from '@supabase/supabase-js'

const caseNumber = process.argv[2]
if (!caseNumber) {
  console.error('Usage: node --env-file=.env.local scripts/clear-stuck-job.mjs <CASE_NUMBER>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}
const db = createClient(url, key)

const { data: job } = await db
  .from('job_queue')
  .select('id, status, queued_at, started_at')
  .eq('case_number', caseNumber)
  .in('status', ['queued', 'processing'])
  .maybeSingle()

if (!job) {
  console.log(`No active (queued/processing) job found for ${caseNumber} — nothing to clear.`)
  process.exit(0)
}

await db.from('job_queue').update({
  status: 'failed',
  error_message: 'Cleared manually — job hung during processing (LLM provider stall).',
  completed_at: new Date().toISOString(),
}).eq('id', job.id)

await db.from('cases').update({
  status: 'escalated',
  decision_reason: 'A technical issue interrupted automated processing. Your case has been referred to a specialist officer for manual review — no decision has been made against you.',
  processed_at: new Date().toISOString(),
}).eq('case_number', caseNumber)

console.log(`Cleared stuck ${job.status} job for ${caseNumber}; case routed to officer review.`)
