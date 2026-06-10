// Document hash integrity verification — cryptographic proof of modification.
//
// A genuinely-issued document embeds a CryptoSignatureToken in its text content
// (either as a visible line or in PDF metadata that surfaces via text extraction):
//
//   CryptoSignatureToken: <SHA-256 hex of the rest of the document text>
//
// On submission the token is located, the hash recomputed (excluding that line),
// and the two compared. A mismatch is proof the file was edited after issuance.
// This is the same logic as verify_medical.py, ported to Node.js for PDFs.
//
// When no token is present the check is simply skipped (hasToken: false) — the
// pipeline falls back to Gemini vision + deterministic forensics as usual.

import { createHash } from 'crypto'

export type HashIntegrityResult = {
  hasToken: boolean
  hashMatch: boolean
  storedHash: string | null
  computedHash: string | null
}

const TOKEN_PREFIXES = [
  'CryptoSignatureToken:',
  'SZHP-VERIFY-TOKEN:',
  'SZHP_VERIFY_TOKEN:',
]

export function checkHashIntegrity(pdfText: string): HashIntegrityResult {
  if (!pdfText) return { hasToken: false, hashMatch: false, storedHash: null, computedHash: null }

  const lines = pdfText.split('\n')
  let storedHash: string | null = null
  let tokenLineIndex = -1

  for (let i = 0; i < lines.length; i++) {
    for (const prefix of TOKEN_PREFIXES) {
      if (lines[i].includes(prefix)) {
        storedHash = lines[i].split(prefix)[1]?.trim() ?? null
        tokenLineIndex = i
        break
      }
    }
    if (tokenLineIndex >= 0) break
  }

  if (!storedHash || tokenLineIndex < 0) {
    return { hasToken: false, hashMatch: false, storedHash: null, computedHash: null }
  }

  // Recompute the hash over ALL lines EXCEPT the token line itself —
  // same algorithm as the Python verify_medical.py script.
  const contentLines = lines.filter((_, i) => i !== tokenLineIndex)
  const contentText = contentLines.join('\n').trim()
  const computedHash = createHash('sha256').update(contentText, 'utf8').digest('hex')

  return {
    hasToken: true,
    hashMatch: computedHash.toLowerCase() === storedHash.toLowerCase(),
    storedHash,
    computedHash,
  }
}
