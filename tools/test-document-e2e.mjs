// E2E: submit real PDF certificates through the LIVE pipeline (multipart upload →
// Gemini vision + deterministic forensics + DB cross-check) and report the verdict.
// Usage: BASE=http://localhost:3000 node tools/_test-gemini-e2e.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')

const BASE = process.env.BASE || 'http://localhost:3000'
const APP = 'MSZHP_100075'
const NAME = 'Salama Al Ameri'
const EID = '784-1980-9041475-5'
const SALARY = 27880
const ARREARS = 10641

function genCert({ sparse = false, salary = SALARY } = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    if (sparse) {
      doc.fontSize(16).text(NAME)
      doc.moveDown().fontSize(14).text(`Salary: ${salary}`)
      doc.end()
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
    doc.end()
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${BASE}/api/auth/demo-login`, { method: 'POST' })
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0]
  if (!cookie) throw new Error(`login failed: ${login.status}`)
  console.log(`\n=== Gemini E2E · ${BASE} · app ${APP} (on-record salary AED ${SALARY.toLocaleString()}) ===\n`)

  const scenarios = [
    { label: 'GENUINE cert (salary matches record)', buf: await genCert() },
    { label: 'TAMPERED salary (cert says 50,000 vs record 27,880)', buf: await genCert({ salary: 50000 }) },
    { label: 'SPARSE FAKE (only a name + a salary number)', buf: await genCert({ sparse: true }) },
  ]

  for (const s of scenarios) {
    const fd = new FormData()
    fd.append('case_number', APP)
    fd.append('monthly_salary', String(SALARY))
    fd.append('arrears_amount', String(ARREARS))
    fd.append('reschedule_reason', 'other')
    fd.append('salaryCertificate', new File([s.buf], 'salary-certificate.pdf', { type: 'application/pdf' }))

    const post = await fetch(`${BASE}/api/process-application`, { method: 'POST', headers: { Cookie: cookie }, body: fd })
    const pj = await post.json().catch(() => ({}))
    if (!post.ok || !pj.success) { console.log(`\n• ${s.label}\n  submit FAILED: ${post.status} ${JSON.stringify(pj).slice(0, 160)}`); continue }

    // Poll until THIS job (just queued) completes — gating on the job lifecycle, not the
    // decision, avoids reading the previous run's stale decision still in the cases table.
    let dec = null
    const deadline = Date.now() + 120000
    while (Date.now() < deadline) {
      await sleep(2500)
      const st = await fetch(`${BASE}/api/case-status/${encodeURIComponent(APP)}`, { headers: { Cookie: cookie } })
      const d = (await st.json().catch(() => ({})))?.data
      if (d?.status === 'completed' && d?.decision?.outcome) { dec = d.decision; break }
      if (d?.status === 'failed') break
    }
    console.log(`\n• ${s.label}`)
    if (!dec) { console.log('  ⏱ not decided within timeout'); continue }
    const vr = dec.verificationReport
    const vision = vr?.checks?.find((c) => c.id === 'vision_authenticity')
    console.log(`  outcome:        ${dec.outcome.toUpperCase()} · recommendation: ${dec.caseStudy?.recommendation ?? '?'}`)
    console.log(`  doc verdict:    ${vr?.verdict ?? '?'} (${vr?.confidenceScore ?? '?'}% confidence)`)
    console.log(`  vision check:   ${vision ? `${vision.status.toUpperCase()} — ${vision.detail}` : '(none)'}`)
    const salaryChk = vr?.checks?.find((c) => c.id === 'salary_match')
    if (salaryChk) console.log(`  salary check:   ${salaryChk.status.toUpperCase()} — ${salaryChk.detail}`)
  }
  console.log('\n=== done ===\n')
}

main().catch((e) => { console.error('E2E error:', e); process.exit(1) })
