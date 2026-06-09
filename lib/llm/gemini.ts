// Vision-LLM document authenticity via Google Gemini (free tier). Called server-side
// with the ACTUAL uploaded PDF so the model can judge — using its broad knowledge —
// whether the file looks like a GENUINE salary certificate (letterhead, employer,
// employee, Emirates ID, salary breakdown, issue date, signature/stamp, consistent
// layout) or a fabrication that merely contains the "wanted" numbers and nothing else.
//
// Provider/model swap lives in THIS file. No SDK dependency — a plain REST call to the
// Generative Language API. Every failure path (no key, timeout, bad JSON, rate limit)
// returns null so the pipeline degrades gracefully to the deterministic forensics,
// exactly like the Groq fallbacks elsewhere.

import type { VisionAssessment, VisionVerdict } from '@/lib/document-forensics'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000
// Inline image/PDF data caps the TOTAL request at 20MB (Gemini docs). base64 inflates
// the bytes by ~4/3, so keep the raw file under ~12MB to stay safely under the ceiling
// (salary certificates are tiny — this is just a guard against an oversized upload).
const MAX_PDF_BYTES = 12 * 1024 * 1024

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

const PROMPT = `You are a UAE government document-fraud examiner. You are shown a PDF a beneficiary uploaded as proof of income for a housing-loan arrears rescheduling request (it should be a SALARY CERTIFICATE, or for an unemployed applicant an official non-work / termination letter).

Judge whether the document looks like a GENUINE, officially-issued document — NOT whether the numbers are "correct". A genuine salary certificate normally contains: the employer/bank name, the employee's name and Emirates ID, a salary breakdown (basic + allowances = gross), an issue date, and a signatory line ("Authorised Signatory" / HR). Many real certificates are plain TEXT PDFs without a graphical logo or a scanned stamp — that ALONE is NOT a reason to doubt them. If the document contains the expected fields above and is internally consistent and professionally laid out, treat it as "authentic".

Reserve "suspicious"/"likely_fake" for documents that are genuinely deficient: a file that is SPARSE (e.g. essentially only a name and a salary figure with none of the employer/employee/breakdown/date/signatory content), placeholder or dummy text, internally inconsistent figures or fields, obvious editing, or a document that is clearly not an income document at all. That sparse, content-free case is what a fabrication made just to pass an automated check looks like.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{
  "verdict": "authentic" | "suspicious" | "likely_fake" | "unreadable",
  "confidence": <integer 0-100>,
  "reasons": [<short strings explaining the verdict>],
  "observed": {
    "documentType": <string or null>,
    "salary": <number or null>,
    "employeeName": <string or null>,
    "employerName": <string or null>,
    "hasLetterhead": <true|false>,
    "hasSignatureOrStamp": <true|false>,
    "issueDate": <string or null>
  }
}
Use "authentic" only if it genuinely looks like a real issued document. Use "likely_fake" for a clear fabrication, "suspicious" when something is off, and "unreadable" only if you truly cannot read the file.`

const VERDICTS: VisionVerdict[] = ['authentic', 'suspicious', 'likely_fake', 'unreadable']

function coerce(raw: unknown): VisionAssessment | null {
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
    observed: {
      documentType: str(obs.documentType),
      salary: num(obs.salary),
      employeeName: str(obs.employeeName),
      employerName: str(obs.employerName),
      hasLetterhead: Boolean(obs.hasLetterhead),
      hasSignatureOrStamp: Boolean(obs.hasSignatureOrStamp),
      issueDate: str(obs.issueDate),
    },
  }
}

export async function assessDocumentAuthenticity(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer
): Promise<VisionAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const u8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  if (u8.byteLength === 0 || u8.byteLength > MAX_PDF_BYTES) return null

  const base64 = Buffer.from(u8).toString('base64')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  // Give the model today's date so a genuine current-year certificate is not mistaken
  // for "future-dated / fabricated" (a training-cutoff artifact). Text AFTER the file.
  const today = new Date().toISOString().slice(0, 10)
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: base64 } },
          { text: `${PROMPT}\n\nFor your reference, today's date is ${today}. Do NOT treat a current or recent issue date as suspicious.` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 1024,
      // Disable "thinking": newer Flash models otherwise spend the token budget on
      // reasoning and truncate the JSON. 0 = off (harmlessly ignored where unsupported).
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  // Up to 3 attempts — 503 (model overloaded) and 429 (rate limit) are transient, so
  // back off briefly and retry rather than dropping to no-vision. Each attempt has its
  // own timeout. Runs in the BACKGROUND document agent, so this latency never blocks
  // the citizen's submission response.
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
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
      const json = await res.json()
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) return null
      // responseMimeType=application/json should yield pure JSON, but strip a stray fence defensively.
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      return coerce(JSON.parse(cleaned))
    } catch (err) {
      clearTimeout(timer)
      console.warn(`[gemini] attempt ${attempt + 1}/3 error (non-fatal):`, String(err))
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return null
}
