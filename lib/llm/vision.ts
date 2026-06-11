/**
 * OpenRouter vision-model document review — replaces the direct Gemini integration.
 *
 * Strategy:
 *   1. Render PDF pages → JPEG images   (pdfjs-dist legacy + @napi-rs/canvas)
 *   2. POST images to OpenRouter free vision model (OpenAI-compatible multipart format)
 *   3. Extract JSON from response (handles plain JSON, markdown fences, and prose)
 *   4. Rotate keys from the shared rotation-manager pool; maintain per-vision-model circuit breakers
 *
 * Vision models (OPENROUTER_VISION_MODEL_1 … N) are separate from text models so that
 * non-vision text models are never sent images. All keys are shared with text models.
 *
 * Every failure path returns null so callers degrade gracefully:
 *   extractFieldsWithVision → null → pdf-extractor falls through to Tier-3 regex
 *   assessDocumentAuthenticity → null → document-agent uses deterministic forensics only
 */

import {
  DOC_TYPE_PROFILES,
  type ExpectedDocType,
  type VisionAssessment,
  type VisionVerdict,
} from '@/lib/document-forensics'
import {
  getAllSlots,
  recordFailure,
  recordSuccess,
  classifyError,
} from './rotation-manager'

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL       = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS     = Number(process.env.LLM_TIMEOUT_MS) || 20_000
const MAX_PDF_BYTES  = 12 * 1024 * 1024  // 12 MB size guard
const RENDER_SCALE   = 1.8               // ~1070 × 1515 px for A4 — good OCR quality
const JPEG_QUALITY   = 0.82

// ── Gemini (PRIMARY vision provider) ───────────────────────────────────────────
// Gemini takes the PDF directly (inline_data) — no page-rendering needed — and has its
// own free-tier quota pool. All GEMINI_API_KEY* keys are tried in order; only once every
// Gemini key is exhausted does vision fall back to the OpenRouter vision models below.

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

function geminiApiKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    ...String(process.env.GEMINI_API_KEYS ?? '').split(','),
  ]
  return Array.from(new Set(raw.map(k => (k ?? '').trim()).filter(Boolean)))
}

const hasGeminiKeys = () => geminiApiKeys().length > 0
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Vision model discovery ────────────────────────────────────────────────────

function discoverVisionModels(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (v: string | undefined) => {
    const m = v?.trim()
    if (m && !seen.has(m)) { seen.add(m); out.push(m) }
  }
  for (let i = 1; i <= 20; i++) add(process.env[`OPENROUTER_VISION_MODEL_${i}`])
  return out
}

const _visionModels = discoverVisionModels()

// Per-vision-model circuit breaker
interface CB { failures: number; openUntil: number }
const _cb: CB[] = _visionModels.map(() => ({ failures: 0, openUntil: 0 }))

/** True when the OpenRouter vision fallback is usable (≥1 vision model AND ≥1 key). */
function isOpenRouterVisionConfigured(): boolean {
  return _visionModels.length > 0 && getAllSlots().length > 0
}

/** True when ANY vision provider is available — Gemini (primary) or OpenRouter (fallback). */
export function isVisionConfigured(): boolean {
  return hasGeminiKeys() || isOpenRouterVisionConfigured()
}

// ── PDF → JPEG image conversion ───────────────────────────────────────────────

/**
 * Render the first `maxPages` pages of a PDF to JPEG base64 strings.
 * Uses pdfjs-dist legacy build (Node.js-safe, no DOM) + @napi-rs/canvas.
 * Returns [] on any failure so callers fall through to text-only fallback.
 */
async function pdfToImages(bytes: Uint8Array, maxPages = 2): Promise<string[]> {
  try {
    const [{ resolve }, { pathToFileURL }, { createCanvas }] = await Promise.all([
      import('path'),
      import('url'),
      import('@napi-rs/canvas'),
    ])

    // Dynamic import of the legacy pdfjs build (the standard build uses DOMMatrix / DOM globals
    // that don't exist in Node.js). eslint-disable-next-line import/no-unresolved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib = (await import(
      /* webpackIgnore: true */ 'pdfjs-dist/legacy/build/pdf.mjs'
    )) as any

    // Point to the bundled worker file (pdfjs v5 requires a workerSrc even in Node.js)
    const workerPath = resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

    const pdf = await pdfjsLib.getDocument({
      data:            bytes,
      verbosity:       0,
      useWorkerFetch:  false,
      isEvalSupported: false,
    }).promise

    const count  = Math.min(pdf.numPages as number, maxPages)
    const images: string[] = []

    for (let p = 1; p <= count; p++) {
      const page     = await pdf.getPage(p)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const w        = Math.ceil(viewport.width  as number)
      const h        = Math.ceil(viewport.height as number)
      const canvas   = createCanvas(w, h)
      const ctx      = canvas.getContext('2d')

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise

      // @napi-rs/canvas toBuffer — second arg is quality (0.0–1.0) for JPEG
      const buf = canvas.toBuffer('image/jpeg', JPEG_QUALITY)
      images.push(buf.toString('base64'))
      page.cleanup()
    }

    await pdf.cleanup()
    return images
  } catch (err) {
    console.warn('[vision] PDF→image conversion failed:', String(err).slice(0, 180))
    return []
  }
}

