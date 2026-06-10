// Vision-LLM document review via Google Gemini (free tier). Called server-side with
// the ACTUAL uploaded PDF and the EXPECTED document type, so the model knows exactly
// which document the citizen was asked to upload (salary certificate, non-work letter,
// bank/income statement, supporting document) and judges:
//   1. matchesExpectedType — is this file the requested document?
//   2. verdict             — does it look GENUINELY issued? Stamps, signatures and
//                            logos are deliberately IGNORED: many real documents are
//                            plain-text PDFs; the judgment is content + consistency.
//
// The SAME doc-type profile (lib/document-forensics DOC_TYPE_PROFILES) also generates
// the OCR field list — this is how "Gemini tells the OCR what to extract": each
// document type declares its fields once, and the authenticity prompt, the Gemini OCR
// prompt, and the Groq text-extraction prompt are all built from that single source.
//
// Provider/model swap lives in THIS file. No SDK dependency — a plain REST call to the
// Generative Language API. Every failure path (no key, timeout, bad JSON, rate limit)
// returns null so the pipeline degrades gracefully to the deterministic forensics —
// downstream text produced on that path is tagged "(fallback)" via markFallback.

import {
  DOC_TYPE_PROFILES,
  type ExpectedDocType,
  type VisionAssessment,
  type VisionVerdict,
} from '@/lib/document-forensics'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000
// Inline image/PDF data caps the TOTAL request at 20MB (Gemini docs). base64 inflates
// the bytes by ~4/3, so keep the raw file under ~12MB to stay safely under the ceiling
// (these documents are tiny — this is just a guard against an oversized upload).
const MAX_PDF_BYTES = 12 * 1024 * 1024

// Module-level circuit breaker (adopted from the Desktop fork backend). Opens after 3
// consecutive exhausted-retry failures within the same process lifetime; stays open for
// 60 seconds so the queue stays healthy rather than spending its budget on a dead service.
const _circuit = { failures: 0, openUntil: 0 }

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

// ── Prompt builders (doc-type aware) ──────────────────────────────────────────

function fieldJsonLines(expectedType: ExpectedDocType): string {
  return DOC_TYPE_PROFILES[expectedType].fields
    .map((f) =>
      f.key === 'monthlySalary'
        ? `  "${f.key}": <${f.description}, number or null>`
        : `  "${f.key}": <${f.description}, string or null>`
    )
    .join(',\n')
}

function authenticityPrompt(expectedType: ExpectedDocType): string {
  const p = DOC_TYPE_PROFILES[expectedType]
  return `You are a UAE government document examiner. A housing-loan beneficiary was asked to upload a specific document for an arrears-rescheduling request.

THE REQUESTED DOCUMENT TYPE IS: ${p.label.toUpperCase()}.
${p.geminiBrief}

Make TWO independent judgments about the attached PDF:

1. TYPE — is this file actually a ${p.label} (the requested type)? Set "matchesExpectedType" to false ONLY when the file is clearly a DIFFERENT recognizable document (e.g. a tenancy contract, an ID copy, or an invoice when a ${p.label} was requested) — name what it looks like in "observed.documentType". A SPARSE or fabricated-looking file that merely ATTEMPTS to be a ${p.label} is NOT a type mismatch — keep "matchesExpectedType" true (or null) and express the problem through the authenticity verdict instead. Use null only if you truly cannot tell.

2. AUTHENTICITY — does it look like a GENUINE, officially-issued document, NOT whether the numbers are "correct"? IMPORTANT: completely IGNORE stamps, signatures, logos and letterheads — many real documents are plain TEXT PDFs without any of them, and their absence is NEVER a reason to doubt a document. Judge ONLY the overall content: are the expected fields present, is it internally consistent, and is it professionally laid out?

Reserve "suspicious"/"likely_fake" for documents that are genuinely deficient: a file that is SPARSE (essentially only a name and a figure with none of the expected content), placeholder or dummy text, internally inconsistent figures or fields, or obvious editing. That sparse, content-free case is what a fabrication made just to pass an automated check looks like.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{
  "verdict": "authentic" | "suspicious" | "likely_fake" | "unreadable",
  "confidence": <integer 0-100>,
  "matchesExpectedType": <true | false | null>,
  "reasons": [<short strings explaining the verdict>],
  "observed": {
    "documentType": <what kind of document this actually looks like, string or null>,
${fieldJsonLines(expectedType)}
  }
}
Use "authentic" only if it genuinely looks like a real issued document. Use "likely_fake" for a clear fabrication, "suspicious" when something is off, and "unreadable" only if you truly cannot read the file.`
}

