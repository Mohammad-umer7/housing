import { buildVerificationReport, type VisionAssessment } from '../lib/document-forensics'
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

describe('Smart required documents', () => {
  it('unemployment → official non-work / termination letter, upload required', () => {
    const r = determineRequiredDocuments({ unemployment: true, hasIncomeRecord: true })
    expect(r.primaryType).toBe('non_work_letter')
    expect(r.requiresUpload).toBe(true)
    expect(r.labels[0]).toMatch(/non-work|termination/i)
  })

  it('business failure → income / bank statement, upload required', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'business_failure', hasIncomeRecord: true })
    expect(r.primaryType).toBe('income_statement')
    expect(r.requiresUpload).toBe(true)
  })

  it('income change → recent salary certificate, upload required', () => {
    const r = determineRequiredDocuments({ income_changed: true, hasIncomeRecord: true })
    expect(r.primaryType).toBe('salary_certificate')
    expect(r.requiresUpload).toBe(true)
  })

  it('stable employment WITH income on record → salary certificate still required', () => {
    // Policy: a certificate is ALWAYS required so the forensic + vision check runs,
    // even when on-record income could otherwise validate the case.
    const r = determineRequiredDocuments({ reschedule_reason: 'other', hasIncomeRecord: true })
    expect(r.primaryType).toBe('salary_certificate')
    expect(r.requiresUpload).toBe(true)
  })

  it('stable employment WITHOUT income on record → upload required', () => {
    const r = determineRequiredDocuments({ reschedule_reason: 'other', hasIncomeRecord: false })
    expect(r.requiresUpload).toBe(true)
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
