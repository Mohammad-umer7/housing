// Shared error helpers for the document-review path (adopted from the Desktop fork
// backend). Used to recognise provider rate-limit / quota errors so the OCR tiers can
// fall through (Groq → Gemini Vision → regex) instead of hard-failing.

export function isRateLimitError(err: unknown, status?: number): boolean {
  if (status === 429) return true
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('rate-limit') ||
    msg.includes('tokens per day') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('429')
  )
}

// Pull a human-readable "try again in …" hint out of a provider error message,
// if present (e.g. Groq's "Please try again in 16m31s").
export function extractRetryAfter(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const m = msg.match(/try again in ([0-9hms.\s]+)/i)
  return m ? m[1].trim() : null
}
