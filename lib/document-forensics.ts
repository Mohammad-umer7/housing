// DOCUMENT FORENSICS — a layered, real-world salary-certificate verification stack.
//
// SADDAD does NOT trust a QR code. It looks up the beneficiary's authoritative salary
// record (by Emirates ID, from UAE PASS) and then cross-checks the UPLOADED certificate
// against it across several independent layers: the IDENTITY + SALARY fields vs the
// authority record, the document's STRUCTURE/layout, its internal ARITHMETIC, and the
// PDF's METADATA for signs of editing. Together these produce a confidence score and a
// single verdict an officer (or the Critic) can act on.
//
// All functions here are PURE and deterministic (no I/O), so they are unit-tested
// without a database and produce identical results on every run for the audit trail.

import type { AuthorityRecord } from '@/lib/integrations/document-authority'

export type VerificationCheckStatus = 'pass' | 'fail' | 'warn' | 'na'

export type VerificationCheck = {
  id: string
  label: string
  status: VerificationCheckStatus
  detail: string
  weight: number // contribution to the confidence score
  scored?: boolean // false = shown but excluded from the confidence score (e.g. the anchor)
}

// The headline verdict:
//   verified     — fields match the authority record and the file is clean
//   mismatch     — salary or identity on the certificate ≠ the authority record (fraud)
//   suspicious   — a vision LLM judged the document likely fabricated / not genuine
//   tampered     — a real certificate whose FILE shows editing (metadata/arithmetic)
//   invalid      — the uploaded file is not a recognized salary certificate at all
//   unverifiable — no authority salary record exists for this beneficiary
//   skipped      — the document authority is not configured
export type VerificationVerdict =
  | 'verified'
  | 'mismatch'
  | 'suspicious'
  | 'tampered'
  | 'invalid'
  | 'unverifiable'
  | 'skipped'

export type VerificationReport = {
  verdict: VerificationVerdict
  confidenceScore: number // 0..100 across the applicable checks
  checks: VerificationCheck[]
  summary: string
  authorityName: string | null
  authoritySalary: number | null
}

// ── Vision LLM authenticity (Gemini) ──────────────────────────────────────────
// Produced by lib/llm/gemini.ts by feeding the ACTUAL PDF to a vision model. It is a
// knowledge-based judgment of whether the document looks like a genuine salary
// certificate (letterhead, employer, signature/stamp, consistent layout) — the layer
// that catches a fake that only contains the "wanted" values and no real content.
// null = vision not run (no API key / unavailable) → treated as N/A, never penalised.
export type VisionVerdict = 'authentic' | 'suspicious' | 'likely_fake' | 'unreadable'

export type VisionAssessment = {
  verdict: VisionVerdict
  confidence: number // 0..100
  reasons: string[]
  observed: {
    documentType: string | null
    salary: number | null
    employeeName: string | null
    employerName: string | null
    hasLetterhead: boolean
    hasSignatureOrStamp: boolean
    issueDate: string | null
  }
}

// ── PDF metadata forensics ─────────────────────────────────────────────────────
// Parsed from the raw PDF bytes (passed as a latin1 string). Works for the common
// case of an uncompressed Info dictionary (what pdfkit and most issuers produce);
// degrades gracefully to nulls (→ "na", no penalty) when fields are absent.
export type PdfMetadata = {
  creationDate: string | null
  modDate: string | null
  producer: string | null
  creator: string | null
  eofCount: number
  modifiedAfterCreation: boolean
  incrementalUpdate: boolean // more than one %%EOF ⇒ the file was appended/edited
}

// PDF dates look like  D:YYYYMMDDHHmmSS±HH'mm'  — parse the leading timestamp.
function parsePdfDate(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m
  const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  return Number.isFinite(t) ? t : null
}

