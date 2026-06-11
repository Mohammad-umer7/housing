import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { processCase } from '@/lib/worker'
import {
  getResubmissionGate,
  resetCaseForResubmit,
  getCasesByEmiratesId,
  countActiveJobs,
  addToQueue,
  upsertCase,
  initAgentSteps,
  checkRefNumberUniqueness,
} from '@/lib/data-layer'
import { baseApplicationId } from '@/lib/integrations/source-systems'
import { requireAuth, checkRateLimit, checkEidRateLimit } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { extractTextFromPDF, extractDocumentFields } from '@/lib/pdf-extractor'
import { checkStructure, checkArithmetic, extractEmiratesId, extractIban, extractAccountNumber, extractRefNumber, checkPdfMetadata, checkFontConsistency, validateEmiratesIdFormat, validatePhoneUAE } from '@/lib/document-forensics'
import { checkHashIntegrity } from '@/lib/doc-hash-verify'
import { classifyRequestCircumstances, determineRequiredDocuments } from '@/governance/housing-arrears'

const sanitize = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, '').trim()

export async function POST(req: NextRequest) {
  let apiKey: string | null = null
  try {
    await requireAuth(req)
    apiKey = req.headers.get('x-api-key')
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  if (apiKey && !checkRateLimit(apiKey)) {
    return NextResponse.json(errorResponse('Rate limit exceeded. Try again in 1 minute.', 429), { status: 429 })
  }

  try {
    const contentType = req.headers.get('content-type') ?? ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any>
    let salaryCertFile: File | null = null
    let supportingDocFile: File | null = null
    const extraFileEntries: { file: File; description: string }[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      body = {
        case_number: formData.get('case_number'),
        full_name: formData.get('full_name'),
        emirates_id: formData.get('emirates_id'),
        phone: formData.get('phone'),
        arrears_amount: formData.get('arrears_amount'),
        monthly_salary: formData.get('monthly_salary'),
        monthly_expenses: formData.get('monthly_expenses') ?? '0',
        reschedule_reason: formData.get('reschedule_reason'),
        months_in_arrears: formData.get('months_in_arrears'),
        remarks: formData.get('remarks'),
        remaining_loan_months: formData.get('remaining_loan_months'),
        current_installment: formData.get('current_installment'),
        loan_bank_name: formData.get('loan_bank_name'),
        loan_account_number: formData.get('loan_account_number'),
        total_loan_amount: formData.get('total_loan_amount'),
        auto_dda: formData.get('auto_dda'),
        documents: formData.get('documents') ? [formData.get('documents')] : [],
        request_description: formData.get('request_description') ?? '',
        primary_description: formData.get('primary_description') ?? '',
        supporting_description: formData.get('supporting_description') ?? '',
      }
      // One file per submission — either the salary cert (primary stage) or the
      // reason-specific supporting document (round-trip). Read whichever is present.
      const primaryEntry = formData.get('salaryCertificate')
      const supportingEntry = formData.get('supportingDocument')
      if (primaryEntry instanceof File && primaryEntry.size > 0 && supportingEntry instanceof File && supportingEntry.size > 0) {
        salaryCertFile = primaryEntry
        supportingDocFile = supportingEntry
      } else {
        const fileEntry = supportingEntry ?? primaryEntry
        if (fileEntry instanceof File && fileEntry.size > 0) {
          salaryCertFile = fileEntry
        }
      }
      // Collect citizen-uploaded extra supporting documents (any format, up to 10)
      for (let i = 0; i < 10; i++) {
        const ef = formData.get(`extra_file_${i}`)
        if (!(ef instanceof File) || ef.size === 0) break
        const desc = String(formData.get(`extra_description_${i}`) ?? '').replace(/<[^>]*>/g, '').trim()
        extraFileEntries.push({ file: ef, description: desc })
      }
    } else {
      body = await req.json()
    }

    const case_number = sanitize(body.case_number)
    const full_name = sanitize(body.full_name)
    const emirates_id = sanitize(body.emirates_id)
    const phone = sanitize(body.phone)
    const arrears_amount = Number(body.arrears_amount)
    const monthly_salary = Number(body.monthly_salary)
    const monthly_expenses = Number(body.monthly_expenses) || 0

    if (!case_number) {
      return NextResponse.json(errorResponse('case_number is required', 400), { status: 400 })
    }
    if (typeof case_number !== 'string' || case_number.length > 50) {
      return NextResponse.json(errorResponse('Invalid case number format', 400), { status: 400 })
    }
    // Emirates ID rate limiting — max 3 submissions per EID in 24 hours
    if (emirates_id && !checkEidRateLimit(emirates_id)) {
      return NextResponse.json(
        errorResponse('Too many submissions from this Emirates ID. Please wait 24 hours before submitting again.', 429),
        { status: 429 }
      )
    }

    // UAE format validation — flag misformatted identifiers before any DB work
    const eidFormatValid   = validateEmiratesIdFormat(emirates_id || null)
    const phoneFormatValid = validatePhoneUAE(phone || null)

    // Real PDF extraction + document forensics setup
    let extractedPdfText = ''
    let pdfBase64: string | null = null
    let arrayBuffer: ArrayBuffer | null = null
    const documentUploaded = !!salaryCertFile
    let pdfMetadata: ReturnType<typeof checkPdfMetadata> | null = null
    let fontConsistency: ReturnType<typeof checkFontConsistency> | null = null

    let supportingExtractedText = ''
    let pdfSupportingBase64: string | null = null
    let supportingArrayBuffer: ArrayBuffer | null = null

    if (salaryCertFile) {
      arrayBuffer = await salaryCertFile.arrayBuffer()
      const pdfBuf = Buffer.from(arrayBuffer.slice(0))
      extractedPdfText = await extractTextFromPDF(arrayBuffer)
      if (pdfBuf.byteLength <= 4 * 1024 * 1024) pdfBase64 = pdfBuf.toString('base64')
      // PDF forensics — run synchronously on the already-loaded buffer
      pdfMetadata    = checkPdfMetadata(pdfBuf)
      fontConsistency = checkFontConsistency(pdfBuf)
    }

    let uploadedDocType: string | undefined = undefined
    if (extractedPdfText) {
      const salaryStruct = checkStructure(extractedPdfText, 'salary_certificate')
      if (salaryStruct.looksLikeExpectedDoc) {
        uploadedDocType = 'salary_certificate'
      } else {
        const nonWorkStruct = checkStructure(extractedPdfText, 'non_work_letter')
        if (nonWorkStruct.looksLikeExpectedDoc) {
          uploadedDocType = 'non_work_letter'
        }
      }
    }

    // Which document THIS case should have uploaded — read from the situation
    // (reschedule reason + free-text), the same classification the Document Agent
    // uses later. The expected type drives the doc-type-aware OCR field extraction
    // here and the Gemini authenticity review in the background agent.
    const reasonStr = String(body.reschedule_reason || 'other')
    const circ = classifyRequestCircumstances(reasonStr, String(body.remarks ?? ''))
    const required = determineRequiredDocuments({
      reschedule_reason: reasonStr,
      unemployment: circ.unemployment,
      income_changed: circ.income_changed,
      temporary_circumstance: circ.temporary_circumstance,
      hasIncomeRecord: true,
      uploadedDocType,
    })
    // Two-document round-trip: if a prior case for this beneficiary already validated the
    // salary cert and is still awaiting the reason-specific supporting document, THIS
    // submission is the supporting-doc stage — expect that doc and carry the salary cert
    // validation forward (server-authoritative; the client cannot force the stage).
    let salaryCertAlreadyValidated = false
    let carriedValidatedSalary: number | null = null
    let carriedValidatedSalaryCertDate: string | null = null
    if (emirates_id && required.supporting) {
      const priorCases = await getCasesByEmiratesId(emirates_id)
      // Only the MOST RECENT case reflects the current state (an older, since-resolved case
      // must not re-trigger the supporting stage).
      const mostRecent = priorCases
        .slice()
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0]
      const cs =
        mostRecent?.case_study && typeof mostRecent.case_study === 'object'
          ? (mostRecent.case_study as Record<string, unknown>)
          : null
      if (cs?.salaryCertValidated === true && cs?.pendingSupportingDoc) {
        salaryCertAlreadyValidated = true
        carriedValidatedSalary = Number(cs.validatedSalary) || null
        carriedValidatedSalaryCertDate = cs.validatedSalaryCertDate ? String(cs.validatedSalaryCertDate) : null
      }
    }
    const expectedDocType =
      salaryCertAlreadyValidated && required.supporting ? required.supporting.type : required.primary.type

    let pdfExtractedFields = null
    let pdfStructure = null
    let pdfArithmetic = null
    let pdfExtractedEid: string | null = null
    let pdfExtractedIban: string | null = null
    let pdfExtractedAccount: string | null = null
    let pdfExtractedRefNumber: string | null = null
    let refNumberUnique = true

    if (salaryCertFile && arrayBuffer) {
      // Three-tier OCR (Groq → Gemini Vision → regex fallback), doc-type aware: the
      // expected document type's profile tells the extractor exactly which fields to
      // pull (salary cert vs bank statement vs non-work letter vs medical/support doc).
      pdfExtractedFields = await extractDocumentFields(extractedPdfText, arrayBuffer, expectedDocType)
      // Deterministic forensic signals (doc-type anchors, internal arithmetic, identity).
      // The Gemini VISION authenticity check runs LATER in the background Document Agent —
      // so we keep the raw PDF (base64) on the job payload and do NOT block the citizen's
      // submission response on a vision LLM call here. A scanned PDF with no text layer
      // gets structure=null (unknown) so it is never penalised for unreadable text.
      pdfStructure = extractedPdfText.length >= 40 ? checkStructure(extractedPdfText, expectedDocType) : null
      pdfArithmetic = checkArithmetic(extractedPdfText)
      pdfExtractedEid = extractEmiratesId(extractedPdfText)
      pdfExtractedIban = extractIban(extractedPdfText)
      pdfExtractedAccount = extractAccountNumber(extractedPdfText)
      // Duplicate-reference fraud check: the same cert reference number appearing in
      // ANOTHER beneficiary's submission means a copied/altered document.
      pdfExtractedRefNumber = extractRefNumber(extractedPdfText)
      if (pdfExtractedRefNumber) {
        refNumberUnique = await checkRefNumberUniqueness(pdfExtractedRefNumber, case_number, emirates_id)
      }
    }

    // Cryptographic hash integrity — detects any text modification after issuance.
    // Only fires when the document embeds a CryptoSignatureToken (see lib/doc-hash-verify.ts).
    const pdfHashIntegrity = extractedPdfText ? checkHashIntegrity(extractedPdfText) : null

    const requestDescription = sanitize(body.request_description)
    const primaryDescription = sanitize(body.primary_description)
    const supportingDescription = sanitize(body.supporting_description)

    const supportingDocUploaded = !!supportingDocFile
    let pdfSupportingExtractedFields = null
    let pdfSupportingStructure = null
    let pdfSupportingArithmetic = null
    let pdfSupportingExtractedEid: string | null = null
    let pdfSupportingExtractedIban: string | null = null
    let pdfSupportingExtractedAccount: string | null = null

    if (supportingDocUploaded && supportingDocFile) {
      supportingArrayBuffer = await supportingDocFile.arrayBuffer()
      const pdfBuf = Buffer.from(supportingArrayBuffer.slice(0))
      supportingExtractedText = await extractTextFromPDF(supportingArrayBuffer)
      if (pdfBuf.byteLength <= 4 * 1024 * 1024) pdfSupportingBase64 = pdfBuf.toString('base64')

      const expectedSupportingType = required.supporting ? required.supporting.type : 'supporting_document'
      pdfSupportingExtractedFields = await extractDocumentFields(supportingExtractedText, supportingArrayBuffer, expectedSupportingType)
      pdfSupportingStructure = supportingExtractedText.length >= 40 ? checkStructure(supportingExtractedText, expectedSupportingType) : null
      pdfSupportingArithmetic = checkArithmetic(supportingExtractedText)
      pdfSupportingExtractedEid = extractEmiratesId(supportingExtractedText)
      pdfSupportingExtractedIban = extractIban(supportingExtractedText)
      pdfSupportingExtractedAccount = extractAccountNumber(supportingExtractedText)
    }

    // Build the unified attachedDocuments manifest now that pdfSupportingBase64 is resolved.
    type AttachedDoc = { index: number; role: 'primary' | 'supporting' | 'additional'; filename: string; mimeType: string; base64: string; description: string; size: number }
    const attachedDocuments: AttachedDoc[] = []
    if (salaryCertFile && pdfBase64) {
      attachedDocuments.push({ index: 0, role: 'primary', filename: salaryCertFile.name, mimeType: salaryCertFile.type || 'application/pdf', base64: pdfBase64, description: primaryDescription, size: salaryCertFile.size })
    }
    if (supportingDocFile && pdfSupportingBase64) {
      attachedDocuments.push({ index: 1, role: 'supporting', filename: supportingDocFile.name, mimeType: supportingDocFile.type || 'application/pdf', base64: pdfSupportingBase64, description: supportingDescription, size: supportingDocFile.size })
    }
    for (let i = 0; i < extraFileEntries.length; i++) {
      const { file, description } = extraFileEntries[i]
      const buf = Buffer.from(await file.arrayBuffer())
      if (buf.byteLength <= 5 * 1024 * 1024) {
        attachedDocuments.push({ index: 2 + i, role: 'additional', filename: file.name, mimeType: file.type || 'application/octet-stream', base64: buf.toString('base64'), description, size: buf.byteLength })
      }
    }

    // Enrich the job payload with PDF extraction + forensic results. The raw extracted
    // text is intentionally NOT stored — it is fully consumed above (LLM fields +
    // structure/arithmetic/EID), and raw PDF text often contains NUL bytes that
    // Postgres JSONB rejects.
    // Re-submission gate (server-side backstop). Keyed on the BASE Application ID: blocks
    // a new submission while a case for this person is still processing, awaiting an
    // officer's decision, or already approved. A rejected / "Request Documents" outcome is
    // NOT blocked — the citizen may re-apply / re-upload (creating a fresh case below).
    const baseAppId = baseApplicationId(case_number)
    const gate = await getResubmissionGate(baseAppId)
    if (gate.blocked) {
      return NextResponse.json(
        errorResponse(gate.reason ?? 'This application cannot be re-submitted right now.', 409),
        { status: 409 }
      )
    }

    // Each submission is its own case (= its own history card). The first submission for
    // this beneficiary uses the base Application ID; every re-submission gets a "-rN"
    // suffix so prior cards are preserved. Person identity = Emirates ID.
    const priorCount = emirates_id ? (await getCasesByEmiratesId(emirates_id)).length : 0
    const submissionCaseNumber = priorCount === 0 ? baseAppId : `${baseAppId}-r${priorCount + 1}`

    const jobPayload = {
      ...body,
      case_number: submissionCaseNumber,
      documentUploaded,
      pdfExpectedDocType: expectedDocType,
      pdfExtractedFields,
      pdfStructure,
      pdfArithmetic,
      pdfExtractedEid,
      pdfExtractedIban,
      pdfExtractedAccount,
      pdfBase64,
      pdfHashIntegrity,
      // Two-document round-trip — when set, the Document Agent trusts the prior salary-cert
      // validation and only validates the supporting document uploaded in this submission.
      salaryCertAlreadyValidated,
      validatedSalary: carriedValidatedSalary,
      validatedSalaryCertDate: carriedValidatedSalaryCertDate,
      documents: documentUploaded
        ? (supportingDocUploaded && required.supporting ? [expectedDocType, required.supporting.type] : [expectedDocType])
        : (Array.isArray(body.documents) ? body.documents : [expectedDocType]),
      // Supporting document fields:
      supportingDocUploaded,
      pdfSupportingExpectedDocType: required.supporting?.type ?? null,
      pdfSupportingExtractedFields,
      pdfSupportingStructure,
      pdfSupportingArithmetic,
      pdfSupportingExtractedEid,
      pdfSupportingExtractedIban,
      pdfSupportingExtractedAccount,
      pdfSupportingBase64,
      // Unified document manifest (all uploaded files with metadata)
      requestDescription,
      attachedDocuments,
      // UAE format validation signals (passed to document agent for scoring)
      eidFormatValid,
      phoneFormatValid,
      // PDF forensic pre-scan signals (timestamp + font analysis)
      pdfMetadata,
      fontConsistency,
      // Duplicate-reference fraud signal (cross-beneficiary DB check)
      pdfExtractedRefNumber,
      refNumberUnique,
    }

    // TESTING ONLY — clean any stale rows for this exact case number (no-op for a fresh
    // -rN). Gated by ALLOW_RESUBMIT_TESTING; remove the flag to restore normal behavior.
    if (process.env.ALLOW_RESUBMIT_TESTING === 'true') {
      await resetCaseForResubmit(submissionCaseNumber)
    }

    const queuePosition = (await countActiveJobs()) + 1

    await addToQueue(submissionCaseNumber, jobPayload)

    await upsertCase({
      case_number: submissionCaseNumber,
      full_name,
      emirates_id,
      phone,
      arrears_amount,
      monthly_salary,
      monthly_expenses,
      status: 'pending',
    })

    await initAgentSteps(submissionCaseNumber)

    // Fire background processing AFTER response is sent
    after(() => processCase(submissionCaseNumber).catch(console.error))

    return NextResponse.json(
      successResponse({ caseId: submissionCaseNumber, queuePosition, message: 'Case queued successfully' })
    )
  } catch (error) {
    console.error('[process-application] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
