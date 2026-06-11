// Real PDF text extraction (unpdf / pdfjs, server-side only) + THREE-TIER, doc-type
// aware field extraction (adopted from the Desktop fork backend and upgraded):
//
//   Tier 1 — Groq LLM (structured JSON on the extracted text). Fast, highest accuracy
//            for digital PDFs. The prompt's field list is generated from the expected
//            document type's profile — Gemini's doc-type profiles literally tell the
//            OCR what to extract for each document (salary cert / non-work letter /
//            bank statement / supporting document).
//   Tier 2 — Gemini Vision OCR (multimodal on the raw PDF bytes). Works on scanned /
//            photographed documents too. Separate free-tier quota pool from Groq, so
//            exhausting one doesn't exhaust the other.
//   Tier 3 — Regex parser (pure in-process, no network). Zero latency, zero cost,
//            always available. Confidence capped at 0.72 and source marked
//            'regex_fallback' so downstream agents can tag it "(fallback)".

import { z } from 'zod'
import { getStructuredModel, isLLMConfigured } from './llm/client'
import { isRateLimitError, extractRetryAfter } from './llm/errors'
import { extractFieldsWithGemini } from './llm/gemini'
import { DOC_TYPE_PROFILES, type ExpectedDocType } from './document-forensics'

const ExtractedFieldsSchema = z.object({
  employeeName: z.string().nullable(),
  monthlySalary: z.number().nullable(),
  employerName: z.string().nullable(),
  issueDate: z.string().nullable(),
  confidence: z.number(),
})

export type ExtractionSource = 'llm' | 'gemini_vision' | 'regex_fallback' | 'none'

export type ExtractedDocFields = {
  employeeName: string | null
  monthlySalary: number | null
  employerName: string | null
  issueDate: string | null
  confidence: number
  source: ExtractionSource
}

const EMPTY: ExtractedDocFields = {
  employeeName: null, monthlySalary: null, employerName: null, issueDate: null,
  confidence: 0, source: 'none',
}

// ── 1. PDF text layer extraction ─────────────────────────────────────────────

export async function extractTextFromPDF(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    // unpdf wraps a serverless-friendly pdfjs build — no worker-loading headaches in
    // the Next.js server runtime (raw pdfjs-dist fails to load its ESM worker there).
    const { getDocumentProxy, extractText } = await import('unpdf')
    // slice(0) hands pdfjs a private copy; it transfers/detaches the buffer it is
    // given, which would otherwise break a subsequent read of the same upload.
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer.slice(0)))
    const { text } = await extractText(pdf, { mergePages: true })
    return (text || '').trim()
  } catch (error) {
    console.error('[pdf-extractor] text extraction failed:', error)
    return ''
  }
}

// ── Word (.docx) support ──────────────────────────────────────────────────────
// Citizens may upload a Word document instead of a PDF. .docx files always carry a clean
// digital text layer, so mammoth's raw-text extraction feeds the SAME field/forensics
// pipeline as a PDF text layer — no OCR/vision needed. Legacy binary .doc is not
// supported by mammoth and degrades to the regex tier (returns '' here).

export function isWordDoc(filename = '', mimeType = ''): boolean {
  const n = filename.toLowerCase()
  return (
    mimeType.includes('officedocument.wordprocessingml') ||
    mimeType === 'application/msword' ||
    n.endsWith('.docx') ||
    n.endsWith('.doc')
  )
}

export async function extractTextFromWord(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) })
    return (value || '').trim()
  } catch (error) {
    console.error('[pdf-extractor] Word (.docx) extraction failed:', error)
    return ''
  }
}

// Dispatch by file type: Word (.docx) → mammoth raw text; everything else → PDF text layer.
export async function extractTextFromDocument(
  fileBuffer: ArrayBuffer,
  filename = '',
  mimeType = '',
): Promise<string> {
  return isWordDoc(filename, mimeType)
    ? extractTextFromWord(fileBuffer)
    : extractTextFromPDF(fileBuffer)
}

// ── 2. Regex-based local parser (Tier 3 — no API required) ───────────────────
// Handles digitally-generated documents. Works offline, no quota. Salary patterns
// only apply to income documents; name/employer/date are generic.

