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
} from '@/lib/data-layer'
import { baseApplicationId } from '@/lib/integrations/source-systems'
import { requireAuth, checkRateLimit } from '@/lib/middleware/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { extractTextFromPDF, extractSalaryCertificateFields } from '@/lib/pdf-extractor'
import { parsePdfMetadata, checkStructure, checkArithmetic, extractEmiratesId } from '@/lib/document-forensics'

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
      }
      const fileEntry = formData.get('salaryCertificate')
      if (fileEntry instanceof File && fileEntry.size > 0) salaryCertFile = fileEntry
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

    // Real PDF extraction + document forensics
    let extractedPdfText = ''
    let pdfExtractedFields = null
    let pdfMetadata = null
    let pdfStructure = null
    let pdfArithmetic = null
    let pdfExtractedEid: string | null = null
    let pdfBase64: string | null = null
    const documentUploaded = !!salaryCertFile

    if (salaryCertFile) {
      const arrayBuffer = await salaryCertFile.arrayBuffer()
      const pdfBuf = Buffer.from(arrayBuffer.slice(0))

      extractedPdfText = await extractTextFromPDF(arrayBuffer)
      if (extractedPdfText.length > 50 && process.env.GROQ_API_KEY) {
        pdfExtractedFields = await extractSalaryCertificateFields(extractedPdfText)
      }
      // Deterministic forensic signals (layout/structure, internal arithmetic, identity,
      // PDF metadata for editing). The Gemini VISION authenticity check runs LATER in the
      // background Document Agent — so we keep the raw PDF (base64) on the job payload and
      // do NOT block the submission response on a vision LLM call here.
      pdfMetadata = parsePdfMetadata(pdfBuf.toString('latin1'))
      pdfStructure = checkStructure(extractedPdfText)
      pdfArithmetic = checkArithmetic(extractedPdfText)
      pdfExtractedEid = extractEmiratesId(extractedPdfText)
      if (pdfBuf.byteLength <= 4 * 1024 * 1024) pdfBase64 = pdfBuf.toString('base64')
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
      pdfExtractedFields,
      pdfMetadata,
      pdfStructure,
      pdfArithmetic,
      pdfExtractedEid,
      pdfBase64,
      documents: documentUploaded
        ? ['salary_certificate']
        : (Array.isArray(body.documents) ? body.documents : ['salary_certificate']),
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