// ── OpenRouter vision REST call ───────────────────────────────────────────────

async function callVisionModel(
  images:    string[],
  prompt:    string,
  maxTokens: number,
  key:       string,
  model:     string,
  signal:    AbortSignal,
): Promise<Response> {
  return fetch(BASE_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer':  'https://saddad.moei.gov.ae',
      'X-Title':       'SADDAD Housing Arrears',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          // Images first (model sees the document before reading instructions)
          ...images.map(b64 => ({
            type:      'image_url',
            image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
          })),
          { type: 'text', text: prompt },
        ],
      }],
      temperature: 0,
      max_tokens:  maxTokens,
      // Omit response_format — not universally supported; we extract JSON from text instead
    }),
    signal,
  })
}

/** Pull the text content from an OpenRouter chat completion response body. */
function responseText(body: unknown): string | null {
  const text = (body as {
    choices?: Array<{ message?: { content?: string } }>
  })?.choices?.[0]?.message?.content
  return text?.trim() ?? null
}

/**
 * Extract a JSON value from a string that may contain:
 *   - Plain JSON: {"key": "value"}
 *   - Markdown fences: ```json\n{...}\n```
 *   - JSON embedded in prose (finds first {...} or [...] block)
 */
function extractJson(text: string): unknown {
  // Strip markdown fences
  const stripped = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()

  try { return JSON.parse(stripped) } catch { /* fall through */ }

  // Find first brace-delimited block
  const m = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (m) { try { return JSON.parse(m[1]) } catch { /* give up */ } }
  return null
}

// ── Attempt loop: tries vision models in order, rotates keys per-model ────────

interface AttemptResult<T> { data: T | null; keyIdx: number; modelIdx: number }

async function runWithVision<T>(
  images:    string[],
  prompt:    string,
  maxTokens: number,
  coerce:    (raw: unknown) => T | null,
): Promise<AttemptResult<T>> {
  const slots = getAllSlots()
  if (slots.length === 0 || images.length === 0) return { data: null, keyIdx: -1, modelIdx: -1 }

  for (let mi = 0; mi < _visionModels.length; mi++) {
    // Skip models whose circuit breaker is open
    if (Date.now() < _cb[mi].openUntil) {
      console.warn(`[vision] model[${mi}]=${_visionModels[mi]} circuit OPEN — skipping`)
      continue
    }

    const model    = _visionModels[mi]
    // Try up to 4 keys from the rotation pool for this model (limit to avoid user-visible delay)
    const keyTries = Math.min(slots.length, 4)

    for (let ki = 0; ki < keyTries; ki++) {
      const slot       = slots[ki % slots.length]
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const res = await callVisionModel(images, prompt, maxTokens, slot.key, model, controller.signal)
        clearTimeout(timer)

        // Transient key errors → try next key
        if (res.status === 429 || res.status === 503) {
          console.warn(`[vision] key[${slot.keyIdx}] model[${mi}] status=${res.status} — next key`)
          recordFailure(slot.keyIdx, slot.modelIdx, { status: res.status })
          continue
        }

        // Model-level error (e.g. vision unsupported) → open circuit, move to next model
        if (res.status === 400 || res.status === 422) {
          const body = await res.text().catch(() => '')
          console.warn(`[vision] model[${mi}]=${model} status=${res.status} (vision may be unsupported): ${body.slice(0, 120)}`)
          _cb[mi].failures++
          if (_cb[mi].failures >= 2) {
            _cb[mi].openUntil = Date.now() + 300_000  // 5-min circuit open
            console.warn(`[vision] model[${mi}]=${model} circuit opened 5min`)
          }
          break  // next model
        }

        if (!res.ok) {
          console.warn(`[vision] key[${slot.keyIdx}] model[${mi}] status=${res.status} — next key`)
          recordFailure(slot.keyIdx, slot.modelIdx, { status: res.status })
          continue
        }

        const content = responseText(await res.json())
        if (!content) {
          console.warn(`[vision] model[${mi}]=${model} empty response — next key`)
          continue
        }

        const raw    = extractJson(content)
        const result = raw ? coerce(raw) : null
        if (!result) {
          console.warn(`[vision] model[${mi}]=${model} coercion failed — next key`)
          continue
        }

        // Success — reset health state
        recordSuccess(slot.keyIdx, slot.modelIdx)
        _cb[mi].failures  = 0
        _cb[mi].openUntil = 0
        return { data: result, keyIdx: slot.keyIdx, modelIdx: mi }

      } catch (err) {
        clearTimeout(timer)
        const kind = classifyError(err)
        console.warn(`[vision] key[${slot.keyIdx}] model[${mi}]=${model} error (${kind}): ${String(err).slice(0, 120)}`)
        recordFailure(slot.keyIdx, slot.modelIdx, err)
        // On timeout, keep trying other keys for this model; other errors → next model
        if (kind !== 'timeout') break
      }
    }
  }

  return { data: null, keyIdx: -1, modelIdx: -1 }
}

