// DOCUMENT FORENSICS — a layered, DOC-TYPE-AWARE verification stack.
//
// The pipeline decides WHICH document each case needs (salary certificate, non-work /
// termination letter, bank/income statement, or a supporting document — read from the
// case's circumstances) and verifies the uploaded file against that expectation in
// independent layers:
//   1. TYPE      — is this file the document we asked for? Gemini vision judges first
//                  (it is told the expected type); a text-anchor scan is the
//                  deterministic fallback when vision is unavailable.
//   2. FIELDS    — identity (Emirates ID / name) and, for income documents, the salary
//                  read from the document vs the beneficiary's authoritative record.
//   3. ARITHMETIC— internal consistency (basic + allowances = gross; salary certs only).
//   4. VISION    — does the document look genuinely issued? Stamps, signatures and
//                  logos are deliberately IGNORED — many real documents are plain-text
//                  PDFs; the judgment is about overall content and consistency.
// Together these produce a confidence score and a single verdict the Critic (or an
// officer) can act on.
//
// All functions here are PURE and deterministic (no I/O), so they are unit-tested
// without a database and produce identical results on every run for the audit trail.

import type { AuthorityRecord } from '@/lib/integrations/document-authority'
import { markFallback } from '@/lib/i18n'

export type VerificationCheckStatus = 'pass' | 'fail' | 'warn' | 'na'

export type VerificationCheck = {
  id: string
  label: string
  status: VerificationCheckStatus
  detail: string
  weight: number // contribution to the confidence score
  scored?: boolean // false = shown but excluded from the confidence score (e.g. the anchor)
}

// ── Expected document types + their verification profiles ─────────────────────
// ONE profile per document type drives everything downstream: what Gemini is told the
// document should be, which fields the OCR extracts (Groq prompt, Gemini OCR prompt and
// the vision "observed" fields are all generated from the SAME field list), and the
// deterministic text anchors used when the AI layers are unavailable.
export type ExpectedDocType =
  | 'salary_certificate'
  | 'non_work_letter'
  | 'income_statement'
  | 'supporting_document'

export type DocFieldSpec = {
  key: 'employeeName' | 'monthlySalary' | 'employerName' | 'issueDate'
  description: string
}

export type DocTypeProfile = {
  label: string // human label used in citizen/officer-facing messages
  // What this document is + what a genuine one contains. Injected into the Gemini
  // authenticity prompt so the model knows exactly which document to expect.
  geminiBrief: string
  // The fields the OCR layer should extract for THIS document type (drives the Groq
  // prompt, the Gemini Vision OCR prompt, and the vision "observed" fields).
  fields: DocFieldSpec[]
  // Deterministic text anchors — the fallback type check when vision is unavailable.
  anchors: RegExp[]
  minAnchors: number
  // true ⇒ the salary cross-check vs the authority record and the internal
  // arithmetic check apply (income documents); false ⇒ those checks are N/A.
  salaryBearing: boolean
}

