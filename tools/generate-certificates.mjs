// Generates demo salary-certificate PDFs that mirror the provided MOEI template.
// SADDAD does NOT use a QR code: it validates the uploaded certificate's fields
// (salary, Emirates ID, name, employer), its document type, and its internal
// arithmetic against the issuing-authority record (looked up by Emirates ID).
// Also emits TAMPERED copies so judges can watch each forensic layer catch them.
//
// Run: node tools/generate-certificates.mjs   (outputs to ./demo-certificates)
//
// Genuine certs validate against the Document Authority (DB-2) -> pipeline proceeds.
// Tampered certs fail one or more forensic layers -> Critic FORCE_ESCALATE.

import PDFDocument from 'pdfkit'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('demo-certificates')

// Authoritative records — MUST match the DB-2 salary_certificate_registry seed
// (keyed by Emirates ID).
const PERSONAS = [
  { case: 'MOEI-2026-1001', name: 'Salem Saif Al Ameri',      eid: '784-1988-2341567-3', employer: 'Abu Dhabi National Oil Company (ADNOC)', title: 'Senior Engineer',      basic: 9000,  allow: 6000, gross: 15000 },
  { case: 'MOEI-2026-1002', name: 'Aisha Mohammed Al Marri',  eid: '784-1992-7651234-8', employer: 'Etihad Airways',                          title: 'Operations Officer',   basic: 5100,  allow: 3400, gross: 8500 },
  { case: 'MOEI-2026-1003', name: 'Hamdan Khalifa Al Suwaidi',eid: '784-1979-4523678-1', employer: 'Emirates Steel Arkan',                    title: 'Project Manager',      basic: 7200,  allow: 4800, gross: 12000 },
  { case: 'MOEI-2026-1004', name: 'Latifa Ahmed Al Falasi',   eid: '784-1995-9988776-5', employer: 'Al Nahda Medical Center',                 title: 'Receptionist',         basic: 1800,  allow: 1000, gross: 2800 },
  { case: 'MOEI-2026-1005', name: 'Rashid Obaid Al Mazrouei', eid: '784-1985-1122334-2', employer: 'Dubai Municipality',                      title: 'Inspector',            basic: 6000,  allow: 4000, gross: 10000 },
  { case: 'MOEI-2026-1006', name: 'Mariam Yousef Al Hosani',  eid: '784-1990-5566778-9', employer: 'First Abu Dhabi Bank',                    title: 'Relationship Manager', basic: 12000, allow: 8000, gross: 20000 },
]

const aed = (n) => 'AED ' + Number(n).toLocaleString('en-US')

async function buildCertificate(p, { issueDate = '2026-05-20' } = {}) {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fillColor('#1f4e79').font('Helvetica-Bold').fontSize(16).text('SALARY CERTIFICATE')
    doc.moveDown(0.4)
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
      .text('Company Name: ', { continued: true })
      .font('Helvetica').text(p.employer)
    doc.moveDown(1.2)

    doc.font('Helvetica').fontSize(11).text(
      `This is to certify that Mr./Ms. ${p.name}, holding Emirates ID ${p.eid}, is employed with ${p.employer} as a ${p.title}.`,
      { lineGap: 3 }
    )
    doc.moveDown(0.9)
    doc.text(`Monthly Basic Salary: ${aed(p.basic)}`, { lineGap: 2 })
    doc.text(`Allowances: ${aed(p.allow)}`, { lineGap: 2 })
    doc.text(`Gross Monthly Salary: ${aed(p.gross)}`, { lineGap: 2 })
    doc.moveDown(0.9)
    doc.text(`Date of Issue: ${issueDate}`)
    doc.moveDown(0.6)
    doc.text("This certificate is issued upon the employee's request for official purposes.")
    doc.moveDown(1.6)

    doc.text('Authorized Signatory')
    doc.moveDown(0.6)
    doc.text('HR Department')
    doc.end()
  })
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const written = []

  // 1) Genuine certificate for every persona (printed values == authority record).
  for (const p of PERSONAS) {
    const pdf = await buildCertificate(p)
    const file = path.join(OUT, `${p.case}_salary_certificate.pdf`)
    await writeFile(file, pdf)
    written.push(file)
  }

  // 2) TAMPERED variants for the showcase persona (1001) — one per forensic layer.
  const salem = PERSONAS[0]

  // (a) Salary edited inside the PDF (45,000) — internally consistent, but does NOT
  //     match the authority's record (15,000) -> verdict 'mismatch' (salary layer).
  const tamperedSalary = { ...salem, basic: 27000, allow: 18000, gross: 45000 }
  await writeFile(
    path.join(OUT, `${salem.case}_TAMPERED-salary.pdf`),
    await buildCertificate(tamperedSalary)
  )
  written.push(`${salem.case}_TAMPERED-salary.pdf`)

  // (b) Identity edited — the certificate prints a DIFFERENT Emirates ID than the
  //     beneficiary's authority record -> verdict 'mismatch' (identity layer).
  const tamperedId = { ...salem, eid: '784-1990-0000000-0' }
  await writeFile(
    path.join(OUT, `${salem.case}_TAMPERED-identity.pdf`),
    await buildCertificate(tamperedId)
  )
  written.push(`${salem.case}_TAMPERED-identity.pdf`)

  // (c) Arithmetic-tampered: the gross STILL matches the authority record (so the
  //     salary cross-check passes), but the internal breakdown was edited and no
  //     longer reconciles (basic + allowances ≠ gross) -> verdict 'tampered'. Proves
  //     the forensic layers are independent.
  const tamperedArithmetic = { ...salem, basic: 12000, allow: 6000, gross: 15000 }
  await writeFile(
    path.join(OUT, `${salem.case}_TAMPERED-arithmetic.pdf`),
    await buildCertificate(tamperedArithmetic)
  )
  written.push(`${salem.case}_TAMPERED-arithmetic.pdf`)

  console.log(`Generated ${written.length} certificates in ${OUT}:`)
  for (const w of written) console.log('  -', path.basename(w))
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