// ── Prompt builders (doc-type aware, identical to what gemini.ts had) ─────────

function fieldJsonLines(expectedType: ExpectedDocType): string {
  return DOC_TYPE_PROFILES[expectedType].fields
    .map(f =>
      f.key === 'monthlySalary'
        ? `  "${f.key}": <${f.description}, number or null>`
        : `  "${f.key}": <${f.description}, string or null>`
    )
    .join(',\n')
}

function ocrPrompt(expectedType: ExpectedDocType): string {
  const p = DOC_TYPE_PROFILES[expectedType]
  return `You are given an image of a UAE ${p.label}. Extract ONLY the following fields and return them as a raw JSON object with NO markdown or additional text:
{
${fieldJsonLines(expectedType)},
  "confidence": <your overall extraction confidence from 0.0 to 1.0>
}
Use null for any field you cannot find. Return ONLY the JSON object.`
}

function authenticityPrompt(expectedType: ExpectedDocType): string {
  const p     = DOC_TYPE_PROFILES[expectedType]
  const today = new Date().toISOString().slice(0, 10)
  return `You are a UAE government document examiner. A housing-loan beneficiary was asked to upload a ${p.label.toUpperCase()}.
${p.geminiBrief}

Make TWO independent judgments:

1. TYPE — is this file actually a ${p.label}? Set "matchesExpectedType" to false ONLY when the file is clearly a DIFFERENT document type. Use null if uncertain.

2. AUTHENTICITY — does it look genuinely issued? IGNORE stamps, signatures, and logos — many real documents are plain text. Judge ONLY: are expected fields present, is content internally consistent, is it professionally formatted?

Reserve "suspicious"/"likely_fake" for: sparse content with almost no information, placeholder text, internally inconsistent figures, or obvious editing artefacts.

Return ONLY this JSON object (no markdown, no explanation):
{
  "verdict": "authentic" | "suspicious" | "likely_fake" | "unreadable",
  "confidence": <integer 0–100>,
  "matchesExpectedType": <true | false | null>,
  "reasons": [<short explanation strings>],
  "observed": {
    "documentType": <what type this appears to be, or null>,
    "emiratesId": <the Emirates ID number printed on the document exactly as shown, format 784-YYYY-NNNNNNN-C, or null if none is visible>,
${fieldJsonLines(expectedType)}
  }
}

Today's date is ${today} — do NOT treat a recent issue date as suspicious.`
}

// ── Coercion ──────────────────────────────────────────────────────────────────

export type VisionOCRFields = {
  employeeName:  string | null
  monthlySalary: number | null
  employerName:  string | null
  issueDate:     string | null
  confidence:    number
}

/** Legacy type alias kept for any code that imports GeminiOCRFields from gemini.ts. */
export type GeminiOCRFields = VisionOCRFields

function coerceOCR(raw: unknown): VisionOCRFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o   = raw as Record<string, unknown>
  const str = (v: unknown) => (v == null || v === '' ? null : String(v).slice(0, 200) || null)
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  let conf  = Number(o.confidence) || 0
  if (conf > 1) conf = conf / 100
  conf = Math.max(0, Math.min(1, conf))
  return {
    employeeName:  str(o.employeeName),
    monthlySalary: num(o.monthlySalary),
    employerName:  str(o.employerName),
    issueDate:     str(o.issueDate),
    confidence:    Math.round(conf * 100) / 100,
  }
}

const VERDICTS: VisionVerdict[] = ['authentic', 'suspicious', 'likely_fake', 'unreadable']

