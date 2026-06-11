import { buildVerificationReport, extractIban, extractAccountNumber, type VisionAssessment } from '../lib/document-forensics'
import type { AuthorityRecord } from '../lib/integrations/document-authority'
import { determineRequiredDocuments } from '../governance/housing-arrears'
import { assessDocumentAuthenticity, isGeminiConfigured } from '../lib/llm/gemini'

const record: AuthorityRecord = {
  doc_code: '',
  emirates_id: '784-1988-2341567-3',
  employee_name: 'Salem Al Ameri',
  employer_name: 'ADNOC',
  job_title: null,
  basic_salary: 9000,
  allowances: 6000,
  gross_salary: 15000,
  issue_date: '2026-05-20',
  status: 'valid',
}
const looksLikeCert = {
  docType: 'salary_certificate' as const,
  score: 1, found: 6, total: 6, looksLikeExpectedDoc: true,
}

function makeVision(over: Partial<VisionAssessment> & Pick<VisionAssessment, 'verdict'>): VisionAssessment {
  return {
    verdict: over.verdict,
    confidence: over.confidence ?? 80,
    reasons: over.reasons ?? [],
    matchesExpectedType: over.matchesExpectedType ?? true,
    observed: {
      documentType: 'salary_certificate',
      salary: null,
      employeeName: null,
      employerName: null,
      issueDate: null,
      ...(over.observed ?? {}),
    },
  }
}

function report(vision: VisionAssessment | null, extractedSalary: number | null = 15000) {
  return buildVerificationReport({
    expectedType: 'salary_certificate',
    record,
    declaredSalary: 15000,
    extracted: { salary: extractedSalary, name: record.employee_name, employer: record.employer_name, emiratesId: record.emirates_id },
    structure: looksLikeCert,
    arithmetic: null,
    vision,
  })
}

describe('Vision-LLM authenticity layer', () => {
  it('a clean, matching certificate with no vision signal verifies (deterministic fallback)', () => {
    expect(report(null).verdict).toBe('verified')
  })

  it('vision "suspicious" overrides a clean field match → suspicious (the bare-values fake)', () => {
    const r = report(makeVision({ verdict: 'suspicious', reasons: ['only a name and a salary figure, no expected content'] }))
    expect(r.verdict).toBe('suspicious')
    expect(r.checks.find((c) => c.id === 'vision_authenticity')?.status).toBe('fail')
  })

  it('vision "likely_fake" → suspicious', () => {
    expect(report(makeVision({ verdict: 'likely_fake' })).verdict).toBe('suspicious')
  })

  it('vision "authentic" keeps a matching certificate verified', () => {
    const r = report(makeVision({ verdict: 'authentic' }))
    expect(r.verdict).toBe('verified')
    expect(r.checks.find((c) => c.id === 'vision_authenticity')?.status).toBe('pass')
  })

  it('a salary the VISION model read off the doc is cross-checked → mismatch even if OCR missed it', () => {
    // extracted (OCR) salary null, but vision read AED 9,000 vs the AED 15,000 record.
    const r = report(makeVision({ verdict: 'authentic', observed: { salary: 9000 } as VisionAssessment['observed'] }), null)
    expect(r.verdict).toBe('mismatch')
  })

  it('vision says the file is NOT the requested document → invalid', () => {
    const r = report(makeVision({ verdict: 'authentic', matchesExpectedType: false, observed: { documentType: 'tenancy contract' } as VisionAssessment['observed'] }))
    expect(r.verdict).toBe('invalid')
  })

  it('vision unreadable is N/A, never penalised', () => {
    const r = report(makeVision({ verdict: 'unreadable' }))
    expect(r.verdict).toBe('verified')
    expect(r.checks.find((c) => c.id === 'vision_authenticity')?.status).toBe('na')
  })
})

