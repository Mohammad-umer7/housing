// Document Agent (graph node) — verifies the salary certificate and flags a
// salary mismatch the Critic can act on. Real OCR extraction happens upstream in
// the API route (lib/pdf-extractor.ts); this node interprets the result. Runs in
// parallel with the DB-Fetch node.

import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import { getApplicant } from '@/lib/integrations/source-systems'
import { buildVerificationReport, type PdfMetadata, type VisionAssessment } from '@/lib/document-forensics'
import { checkStructure, checkArithmetic } from '@/lib/document-forensics'
import { assessDocumentAuthenticity } from '@/lib/llm/gemini'
import { classifyRequestCircumstances, determineRequiredDocuments } from '@/governance/housing-arrears'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { DocAuthenticity, VerificationReport } from './types'

export async function documentNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, formData } = state
  console.log(`[DocumentAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'document_agent'

  try {
    await updateAgentStep(caseNumber, agent, {
      status: 'running',
      started_at: new Date().toISOString(),
      ran_in_parallel: true,
    })

    const documentUploaded = Boolean(formData.documentUploaded)
    const declaredSalary = Number(formData.monthly_salary) || null

    // Authoritative record = the beneficiary's retrieved Programme data (MOEI /
    // Financial Services), looked up by Application ID. Income is validated against
    // THIS record — with OR without an uploaded certificate. A certificate is
    // optional; when one IS uploaded it gets the full forensic verification.
    const onRecord = await getApplicant(caseNumber)
    const onRecordSalary = Number(onRecord?.monthly_salary) || null
    const recordExists = !!onRecord && onRecordSalary !== null && onRecordSalary > 0

    // Smart completeness — decide WHICH document this case needs, read from the
    // situation (reschedule reason + free-text). A required document that is missing
    // routes back to the citizen ("Request Documents"), never a rejection.
    const reason = String(formData.reschedule_reason || onRecord?.reschedule_reason || 'other')
    const freeText = `${formData.remarks ?? onRecord?.remarks ?? ''} ${onRecord?.justifications ?? ''}`
    const circ = classifyRequestCircumstances(reason, freeText)
    const required = determineRequiredDocuments({
      reschedule_reason: reason,
      unemployment: circ.unemployment,
      income_changed: Boolean(onRecord?.income_changed) || circ.income_changed,
      temporary_circumstance: circ.temporary_circumstance,
      hasIncomeRecord: recordExists,
    })

    const extractedFields = (formData.pdfExtractedFields ?? {}) as {
      employeeName?: string | null
      monthlySalary?: number | null
      employerName?: string | null
      confidence?: number
    }
    const extractedSalary: number | null = extractedFields.monthlySalary ?? null
    const confidence = Number(extractedFields.confidence) || 0

    const authorityRecord = recordExists
      ? {
          doc_code: '',
          emirates_id: String(onRecord!.emirates_id ?? ''),
          employee_name: String(onRecord!.full_name ?? ''),
          employer_name: '',
          job_title: null,
          basic_salary: 0,
          allowances: 0,
          gross_salary: onRecordSalary!,
          issue_date: '',
          status: 'valid',
        }
      : null

    let verificationReport: VerificationReport
    if (documentUploaded) {
      // Gemini VISION authenticity runs HERE in the background (not in the submission
      // route), so it never blocks the citizen's submit. It catches a fabricated file
      // that carries only the wanted values with no real letterhead/signature. Fully
      // non-fatal: a null result (no key / 503 / timeout) just leaves the check N/A.
      const pdfBase64 = typeof formData.pdfBase64 === 'string' ? formData.pdfBase64 : null
      const vision: VisionAssessment | null = pdfBase64
        ? await assessDocumentAuthenticity(Buffer.from(pdfBase64, 'base64'))
        : null

      // Full forensic verification of the uploaded document against the record.
      verificationReport = buildVerificationReport({
        record: authorityRecord,
        declaredSalary,
        extracted: {
          salary: extractedSalary,
          name: extractedFields.employeeName ?? null,
          employer: extractedFields.employerName ?? null,
          emiratesId: (formData.pdfExtractedEid as string | null) ?? null,
        },
        structure: (formData.pdfStructure as ReturnType<typeof checkStructure> | null) ?? null,
        arithmetic: (formData.pdfArithmetic as ReturnType<typeof checkArithmetic> | null) ?? null,
        metadata: (formData.pdfMetadata as PdfMetadata | null) ?? null,
        vision,
      })
    } else {
      // No certificate was uploaded — ask the citizen for exactly the document THIS
      // situation needs (Request Documents, NOT a rejection).
      verificationReport = {
        verdict: 'unverifiable',
        confidenceScore: 0,
        checks: [{
          id: 'documents_required',
          label: 'Required supporting document provided',
          status: 'fail',
          detail: `Please provide: ${required.labels.join('; ')}.`,
          weight: 100,
        }],
        summary: `Additional documentation required — ${required.labels.join('; ')}.`,
        authorityName: onRecord ? (String(onRecord.full_name ?? '') || null) : null,
        authoritySalary: onRecordSalary,
      }
    }

    const verdict = verificationReport.verdict

    // Routing contract for an UPLOADED certificate:
    //   • invalid  → the file is not a salary certificate (wrong document)          ⇒ Request Documents
    //   • mismatch → the certificate's details disagree with the beneficiary record ⇒ Request Documents
    //   • verified → genuine and matching                                           ⇒ proceed
    //   • suspicious / tampered / unverifiable → the DATA is real but the file is
    //     flagged (fabricated-looking, edited, or no record to compare) ⇒ proceed so
    //     the Critic escalates it to a HUMAN OFFICER (never bounced to the citizen).
    // A missing upload always asks the citizen for the required document.
    const needsResubmit = documentUploaded && (verdict === 'invalid' || verdict === 'mismatch')
    const complete = documentUploaded && !needsResubmit

    // Specific, citizen-facing reason when we bounce the file back for re-submission.
    const resubmitReason =
      verdict === 'invalid'
        ? 'The uploaded file does not appear to be a salary certificate. Please upload a valid salary certificate (issued within the last 30 days).'
        : verdict === 'mismatch'
        ? `${verificationReport.summary} Please re-submit a correct, genuine salary certificate that matches your records.`
        : ''

    const authenticity: DocAuthenticity = verdict
    const authorityName = verificationReport.authorityName
    const authoritySalary = verificationReport.authoritySalary
    // Citizen-facing reason: the specific resubmit message when bouncing the file back;
    // otherwise the verification summary (used by the Critic when it escalates).
    const authorityReason = needsResubmit ? resubmitReason : verificationReport.summary
    const salaryMismatch = authenticity === 'mismatch'

    const documents = complete ? [required.primaryType] : []
    // What to ask the citizen for: the specific resubmit reason for a wrong/mismatched
    // upload, otherwise the situation's required documents (missing upload).
    const missing = complete ? [] : needsResubmit ? [resubmitReason] : required.labels
    const icon = authenticity === 'verified' ? `✓ verified ${verificationReport.confidenceScore}%` : `⚠ ${authenticity} (${verificationReport.confidenceScore}%)`
    const stateLabel = !documentUploaded
      ? `Documents required (${required.primaryType})`
      : needsResubmit
      ? `Resubmit required — ${verdict === 'invalid' ? 'not a salary certificate' : 'details do not match record'}`
      : 'Document uploaded'
    const resultSummary = `${stateLabel} · ${icon}`

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: resultSummary,
    })

    console.log(`[DocumentAgent] DONE case=${caseNumber} complete=${complete} authenticity=${authenticity} duration=${duration}ms`)
    return {
      docResult: {
        documents, complete, missing, salaryMismatch, extractedSalary, confidence,
        authenticity, authorityName, authoritySalary, authorityReason, verificationReport,
        requiredDocuments: required.labels,
      },
    }
  } catch (err) {
    console.error(`[DocumentAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Non-fatal error: ${String(err)}`,
      })
    } catch { /* ignore secondary failure */ }
    return { docResult: { documents: [], complete: false, missing: ['salary_certificate'], salaryMismatch: false, extractedSalary: null, confidence: 0, authenticity: 'skipped', authorityName: null, authoritySalary: null, authorityReason: 'Document agent error — authenticity not checked.', verificationReport: null, requiredDocuments: [] } }
  }
}