function coerceAuthenticity(raw: unknown, expectedType: ExpectedDocType): VisionAssessment | null {
  if (!raw || typeof raw !== 'object') return null
  const o       = raw as Record<string, unknown>
  const verdict = VERDICTS.includes(o.verdict as VisionVerdict) ? (o.verdict as VisionVerdict) : 'unreadable'
  let confRaw   = Number(o.confidence) || 0
  if (confRaw > 0 && confRaw <= 1) confRaw *= 100
  const confidence = Math.max(0, Math.min(100, Math.round(confRaw)))
  const reasons    = Array.isArray(o.reasons)
    ? o.reasons.map(r => String(r)).filter(Boolean).slice(0, 6)
    : []
  const obs = (o.observed && typeof o.observed === 'object' ? o.observed : {}) as Record<string, unknown>
  const str = (v: unknown) => (v == null ? null : String(v).slice(0, 200) || null)
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  return {
    verdict,
    confidence,
    reasons,
    expectedType,
    matchesExpectedType:
      o.matchesExpectedType === true ? true : o.matchesExpectedType === false ? false : null,
    observed: {
      documentType: str(obs.documentType),
      salary:       num(obs.monthlySalary ?? obs.salary),
      employeeName: str(obs.employeeName),
      employerName: str(obs.employerName),
      issueDate:    str(obs.issueDate),
      emiratesId:   str(obs.emiratesId),
    },
  }
}

// ── Gemini direct-PDF calls (PRIMARY) ─────────────────────────────────────────
// Gemini accepts the PDF inline (no page rendering). Keys are tried in order; a 429
// (rate-limit / quota) or 401/403 (bad key) advances to the NEXT key, a 503 retries the
// same key briefly, anything else gives up. Returns cleaned JSON text or null.

async function callGeminiPdf(
  base64: string, apiKey: string, prompt: string, maxOutputTokens: number, signal: AbortSignal,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  return fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
        { text: prompt },
      ] }],
      generationConfig: {
        temperature:      0,
        responseMimeType: 'application/json',
        maxOutputTokens,
        // Disable "thinking" — newer Flash models otherwise spend the token budget on
        // reasoning and truncate the JSON (0 = off; harmlessly ignored where unsupported).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal,
  })
}

async function geminiAllKeys(
  base64: string, prompt: string, maxOutputTokens: number, tag: string,
): Promise<string | null> {
  const keys = geminiApiKeys()
  for (let k = 0; k < keys.length; k++) {
    const keyLabel = `key ${k + 1}/${keys.length}`
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const res = await callGeminiPdf(base64, keys[k], prompt, maxOutputTokens, controller.signal)
        clearTimeout(timer)
        if (res.status === 429 || res.status === 401 || res.status === 403) {
          console.warn(`[${tag}] ${res.status} on ${keyLabel} — rate-limited/exhausted/unauthorized, next key`)
          break // next key
        }
        if (res.status === 503) {
          console.warn(`[${tag}] 503 on ${keyLabel} (attempt ${attempt + 1}) — retrying`)
          if (attempt < 1) await sleep(1500 * (attempt + 1))
          continue
        }
        if (!res.ok) {
          console.warn(`[${tag}] non-OK ${res.status} on ${keyLabel}`)
          return null
        }
        const text = (await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        })?.candidates?.[0]?.content?.parts?.[0]?.text
        return text ? text.trim() : null
      } catch (err) {
        clearTimeout(timer)
        console.warn(`[${tag}] ${keyLabel} attempt ${attempt + 1} error: ${String(err).slice(0, 120)}`)
        if (attempt < 1) await sleep(1000 * (attempt + 1))
      }
    }
  }
  return null // every Gemini key exhausted
}

function geminiOcrPrompt(expectedType: ExpectedDocType): string {
  const p = DOC_TYPE_PROFILES[expectedType]
  return `You are given a UAE ${p.label} as a PDF. Extract ONLY the following fields and return them as a raw JSON object with NO markdown or additional text:
{
${fieldJsonLines(expectedType)},
  "confidence": <your overall extraction confidence from 0.0 to 1.0>
}
Use null for any field you cannot find. Return ONLY the JSON object.`
}

