import {
  parsePdfMetadata,
  checkStructure,
  checkArithmetic,
  extractEmiratesId,
  buildVerificationReport,
} from '../lib/document-forensics'
import type { AuthorityRecord } from '../lib/integrations/document-authority'

const RECORD: AuthorityRecord = {
  doc_code: 'MOEI-WPS-1001',
  emirates_id: '784-1988-2341567-3',
  employee_name: 'Salem Saif Al Ameri',
  employer_name: 'Abu Dhabi National Oil Company (ADNOC)',
  job_title: 'Senior Engineer',
  basic_salary: 9000,
  allowances: 6000,
  gross_salary: 15000,
  issue_date: '2026-05-20',
  status: 'valid',
}

const GENUINE_TEXT =
  'SALARY CERTIFICATE Company Name: ADNOC This is to certify that Mr. Salem Saif Al Ameri, ' +
  'holding Emirates ID 784-1988-2341567-3, is employed with Abu Dhabi National Oil Company (ADNOC) ' +
  'as a Senior Engineer. Monthly Basic Salary: AED 9,000 Allowances: AED 6,000 Gross Monthly Salary: AED 15,000 ' +
  'Authorized Signatory HR Department'

function inputs(over: Partial<Parameters<typeof buildVerificationReport>[0]> = {}) {
  return {
    record: RECORD,
    declaredSalary: 15000,
    extracted: { salary: 15000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' },
    structure: checkStructure(GENUINE_TEXT),
    arithmetic: checkArithmetic(GENUINE_TEXT),
    metadata: {
      creationDate: 'D:20260520120000', modDate: null, producer: 'PDFKit', creator: 'PDFKit',
      eofCount: 1, modifiedAfterCreation: false, incrementalUpdate: false,
    },
    ...over,
  }
}

describe('checkStructure', () => {
  test('recognises a genuine salary certificate layout', () => {
    const s = checkStructure(GENUINE_TEXT)
    expect(s.looksLikeSalaryCertificate).toBe(true)
    expect(s.found).toBeGreaterThanOrEqual(4)
  })
  test('rejects an unrelated document', () => {
    const s = checkStructure('This is a tenancy contract between landlord and tenant.')
    expect(s.looksLikeSalaryCertificate).toBe(false)
  })
})

describe('checkArithmetic', () => {
  test('reconciles basic + allowances == gross', () => {
    const a = checkArithmetic(GENUINE_TEXT)
    expect(a.hasFigures).toBe(true)
    expect(a.consistent).toBe(true)
  })
  test('flags figures that do not add up', () => {
    const a = checkArithmetic('Basic Salary: AED 20,000 Allowances: AED 6,000 Gross Monthly Salary: AED 15,000')
    expect(a.hasFigures).toBe(true)
    expect(a.consistent).toBe(false)
  })
})

describe('parsePdfMetadata', () => {
  test('detects an incremental update (multiple EOF markers)', () => {
    const m = parsePdfMetadata('%PDF-1.3\n/Producer (PDFKit)\n/CreationDate (D:20260520120000)\n%%EOF\n%%EOF\n')
    expect(m.eofCount).toBe(2)
    expect(m.incrementalUpdate).toBe(true)
    expect(m.producer).toBe('PDFKit')
  })
  test('detects modification after creation', () => {
    const m = parsePdfMetadata('/CreationDate (D:20260520120000)\n/ModDate (D:20260601120000)\n%%EOF\n')
    expect(m.modifiedAfterCreation).toBe(true)
  })
  test('clean single-revision file is not flagged', () => {
    const m = parsePdfMetadata('/CreationDate (D:20260520120000)\n%%EOF\n')
    expect(m.incrementalUpdate).toBe(false)
    expect(m.modifiedAfterCreation).toBe(false)
  })
})

describe('extractEmiratesId', () => {
  test('pulls and normalises the Emirates ID', () => {
    expect(extractEmiratesId('holding Emirates ID 784-1988-2341567-3, is employed'))
      .toBe('784-1988-2341567-3')
  })
})

describe('buildVerificationReport', () => {
  test('genuine certificate → verified, high confidence', () => {
    const r = buildVerificationReport(inputs())
    expect(r.verdict).toBe('verified')
    expect(r.confidenceScore).toBeGreaterThanOrEqual(95)
  })
  test('salary mismatch vs authority → mismatch', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 45000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' }, declaredSalary: 45000 }))
    expect(r.verdict).toBe('mismatch')
  })
  test('Emirates ID mismatch vs authority → mismatch', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 15000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-0000-0000000-0' } }))
    expect(r.verdict).toBe('mismatch')
  })
  test('edited file (incremental update) but valid QR + salary → tampered', () => {
    const r = buildVerificationReport(inputs({
      metadata: { creationDate: 'D:20260520120000', modDate: null, producer: 'PDFKit', creator: 'PDFKit', eofCount: 2, modifiedAfterCreation: false, incrementalUpdate: true },
    }))
    expect(r.verdict).toBe('tampered')
  })
  test('figures that do not reconcile → tampered', () => {
    const r = buildVerificationReport(inputs({
      arithmetic: checkArithmetic('Basic Salary: AED 20,000 Allowances: AED 6,000 Gross Monthly Salary: AED 15,000'),
    }))
    expect(r.verdict).toBe('tampered')
  })
  test('no authority record for this beneficiary → unverifiable', () => {
    const r = buildVerificationReport(inputs({ record: null }))
    expect(r.verdict).toBe('unverifiable')
  })

  test('a non-certificate PDF (wrong document) → invalid, low confidence', () => {
    const r = buildVerificationReport(inputs({
      structure: checkStructure('This is a residential tenancy contract between landlord and tenant.'),
      arithmetic: checkArithmetic('no salary figures here'),
      extracted: { salary: null, name: null, employer: null, emiratesId: null },
    }))
    expect(r.verdict).toBe('invalid')
    expect(r.confidenceScore).toBeLessThan(50)
    // the content fields must NOT be scored as passing for a non-certificate
    expect(r.checks.find((c) => c.id === 'salary_match')!.status).toBe('na')
  })

  test('certificate with no readable salary → salary check N/A, not a false pass', () => {
    const r = buildVerificationReport(inputs({
      extracted: { salary: null, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' },
      declaredSalary: 15000,
    }))
    expect(r.checks.find((c) => c.id === 'salary_match')!.status).toBe('na')
    expect(r.verdict).toBe('verified') // structure + identity + metadata still validate it
  })
})
