import { buildVerificationReport } from '../lib/document-forensics'
import type { AuthorityRecord } from '../lib/integrations/document-authority'

const record: AuthorityRecord = {
  doc_code: 'MOEI-WPS-1001',
  emirates_id: '784-1988-2341567-3',
  employee_name: 'Salem Saif Al Ameri',
  employer_name: 'ADNOC',
  job_title: 'Senior Engineer',
  basic_salary: 9000,
  allowances: 6000,
  gross_salary: 15000,
  issue_date: '2026-05-20',
  status: 'valid',
}

// Salary/record verdict behaviour (the logic the verification engine cross-checks
// against the issuing-authority record, looked up by Emirates ID). Forensic layers
// are left 'na' (null) here so the verdict is driven purely by salary/record.
function verdict(over: { record?: AuthorityRecord | null; extractedSalary?: number | null; declaredSalary?: number | null }) {
  return buildVerificationReport({
    record: over.record === undefined ? record : over.record,
    declaredSalary: over.declaredSalary ?? null,
    extracted: { salary: over.extractedSalary ?? null, name: null, employer: null, emiratesId: null },
    structure: null,
    arithmetic: null,
    metadata: null,
  }).verdict
}

describe('verification engine — salary cross-check against the Document Authority', () => {
  test('verified: record found and salaries match', () => {
    expect(verdict({ extractedSalary: 15000, declaredSalary: 15000 })).toBe('verified')
  })

  test('unverifiable: no salary record on file for this beneficiary', () => {
    expect(verdict({ record: null, declaredSalary: 15000 })).toBe('unverifiable')
  })

  test('unverifiable: record exists but is revoked', () => {
    expect(verdict({ record: { ...record, status: 'revoked' }, declaredSalary: 15000 })).toBe('unverifiable')
  })

  test('mismatch: extracted PDF salary diverges from the authority record', () => {
    expect(verdict({ extractedSalary: 45000, declaredSalary: 15000 })).toBe('mismatch')
  })

  test('mismatch: declared (form) salary diverges even if the PDF was not read', () => {
    expect(verdict({ extractedSalary: null, declaredSalary: 30000 })).toBe('mismatch')
  })

  test('verified: small rounding difference within 2% tolerance passes', () => {
    expect(verdict({ extractedSalary: 15100 })).toBe('verified')
  })

  test('verified: no readable salary still validates against the record', () => {
    expect(verdict({ extractedSalary: null, declaredSalary: 0 })).toBe('verified')
  })
})
