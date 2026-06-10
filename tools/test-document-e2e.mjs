// E2E ORCHESTRATION TEST: submit real PDF documents through the LIVE pipeline
// (multipart upload → 3-tier OCR → Gemini vision authenticity + type check →
// deterministic forensics + DB cross-check → governance rules → critic) and assert
// the routing contract:
//   • genuine doc + DB match + rules pass            → APPROVED
//   • DB cross-check mismatch (edited salary)        → ESCALATED to a human officer
//   • fabricated-looking doc (sparse fake)           → ESCALATED to a human officer
//   • wrong document type (tenancy contract)         → REJECTED as "Request Documents"
//   • no document uploaded                           → REJECTED as "Request Documents"
// Escalated/rejected cases must carry an AI rationale for the citizen AND officer.
//
// Usage: BASE=http://localhost:3000 node tools/test-document-e2e.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')

const BASE = process.env.BASE || 'http://localhost:3000'
const APP = 'MSZHP_100075'
const NAME = 'Salama Al Ameri'
const EID = '784-1980-9041475-5'
const SALARY = 27880
const ARREARS = 10641

function pdfFrom(build) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    build(doc)
    doc.end()
  })
}

function genCert({ sparse = false, salary = SALARY } = {}) {
  return pdfFrom((doc) => {
    if (sparse) {
      doc.fontSize(16).text(NAME)
      doc.moveDown().fontSize(14).text(`Salary: ${salary}`)
      return
    }
    const basic = Math.round(salary * 0.65)
    const allow = salary - basic
    doc.fontSize(18).text('Abu Dhabi National Oil Company (ADNOC)', { align: 'center' })
    doc.moveDown().fontSize(15).text('SALARY CERTIFICATE', { align: 'center' })
    doc.moveDown().fontSize(12)
    doc.text(`Date of Issue: ${new Date().toISOString().slice(0, 10)}`)
    doc.moveDown().text('To Whom It May Concern,')
    doc.moveDown().text(`This is to certify that Mr./Ms. ${NAME}, holding Emirates ID ${EID}, is employed with Abu Dhabi National Oil Company (ADNOC).`)
    doc.moveDown()
    doc.text(`Basic Salary:   AED ${basic.toLocaleString()}`)
    doc.text(`Allowances:     AED ${allow.toLocaleString()}`)
    doc.text(`Gross Salary:   AED ${salary.toLocaleString()}`)
    doc.moveDown().text('This certificate is issued upon the employee’s request and is valid for official purposes.')
    doc.moveDown(2).text('Authorised Signatory')
    doc.text('HR Department, ADNOC')
  })
}

