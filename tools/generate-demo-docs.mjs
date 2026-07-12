// Generates the three DEMO sample documents shown in the citizen submission form's
// "Demo documents" picker. These are FAKE, illustrative PDFs whose real text content
// deterministically routes through the (LLM-free) forensic pipeline to a known outcome:
//
//   demo-approve.pdf   — genuine salary certificate matching the showcase applicant's
//                        on-record salary (AED 27,880) → verdict "verified" → APPROVED.
//   demo-escalate.pdf  — salary certificate whose figures DON'T match the record
//                        (AED 52,000) → verdict "mismatch" → ESCALATED to an officer.
//   demo-reject.pdf    — a tenancy contract (the WRONG document type) → verdict
//                        "invalid" → the citizen is asked for the correct document
//                        (surfaces as a rejected / more-info-required outcome).
//
// Calibrated for the default demo applicant MSZHP_100075 (Salem Saif Al Ameri).
// Run: node tools/generate-demo-docs.mjs   (outputs to ./public/demo-docs)

import PDFDocument from 'pdfkit'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('public', 'demo-docs')
const NAME = 'Salem Saif Al Ameri'
const EID = '784-1988-2341567-3'
const EMPLOYER = 'Abu Dhabi National Oil Company (ADNOC)'
const aed = (n) => 'AED ' + Number(n).toLocaleString('en-US')

function render(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    build(doc)
    doc.end()
  })
}

// A genuine-looking salary certificate. `gross` drives the outcome: matching the
// on-record salary → verified; far off → mismatch.
function salaryCertificate({ basic, allow, gross, issueDate = '2026-06-15' }) {
  return render((doc) => {
    doc.fillColor('#1f4e79').font('Helvetica-Bold').fontSize(16).text('SALARY CERTIFICATE')
    doc.moveDown(0.4)
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text('Company Name: ', { continued: true })
      .font('Helvetica').text(EMPLOYER)
    doc.moveDown(1.2)
    doc.font('Helvetica').fontSize(11).text(
      `This is to certify that Mr./Ms. ${NAME}, holding Emirates ID ${EID}, is employed with ${EMPLOYER} as a Senior Engineer.`,
      { lineGap: 3 })
    doc.moveDown(0.9)
    doc.text(`Monthly Basic Salary: ${aed(basic)}`, { lineGap: 2 })
    doc.text(`Allowances: ${aed(allow)}`, { lineGap: 2 })
    doc.text(`Gross Monthly Salary: ${aed(gross)}`, { lineGap: 2 })
    doc.moveDown(0.9)
    doc.text(`Date of Issue: ${issueDate}`)
    doc.moveDown(0.6)
    doc.text("This certificate is issued upon the employee's request for official purposes.")
    doc.moveDown(1.6)
    doc.text('Authorized Signatory')
    doc.moveDown(0.6)
    doc.text('HR Department')
  })
}

// A tenancy contract — deliberately the WRONG document type (no salary-certificate
// anchors), so the type check fails and the file is bounced back as "not the
// requested document".
function tenancyContract() {
  return render((doc) => {
    doc.fillColor('#7a1f1f').font('Helvetica-Bold').fontSize(16).text('TENANCY CONTRACT')
    doc.moveDown(0.4)
    doc.fillColor('#000').font('Helvetica').fontSize(11)
    doc.text('This Tenancy Contract is made between the Landlord and the Tenant for the lease of a residential unit.', { lineGap: 3 })
    doc.moveDown(0.9)
    doc.font('Helvetica-Bold').text('Landlord: ', { continued: true }).font('Helvetica').text('Al Maryah Real Estate LLC')
    doc.font('Helvetica-Bold').text('Tenant: ', { continued: true }).font('Helvetica').text(NAME)
    doc.font('Helvetica-Bold').text('Property: ', { continued: true }).font('Helvetica').text('Villa 42, Al Bateen, Abu Dhabi')
    doc.font('Helvetica-Bold').text('Annual Rent: ', { continued: true }).font('Helvetica').text(aed(120000))
    doc.font('Helvetica-Bold').text('Contract Term: ', { continued: true }).font('Helvetica').text('12 months (2026-01-01 to 2026-12-31)')
    doc.moveDown(0.9)
    doc.text('The Tenant agrees to pay the rent in four quarterly instalments and to maintain the property in good condition.', { lineGap: 3 })
    doc.moveDown(1.4)
    doc.text('Signed by the Landlord and the Tenant.')
  })
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const files = {
    // Matches the on-record salary 27,880 (16,728 + 11,152) → verified → APPROVE.
    'demo-approve.pdf': await salaryCertificate({ basic: 16728, allow: 11152, gross: 27880 }),
    // Broken internal arithmetic (30,000 + 10,000 ≠ 52,000) AND a salary that doesn't
    // match the record → forensic fraud signal (tampered/mismatch) → ESCALATE to officer.
    // Applicant-agnostic: the arithmetic check is internal to the document.
    'demo-escalate.pdf': await salaryCertificate({ basic: 30000, allow: 10000, gross: 52000 }),
    // Wrong document type → invalid → REJECT / request correct document.
    'demo-reject.pdf': await tenancyContract(),
  }
  for (const [name, buf] of Object.entries(files)) {
    await writeFile(path.join(OUT, name), buf)
    console.log('  -', path.join('public/demo-docs', name), `(${buf.length} bytes)`)
  }
  console.log('Generated demo documents in', OUT)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