export const DOC_TYPE_PROFILES: Record<ExpectedDocType, DocTypeProfile> = {
  salary_certificate: {
    label: 'salary certificate',
    geminiBrief:
      'A genuine UAE salary certificate normally contains: the employer/company name, the employee\'s name and Emirates ID, a salary breakdown (basic + allowances = gross), an issue date, and a signatory line ("Authorised Signatory" / HR).',
    fields: [
      { key: 'employeeName', description: 'full name of the employee' },
      { key: 'monthlySalary', description: 'the gross or total monthly salary as a plain number (no AED prefix, no commas)' },
      { key: 'employerName', description: 'name of the company or employer' },
      { key: 'issueDate', description: 'issue or certificate date in DD/MM/YYYY format' },
    ],
    anchors: [
      /salary\s+certificate/i,
      /emirates\s*id|784-?\d/i,
      /basic\s+salary/i,
      /allowance/i,
      /gross/i,
      /(authorized|authorised)\s+signatory|hr\s+department/i,
    ],
    minAnchors: 4,
    salaryBearing: true,
  },
  non_work_letter: {
    label: 'non-work / termination letter',
    geminiBrief:
      'A genuine non-work / termination letter normally contains: the former employer or labour-authority name, the person\'s name (and usually their Emirates ID), a clear statement of termination / end of service / no current employment, and a date. It proves the person no longer earns a salary.',
    fields: [
      { key: 'employeeName', description: 'full name of the person the letter concerns' },
      { key: 'employerName', description: 'the former employer or issuing authority' },
      { key: 'issueDate', description: 'date of the letter in DD/MM/YYYY format' },
    ],
    anchors: [
      // Core signals only — generic anchors (Emirates ID / date / HR) would let a
      // salary certificate satisfy this profile by accident.
      /terminat|end\s+of\s+service|cessation|cancellation\s+of\s+employment|resign|dismiss/i,
      /unemploy|non-?work|not\s+(currently\s+)?employed|no\s+longer\s+employed|out\s+of\s+work|no\s+(stable\s+)?income/i,
      /labou?r|human\s+resources|hr\s+department|ministry|authority/i,
    ],
    minAnchors: 2,
    salaryBearing: false,
  },
  income_statement: {
    label: 'bank / income statement',
    geminiBrief:
      'A genuine bank or income statement normally contains: the bank or institution name, the account holder\'s name, an account number or IBAN, a statement period, and a list of transactions or income entries with balances.',
    fields: [
      { key: 'employeeName', description: 'the account holder\'s full name' },
      { key: 'monthlySalary', description: 'the average monthly income / salary credits visible on the statement, as a plain number (null if unclear)' },
      { key: 'employerName', description: 'the bank or institution name' },
      { key: 'issueDate', description: 'the statement period end date in DD/MM/YYYY format' },
    ],
    anchors: [
      /bank\s+statement|account\s+statement|statement\s+of\s+account|income\s+statement/i,
      /account\s+(number|no)|iban/i,
      /balance/i,
      /transaction|credit|debit|deposit/i,
      /salary|income/i,
    ],
    minAnchors: 3,
    salaryBearing: false,
  },
  supporting_document: {
    label: 'supporting document (e.g. medical report or official assignment letter)',
    geminiBrief:
      'A genuine supporting document (e.g. a medical report, hospital letter, or an official assignment / secondment letter) normally contains: the issuing organisation (hospital, clinic, employer or government entity), the person\'s name, a description of the circumstance (treatment, official mission, etc.), and a date.',
    fields: [
      { key: 'employeeName', description: 'full name of the person the document concerns' },
      { key: 'employerName', description: 'the issuing organisation (hospital, clinic, employer or authority)' },
      { key: 'issueDate', description: 'date of the document in DD/MM/YYYY format' },
    ],
    anchors: [
      /medical|hospital|clinic|treatment|diagnos|patient/i,
      /assignment|secondment|mission|official\s+duty|deployment/i,
      /emirates\s*id|784-?\d|name/i,
      /date/i,
    ],
    minAnchors: 2,
    salaryBearing: false,
  },
}

// The headline verdict:
//   verified     — the document is the requested type, looks genuine, and its fields
//                  match the authority record
//   mismatch     — salary or identity on the document ≠ the authority record (fraud
//                  signal → officer review, never bounced to the citizen)
//   suspicious   — the vision LLM judged the document likely fabricated / not genuine
//   tampered     — internal figures do not reconcile (salary certificates)
//   invalid      — the uploaded file is NOT the requested document type at all
//                  (→ ask the citizen for the right document)
//   unverifiable — no authority salary record exists to validate an income document
//   skipped      — verification not run
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
  expectedType: ExpectedDocType
}

// ── Vision LLM authenticity (Gemini) ──────────────────────────────────────────
// Produced by lib/llm/gemini.ts by feeding the ACTUAL PDF to a vision model that is
// TOLD which document type to expect. It returns two independent judgments:
//   matchesExpectedType — is this file the requested document? (null = could not judge)
//   verdict             — does it look genuinely issued? Stamps/signatures/logos are
//                         explicitly ignored; the judgment is content + consistency.
// null assessment = vision not run (no API key / quota / timeout) → the deterministic
// layers decide alone and the report marks the vision check as a fallback.
export type VisionVerdict = 'authentic' | 'suspicious' | 'likely_fake' | 'unreadable'

export type VisionAssessment = {
  verdict: VisionVerdict
  confidence: number // 0..100
  reasons: string[]
  expectedType?: ExpectedDocType
  matchesExpectedType: boolean | null
  observed: {
    documentType: string | null
    salary: number | null
    employeeName: string | null
    employerName: string | null
    issueDate: string | null
  }
}