// A clearly DIFFERENT document type — should bounce back as "Request Documents".
function genTenancyContract() {
  return pdfFrom((doc) => {
    doc.fontSize(18).text('RESIDENTIAL TENANCY CONTRACT', { align: 'center' })
    doc.moveDown().fontSize(12)
    doc.text(`This tenancy agreement is made on ${new Date().toISOString().slice(0, 10)} between:`)
    doc.moveDown()
    doc.text('Landlord: Al Saada Real Estate LLC')
    doc.text(`Tenant: ${NAME}`)
    doc.moveDown()
    doc.text('Property: Apartment 1204, Marina Heights Tower, Abu Dhabi')
    doc.text('Annual Rent: AED 85,000 payable in 4 cheques')
    doc.text('Term: 12 months commencing 01/07/2026')
    doc.moveDown(2)
    doc.text('Signed by both parties.')
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// fetch with a hard timeout + one retry — a single hung dev-server response must not
// kill the whole E2E run (undici's default headers timeout is 5 minutes).
async function fetchSafe(url, opts = {}, { timeoutMs = 30000, retries = 1 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      if (i === retries) throw err
      await sleep(2000)
    }
  }
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/demo-login`, { method: 'POST' })
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0]
  if (!cookie) throw new Error(`login failed: ${login.status}`)
  console.log(`\n=== Document E2E · ${BASE} · app ${APP} (on-record salary AED ${SALARY.toLocaleString()}) ===\n`)

  const scenarios = [
    {
      label: 'GENUINE cert (salary matches record)',
      buf: await genCert(),
      expectOutcome: ['approved'],
      expectVerdict: ['verified'],
    },
    {
      label: 'TAMPERED salary (cert says 50,000 vs record 27,880) → officer escalation',
      buf: await genCert({ salary: 50000 }),
      expectOutcome: ['escalated'],
      expectVerdict: ['mismatch'],
    },
    {
      label: 'SPARSE FAKE (only a name + a salary number) → officer escalation',
      buf: await genCert({ sparse: true }),
      expectOutcome: ['escalated'],
      expectVerdict: ['suspicious', 'mismatch'], // fraud signals — must escalate, never approve/bounce
    },
    {
      label: 'WRONG DOC TYPE (tenancy contract) → request documents',
      buf: await genTenancyContract(),
      expectOutcome: ['rejected'],
      expectRecommendation: ['Request Documents'],
      expectVerdict: ['invalid'],
    },
    {
      label: 'NO DOCUMENT uploaded → request documents',
      buf: null,
      expectOutcome: ['rejected'],
      expectRecommendation: ['Request Documents'],
    },
  ]

  let pass = 0
  let fail = 0
  for (const s of scenarios) {
    const fd = new FormData()
    fd.append('case_number', APP)
    fd.append('monthly_salary', String(SALARY))
    fd.append('arrears_amount', String(ARREARS))
    fd.append('reschedule_reason', 'other')
    if (s.buf) fd.append('salaryCertificate', new File([s.buf], 'document.pdf', { type: 'application/pdf' }))

    const post = await fetchSafe(`${BASE}/api/process-application`, { method: 'POST', headers: { Cookie: cookie }, body: fd }, { timeoutMs: 90000 })
    const pj = await post.json().catch(() => ({}))
    if (!post.ok || !pj.success) { console.log(`\n• ${s.label}\n  submit FAILED: ${post.status} ${JSON.stringify(pj).slice(0, 160)}`); fail++; continue }
    const caseId = pj.data?.caseId || APP

    // Poll until THIS job (just queued) completes — gating on the job lifecycle, not the
    // decision, avoids reading the previous run's stale decision still in the cases table.
    let dec = null
    const deadline = Date.now() + 150000
    while (Date.now() < deadline) {
      await sleep(2500)
      let d = null
      try {
        const st = await fetchSafe(`${BASE}/api/case-status/${encodeURIComponent(caseId)}`, { headers: { Cookie: cookie } }, { timeoutMs: 15000, retries: 0 })
        d = (await st.json().catch(() => ({})))?.data
      } catch { continue } // transient poll failure — keep polling until the deadline
      if (d?.status === 'completed' && d?.decision?.outcome) { dec = d.decision; break }
      if (d?.status === 'failed') break
    }
    console.log(`\n• ${s.label}  (case ${caseId})`)
    if (!dec) { console.log('  ⏱ not decided within timeout'); fail++; continue }

    const vr = dec.verificationReport
    const recommendation = dec.caseStudy?.recommendation ?? '?'
    const vision = vr?.checks?.find((c) => c.id === 'vision_authenticity')
    const typeChk = vr?.checks?.find((c) => c.id === 'document_type')
    console.log(`  outcome:        ${dec.outcome.toUpperCase()} · recommendation: ${recommendation}`)
    console.log(`  doc verdict:    ${vr?.verdict ?? '(none)'} (${vr?.confidenceScore ?? '?'}% confidence)`)
    if (typeChk) console.log(`  type check:     ${typeChk.status.toUpperCase()} — ${typeChk.detail}`)
    if (vision) console.log(`  vision check:   ${vision.status.toUpperCase()} — ${vision.detail}`)
    const salaryChk = vr?.checks?.find((c) => c.id === 'salary_match')
    if (salaryChk) console.log(`  salary check:   ${salaryChk.status.toUpperCase()} — ${salaryChk.detail}`)
    const rationale = dec.reason || dec.rationale || ''
    console.log(`  AI rationale:   ${String(rationale).slice(0, 220)}${String(rationale).length > 220 ? '…' : ''}`)

    const outcomeOk = s.expectOutcome.includes(String(dec.outcome).toLowerCase())
    const verdictOk = !s.expectVerdict || s.expectVerdict.includes(String(vr?.verdict))
    const recOk = !s.expectRecommendation || s.expectRecommendation.includes(recommendation)
    const rationaleOk = String(dec.outcome).toLowerCase() === 'approved' || String(rationale).length > 0
    const ok = outcomeOk && verdictOk && recOk && rationaleOk
    console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}${outcomeOk ? '' : ` — expected outcome ${s.expectOutcome.join('/')}`}${verdictOk ? '' : ` — expected verdict ${s.expectVerdict.join('/')}`}${recOk ? '' : ` — expected recommendation ${s.expectRecommendation.join('/')}`}${rationaleOk ? '' : ' — missing AI rationale'}`)
    ok ? pass++ : fail++
  }
  console.log(`\n=== done · ${pass} passed, ${fail} failed ===\n`)
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => { console.error('E2E error:', e); process.exit(1) })