// OCR prompt — the field list comes from the SAME doc-type profile, so the vision OCR
// extracts exactly what the expected document type declares.
function ocrPrompt(expectedType: ExpectedDocType): string {
  const p = DOC_TYPE_PROFILES[expectedType]
  return `You are given a UAE ${p.label} as a PDF. Extract ONLY the following fields and return them as a raw JSON object with NO markdown or prose:
{
${fieldJsonLines(expectedType)},
  "confidence": <your overall extraction confidence from 0.0 to 1.0>
}
Use null for any field you cannot find. Do NOT include any explanation outside the JSON.`
}

// ── Coercion ──────────────────────────────────────────────────────────────────

const VERDICTS: VisionVerdict[] = ['authentic', 'suspicious', 'likely_fake', 'unreadable']

function coerce(raw: unknown, expectedType: ExpectedDocType): VisionAssessment | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const verdict = VERDICTS.includes(o.verdict as VisionVerdict) ? (o.verdict as VisionVerdict) : 'unreadable'
  // Models sometimes return confidence as 0-1 rather than 0-100 — normalise either way.
  let confRaw = Number(o.confidence) || 0
  if (confRaw > 0 && confRaw <= 1) confRaw *= 100
  const confidence = Math.max(0, Math.min(100, Math.round(confRaw)))
  const reasons = Array.isArray(o.reasons)
    ? o.reasons.map((r) => String(r)).filter(Boolean).slice(0, 6)
    : []
  const obs = (o.observed && typeof o.observed === 'object' ? o.observed : {}) as Record<string, unknown>
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  const str = (v: unknown) => (v == null ? null : String(v).slice(0, 200) || null)
  return {
    verdict,
    confidence,
    reasons,
    expectedType,
    matchesExpectedType:
      o.matchesExpectedType === true ? true : o.matchesExpectedType === false ? false : null,
    observed: {
      documentType: str(obs.documentType),
      salary: num(obs.monthlySalary ?? obs.salary),
      employeeName: str(obs.employeeName),
      employerName: str(obs.employerName),
      issueDate: str(obs.issueDate),
    },
  }
}

export type GeminiOCRFields = {
  employeeName: string | null
  monthlySalary: number | null
  employerName: string | null
  issueDate: string | null
  confidence: number
}

function coerceOCR(raw: unknown): GeminiOCRFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const str = (v: unknown) => (v == null || v === '' ? null : String(v).slice(0, 200) || null)
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  let conf = Number(o.confidence) || 0
  if (conf > 1) conf = conf / 100
  conf = Math.max(0, Math.min(1, conf))
  return {
    employeeName: str(o.employeeName),
    monthlySalary: num(o.monthlySalary),
    employerName: str(o.employerName),
    issueDate: str(o.issueDate),
    confidence: Math.round(conf * 100) / 100,
  }
}

// ── REST plumbing ─────────────────────────────────────────────────────────────

function asBytes(pdfBytes: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
}

async function callGemini(base64: string, prompt: string, maxOutputTokens: number, signal: AbortSignal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        maxOutputTokens,
        // Disable "thinking": newer Flash models otherwise spend the token budget on
        // reasoning and truncate the JSON. 0 = off (harmlessly ignored where unsupported).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal,
  })
}

