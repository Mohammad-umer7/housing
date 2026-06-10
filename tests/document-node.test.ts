import { documentNode } from '../agents/document-agent'
import { getApplicant } from '../lib/integrations/source-systems'
import { updateAgentStep } from '../lib/data-layer'

jest.mock('../lib/data-layer', () => ({
  updateAgentStep: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../lib/integrations/source-systems', () => ({
  getApplicant: jest.fn(),
}))

jest.mock('../lib/llm/gemini', () => ({
  assessDocumentAuthenticity: jest.fn().mockResolvedValue({
    verdict: 'authentic',
    confidence: 90,
    reasons: [],
    matchesExpectedType: true,
    observed: {
      documentType: 'salary certificate',
      salary: 15000,
      employeeName: 'Salem Saif Al Ameri',
      employerName: 'ADNOC',
      issueDate: '20/05/2026',
    },
  }),
  isGeminiConfigured: jest.fn().mockReturnValue(true),
}))

describe('documentNode - simultaneous upload verification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('valid primary + valid supporting -> complete = true', async () => {
    (getApplicant as jest.Mock).mockResolvedValue({
      full_name: 'Salem Saif Al Ameri',
      emirates_id: '784-1988-2341567-3',
      monthly_salary: 15000,
      reschedule_reason: 'job_loss',
    })

    const state = {
      caseNumber: 'CASE-001',
      formData: {
        documentUploaded: true,
        pdfExpectedDocType: 'salary_certificate',
        pdfExtractedFields: {
          employeeName: 'Salem Saif Al Ameri',
          monthlySalary: 15000,
          employerName: 'ADNOC',
          issueDate: '20/05/2026',
        },
        pdfStructure: { looksLikeExpectedDoc: true, found: 6, total: 6 },
        pdfArithmetic: { consistent: true, hasFigures: true, basic: 9000, allowances: 6000, gross: 15000 },
        pdfExtractedEid: '784-1988-2341567-3',
        reschedule_reason: 'job_loss',
        
        supportingDocUploaded: true,
        pdfSupportingExpectedDocType: 'non_work_letter',
        pdfSupportingExtractedFields: {
          employeeName: 'Salem Saif Al Ameri',
          employerName: 'ADNOC',
          issueDate: '09/06/2026',
        },
        pdfSupportingStructure: { looksLikeExpectedDoc: true, found: 3, total: 3 },
      },
    } as any

    const result = await documentNode(state)
    expect(result.docResult).toBeDefined()
    expect(result.docResult.complete).toBe(true)
    expect(result.docResult.authenticity).toBe('verified')
    expect(result.docResult.verificationReport.checks.some(c => c.id.startsWith('supp_'))).toBe(true)
  })

  test('valid primary + invalid supporting type -> complete = false, salaryCertValidated = true', async () => {
    (getApplicant as jest.Mock).mockResolvedValue({
      full_name: 'Salem Saif Al Ameri',
      emirates_id: '784-1988-2341567-3',
      monthly_salary: 15000,
      reschedule_reason: 'job_loss',
    })

    const state = {
      caseNumber: 'CASE-001',
      formData: {
        documentUploaded: true,
        pdfExpectedDocType: 'salary_certificate',
        pdfExtractedFields: {
          employeeName: 'Salem Saif Al Ameri',
          monthlySalary: 15000,
          employerName: 'ADNOC',
          issueDate: '20/05/2026',
        },
        pdfStructure: { looksLikeExpectedDoc: true, found: 6, total: 6 },
        pdfArithmetic: { consistent: true, hasFigures: true, basic: 9000, allowances: 6000, gross: 15000 },
        pdfExtractedEid: '784-1988-2341567-3',
        reschedule_reason: 'job_loss',
        
        supportingDocUploaded: true,
        pdfSupportingExpectedDocType: 'non_work_letter',
        pdfSupportingExtractedFields: {},
        pdfSupportingStructure: { looksLikeExpectedDoc: false, found: 0, total: 3 },
      },
    } as any

    const result = await documentNode(state)
    expect(result.docResult).toBeDefined()
    expect(result.docResult.complete).toBe(false)
    expect(result.docResult.salaryCertValidated).toBe(true)
    expect(result.docResult.pendingSupportingDoc).toBeDefined()
    expect(result.docResult.pendingSupportingDoc.type).toBe('non_work_letter')
  })

  test('valid primary + supporting with date chronology error -> mismatch verdict', async () => {
    (getApplicant as jest.Mock).mockResolvedValue({
      full_name: 'Salem Saif Al Ameri',
      emirates_id: '784-1988-2341567-3',
      monthly_salary: 15000,
      reschedule_reason: 'job_loss',
    })

    const state = {
      caseNumber: 'CASE-001',
      formData: {
        documentUploaded: true,
        pdfExpectedDocType: 'salary_certificate',
        pdfExtractedFields: {
          employeeName: 'Salem Saif Al Ameri',
          monthlySalary: 15000,
          employerName: 'ADNOC',
          issueDate: '09/06/2026',
        },
        pdfStructure: { looksLikeExpectedDoc: true, found: 6, total: 6 },
        pdfArithmetic: { consistent: true, hasFigures: true, basic: 9000, allowances: 6000, gross: 15000 },
        pdfExtractedEid: '784-1988-2341567-3',
        reschedule_reason: 'job_loss',
        
        supportingDocUploaded: true,
        pdfSupportingExpectedDocType: 'non_work_letter',
        pdfSupportingExtractedFields: {
          employeeName: 'Salem Saif Al Ameri',
          employerName: 'ADNOC',
          issueDate: '15/05/2025',
        },
        pdfSupportingStructure: { looksLikeExpectedDoc: true, found: 3, total: 3 },
      },
    } as any

    const result = await documentNode(state)
    expect(result.docResult).toBeDefined()
    expect(result.docResult.complete).toBe(true)
    expect(result.docResult.authenticity).toBe('mismatch')
  })
})
