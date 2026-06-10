import {
  checkStructure,
  checkArithmetic,
  extractEmiratesId,
  buildVerificationReport,
  type VisionAssessment,
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

const NON_WORK_TEXT =
  'TO WHOM IT MAY CONCERN. This letter confirms the termination / end of service of Mr. Salem Saif Al Ameri, ' +
  'Emirates ID 784-1988-2341567-3, effective 01/05/2026. He is no longer employed with our establishment. ' +
  'HR Department. Date: 20/05/2026'

function inputs(over: Partial<Parameters<typeof buildVerificationReport>[0]> = {}) {
  return {
    expectedType: 'salary_certificate' as const,
    record: RECORD,
    declaredSalary: 15000,
    extracted: { salary: 15000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' },
    structure: checkStructure(GENUINE_TEXT, 'salary_certificate'),
    arithmetic: checkArithmetic(GENUINE_TEXT),
    ...over,
  }
}

function vision(over: Partial<VisionAssessment> = {}): VisionAssessment {
  return {
    verdict: 'authentic',
    confidence: 90,
    reasons: [],
    matchesExpectedType: true,
    observed: {
      documentType: 'salary certificate',
      salary: null,
      employeeName: null,
      employerName: null,
      issueDate: null,
      ...(over.observed ?? {}),
    },
    ...over,
  }
}

describe('checkStructure (doc-type aware)', () => {
  test('recognises a genuine salary certificate layout', () => {
    const s = checkStructure(GENUINE_TEXT, 'salary_certificate')
    expect(s.looksLikeExpectedDoc).toBe(true)
    expect(s.found).toBeGreaterThanOrEqual(4)
  })
  test('rejects an unrelated document for the salary-certificate profile', () => {
    const s = checkStructure('This is a tenancy contract between landlord and tenant.', 'salary_certificate')
    expect(s.looksLikeExpectedDoc).toBe(false)
  })
  test('recognises a termination letter when a non-work letter is expected', () => {
    const s = checkStructure(NON_WORK_TEXT, 'non_work_letter')
    expect(s.looksLikeExpectedDoc).toBe(true)
  })
  test('a salary certificate does NOT satisfy the non-work-letter profile', () => {
    const s = checkStructure(GENUINE_TEXT, 'non_work_letter')
    expect(s.looksLikeExpectedDoc).toBe(false)
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
  test('salary mismatch vs authority → mismatch (officer escalation, not citizen bounce)', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 45000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' }, declaredSalary: 45000 }))
    expect(r.verdict).toBe('mismatch')
  })
  test('Emirates ID mismatch vs authority → mismatch', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 15000, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-0000-0000000-0' } }))
    expect(r.verdict).toBe('mismatch')
  })
  test('Name mismatch vs authority → mismatch', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 15000, name: 'Different Name', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' } }))
    expect(r.verdict).toBe('mismatch')
  })
  test('Employer mismatch vs authority → mismatch', () => {
    const r = buildVerificationReport(inputs({ extracted: { salary: 15000, name: 'Salem Saif Al Ameri', employer: 'Different Company', emiratesId: '784-1988-2341567-3' } }))
    expect(r.verdict).toBe('mismatch')
  })
  test('figures that do not reconcile → tampered', () => {
    const r = buildVerificationReport(inputs({
      arithmetic: checkArithmetic('Basic Salary: AED 5,000 Allowances: AED 6,000 Gross Monthly Salary: AED 15,000'),
    }))
    expect(r.verdict).toBe('tampered')
  })
  test('no authority record for an income document → unverifiable', () => {
    const r = buildVerificationReport(inputs({ record: null }))
    expect(r.verdict).toBe('unverifiable')
  })

  test('wrong document type (anchors fallback) → invalid, low confidence', () => {
    const r = buildVerificationReport(inputs({
      structure: checkStructure('This is a residential tenancy contract between landlord and tenant.', 'salary_certificate'),
      arithmetic: checkArithmetic('no salary figures here'),
      extracted: { salary: null, name: null, employer: null, emiratesId: null },
    }))
    expect(r.verdict).toBe('invalid')
    expect(r.confidenceScore).toBeLessThan(50)
    // the content fields must NOT be scored as passing for a wrong-type file
    expect(r.checks.find((c) => c.id === 'salary_match')!.status).toBe('na')
  })

  test('fabricated file flagged by vision AND judged wrong-type → suspicious (escalate), not a citizen bounce', () => {
    const r = buildVerificationReport(inputs({
      vision: vision({
        verdict: 'likely_fake',
        matchesExpectedType: false,
        reasons: ['sparse file with only a name and salary figure'],
        observed: { documentType: null, salary: null, employeeName: null, employerName: null, issueDate: null },
      }),
    }))
    expect(r.verdict).toBe('suspicious')
  })

  test('vision says WRONG type → invalid even when anchors accidentally pass', () => {
    const r = buildVerificationReport(inputs({
      vision: vision({ matchesExpectedType: false, observed: { documentType: 'bank statement', salary: null, employeeName: null, employerName: null, issueDate: null } }),
    }))
    expect(r.verdict).toBe('invalid')
    expect(r.summary).toMatch(/bank statement/i)
  })

  test('vision confirms type → NOT invalid even when the text anchors fail (scanned file)', () => {
    const r = buildVerificationReport(inputs({
      structure: null, // scanned PDF — no text layer
      extracted: { salary: null, name: null, employer: null, emiratesId: null },
      arithmetic: null,
      vision: vision({ observed: { documentType: 'salary certificate', salary: 15000, employeeName: 'Salem Saif Al Ameri', employerName: 'ADNOC', issueDate: null } }),
    }))
    expect(r.verdict).toBe('verified')
  })

  test('certificate with no readable salary → salary check N/A, not a false pass', () => {
    const r = buildVerificationReport(inputs({
      extracted: { salary: null, name: 'Salem Saif Al Ameri', employer: 'ADNOC', emiratesId: '784-1988-2341567-3' },
      declaredSalary: 15000,
    }))
    expect(r.checks.find((c) => c.id === 'salary_match')!.status).toBe('na')
    expect(r.verdict).toBe('verified') // type + identity still validate it
  })

  test('non-work letter: salary/arithmetic are N/A and no record ≠ unverifiable', () => {
    const r = buildVerificationReport({
      expectedType: 'non_work_letter',
      record: null, // an unemployed beneficiary may have no salary record — that is fine
      declaredSalary: null,
      extracted: { salary: null, name: 'Salem Saif Al Ameri', employer: null, emiratesId: '784-1988-2341567-3' },
      structure: checkStructure(NON_WORK_TEXT, 'non_work_letter'),
      arithmetic: null,
      vision: vision({ observed: { documentType: 'termination letter', salary: null, employeeName: 'Salem Saif Al Ameri', employerName: null, issueDate: '20/05/2026' } }),
    })
    expect(r.verdict).toBe('verified')
    expect(r.checks.find((c) => c.id === 'salary_match')!.status).toBe('na')
    expect(r.checks.find((c) => c.id === 'arithmetic')!.status).toBe('na')
  })

  test('non-work letter judged fake by vision → suspicious', () => {
    const r = buildVerificationReport({
      expectedType: 'non_work_letter',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: null, employer: null, emiratesId: null },
      structure: checkStructure(NON_WORK_TEXT, 'non_work_letter'),
      arithmetic: null,
      vision: vision({ verdict: 'suspicious', reasons: ['placeholder text only'] }),
    })
    expect(r.verdict).toBe('suspicious')
  })

  test('non-work letter date older than validated salary cert date → mismatch', () => {
    const r = buildVerificationReport({
      expectedType: 'non_work_letter',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: 'Salem Saif Al Ameri', employer: null, emiratesId: '784-1988-2341567-3', issueDate: '15/05/2025' },
      structure: checkStructure(NON_WORK_TEXT, 'non_work_letter'),
      arithmetic: null,
      vision: vision({ observed: { documentType: 'termination letter', salary: null, employeeName: 'Salem Saif Al Ameri', employerName: null, issueDate: '15/05/2025' } }),
      validatedSalaryCertDate: '09/06/2026',
    })
    expect(r.verdict).toBe('mismatch')
    expect(r.checks.find((c) => c.id === 'date_chronology')?.status).toBe('fail')
  })

  test('non-work letter date newer than validated salary cert date → verified', () => {
    const r = buildVerificationReport({
      expectedType: 'non_work_letter',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: 'Salem Saif Al Ameri', employer: null, emiratesId: '784-1988-2341567-3', issueDate: '09/06/2026' },
      structure: checkStructure(NON_WORK_TEXT, 'non_work_letter'),
      arithmetic: null,
      vision: vision({ observed: { documentType: 'termination letter', salary: null, employeeName: 'Salem Saif Al Ameri', employerName: null, issueDate: '09/06/2026' } }),
      validatedSalaryCertDate: '15/05/2025',
    })
    expect(r.verdict).toBe('verified')
    expect(r.checks.find((c) => c.id === 'date_chronology')?.status).toBe('pass')
  })
})