describe('Smart required documents (two-document model)', () => {
  it('job loss / unemployment → non-work letter REPLACES the salary cert (no supporting doc)', () => {
    const r = determineRequiredDocuments({ unemployment: true, hasIncomeRecord: true })
    expect(r.primary.type).toBe('non_work_letter')
    expect(r.supporting).toBeNull()
    expect(r.requiresUpload).toBe(true)
    expect(r.primary.label).toMatch(/non-work|termination/i)
  })

  it('job loss / unemployment + uploadedDocType salary_certificate → salary cert is primary and non-work letter is supporting doc', () => {
    const r = determineRequiredDocuments({ unemployment: true, hasIncomeRecord: true, uploadedDocType: 'salary_certificate' })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting?.type).toBe('non_work_letter')
    expect(r.requiresUpload).toBe(true)
    expect(r.supporting?.label).toMatch(/non-work|termination/i)
  })

  it('business failure → salary cert (primary) + business failure certificate (supporting)', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'business_failure', hasIncomeRecord: true })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting?.type).toBe('business_failure_certificate')
    expect(r.supporting?.label).toMatch(/business failure|closure|insolvency/i)
  })

  it('medical expenses → salary cert (primary) + medical condition certificate (supporting)', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'medical_expenses', hasIncomeRecord: true })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting?.type).toBe('medical_certificate')
    expect(r.supporting?.label).toMatch(/medical/i)
  })

  it('salary reduction / income change → salary cert (primary) + salary reduction certificate (supporting)', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'salary_reduction', income_changed: true, hasIncomeRecord: true })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting?.type).toBe('salary_reduction_certificate')
    expect(r.supporting?.label).toMatch(/salary reduction/i)
  })

  it('other / stable employment → salary cert only (no supporting doc)', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'other', hasIncomeRecord: true })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting).toBeNull()
    expect(r.requiresUpload).toBe(true)
  })

  it('family circumstances → salary cert (primary) + family circumstances certificate (supporting)', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'family_circumstances', hasIncomeRecord: true })
    expect(r.primary.type).toBe('salary_certificate')
    expect(r.supporting?.type).toBe('family_circumstances_certificate')
    expect(r.supporting?.label).toMatch(/family circumstances/i)
  })

  it('back-compat: primaryType/labels/requiresUpload still point at the primary doc', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'business_failure', hasIncomeRecord: true })
    expect(r.primaryType).toBe('salary_certificate')
    expect(r.labels[0]).toBe(r.primary.label)
    expect(r.requiresUpload).toBe(true)
  })
})

describe('Account / IBAN cross-check', () => {
  const recIban = 'AE070331234567890123456'
  const structure = { docType: 'income_statement' as const, score: 1, found: 5, total: 5, looksLikeExpectedDoc: true }

  it('matching IBAN on the document → account check passes', () => {
    const r = buildVerificationReport({
      expectedType: 'income_statement',
      record: { ...record, iban: recIban },
      declaredSalary: null,
      extracted: { salary: null, name: record.employee_name, employer: null, emiratesId: record.emirates_id, iban: 'AE07 0331 2345 6789 0123 456' },
      structure, arithmetic: null, vision: null,
    })
    expect(r.checks.find((c) => c.id === 'account_match')?.status).toBe('pass')
    expect(r.verdict).toBe('verified')
  })

  it('a different IBAN on the document → mismatch (fraud signal → officer review)', () => {
    const r = buildVerificationReport({
      expectedType: 'income_statement',
      record: { ...record, iban: recIban },
      declaredSalary: null,
      extracted: { salary: null, name: record.employee_name, employer: null, emiratesId: record.emirates_id, iban: 'AE999999999999999999999' },
      structure, arithmetic: null, vision: null,
    })
    expect(r.checks.find((c) => c.id === 'account_match')?.status).toBe('fail')
    expect(r.verdict).toBe('mismatch')
  })

  it('no account/IBAN to compare → check is N/A (never penalised)', () => {
    const r = buildVerificationReport({
      expectedType: 'income_statement',
      record: { ...record, iban: recIban },
      declaredSalary: null,
      extracted: { salary: null, name: record.employee_name, employer: null, emiratesId: record.emirates_id },
      structure, arithmetic: null, vision: null,
    })
    expect(r.checks.find((c) => c.id === 'account_match')?.status).toBe('na')
  })
})

describe('IBAN / account extraction', () => {
  it('extracts a UAE IBAN (with or without spaces)', () => {
    expect(extractIban('Beneficiary IBAN: AE07 0331 2345 6789 0123 456 — thank you')).toBe('AE070331234567890123456')
  })
  it('extracts a labelled account number', () => {
    expect(extractAccountNumber('Account Number: 049-2019482-01')).toBe('049-2019482-01')
  })
})

describe('Gemini vision client graceful fallback', () => {
  it('is not configured and returns null without an API key', async () => {
    delete process.env.GEMINI_API_KEY
    expect(isGeminiConfigured()).toBe(false)
    const res = await assessDocumentAuthenticity(new ArrayBuffer(8), 'salary_certificate')
    expect(res).toBeNull()
  })
})
