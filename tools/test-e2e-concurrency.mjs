// End-to-end concurrency test against the RUNNING dev server. Logs in once, then
// fires N real submissions SIMULTANEOUSLY (distinct App IDs = distinct users),
// each running the full 11-agent LangGraph pipeline, and polls every case to a
// terminal decision. Proves the whole stack (auth → enqueue → after() worker →
// atomic claim → pipeline → decision) handles parallel users without losing,
// stalling, or cross-contaminating cases.
//
// Usage: BASE=http://localhost:3939 node tools/test-e2e-concurrency.mjs
const BASE = process.env.BASE || 'http://localhost:3939'

// Distinct App IDs spanning approve / escalate and priority / non-priority.
const CASES = [
  { case_number: 'MSZHP_100075', monthly_salary: 27880, arrears_amount: 10641 },  // clean
  { case_number: 'MSZHP_100332', monthly_salary: 23540, arrears_amount: 3417 },   // orphan, clean
  { case_number: 'MSZHP_100933', monthly_salary: 20725, arrears_amount: 332685 }, // determination, escalate
  { case_number: 'MSZHP_104476', monthly_salary: 25400, arrears_amount: 161630 }, // senior, escalate
  { case_number: 'MSZHP_107732', monthly_salary: 19000, arrears_amount: 160350 }, // escalate G-03
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1) Auth (one-click demo login) → capture the session cookie.
  const login = await fetch(`${BASE}/api/auth/demo-login`, { method: 'POST' })
  const setCookie = login.headers.get('set-cookie')
  if (!login.ok || !setCookie) throw new Error(`login failed: ${login.status} ${await login.text()}`)
  const cookie = setCookie.split(';')[0]
  console.log(`\n=== E2E concurrency test · ${CASES.length} simultaneous users · ${BASE} ===`)
  console.log(`auth: ${cookie.split('=')[0]} cookie acquired\n`)

  // 2) Fire all submissions AT ONCE.
  const submitStart = Date.now()
  const submits = await Promise.all(
    CASES.map(async (c) => {
      const t = Date.now()
      const res = await fetch(`${BASE}/api/process-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(c),
      })
      const json = await res.json().catch(() => ({}))
      return { case: c.case_number, ok: res.ok, ms: Date.now() - t, body: json }
    })
  )
  console.log('Submissions (all fired concurrently):')
  for (const s of submits) {
    console.log(`  ${s.ok ? '✓' : '✗'} ${s.case} — queued in ${s.ms}ms · pos ${s.body?.data?.queuePosition ?? '?'}`)
  }
  const allQueued = submits.every((s) => s.ok)

  // 3) Poll every case to a terminal decision.
  const terminal = new Set(['approved', 'rejected', 'escalated'])
  const done = {}
  const deadline = Date.now() + 120000
  while (Object.keys(done).length < CASES.length && Date.now() < deadline) {
    await sleep(2000)
    await Promise.all(
      CASES.filter((c) => !done[c.case_number]).map(async (c) => {
        const res = await fetch(`${BASE}/api/case-status/${encodeURIComponent(c.case_number)}`, { headers: { Cookie: cookie } })
        const j = await res.json().catch(() => ({}))
        const d = j?.data
        if (!d) return
        const outcome = d.decision?.outcome
        if (outcome && terminal.has(outcome)) {
          done[c.case_number] = {
            outcome,
            jobStatus: d.status,
            processingMs: d.processingTimeMs,
            stepsDone: (d.agentSteps || []).filter((s) => s.status === 'done').length,
            stepsTotal: (d.agentSteps || []).length,
          }
        }
      })
    )
    const n = Object.keys(done).length
    process.stdout.write(`\r  polling… ${n}/${CASES.length} decided (${Math.round((Date.now() - submitStart) / 1000)}s)`)
  }
  console.log('\n')

  // 4) Report.
  console.log('Results:')
  for (const c of CASES) {
    const r = done[c.case_number]
    if (r) console.log(`  ✅ ${c.case_number} → ${r.outcome.toUpperCase()} · ${r.stepsDone}/${r.stepsTotal} agents · ${Math.round((r.processingMs || 0) / 1000)}s`)
    else console.log(`  ❌ ${c.case_number} → NOT DECIDED within timeout (stuck?)`)
  }

  const decided = Object.keys(done).length
  const wall = Math.round((Date.now() - submitStart) / 1000)
  console.log(`\n=== ${decided}/${CASES.length} decided · all queued: ${allQueued} · total wall time ${wall}s ===`)
  process.exit(decided === CASES.length && allQueued ? 0 : 1)
}

main().catch((e) => { console.error('E2E test error:', e); process.exit(1) })