function parseAedAmount(raw: string): number | null {
  const clean = raw.replace(/AED|,|\s/gi, '').trim()
  const n = parseFloat(clean)
  return Number.isFinite(n) && n > 100 && n < 5_000_000 ? n : null
}

function normaliseDate(d: string, m: string, y: string): string {
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const mm = months[m.toLowerCase().slice(0, 3)] ?? m.padStart(2, '0')
  return `${d.padStart(2, '0')}/${mm}/${y}`
}

export function extractFieldsWithRegex(
  text: string,
  expectedType: ExpectedDocType = 'salary_certificate'
): ExtractedDocFields {
  const t = text.replace(/\r\n/g, '\n')
  const salaryBearing = DOC_TYPE_PROFILES[expectedType].salaryBearing
  let found = 0

  // ── Person name ────────────────────────────────────────────────────────────
  let employeeName: string | null = null
  const namePatterns = [
    /(?:employee|staff|worker|holder|beneficiary|patient|name of employee|full name|account holder)\s*[:\-]\s*([A-Z][A-Za-z\s\-'.]{2,60})/i,
    /(?:this is to certify that|hereby certify that|certify that)\s+(?:Mr\.|Mrs\.|Ms\.|Dr\.)?\s*([A-Z][A-Za-z\s\-'.]{2,60}?)\s+(?:is|has been|works|was)/i,
    /^(?:Mr\.|Mrs\.|Ms\.|Dr\.)?\s*([A-Z]{2}[A-Za-z\s\-'.]{2,50})\s*$/m,
  ]
  for (const re of namePatterns) {
    const m = re.exec(t)
    if (m?.[1]) { employeeName = m[1].trim().replace(/\s{2,}/g, ' '); found++; break }
  }

  // ── Monthly salary (income documents only) ─────────────────────────────────
  let monthlySalary: number | null = null
  if (salaryBearing) {
    const salaryPatterns = [
      /(?:gross\s+(?:monthly\s+)?salary|total\s+(?:monthly\s+)?salary|monthly\s+gross)\s*[:\-]?\s*(AED\s*[\d,]+(?:\.\d{1,2})?)/i,
      /(?:total\s+remuneration|total\s+compensation)\s*[:\-]?\s*(AED\s*[\d,]+(?:\.\d{1,2})?)/i,
      /(?:monthly\s+salary|basic\s+salary|net\s+salary|total\s+salary|monthly\s+income)\s*[:\-]?\s*(AED\s*[\d,]+(?:\.\d{1,2})?)/i,
      /(?:monthly\s+salary|basic\s+salary|net\s+salary|total\s+salary|monthly\s+income)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:AED|per\s+month|\/month)?/i,
      /salary[^:\n]{0,30}[:\-]\s*(AED\s*[\d,]+(?:\.\d{1,2})?)/i,
      /\bAED\s+([\d,]{4,}(?:\.\d{1,2})?)\b/,
    ]
    for (const re of salaryPatterns) {
      const m = re.exec(t)
      if (m?.[1]) {
        const n = parseAedAmount(m[1])
        if (n !== null) { monthlySalary = n; found++; break }
      }
    }
  }

  // ── Employer / issuing organisation ────────────────────────────────────────
  let employerName: string | null = null
  const employerPatterns = [
    /(?:company\s+name|employer\s+name|organization|organisation|establishment|employer|bank\s+name|hospital|clinic)\s*[:\-]\s*([A-Z][A-Za-z0-9\s\-&,.()]{2,80})/i,
    /(?:issued\s+by|on\s+behalf\s+of|from)\s+([A-Z][A-Za-z0-9\s\-&,.()]{3,60})/i,
    /^([A-Z][A-Z\s&,.()-]{5,60}(?:LLC|L\.L\.C\.|FZCO|FZE|W\.L\.L\.?|PJSC|Ltd|Limited|Corporation|Corp|Inc|Group|Co\.|Company|Bank|Hospital))\s*$/m,
  ]
  for (const re of employerPatterns) {
    const m = re.exec(t)
    if (m?.[1]) { employerName = m[1].trim().replace(/\s{2,}/g, ' '); found++; break }
  }

  // ── Issue / document date ──────────────────────────────────────────────────
  let issueDate: string | null = null
  const datePatterns = [
    /(?:date\s*(?:of\s+(?:issue|issuance|certificate))?|issued\s+on)\s*[:\-]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i,
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    /(\d{4})-(\d{2})-(\d{2})/,
  ]
  for (const re of datePatterns) {
    const m = re.exec(t)
    if (m) {
      try {
        if (/january|february|march|april|may|june|july|august|september|october|november|december/i.test(m[0])) {
          if (/^\d/.test(m[1])) issueDate = normaliseDate(m[1], m[2], m[3])
          else issueDate = normaliseDate(m[2], m[1], m[3])
        } else if (m[1]?.length === 4) {
          issueDate = `${m[3]}/${m[2]}/${m[1]}` // ISO: YYYY-MM-DD
        } else {
          issueDate = normaliseDate(m[1], m[2], m[3])
        }
        found++
        break
      } catch { /* ignore bad parse */ }
    }
  }

  // Confidence proportional to how many of the applicable fields were found,
  // capped at 0.72 to signal this was heuristic rather than LLM-extracted.
  const applicable = salaryBearing ? 4 : 3
  const confidence = Math.round((found / applicable) * 0.72 * 100) / 100

  return { employeeName, monthlySalary, employerName, issueDate, confidence, source: 'regex_fallback' }
}

// ── 3. Three-tier extraction: Groq LLM → Gemini Vision → Regex ───────────────

export async function extractDocumentFields(
  pdfText: string,
  pdfBytes: ArrayBuffer | Buffer | undefined,
  expectedType: ExpectedDocType = 'salary_certificate'
): Promise<ExtractedDocFields> {
  const profile = DOC_TYPE_PROFILES[expectedType]

  // ── Tier 1: Groq LLM (→ OpenRouter fallback) on the extracted text ────────
  if (pdfText && pdfText.length >= 20 && isLLMConfigured()) {
    const fieldList = profile.fields.map((f) => `- ${f.key}: ${f.description}`).join('\n')
    const prompt = `Extract the following fields from this ${profile.label}. Use null for any field you cannot find (including any field not listed for this document type), and a confidence between 0 and 1.

Fields to extract:
${fieldList}

Document text:
${pdfText.slice(0, 2000)}`

    try {
      const model = getStructuredModel(ExtractedFieldsSchema, { temperature: 0, maxTokens: 300 })
      const parsed = await model.invoke([
        ['system', `You extract structured fields from UAE documents (this one should be a ${profile.label}).`],
        ['human', prompt],
      ])
      if (parsed) {
        console.log(`[pdf-extractor] LLM extraction (${expectedType}) — confidence ${parsed.confidence}`)
        return { ...parsed, source: 'llm' }
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        const retryAfter = extractRetryAfter(err)
        console.warn(`[pdf-extractor] LLM rate-limited${retryAfter ? ` (retry in ${retryAfter})` : ''} — trying Gemini Vision`)
      } else {
        console.warn('[pdf-extractor] LLM extraction failed — trying Gemini Vision:', String(err))
      }
    }
  }

  // ── Tier 2: Gemini Vision OCR on the raw bytes ─────────────────────────────
  if (pdfBytes) {
    const geminiResult = await extractFieldsWithGemini(pdfBytes, expectedType)
    if (geminiResult) {
      console.log(`[pdf-extractor] Gemini Vision extraction (${expectedType}) — confidence ${geminiResult.confidence}`)
      return { ...geminiResult, source: 'gemini_vision' }
    }
    console.warn('[pdf-extractor] Gemini Vision unavailable — falling back to regex parser (fallback)')
  }

  // ── Tier 3: Regex parser (fallback) ────────────────────────────────────────
  if (pdfText && pdfText.length >= 20) {
    console.warn('[pdf-extractor] using local regex parser — no API (fallback)')
    return extractFieldsWithRegex(pdfText, expectedType)
  }

  return EMPTY
}

// Back-compat alias (salary certificates were the only supported type before the
// doc-type-aware upgrade).
export async function extractSalaryCertificateFields(
  pdfText: string,
  pdfBytes?: ArrayBuffer | Buffer
): Promise<ExtractedDocFields> {
  return extractDocumentFields(pdfText, pdfBytes, 'salary_certificate')
}