function geminiAuthPrompt(expectedType: ExpectedDocType): string {
  const p     = DOC_TYPE_PROFILES[expectedType]
  const today = new Date().toISOString().slice(0, 10)
  return `You are a UAE government document examiner. A housing-loan beneficiary was asked to upload a ${p.label.toUpperCase()}, attached as a PDF.
${p.geminiBrief}

Make TWO independent judgments:

1. TYPE — is this file actually a ${p.label}? Set "matchesExpectedType" to false ONLY when the file is clearly a DIFFERENT document type. Use null if uncertain.

2. AUTHENTICITY — does it look genuinely issued? IGNORE stamps, signatures, and logos — many real documents are plain text. Judge ONLY: are expected fields present, is content internally consistent, is it professionally formatted?

Reserve "suspicious"/"likely_fake" for: sparse content with almost no information, placeholder text, internally inconsistent figures, or obvious editing artefacts.

Return ONLY this JSON object (no markdown, no explanation):
{
  "verdict": "authentic" | "suspicious" | "likely_fake" | "unreadable",
  "confidence": <integer 0–100>,
  "matchesExpectedType": <true | false | null>,
  "reasons": [<short explanation strings>],
  "observed": {
    "documentType": <what type this appears to be, or null>,
    "emiratesId": <the Emirates ID number printed on the document exactly as shown, format 784-YYYY-NNNNNNN-C, or null if none is visible>,
${fieldJsonLines(expectedType)}
  }
}

Today's date is ${today} — do NOT treat a recent issue date as suspicious.`
}

async function geminiExtractFields(u8: Uint8Array, expectedType: ExpectedDocType): Promise<VisionOCRFields | null> {
  const text = await geminiAllKeys(Buffer.from(u8).toString('base64'), geminiOcrPrompt(expectedType), 512, 'gemini-ocr')
  if (!text) return null
  const raw = extractJson(text)
  return raw ? coerceOCR(raw) : null
}

async function geminiAssessAuthenticity(u8: Uint8Array, expectedType: ExpectedDocType): Promise<VisionAssessment | null> {
  const text = await geminiAllKeys(Buffer.from(u8).toString('base64'), geminiAuthPrompt(expectedType), 1024, 'gemini-auth')
  if (!text) return null
  const raw = extractJson(text)
  return raw ? coerceAuthenticity(raw, expectedType) : null
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Tier-2 OCR: extract structured fields from a PDF. Gemini first (all keys, direct PDF);
 * if every Gemini key is exhausted, fall back to an OpenRouter vision model.
 * Returns null on total failure — pdf-extractor.ts falls through to Tier-3 regex.
 */
export async function extractFieldsWithVision(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  expectedType: ExpectedDocType = 'salary_certificate',
): Promise<VisionOCRFields | null> {
  const u8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as ArrayBuffer)
  if (u8.byteLength === 0 || u8.byteLength > MAX_PDF_BYTES) return null

  // PRIMARY: Gemini (all keys, PDF sent directly).
  if (hasGeminiKeys()) {
    const g = await geminiExtractFields(u8, expectedType)
    if (g) { console.log(`[vision] Gemini OCR (${expectedType}) — confidence ${g.confidence}`); return g }
    console.warn('[vision] Gemini OCR exhausted — falling back to OpenRouter vision')
  }

  // FALLBACK: OpenRouter vision models (render PDF → images first).
  if (isOpenRouterVisionConfigured()) {
    const images = await pdfToImages(u8, 2)
    if (images.length === 0) return null
    const { data } = await runWithVision(images, ocrPrompt(expectedType), 512, coerceOCR)
    if (data) console.log(`[vision] OpenRouter OCR (${expectedType}) — confidence ${data.confidence}`)
    return data
  }
  return null
}

/**
 * Vision authenticity check: genuine document of the expected type?
 * Returns null on any failure — document-agent.ts uses deterministic forensics only.
 * Uses 3 pages (more context helps authenticity judgment on multi-page documents).
 */
export async function assessDocumentAuthenticity(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  expectedType: ExpectedDocType = 'salary_certificate',
): Promise<VisionAssessment | null> {
  const u8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as ArrayBuffer)
  if (u8.byteLength === 0 || u8.byteLength > MAX_PDF_BYTES) return null

  // PRIMARY: Gemini (all keys, PDF sent directly).
  if (hasGeminiKeys()) {
    const g = await geminiAssessAuthenticity(u8, expectedType)
    if (g) return g
    console.warn('[vision] Gemini authenticity exhausted — falling back to OpenRouter vision')
  }

  // FALLBACK: OpenRouter vision models (3 pages — more context for authenticity).
  if (isOpenRouterVisionConfigured()) {
    const images = await pdfToImages(u8, 3)
    if (images.length === 0) return null
    const { data } = await runWithVision(
      images,
      authenticityPrompt(expectedType),
      1024,
      (raw) => coerceAuthenticity(raw, expectedType),
    )
    return data
  }
  return null
}

// Legacy aliases — gemini.ts re-exports these, no changes needed in callers
export { extractFieldsWithVision as extractFieldsWithGemini }
export { isVisionConfigured as isGeminiConfigured }
