// Document Agent (graph node) — verifies the uploaded document (doc-type aware) and
// flags fraud signals the Critic can act on. Real OCR extraction happens upstream in
// the API route (lib/pdf-extractor.ts, three-tier Groq → Gemini Vision → regex); this
// node runs the Gemini authenticity review and interprets the combined result. Runs in
// parallel with the DB-Fetch node.
//
// ROUTING CONTRACT for an UPLOADED document:
//   • invalid    → the file is NOT the requested document type (e.g. a tenancy
//                  contract when a salary certificate was asked for)
//                  ⇒ Request Documents (bounced to the citizen with the exact ask)
//   • verified   → genuine and matching ⇒ proceed; the governance rules (G-00…G-05)
//                  then decide Approve / Reject / Escalate
//   • mismatch / suspicious / tampered / unverifiable → fraud or authenticity signal
//                  (DB cross-check failed, vision flagged a fake, figures edited, or
//                  no record to compare) ⇒ proceed so the Critic FORCE-ESCALATES it to
//                  a HUMAN OFFICER — the citizen is NEVER auto-rejected for a document
//                  authenticity problem, and both the citizen and the officer receive
//                  the AI rationale explaining exactly what was flagged.
// A missing upload always asks the citizen for the specific required document.

import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import { getApplicant } from '@/lib/integrations/source-systems'
import {
  buildVerificationReport,
  DOC_TYPE_PROFILES,
  type StructureCheck,
  type VisionAssessment,
} from '@/lib/document-forensics'
import { checkArithmetic } from '@/lib/document-forensics'
import { assessDocumentAuthenticity, isGeminiConfigured } from '@/lib/llm/gemini'
import { markFallback } from '@/lib/i18n'
import { classifyRequestCircumstances, determineRequiredDocuments, type DocSpec } from '@/governance/housing-arrears'
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
    // THIS record — with OR without an uploaded certificate. When a document IS
    // uploaded it gets the full doc-type-aware verification.
    const onRecord = await getApplicant(caseNumber)
    const onRecordSalary = Number(onRecord?.monthly_salary) || null
    const recordExists = !!onRecord && onRecordSalary !== null && onRecordSalary > 0

    // Smart completeness — decide WHICH document this case needs, read from the
    // situation (reschedule reason + free-text). A required document that is missing
    // routes back to the citizen ("Request Documents"), never a rejection.
    const reason = String(formData.reschedule_reason || onRecord?.reschedule_reason || 'other')
    const freeText = `${formData.remarks ?? onRecord?.remarks ?? ''} ${onRecord?.justifications ?? ''}`
    const circ = classifyRequestCircumstances(reason, freeText)

    const uploadedDocType =
      formData.pdfExpectedDocType === 'salary_certificate' || formData.salaryCertAlreadyValidated
        ? 'salary_certificate'
        : formData.pdfExpectedDocType === 'non_work_letter'
        ? 'non_work_letter'
        : undefined

    const required = determineRequiredDocuments({
      reschedule_reason: reason,
      unemployment: circ.unemployment,
      income_changed: Boolean(onRecord?.income_changed) || circ.income_changed,
      temporary_circumstance: circ.temporary_circumstance,
      hasIncomeRecord: recordExists,
      uploadedDocType,
    })
    // Two-document round-trip: if the salary cert was already validated in a prior
    // submission, THIS submission is the supporting-doc stage; otherwise it's the primary
    // (mandatory) stage. The uploaded file (always one per submission) is validated against
    // the current stage's expected type.
    const salaryCertAlreadyValidated = Boolean(formData.salaryCertAlreadyValidated)
    const carriedSalary = Number(formData.validatedSalary) || null
    const stage: 'primary' | 'supporting' =
      salaryCertAlreadyValidated && required.supporting ? 'supporting' : 'primary'
    const expectedType = stage === 'supporting' ? required.supporting!.type : required.primary.type
    const profile = DOC_TYPE_PROFILES[expectedType]

    const extractedFields = (formData.pdfExtractedFields ?? {}) as {
      employeeName?: string | null
      monthlySalary?: number | null
      employerName?: string | null
      confidence?: number
      source?: string
    }
    const extractedSalary: number | null = extractedFields.monthlySalary ?? null
    const confidence = Number(extractedFields.confidence) || 0
    const ocrWasFallback = extractedFields.source === 'regex_fallback'

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
          account_number: onRecord!.account_number ? String(onRecord!.account_number) : null,
          iban: onRecord!.iban ? String(onRecord!.iban) : null,
        }
      : null

    let verificationReport: VerificationReport
    let supportingReport: VerificationReport | null = null

    if (documentUploaded) {
      // Gemini VISION review runs HERE in the background (not in the submission route),
      // so it never blocks the citizen's submit. It is TOLD the expected document type
      // (so it knows whether the file is even the right document) and judges whether it
      // looks genuinely issued — stamps/signatures deliberately ignored. Fully
      // non-fatal: a null result (no key / 503 / timeout / circuit open) leaves the
      // vision check N/A and the deterministic forensics decide alone (fallback).
      const pdfBase64 = typeof formData.pdfBase64 === 'string' ? formData.pdfBase64 : null
      const vision: VisionAssessment | null = pdfBase64
        ? await assessDocumentAuthenticity(Buffer.from(pdfBase64, 'base64'), expectedType)
        : null

      // Full doc-type-aware verification of the uploaded document against the record.
      verificationReport = buildVerificationReport({
        expectedType,
        record: authorityRecord,
        declaredSalary,
        extracted: {
          salary: extractedSalary,
          name: extractedFields.employeeName ?? null,
          employer: extractedFields.employerName ?? null,
          emiratesId: (formData.pdfExtractedEid as string | null) ?? null,
          iban: (formData.pdfExtractedIban as string | null) ?? null,
          account: (formData.pdfExtractedAccount as string | null) ?? null,
          issueDate: extractedFields.issueDate ?? null,
        },
        structure: (formData.pdfStructure as StructureCheck | null) ?? null,
        arithmetic: (formData.pdfArithmetic as ReturnType<typeof checkArithmetic> | null) ?? null,
        vision,
        validatedSalaryCertDate: formData.validatedSalaryCertDate ? String(formData.validatedSalaryCertDate) : null,
        hashIntegrity: (formData.pdfHashIntegrity as { hasToken: boolean; hashMatch: boolean; storedHash: string | null; computedHash: string | null } | null) ?? null,
      })

      // If primary is valid/accepted and we have a supporting document uploaded in this same primary stage:
      if (stage === 'primary' && verificationReport.verdict !== 'invalid' && Boolean(formData.supportingDocUploaded) && required.supporting) {
        const expectedSupportingType = required.supporting.type
        const pdfSupportingBase64 = typeof formData.pdfSupportingBase64 === 'string' ? formData.pdfSupportingBase64 : null
        const suppVision: VisionAssessment | null = pdfSupportingBase64
          ? await assessDocumentAuthenticity(Buffer.from(pdfSupportingBase64, 'base64'), expectedSupportingType)
          : null

        const suppExtractedFields = (formData.pdfSupportingExtractedFields ?? {}) as {
          employeeName?: string | null
          monthlySalary?: number | null
          employerName?: string | null
          confidence?: number
          source?: string
          issueDate?: string | null
        }

        const primaryValidatedDate = extractedFields.issueDate ?? vision?.observed?.issueDate ?? null

        supportingReport = buildVerificationReport({
          expectedType: expectedSupportingType,
          record: authorityRecord,
          declaredSalary,
          extracted: {
            salary: suppExtractedFields.monthlySalary ?? null,
            name: suppExtractedFields.employeeName ?? null,
            employer: suppExtractedFields.employerName ?? null,
            emiratesId: (formData.pdfSupportingExtractedEid as string | null) ?? null,
            iban: (formData.pdfSupportingExtractedIban as string | null) ?? null,
            account: (formData.pdfSupportingExtractedAccount as string | null) ?? null,
            issueDate: suppExtractedFields.issueDate ?? null,
          },
          structure: (formData.pdfSupportingStructure as StructureCheck | null) ?? null,
          arithmetic: (formData.pdfSupportingArithmetic as ReturnType<typeof checkArithmetic> | null) ?? null,
          vision: suppVision,
          validatedSalaryCertDate: primaryValidatedDate,
        })
      }
    } else {
      // No document was uploaded — ask the citizen for exactly the document THIS
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
        expectedType,
      }
    }

    const primaryVerdict = verificationReport.verdict

    if (supportingReport) {
      // Merge the two reports
      const mergedChecks = [
        ...verificationReport.checks,
        ...supportingReport.checks.map(c => ({
          ...c,
          id: `supp_${c.id}`,
          label: `${c.label} (Supporting Doc)`,
          detail: `${c.detail} (Supporting Doc)`,
        }))
      ]

      // Recalculate confidenceScore
      const scored = mergedChecks.filter((c) => c.scored !== false && c.status !== 'na')
      const totalWeight = scored.reduce((s, c) => s + c.weight, 0) || 1
      const earned = scored.reduce(
        (s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
        0
      )
      const combinedConfidenceScore = Math.round((earned / totalWeight) * 100)

      // Precedence: suspicious > invalid > mismatch > unverifiable > tampered > verified
      let combinedVerdict: typeof verificationReport.verdict = 'verified'
      const verdicts = [verificationReport.verdict, supportingReport.verdict]
      if (verdicts.includes('suspicious')) combinedVerdict = 'suspicious'
      else if (verdicts.includes('invalid')) combinedVerdict = 'invalid'
      else if (verdicts.includes('mismatch')) combinedVerdict = 'mismatch'
      else if (verdicts.includes('unverifiable')) combinedVerdict = 'unverifiable'
      else if (verdicts.includes('tampered')) combinedVerdict = 'tampered'

      const combinedSummary = `${verificationReport.summary} Supporting Doc: ${supportingReport.summary}`

      verificationReport = {
        verdict: combinedVerdict,
        confidenceScore: combinedConfidenceScore,
        checks: mergedChecks,
        summary: combinedSummary,
        authorityName: verificationReport.authorityName,
        authoritySalary: verificationReport.authoritySalary,
        expectedType: verificationReport.expectedType,
      }
    }

    const verdict = verificationReport.verdict

    // Routing contract:
    //   hash_tampered — cryptographic proof the file was edited after issuance.
    //                   Citizen sees "resubmit the original"; officer gets the full
    //                   AI rationale (fraud signal path).
    //   invalid       — wrong document type: bounced to citizen with exact ask.
    //   mismatch / suspicious / tampered — field/vision fraud signals: escalated
    //                   to officer; citizen never auto-rejected for authenticity.
    const hashTampered = documentUploaded && verdict === 'hash_tampered'
    const wrongType = documentUploaded && verdict === 'invalid'
    const fraudSignal = documentUploaded && ['mismatch', 'suspicious', 'tampered', 'hash_tampered'].includes(verdict)
    const accepted = documentUploaded && !wrongType // present & right type (fraud still proceeds)

    // ── Two-document completeness ────────────────────────────────────────────────
    // `complete` (→ document_valid → G-01) is true only when EVERY required document for
    // this case is satisfied. A mandatory salary cert plus a reason-specific supporting
    // doc is collected over a Request-Documents round-trip: the salary cert first, then
    // the supporting doc (the salary cert is trusted forward so it isn't re-uploaded).
    let complete: boolean
    let owedDoc: DocSpec | null
    let pendingSupportingDoc: { type: string; label: string } | null = null
    let salaryCertValidated = salaryCertAlreadyValidated
    let validatedSalary: number | null = stage === 'supporting' ? carriedSalary : null

    if (stage === 'supporting') {
      // Salary cert trusted from the prior submission; validate the supporting doc.
      complete = accepted
      owedDoc = accepted ? null : required.supporting
      if (!accepted) pendingSupportingDoc = required.supporting
    } else {
      // stage === 'primary'
      const primaryAccepted = documentUploaded && primaryVerdict !== 'invalid'
      const primaryFraud = primaryAccepted && ['mismatch', 'suspicious', 'tampered', 'hash_tampered'].includes(primaryVerdict)

      if (!primaryAccepted) {
        complete = false
        owedDoc = required.primary
      } else if (primaryFraud) {
        complete = true
        owedDoc = null
      } else if (required.supporting) {
        if (supportingReport) {
          const suppAccepted = supportingReport.verdict !== 'invalid'
          const suppFraud = suppAccepted && ['mismatch', 'suspicious', 'tampered'].includes(supportingReport.verdict)

          if (!suppAccepted) {
            complete = false
            owedDoc = required.supporting
            pendingSupportingDoc = required.supporting
            salaryCertValidated = true
            validatedSalary = extractedSalary ?? onRecordSalary
          } else if (suppFraud) {
            complete = true
            owedDoc = null
          } else {
            complete = true
            owedDoc = null
          }
        } else {
          complete = false
          owedDoc = required.supporting
          pendingSupportingDoc = required.supporting
          salaryCertValidated = true
          validatedSalary = extractedSalary ?? onRecordSalary
        }
      } else {
        complete = true
        owedDoc = null
      }
    }

    // Specific, citizen-facing reason when we bounce the file back for re-submission.
    const resubmitReason = hashTampered
      ? 'This document has been modified from its original. Please resubmit the original, unedited document.'
      : wrongType
      ? (supportingReport && supportingReport.verdict === 'invalid'
        ? `The uploaded supporting document does not appear to be a ${DOC_TYPE_PROFILES[required.supporting!.type].label}. Please upload: ${owedDoc?.label ?? required.supporting!.label}.`
        : `The uploaded file does not appear to be a ${profile.label}. Please upload: ${owedDoc?.label ?? required.primary.label}.`)
      : ''

    const authenticity: DocAuthenticity = verdict
    const authorityName = verificationReport.authorityName
    const authoritySalary = verificationReport.authoritySalary
    // Citizen-facing reason: hash_tampered + wrong-type get the resubmit message;
    // everything else uses the verification summary (Critic escalation rationale).
    const authorityReason = (hashTampered || wrongType) ? resubmitReason : verificationReport.summary
    const salaryMismatch = authenticity === 'mismatch'

    const primaryDone = stage === 'supporting' || accepted
    const documents = complete
      ? [required.primary.type, ...(required.supporting ? [required.supporting.type] : [])]
      : (primaryDone ? [required.primary.type] : [])
    // What to ask the citizen for: the specific resubmit reason for a wrong-type upload,
    // otherwise the next owed document (missing upload).
    const missing = complete ? [] : wrongType ? [resubmitReason] : owedDoc ? [owedDoc.label] : required.labels
    const visionRan = isGeminiConfigured() && documentUploaded
    const fallbackTag = documentUploaded && !visionRan ? ' · vision off (fallback)' : ''
    const ocrTag = ocrWasFallback ? ' · OCR regex (fallback)' : ''
    const icon = authenticity === 'verified'
      ? `✓ verified ${verificationReport.confidenceScore}%`
      : `⚠ ${authenticity} (${verificationReport.confidenceScore}%)`
    const stateLabel = !documentUploaded
      ? `${stage === 'supporting' ? 'Supporting document' : 'Documents'} required (${expectedType})`
      : hashTampered
      ? 'Resubmit required — document modified (hash mismatch)'
      : wrongType
      ? (supportingReport && supportingReport.verdict === 'invalid' ? `Resubmit required — not a ${DOC_TYPE_PROFILES[required.supporting!.type].label}` : `Resubmit required — not a ${profile.label}`)
      : stage === 'primary' && !complete
      ? `Salary cert verified — supporting document required (${required.supporting?.type ?? ''})`
      : `Document verified (${expectedType})`
    const resultSummary = `${stateLabel} · ${icon}${fallbackTag}${ocrTag}`

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: resultSummary,
    })

    console.log(`[DocumentAgent] DONE case=${caseNumber} complete=${complete} expected=${expectedType} authenticity=${authenticity} duration=${duration}ms`)
    const validatedSalaryCertDate =
      stage === 'primary' && accepted
        ? (extractedFields.issueDate ?? vision?.observed?.issueDate ?? null)
        : (formData.validatedSalaryCertDate ?? null)

    return {
      docResult: {
        documents, complete, missing, salaryMismatch, extractedSalary, confidence,
        authenticity, authorityName, authoritySalary, authorityReason, verificationReport,
        requiredDocuments: required.labels,
        stage, pendingSupportingDoc, salaryCertValidated, validatedSalary,
        validatedSalaryCertDate,
      },
    }
  } catch (err) {
    console.error(`[DocumentAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: markFallback(`Non-fatal error: ${String(err)}`),
      })
    } catch { /* ignore secondary failure */ }
    return { docResult: { documents: [], complete: false, missing: ['salary_certificate'], salaryMismatch: false, extractedSalary: null, confidence: 0, authenticity: 'skipped', authorityName: null, authoritySalary: null, authorityReason: markFallback('Document agent error — authenticity not checked.'), verificationReport: null, requiredDocuments: [] } }
  }
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const clean = dateStr.trim()

  // Match DD/MM/YYYY or DD-MM-YYYY
  let match = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const year = parseInt(match[3], 10)
    return new Date(year, month, day)
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  match = clean.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    return new Date(year, month, day)
  }

  // Fallback parser
  const parsed = new Date(clean)
  return isNaN(parsed.getTime()) ? null : parsed
}