export function parsePdfMetadata(rawPdf: string): PdfMetadata {
  const grab = (key: string) => {
    // /Key (value)  — value may contain escaped parens; keep it simple + robust.
    const m = rawPdf.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`))
    if (!m) return null
    // UTF-16 PDF strings interleave NUL bytes; strip control chars so the value is
    // clean for display + JSONB storage.
    const v = m[1].replace(/[\u0000-\u001F\u007F]/g, '').trim()
    return v || null
  }
  const creationDate = grab('CreationDate')
  const modDate = grab('ModDate')
  const producer = grab('Producer')
  const creator = grab('Creator')
  const eofCount = (rawPdf.match(/%%EOF/g) || []).length

  const cTime = parsePdfDate(creationDate)
  const mTime = parsePdfDate(modDate)
  // > 60s after creation counts as a real post-issuance edit (ignores same-save jitter).
  const modifiedAfterCreation = cTime !== null && mTime !== null && mTime - cTime > 60_000

  return {
    creationDate,
    modDate,
    producer,
    creator,
    eofCount,
    modifiedAfterCreation,
    incrementalUpdate: eofCount > 1,
  }
}

// ── Layout / structure ──────────────────────────────────────────────────────────
const STRUCTURE_ANCHORS = [
  /salary\s+certificate/i,
  /emirates\s*id|784-?\d/i,
  /basic\s+salary/i,
  /allowance/i,
  /gross/i,
  /(authorized|authorised)\s+signatory|hr\s+department/i,
]

export function checkStructure(pdfText: string): {
  score: number
  found: number
  total: number
  looksLikeSalaryCertificate: boolean
} {
  const text = pdfText || ''
  const found = STRUCTURE_ANCHORS.filter((re) => re.test(text)).length
  const total = STRUCTURE_ANCHORS.length
  return {
    score: total ? found / total : 0,
    found,
    total,
    looksLikeSalaryCertificate: found >= 4, // majority of the expected sections present
  }
}

// ── Internal arithmetic (basic + allowances == gross) ────────────────────────────
function numberAfter(text: string, labels: RegExp): number | null {
  const m = text.match(labels)
  if (!m) return null
  const n = Number(m[1].replace(/[, ]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function checkArithmetic(pdfText: string): {
  basic: number | null
  allowances: number | null
  gross: number | null
  consistent: boolean
  hasFigures: boolean
} {
  const text = pdfText || ''
  const basic = numberAfter(text, /basic[^0-9]{0,28}([\d, ]{3,})/i)
  const allowances = numberAfter(text, /allowance[s]?[^0-9]{0,28}([\d, ]{3,})/i)
  const gross = numberAfter(text, /gross[^0-9]{0,28}([\d, ]{3,})/i)
  const hasFigures = basic !== null && allowances !== null && gross !== null
  const consistent = hasFigures ? Math.abs((basic! + allowances!) - gross!) <= Math.max(1, gross! * 0.01) : false
  return { basic, allowances, gross, consistent, hasFigures }
}

// ── Emirates ID extraction (for the identity cross-check) ─────────────────────────
export function extractEmiratesId(pdfText: string): string | null {
  const m = (pdfText || '').match(/784-?\d{4}-?\d{7}-?\d/)
  return m ? m[0].replace(/(\d{3})-?(\d{4})-?(\d{7})-?(\d)/, '$1-$2-$3-$4') : null
}

const norm = (s: string | null | undefined) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ── The orchestrator ──────────────────────────────────────────────────────────
export type ForensicInputs = {
  // The authoritative record looked up by the beneficiary's Emirates ID (null = no
  // record on file → cannot validate the certificate against anything).
  record: AuthorityRecord | null
  declaredSalary: number | null
  extracted: {
    salary: number | null
    name: string | null
    employer: string | null
    emiratesId: string | null
  }
  // null ⇒ the signal was not available (e.g. text extraction unavailable) → "na",
  // never penalised.
  structure: ReturnType<typeof checkStructure> | null
  arithmetic: ReturnType<typeof checkArithmetic> | null
  metadata: PdfMetadata | null
  // Vision-LLM authenticity judgment on the actual PDF (null/omitted = not run → "na").
  vision?: VisionAssessment | null
}

export function buildVerificationReport(input: ForensicInputs): VerificationReport {
  const { record, declaredSalary, extracted, structure, arithmetic, metadata, vision } = input
  const checks: VerificationCheck[] = []
  const visionSuspicious = !!vision && (vision.verdict === 'suspicious' || vision.verdict === 'likely_fake')

  const recordValid = !!record && record.status === 'valid'
  const authorityName = record?.employee_name ?? null
  const authoritySalary = recordValid ? Number(record!.gross_salary) : null

  // GATE: if the file doesn't have the structure of a salary certificate, it is not a
  // valid certificate at all — the "extracted" fields (salary/EID/name/arithmetic) are
  // untrustworthy, so they are marked N/A rather than scored. Only the structure and
  // metadata (which read the raw file regardless) remain meaningful.
  const structureKnown = structure !== null
  const notACert = structureKnown && !structure!.looksLikeSalaryCertificate

  // 1: anchor — does the salary authority hold a record for this beneficiary? Shown for
  // context but NOT scored: it is about the PERSON, not whether THIS file is genuine.
  checks.push({
    id: 'authority_record',
    label: 'Salary record found at the issuing authority',
    status: recordValid ? 'pass' : 'fail',
    detail: recordValid
      ? `Authority holds a valid salary record for ${record!.employee_name}.`
      : 'No valid salary record on file at the issuing authority for this beneficiary.',
    weight: 0,
    scored: false,
  })

  // 2: salary READ FROM the certificate vs the authority record (2% tol). Only a salary
  // actually extracted from the document can PASS; the declared (typed) salary can only
  // trigger a FAIL (fraud), never a pass — so a file with no readable salary is N/A.
  const TOL = 0.02
  const extractedSalary = Number(extracted.salary)
  const visionSalary = Number(vision?.observed?.salary)
  const hasExtractedSalary =
    (Number.isFinite(extractedSalary) && extractedSalary > 0) ||
    (Number.isFinite(visionSalary) && visionSalary > 0)
  const diverges = (v: number) =>
    Number.isFinite(v) && v > 0 && authoritySalary! > 0 && Math.abs(authoritySalary! - v) / authoritySalary! > TOL
  // Both the OCR-extracted salary AND the salary the vision model READ off the document
  // are cross-checked against the authority record (a declared/typed value can only FAIL).
  const salaryMismatch =
    recordValid && !notACert && (diverges(extractedSalary) || diverges(visionSalary) || diverges(Number(declaredSalary)))
  const divergingVal = salaryMismatch
    ? [extractedSalary, visionSalary, Number(declaredSalary)].find((v) => diverges(v))
    : undefined
  checks.push({
    id: 'salary_match',
    label: 'Certificate salary matches the authority record',
    status: !recordValid || notACert ? 'na' : salaryMismatch ? 'fail' : hasExtractedSalary ? 'pass' : 'na',
    detail: !recordValid
      ? 'No authority record to compare against.'
      : notACert
      ? 'Not evaluated — the file is not a recognized salary certificate.'
      : salaryMismatch
      ? `Salary (AED ${Number(divergingVal).toLocaleString()}) does not match the authority record (AED ${authoritySalary!.toLocaleString()}).`
      : hasExtractedSalary
      ? `Salary read from the certificate matches the authority (AED ${authoritySalary!.toLocaleString()}).`
      : 'No salary could be read from the document to compare.',
    weight: 25,
  })

  // 3: identity cross-check (Emirates ID / name / employer) against the record.
  const eidMatch = record && !notACert && extracted.emiratesId
    ? norm(extracted.emiratesId) === norm(record.emirates_id)
    : null
  checks.push({
    id: 'emirates_id_match',
    label: 'Emirates ID matches the authority record',
    status: eidMatch === null ? 'na' : eidMatch ? 'pass' : 'fail',
    detail: notACert
      ? 'Not evaluated — the file is not a recognized salary certificate.'
      : eidMatch === null
      ? 'Emirates ID not available to cross-check.'
      : eidMatch
      ? 'Emirates ID on the certificate matches the registry.'
      : `Emirates ID on the certificate (${extracted.emiratesId}) does not match the registry record.`,
    weight: 18,
  })
  const nameMatch = record && !notACert && extracted.name
    ? norm(extracted.name).includes(norm(record.employee_name).slice(0, 10)) ||
      norm(record.employee_name).includes(norm(extracted.name).slice(0, 10))
    : null
  checks.push({
    id: 'name_match',
    label: 'Employee name matches the authority record',
    status: nameMatch === null ? 'na' : nameMatch ? 'pass' : 'warn',
    detail: nameMatch === null
      ? 'Name not available to cross-check.'
      : nameMatch
      ? 'Name matches the registry.'
      : `Name on the certificate ("${extracted.name}") differs from the registry ("${record?.employee_name}").`,
    weight: 6,
  })
  const employerMatch = record && !notACert && extracted.employer
    ? norm(extracted.employer).includes(norm(record.employer_name).slice(0, 8)) ||
      norm(record.employer_name).includes(norm(extracted.employer).slice(0, 8))
    : null
  checks.push({
    id: 'employer_match',
    label: 'Employer matches the authority record',
    status: employerMatch === null ? 'na' : employerMatch ? 'pass' : 'warn',
    detail: employerMatch === null
      ? 'Employer not available to cross-check.'
      : employerMatch
      ? 'Employer matches the registry.'
      : `Employer on the certificate differs from the registry ("${record?.employer_name}").`,
    weight: 6,
  })

  // 4: layout / structure — the gate. Is this even a salary certificate?
  checks.push({
    id: 'structure',
    label: 'Document has the expected salary-certificate layout',
    status: !structure ? 'na' : structure.looksLikeSalaryCertificate ? 'pass' : 'fail',
    detail: !structure
      ? 'Document text not available to inspect layout.'
      : `${structure.found}/${structure.total} expected salary-certificate sections present.`,
    weight: 25,
  })

  // 5: internal arithmetic.
  const arithmeticFail = !notACert && !!arithmetic && arithmetic.hasFigures && !arithmetic.consistent
  checks.push({
    id: 'arithmetic',
    label: 'Basic + allowances equals gross salary',
    status: notACert || !arithmetic || !arithmetic.hasFigures ? 'na' : arithmetic.consistent ? 'pass' : 'fail',
    detail: notACert
      ? 'Not evaluated — the file is not a recognized salary certificate.'
      : !arithmetic || !arithmetic.hasFigures
      ? 'Salary breakdown not fully readable.'
      : arithmetic.consistent
      ? `Figures reconcile (${arithmetic.basic} + ${arithmetic.allowances} = ${arithmetic.gross}).`
      : `Figures do NOT reconcile (${arithmetic.basic} + ${arithmetic.allowances} ≠ ${arithmetic.gross}).`,
    weight: 10,
  })

  // 6: PDF metadata forensics.
  const metaTampered = metadata ? (metadata.incrementalUpdate || metadata.modifiedAfterCreation) : false
  checks.push({
    id: 'metadata',
    label: 'PDF metadata shows no post-issuance editing',
    status: !metadata ? 'na' : metaTampered ? 'fail' : 'pass',
    detail: !metadata
      ? 'PDF metadata not available.'
      : metaTampered
      ? `Editing evidence: ${[
          metadata.incrementalUpdate ? `incremental update (${metadata.eofCount} EOF markers)` : '',
          metadata.modifiedAfterCreation ? 'modified after creation date' : '',
        ].filter(Boolean).join('; ')}${metadata.producer ? ` · producer "${metadata.producer}"` : ''}.`
      : `Clean — single revision${metadata.producer ? `, produced by "${metadata.producer}"` : ''}.`,
    weight: 10,
  })

  // 7: vision-LLM authenticity — the knowledge-based "does this look genuine" layer.
  // Catches a fabricated file that passes the field/structure checks (e.g. only the
  // wanted values, no real letterhead/employer/signature).
  const visionKnown = !!vision && vision.verdict !== 'unreadable'
  checks.push({
    id: 'vision_authenticity',
    label: 'AI vision review of document authenticity',
    status: !visionKnown ? 'na' : visionSuspicious ? 'fail' : 'pass',
    detail: !vision
      ? 'Vision authenticity review not available.'
      : vision.verdict === 'unreadable'
      ? 'The vision model could not read the document.'
      : visionSuspicious
      ? `Flagged as ${vision.verdict.replace('_', ' ')} (${vision.confidence}% confidence): ${vision.reasons.slice(0, 3).join('; ') || 'no specific reasons given'}.`
      : `Appears authentic (${vision.confidence}% confidence)${vision.reasons.length ? `: ${vision.reasons.slice(0, 2).join('; ')}` : ''}.`,
    weight: 25,
  })

  // ── Confidence score: weighted pass-ratio over the SCORED, applicable checks
  // (the anchor is excluded; N/A checks are excluded). It answers "how confident are
  // we this is a genuine, matching salary certificate" — so a file that fails the
  // structure gate scores low even if the person has a record and the file is unedited.
  const scored = checks.filter((c) => c.scored !== false && c.status !== 'na')
  const totalWeight = scored.reduce((s, c) => s + c.weight, 0) || 1
  const earned = scored.reduce(
    (s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
    0
  )
  const confidenceScore = Math.round((earned / totalWeight) * 100)

  // ── Verdict (precedence: not-a-cert → field fraud → vision-suspicious → no record →
  //    file tamper → clean). Vision suspicion outranks a clean field match, because a
  //    fabricated file can carry the exact "wanted" values yet obviously not be genuine.
  let verdict: VerificationVerdict
  if (notACert) verdict = 'invalid'
  else if (salaryMismatch || eidMatch === false) verdict = 'mismatch'
  else if (visionSuspicious) verdict = 'suspicious'
  else if (!recordValid) verdict = 'unverifiable'
  else if (metaTampered || arithmeticFail) verdict = 'tampered'
  else verdict = 'verified'

  const failing = checks.filter((c) => c.status === 'fail').map((c) => c.label)
  const summary =
    verdict === 'verified'
      ? `Validated against the issuing authority with ${confidenceScore}% confidence.`
      : verdict === 'invalid'
      ? `The uploaded file is not a recognized salary certificate (${structure ? `only ${structure.found}/${structure.total} expected sections present` : 'layout not readable'}) — it cannot be validated.`
      : verdict === 'unverifiable'
      ? 'No salary record on file at the issuing authority for this beneficiary — cannot validate the certificate.'
      : verdict === 'mismatch'
      ? `Certificate content does not match the authority record (${failing.join('; ')}).`
      : verdict === 'suspicious'
      ? `AI vision review judged this document likely not genuine${vision ? ` (${vision.reasons.slice(0, 2).join('; ') || vision.verdict.replace('_', ' ')})` : ''} — referred for human review.`
      : `The certificate matches the authority but the file shows signs of editing (${failing.join('; ')}).`

  return {
    verdict,
    confidenceScore,
    checks,
    summary,
    authorityName,
    authoritySalary,
  }
}