function extractJsonText(json: unknown): string | null {
  const text: string | undefined = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null
  // responseMimeType=application/json should yield pure JSON, but strip a stray fence defensively.
  return text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

// ── OCR field extraction via Gemini Vision ────────────────────────────────────
// Tier-2 of the OCR stack (after Groq, before the regex fallback). Works on scanned
// PDFs too (not just digital text-layer ones). The expected doc type selects which
// fields are extracted.

export async function extractFieldsWithGemini(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  expectedType: ExpectedDocType = 'salary_certificate'
): Promise<GeminiOCRFields | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  if (_circuit.openUntil > Date.now()) {
    console.warn('[gemini-ocr] circuit OPEN — skipping OCR extraction')
    return null
  }

  const u8 = asBytes(pdfBytes)
  if (u8.byteLength === 0 || u8.byteLength > MAX_PDF_BYTES) return null
  const base64 = Buffer.from(u8).toString('base64')

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await callGemini(base64, ocrPrompt(expectedType), 512, controller.signal)
      clearTimeout(timer)
      if (res.status === 429 || res.status === 503) {
        console.warn(`[gemini-ocr] ${res.status} on attempt ${attempt + 1} — will use regex fallback`)
        return null
      }
      if (!res.ok) {
        console.warn(`[gemini-ocr] non-OK response: ${res.status}`)
        return null
      }
      const cleaned = extractJsonText(await res.json())
      if (!cleaned) return null
      const result = coerceOCR(JSON.parse(cleaned))
      if (result) {
        _circuit.failures = 0
        _circuit.openUntil = 0
        console.log(`[gemini-ocr] extracted ${expectedType} fields — confidence ${result.confidence}`)
      }
      return result
    } catch (err) {
      clearTimeout(timer)
      console.warn(`[gemini-ocr] attempt ${attempt + 1} error:`, String(err))
    }
  }
  return null
}

// ── Authenticity + type review ────────────────────────────────────────────────

export async function assessDocumentAuthenticity(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  expectedType: ExpectedDocType = 'salary_certificate'
): Promise<VisionAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  // Circuit open — skip until the cooldown expires to avoid burning quota on a dead service.
  if (_circuit.openUntil > Date.now()) {
    console.warn('[gemini] circuit OPEN — skipping vision call')
    return null
  }
  const u8 = asBytes(pdfBytes)
  if (u8.byteLength === 0 || u8.byteLength > MAX_PDF_BYTES) return null

  const base64 = Buffer.from(u8).toString('base64')
  // Give the model today's date so a genuine current-year document is not mistaken
  // for "future-dated / fabricated" (a training-cutoff artifact). Text AFTER the file.
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `${authenticityPrompt(expectedType)}\n\nFor your reference, today's date is ${today}. Do NOT treat a current or recent issue date as suspicious.`

  // Up to 3 attempts — 503 (model overloaded) and 429 (rate limit) are transient, so
  // back off briefly and retry rather than dropping to no-vision. Each attempt has its
  // own timeout. Runs in the BACKGROUND document agent, so this latency never blocks
  // the citizen's submission response.
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await callGemini(base64, prompt, 1024, controller.signal)
      clearTimeout(timer)
      if (res.status === 503 || res.status === 429) {
        console.warn(`[gemini] ${res.status} (attempt ${attempt + 1}/3) — retrying`)
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      if (!res.ok) {
        console.warn(`[gemini] vision call failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
        return null
      }
      const cleaned = extractJsonText(await res.json())
      if (!cleaned) return null
      const result = coerce(JSON.parse(cleaned), expectedType)
      // Success — reset the circuit breaker.
      _circuit.failures = 0
      _circuit.openUntil = 0
      return result
    } catch (err) {
      clearTimeout(timer)
      console.warn(`[gemini] attempt ${attempt + 1}/3 error (non-fatal):`, String(err))
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  // Exhausted retries — open the circuit breaker after repeated failures so the rest
  // of the queue isn't throttled by a temporary outage. The pipeline falls back to the
  // deterministic forensics (marked "(fallback)" downstream).
  _circuit.failures++
  if (_circuit.failures >= 3) {
    _circuit.openUntil = Date.now() + 60_000
    console.warn('[gemini] circuit OPENED after repeated failures — cooling down 60s')
  }
  return null
}