// ── Layout / structure (deterministic type check) ──────────────────────────────
// Doc-type-aware anchor scan over the extracted text. This is the FALLBACK type
// check — the primary judgment comes from Gemini vision (which also works for
// scanned documents with no text layer).
export type StructureCheck = {
  docType: ExpectedDocType
  score: number
  found: number
  total: number
  looksLikeExpectedDoc: boolean
}

export function checkStructure(
  pdfText: string,
  docType: ExpectedDocType = 'salary_certificate'
): StructureCheck {
  const profile = DOC_TYPE_PROFILES[docType]
  const text = pdfText || ''
  const found = profile.anchors.filter((re) => re.test(text)).length
  const total = profile.anchors.length
  return {
    docType,
    score: total ? found / total : 0,
    found,
    total,
    looksLikeExpectedDoc: found >= profile.minAnchors,
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
  // Which document this case asked the citizen for — drives every layer below.
  expectedType: ExpectedDocType
  // The authoritative record looked up for this beneficiary (null = no record on
  // file → income documents cannot be validated against anything).
  record: AuthorityRecord | null
  declaredSalary: number | null
  extracted: {
    salary: number | null
    name: string | null
    employer: string | null
    emiratesId: string | null
  }
  // null ⇒ the signal was not available (e.g. scanned PDF with no text layer) → the
  // check is "na", never penalised.
  structure: StructureCheck | null
  arithmetic: ReturnType<typeof checkArithmetic> | null
  // Vision-LLM judgment on the actual PDF (null/omitted = not run → fallback to the
  // deterministic layers).
  vision?: VisionAssessment | null
}

export function buildVerificationReport(input: ForensicInputs): VerificationReport {
  const { expectedType, record, declaredSalary, extracted, structure, arithmetic, vision } = input
  const profile = DOC_TYPE_PROFILES[expectedType]
  const checks: VerificationCheck[] = []
  const visionSuspicious = !!vision && (vision.verdict === 'suspicious' || vision.verdict === 'likely_fake')

  const recordValid = !!record && record.status === 'valid'
  const authorityName = record?.employee_name ?? null
  const authoritySalary = recordValid ? Number(record!.gross_salary) : null

  // TYPE GATE — is this file the document we asked for? Vision's judgment wins when
  // available (it is told the expected type and works on scanned files too); the
  // deterministic anchor scan is the fallback. If the file is the WRONG document, the
  // content fields (salary/EID/name/arithmetic) are untrustworthy → marked N/A.
  const visionTypeKnown = !!vision && vision.verdict !== 'unreadable' && vision.matchesExpectedType !== null
  const structureKnown = structure !== null
  const wrongType = visionTypeKnown
    ? vision!.matchesExpectedType === false
    : structureKnown
    ? !structure!.looksLikeExpectedDoc
    : false

  // 1: anchor — does the authority hold a record for this beneficiary? Shown for
  // context but NOT scored: it is about the PERSON, not whether THIS file is genuine.
  checks.push({
    id: 'authority_record',
    label: 'Beneficiary record found at the issuing authority',
    status: recordValid ? 'pass' : 'fail',
    detail: recordValid
      ? `Authority holds a valid record for ${record!.employee_name}.`
      : 'No valid record on file at the issuing authority for this beneficiary.',
    weight: 0,
    scored: false,
  })

  // 2: document TYPE — the gate. Is this the requested document?
  checks.push({
    id: 'document_type',
    label: `Uploaded file is the requested document (${profile.label})`,
    status: !visionTypeKnown && !structureKnown ? 'na' : wrongType ? 'fail' : 'pass',
    detail: visionTypeKnown
      ? wrongType
        ? `AI review judged the file is NOT a ${profile.label}${vision!.observed.documentType ? ` (it looks like: ${vision!.observed.documentType})` : ''}.`
        : `AI review confirms the file is a ${profile.label}.`
      : structureKnown
      ? markFallback(
          wrongType
            ? `Text scan: only ${structure!.found}/${structure!.total} expected ${profile.label} sections present — does not look like the requested document.`
            : `Text scan: ${structure!.found}/${structure!.total} expected ${profile.label} sections present.`
        )
      : 'Document type could not be inspected (no readable text and no vision review).',
    weight: 25,
  })

  // 3: salary READ FROM the document vs the authority record (2% tol). Income
  // documents only. Only a salary actually read from the document can PASS; the
  // declared (typed) salary can only trigger a FAIL (fraud), never a pass.
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
  const salaryApplicable = profile.salaryBearing && recordValid && !wrongType
  const salaryMismatch =
    salaryApplicable && (diverges(extractedSalary) || diverges(visionSalary) || diverges(Number(declaredSalary)))
  const divergingVal = salaryMismatch
    ? [extractedSalary, visionSalary, Number(declaredSalary)].find((v) => diverges(v))
    : undefined
  checks.push({
    id: 'salary_match',
    label: 'Document salary matches the authority record',
    status: !profile.salaryBearing
      ? 'na'
      : !recordValid || wrongType
      ? 'na'
      : salaryMismatch
      ? 'fail'
      : hasExtractedSalary
      ? 'pass'
      : 'na',
    detail: !profile.salaryBearing
      ? `Not applicable for a ${profile.label}.`
      : !recordValid
      ? 'No authority record to compare against.'
      : wrongType
      ? 'Not evaluated — the file is not the requested document type.'
      : salaryMismatch
      ? `Salary (AED ${Number(divergingVal).toLocaleString()}) does not match the authority record (AED ${authoritySalary!.toLocaleString()}).`
      : hasExtractedSalary
      ? `Salary read from the document matches the authority (AED ${authoritySalary!.toLocaleString()}).`
      : 'No salary could be read from the document to compare.',
    weight: 25,
  })

  // 4: identity cross-check (Emirates ID / name / employer) against the record.
  const eidMatch = record && !wrongType && extracted.emiratesId
    ? norm(extracted.emiratesId) === norm(record.emirates_id)
    : null
  checks.push({
    id: 'emirates_id_match',
    label: 'Emirates ID matches the authority record',
    status: eidMatch === null ? 'na' : eidMatch ? 'pass' : 'fail',
    detail: wrongType
      ? 'Not evaluated — the file is not the requested document type.'
      : eidMatch === null
      ? 'Emirates ID not available to cross-check.'
      : eidMatch
      ? 'Emirates ID on the document matches the registry.'
      : `Emirates ID on the document (${extracted.emiratesId}) does not match the registry record.`,
    weight: 18,
  })
  const extractedName = extracted.name ?? vision?.observed?.employeeName ?? null
  const nameMatch = record && !wrongType && extractedName
    ? norm(extractedName).includes(norm(record.employee_name).slice(0, 10)) ||
      norm(record.employee_name).includes(norm(extractedName).slice(0, 10))
    : null
  checks.push({
    id: 'name_match',
    label: 'Name matches the authority record',
    status: nameMatch === null ? 'na' : nameMatch ? 'pass' : 'warn',
    detail: nameMatch === null
      ? 'Name not available to cross-check.'
      : nameMatch
      ? 'Name matches the registry.'
      : `Name on the document ("${extractedName}") differs from the registry ("${record?.employee_name}").`,
    weight: 6,
  })
  const extractedEmployer = extracted.employer ?? vision?.observed?.employerName ?? null
  const employerMatch = profile.salaryBearing && record && !wrongType && extractedEmployer
    ? norm(extractedEmployer).includes(norm(record.employer_name).slice(0, 8)) ||
      norm(record.employer_name).includes(norm(extractedEmployer).slice(0, 8))
    : null
  checks.push({
    id: 'employer_match',
    label: 'Employer matches the authority record',
    status: employerMatch === null ? 'na' : employerMatch ? 'pass' : 'warn',
    detail: !profile.salaryBearing
      ? `Not applicable for a ${profile.label}.`
      : employerMatch === null
      ? 'Employer not available to cross-check.'
      : employerMatch
      ? 'Employer matches the registry.'
      : `Employer on the document differs from the registry ("${record?.employer_name}").`,
    weight: 6,
  })

  // 5: internal arithmetic (salary certificates only).
  const arithmeticFail =
    profile.salaryBearing && !wrongType && !!arithmetic && arithmetic.hasFigures && !arithmetic.consistent
  checks.push({
    id: 'arithmetic',
    label: 'Basic + allowances equals gross salary',
    status: !profile.salaryBearing || wrongType || !arithmetic || !arithmetic.hasFigures
      ? 'na'
      : arithmetic.consistent
      ? 'pass'
      : 'fail',
    detail: !profile.salaryBearing
      ? `Not applicable for a ${profile.label}.`
      : wrongType
      ? 'Not evaluated — the file is not the requested document type.'
      : !arithmetic || !arithmetic.hasFigures
      ? 'Salary breakdown not fully readable.'
      : arithmetic.consistent
      ? `Figures reconcile (${arithmetic.basic} + ${arithmetic.allowances} = ${arithmetic.gross}).`
      : `Figures do NOT reconcile (${arithmetic.basic} + ${arithmetic.allowances} ≠ ${arithmetic.gross}).`,
    weight: 10,
  })

  // 6: vision-LLM authenticity — the knowledge-based "does this look genuinely issued"
  // layer. Catches a fabricated file that passes the field/anchor checks (e.g. only the
  // wanted values, no real content). Stamps/signatures are ignored by design.
  const visionKnown = !!vision && vision.verdict !== 'unreadable'
  checks.push({
    id: 'vision_authenticity',
    label: 'AI vision review of document authenticity',
    status: !visionKnown ? 'na' : visionSuspicious ? 'fail' : 'pass',
    detail: !vision
      ? markFallback('Vision authenticity review not available — deterministic checks only.')
      : vision.verdict === 'unreadable'
      ? markFallback('The vision model could not read the document — deterministic checks only.')
      : visionSuspicious
      ? `Flagged as ${vision.verdict.replace('_', ' ')} (${vision.confidence}% confidence): ${vision.reasons.slice(0, 3).join('; ') || 'no specific reasons given'}.`
      : `Appears authentic (${vision.confidence}% confidence)${vision.reasons.length ? `: ${vision.reasons.slice(0, 2).join('; ')}` : ''}.`,
    weight: 25,
  })

  // ── Confidence score: weighted pass-ratio over the SCORED, applicable checks
  // (the anchor is excluded; N/A checks are excluded). It answers "how confident are
  // we this is the genuine, matching document we asked for" — so a wrong-type file
  // scores low even if the person has a record.
  const scored = checks.filter((c) => c.scored !== false && c.status !== 'na')
  const totalWeight = scored.reduce((s, c) => s + c.weight, 0) || 1
  const earned = scored.reduce(
    (s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
    0
  )
  const confidenceScore = Math.round((earned / totalWeight) * 100)

  // ── Verdict precedence: vision-suspicious → wrong type → field fraud → no record
  //    for an income doc → file tamper → clean.
  //    SUSPICION OUTRANKS WRONG-TYPE on purpose: a fabricated file (sparse, dummy
  //    text, edited) must ESCALATE to an officer, even if the vision model also
  //    thinks it isn't really the requested document — only an honestly-wrong but
  //    genuine-looking document (e.g. a real tenancy contract) bounces back to the
  //    citizen as a resubmit. Vision suspicion also outranks a clean field match,
  //    because a fabricated file can carry the exact "wanted" values.
  let verdict: VerificationVerdict
  if (visionSuspicious) verdict = 'suspicious'
  else if (wrongType) verdict = 'invalid'
  else if (salaryMismatch || eidMatch === false) verdict = 'mismatch'
  else if (profile.salaryBearing && !recordValid) verdict = 'unverifiable'
  else if (arithmeticFail) verdict = 'tampered'
  else verdict = 'verified'

  const failing = checks.filter((c) => c.status === 'fail').map((c) => c.label)
  const summary =
    verdict === 'verified'
      ? `The ${profile.label} validated against the issuing authority with ${confidenceScore}% confidence.`
      : verdict === 'invalid'
      ? `The uploaded file is not the requested ${profile.label}${
          visionTypeKnown && vision!.observed.documentType ? ` (it appears to be: ${vision!.observed.documentType})` : ''
        } — it cannot be validated.`
      : verdict === 'unverifiable'
      ? 'No salary record on file at the issuing authority for this beneficiary — cannot validate the document.'
      : verdict === 'mismatch'
      ? `Document content does not match the authority record (${failing.join('; ')}).`
      : verdict === 'suspicious'
      ? `AI vision review judged this document likely not genuine${vision ? ` (${vision.reasons.slice(0, 2).join('; ') || vision.verdict.replace('_', ' ')})` : ''} — referred for human review.`
      : `The document matches the authority but its internal figures show signs of editing (${failing.join('; ')}).`

  return {
    verdict,
    confidenceScore,
    checks,
    summary,
    authorityName,
    authoritySalary,
    expectedType,
  }
}
