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
  | 'business_failure_certificate'
  | 'salary_reduction_certificate'
  | 'family_circumstances_certificate'
  | 'medical_certificate'

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
  business_failure_certificate: {
    label: 'business failure / closure certificate',
    geminiBrief:
      'A genuine UAE business failure certificate is an official declaration or supporting document indicating business closure, insolvency, financial distress or commercial failure. It normally contains: the trade licence information, the company/establishment details, the owner\'s name, the reason for closure or distress, a date, and an authorised signatory or official stamp.',
    fields: [
      { key: 'employeeName', description: 'full name of the business owner the certificate concerns' },
      { key: 'employerName', description: 'the business / company / establishment name' },
      { key: 'issueDate', description: 'date of the declaration in DD/MM/YYYY format' },
    ],
    anchors: [
      /trade\s+licen[cs]e|commercial\s+licen[cs]e|رخصة\s*تجارية/i,
      /clos(ure|ed|ing)|insolven|bankrupt|liquidat|financial\s+distress|cease[ds]?\s+(trading|operations?)|wound\s+up|deregist|تعثر|إفلاس|إغلاق|تصفية/i,
      /business|company|commercial|establishment|enterprise|l\.?l\.?c|نشاط\s*تجاري|شركة|مؤسسة/i,
      /(authorized|authorised)\s+signatory|signature|stamp|seal|department\s+of\s+economic|chamber\s+of\s+commerce|توقيع|ختم/i,
    ],
    minAnchors: 2,
    salaryBearing: false,
  },
  salary_reduction_certificate: {
    label: 'salary reduction certificate',
    geminiBrief:
      'A genuine UAE salary reduction certificate is an employer-issued confirmation of a salary reduction. It normally contains: the company letterhead, the employee\'s name, the PREVIOUS salary, the REVISED (new) salary, the effective date of the reduction, the reason for the reduction, and an HR authorisation / authorised signatory.',
    fields: [
      { key: 'employeeName', description: 'full name of the employee' },
      { key: 'monthlySalary', description: 'the REVISED (new, reduced) monthly salary as a plain number (no AED prefix, no commas)' },
      { key: 'employerName', description: 'name of the company or employer' },
      { key: 'issueDate', description: 'date of the letter in DD/MM/YYYY format' },
    ],
    anchors: [
      /salary\s+reduction|reduc(ed|tion)\s+(of\s+|in\s+)?(the\s+)?salary|pay\s+cut|تخفيض\s*الراتب|خفض\s*الراتب/i,
      /(previous|former|old|current)\s+salary|(revised|new|adjusted)\s+salary|الراتب\s*(السابق|الجديد|المعدل)/i,
      /effective\s+(date|from)|with\s+effect\s+from|اعتبارًا\s*من|تاريخ\s*السريان/i,
      /hr|human\s+resources|(authorized|authorised)\s+signatory|إدارة\s*الموارد\s*البشرية|توقيع/i,
    ],
    minAnchors: 2,
    salaryBearing: false, // the revised salary intentionally differs from the on-record salary
  },
  family_circumstances_certificate: {
    label: 'family circumstances certificate',
    geminiBrief:
      'A genuine family circumstances certificate is a supporting document explaining exceptional family circumstances affecting the applicant\'s financial situation (e.g. divorce decree, death certificate of a provider, guardianship/custody order, dependants documentation). It normally contains: the issuing authority or organisation (court, ministry, community authority), the relevant family details, a statement of the circumstance and its financial impact, a date, and an official reference or signatory.',
    fields: [
      { key: 'employeeName', description: 'full name of the person the certificate concerns' },
      { key: 'employerName', description: 'the issuing authority, court or organisation' },
      { key: 'issueDate', description: 'date of the document in DD/MM/YYYY format' },
    ],
    anchors: [
      /family|household|dependent|dependant|divorce|death|widow|guardian|custody|marriage|أسر|عائل|طلاق|وفاة|حضانة|وصاية/i,
      /circumstance|hardship|situation|support|financial\s+impact|welfare|ظروف|إعالة|دعم/i,
      /court|authority|ministry|organi[sz]ation|community|judicial|federal|محكمة|هيئة|وزارة|مجتمع/i,
      /date|reference|ref\.?\s*(no|number)|تاريخ|رقم\s*المرجع/i,
    ],
    minAnchors: 2,
    salaryBearing: false,
  },
  medical_certificate: {
    label: 'medical condition certificate',
    geminiBrief:
      'A genuine UAE medical condition certificate is a medical report or physician-issued certificate confirming a health condition affecting the applicant\'s financial capability. It normally contains: the hospital/clinic information, the physician\'s name and details, the patient\'s name, a diagnosis summary, the treatment period, a date, and an official stamp or signature (MOH / DHA / DoH licensed facility).',
    fields: [
      { key: 'employeeName', description: 'full name of the patient the certificate concerns' },
      { key: 'employerName', description: 'the hospital, clinic or medical facility name' },
      { key: 'issueDate', description: 'date of the report in DD/MM/YYYY format' },
    ],
    anchors: [
      /medical|hospital|clinic|patient|physician|doctor|dr\.|طبي|مستشفى|عيادة|طبيب/i,
      /diagnos|treatment|condition|illness|disease|surgery|therapy|sick\s+leave|تشخيص|علاج|حالة\s*صحية|مرض/i,
      /stamp|seal|signature|licen[cs]e|moh|dha|doh|ministry\s+of\s+health|ختم|توقيع|وزارة\s*الصحة/i,
      /date|period|from|to|تاريخ|فترة/i,
    ],
    minAnchors: 2,
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
  | 'hash_tampered'
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
  uaePipelineScore?: UAEPipelineScore // 100-point UAE verification pipeline score
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

// ── Bank account + IBAN extraction (for the account cross-check) ───────────────────
// UAE IBAN is "AE" + 2 check digits + 19 digits (often printed in 4-digit groups).
export function extractIban(pdfText: string): string | null {
  const m = (pdfText || '').match(/AE\d{2}(?:[ ]?\d){19}/i)
  return m ? m[0].replace(/\s+/g, '').toUpperCase() : null
}
// A labelled account number, e.g. "Account Number: 049-2019482-01".
export function extractAccountNumber(pdfText: string): string | null {
  const m = (pdfText || '').match(/account\s*(?:number|no\.?|#)?\s*[:\-]?\s*([0-9][0-9\- ]{6,30})/i)
  return m ? m[1].trim().replace(/[ ]+$/, '') : null
}

// ── Reference number extraction (for the duplicate-ref fraud check) ────────────
// UAE government/corporate reference format: ORG/DEPT/YYYY/NNNN (e.g. GT/HR/2026/8841).
export function extractRefNumber(pdfText: string): string | null {
  const m = (pdfText || '').match(/\b([A-Z]{1,10}\/[A-Z]{1,10}\/20\d{2}\/\d{3,8})\b/)
  return m ? m[1] : null
}

// ── Format validators ──────────────────────────────────────────────────────────
// UAE Emirates ID: 784-YYYY-XXXXXXX-C (3-4-7-1 groups, exactly 15 digits)
export function validateEmiratesIdFormat(eid: string | null): boolean {
  if (!eid) return false
  return /^784-\d{4}-\d{7}-\d$/.test(eid.trim())
}

// UAE government reference number: ORG/DEPT/YYYY/NNNN
export function validateRefNumberFormat(ref: string | null): boolean {
  if (!ref) return false
  return /^[A-Z]{1,10}\/[A-Z]{1,10}\/20\d{2}\/\d{3,8}$/.test(ref.trim())
}

// Issue date must not be in the future (a cert issued "tomorrow" is fabricated)
export function validateDateNotFuture(dateStr: string | null): boolean {
  if (!dateStr) return true
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) return true
  return parsed <= new Date()
}

// UAE phone: +971XXXXXXXX, 971XXXXXXXX, or 0XXXXXXXXX (8–9 digits after prefix)
export function validatePhoneUAE(phone: string | null): boolean {
  if (!phone) return true
  const clean = phone.replace(/[\s\-.()]/g, '')
  return /^\+971\d{8,9}$/.test(clean) || /^971\d{8,9}$/.test(clean) || /^0[0-9]{8,9}$/.test(clean)
}

// ── PDF metadata forensics ─────────────────────────────────────────────────────
// Parse the PDF binary header for creation and modification timestamps.
// A document whose ModDate is more than 1 year after its CreationDate is suspicious
// (it was likely opened and edited after being originally issued).
export function checkPdfMetadata(buffer: Buffer): {
  creationYear: number | null
  modificationYear: number | null
  suspicious: boolean
  reason: string | null
} {
  const raw = buffer.toString('latin1', 0, Math.min(buffer.length, 65536))
  const cm = raw.match(/\/CreationDate\s*\(D:(\d{4})/)
  const mm = raw.match(/\/ModDate\s*\(D:(\d{4})/)
  const creationYear = cm ? parseInt(cm[1], 10) : null
  const modificationYear = mm ? parseInt(mm[1], 10) : null
  if (creationYear !== null && modificationYear !== null && modificationYear > creationYear + 1) {
    return {
      creationYear, modificationYear, suspicious: true,
      reason: `Document created in ${creationYear} but last modified in ${modificationYear} — possible post-issuance tampering`,
    }
  }
  return { creationYear, modificationYear, suspicious: false, reason: null }
}

// ── Font consistency ────────────────────────────────────────────────────────────
// Text injected into an existing PDF (copy-paste fraud) leaves a foreign font family.
// Legitimate salary certificates typically use 1–3 fonts; >3 distinct base font
// families in a simple certificate is a strong injection signal.
export function checkFontConsistency(buffer: Buffer): {
  fontCount: number
  suspicious: boolean
} {
  const raw = buffer.toString('latin1', 0, Math.min(buffer.length, 131072))
  const fonts = new Set(
    [...raw.matchAll(/\/BaseFont\s*\/([^\s\/\[\]()]+)/g)].map(m => m[1].replace(/^\w+\+/, ''))
  )
  return { fontCount: fonts.size, suspicious: fonts.size > 3 }
}

// ── Multi-channel OCR reconciliation ───────────────────────────────────────────
// Compares the embedded PDF text layer (direct extraction) to rendered OCR output.
// A delta > 50 characters in the first 500 means the visual layer was altered after
// the text layer was set — a strong copy-paste / image-swap signal.
export function reconcileOcrChannels(embeddedText: string, renderedText: string): {
  delta: number
  suspicious: boolean
} {
  if (!embeddedText || !renderedText) return { delta: 0, suspicious: false }
  const a = embeddedText.replace(/\s+/g, ' ').trim()
  const b = renderedText.replace(/\s+/g, ' ').trim()
  const len = Math.min(a.length, b.length, 500)
  let diff = Math.abs(a.length - b.length)
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++
  return { delta: diff, suspicious: diff > 50 }
}

// ── UAE Pipeline 100-point weighted scoring ────────────────────────────────────
// Maps the verification report to the official UAE AI Certificate Verification
// Pipeline scoring model (Section 4 of the UAE Pipeline spec):
//   Schema/Format Validation  (15) — EID format, ref format, date, phone
//   Arithmetic Check          (20) — basic + allowances = gross
//   Rule Engine               (20) — all field match checks
//   LLM Semantic Risk         (20) — vision authenticity + hash integrity
//   Database Match            (15) — authority record + salary cross-check
//   Visual Forgery Detection  (10) — PDF metadata, fonts, OCR reconciliation
//   TOTAL                    (100)
//
// verdict: REAL ≥ 80 · REVIEW 60–79 · FAKE < 60

export type UAEPipelineScore = {
  schemaValidation: number   // 0–15
  arithmeticCheck:  number   // 0–20
  ruleEngine:       number   // 0–20
  llmSemanticRisk:  number   // 0–20
  databaseMatch:    number   // 0–15
  visualForgery:    number   // 0–10
  total:            number   // 0–100
  verdict:          'REAL' | 'REVIEW' | 'FAKE'
  breakdown:        string[]
}

export function buildWeightedScore(
  report: VerificationReport,
  extras?: {
    pdfMetadataSuspicious?: boolean
    fontsSuspicious?:       boolean
    ocrDeltaSuspicious?:    boolean
    eidFormatPass?:         boolean
    refFormatPass?:         boolean
    dateNotFuture?:         boolean
  }
): UAEPipelineScore {
  const checks = report.checks
  const get = (id: string) => checks.find(c => c.id === id)

  // THE TYPE GATE DOMINATES: when the uploaded file is not the requested document
  // type, the content checks are all N/A — partial "benefit of the doubt" credit
  // must NOT add up to a high score for a file we could not actually verify.
  const wrongType = get('document_type')?.status === 'fail' || report.verdict === 'invalid'

  // Schema / Format (15): EID format + ref format + date validity
  const eidFmt  = extras?.eidFormatPass  !== false ? 5 : 0
  const refFmt  = extras?.refFormatPass  !== false ? 5 : 0
  const dateFmt = extras?.dateNotFuture  !== false ? 5 : 0
  const schemaValidation = eidFmt + refFmt + dateFmt

  // Arithmetic (20): internal salary reconciliation. No partial credit on a
  // wrong-type file — its figures were never evaluated.
  const arith = get('arithmetic')
  const arithmeticCheck = wrongType ? 0
    : !arith || arith.status === 'na' ? 15
    : arith.status === 'pass' ? 20 : 0

  // Rule Engine (20): field-match checks across all applicable dimensions.
  // Zero on a wrong-type file — the fields could not be cross-checked at all.
  const ruleIds = ['emirates_id_match', 'name_match', 'employer_match', 'account_match', 'date_chronology', 'ref_uniqueness']
  const applicable = ruleIds.filter(id => get(id)?.status !== 'na')
  const passed     = applicable.filter(id => get(id)?.status === 'pass')
  const ruleEngine = wrongType ? 0
    : applicable.length === 0 ? 15
    : Math.round((passed.length / applicable.length) * 20)

  // LLM Semantic Risk (20): vision authenticity + cryptographic hash integrity
  const vision = get('vision_authenticity')
  const hash   = get('hash_integrity')
  const visionScore = !vision || vision.status === 'na' ? 10 : vision.status === 'pass' ? 10 : 0
  const hashScore   = !hash   || hash.status   === 'na' ? 10 : hash.status   === 'pass' ? 10 : 0
  const llmSemanticRisk = visionScore + hashScore

  // Database Match (15): authority record existence + salary cross-check
  const authRec = get('authority_record')
  const salaryM = get('salary_match')
  const dbAuth  = !authRec || authRec.status === 'na' ? 7 : authRec.status === 'pass' ? 8 : 0
  const dbSal   = !salaryM || salaryM.status  === 'na' ? 7 : salaryM.status  === 'pass' ? 7 : 0
  const databaseMatch = Math.min(15, dbAuth + dbSal)

  // Visual Forgery (10): metadata timestamps, font families, OCR channel reconciliation
  const metaOk = !extras?.pdfMetadataSuspicious ? 4 : 0
  const fontOk = !extras?.fontsSuspicious        ? 3 : 0
  const ocrOk  = !extras?.ocrDeltaSuspicious     ? 3 : 0
  const visualForgery = metaOk + fontOk + ocrOk

  let total = schemaValidation + arithmeticCheck + ruleEngine + llmSemanticRisk + databaseMatch + visualForgery
  // Verdict-consistency caps: the 100-point score can never contradict the
  // forensic verdict (e.g. "invalid" must not display as 92/100 REAL).
  //   wrong type      → FAKE band (the requested document was not provided)
  //   hash_tampered   → FAKE band (cryptographic proof of post-issuance editing)
  //   suspicious      → REVIEW band at best (vision flagged a likely fake)
  //   mismatch/tampered → REVIEW band at best (field fraud signals)
  if (wrongType) total = Math.min(total, 45)
  else if (report.verdict === 'hash_tampered') total = Math.min(total, 40)
  else if (report.verdict === 'suspicious') total = Math.min(total, 65)
  else if (report.verdict === 'mismatch' || report.verdict === 'tampered') total = Math.min(total, 70)
  const verdict: UAEPipelineScore['verdict'] = total >= 80 ? 'REAL' : total >= 60 ? 'REVIEW' : 'FAKE'

  const breakdown = [
    `Schema/Format:  ${schemaValidation}/15`,
    `Arithmetic:     ${arithmeticCheck}/20`,
    `Rule Engine:    ${ruleEngine}/20`,
    `LLM Semantic:   ${llmSemanticRisk}/20`,
    `Database Match: ${databaseMatch}/15`,
    `Visual Forgery: ${visualForgery}/10`,
    ...(wrongType ? ['Type gate FAILED — not the requested document; score capped below the REVIEW band'] : []),
    `Total:          ${total}/100  →  ${verdict}`,
  ]

  return { schemaValidation, arithmeticCheck, ruleEngine, llmSemanticRisk, databaseMatch, visualForgery, total, verdict, breakdown }
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
    iban?: string | null
    account?: string | null
    issueDate?: string | null
  }
  // null ⇒ the signal was not available (e.g. scanned PDF with no text layer) → the
  // check is "na", never penalised.
  structure: StructureCheck | null
  arithmetic: ReturnType<typeof checkArithmetic> | null
  // Vision-LLM judgment on the actual PDF (null/omitted = not run → fallback to the
  // deterministic layers).
  vision?: VisionAssessment | null
  validatedSalaryCertDate?: string | null
  // Cryptographic hash integrity check (null = no token found in document → skipped).
  hashIntegrity?: { hasToken: boolean; hashMatch: boolean; storedHash: string | null; computedHash: string | null } | null
}

export function buildVerificationReport(input: ForensicInputs): VerificationReport {
  const { expectedType, record, declaredSalary, extracted, structure, arithmetic, vision, validatedSalaryCertDate, hashIntegrity } = input
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
    status: nameMatch === null ? 'na' : nameMatch ? 'pass' : 'fail',
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
    status: employerMatch === null ? 'na' : employerMatch ? 'pass' : 'fail',
    detail: !profile.salaryBearing
      ? `Not applicable for a ${profile.label}.`
      : employerMatch === null
      ? 'Employer not available to cross-check.'
      : employerMatch
      ? 'Employer matches the registry.'
      : `Employer on the document differs from the registry ("${record?.employer_name}").`,
    weight: 6,
  })

  // 4b: bank account / IBAN cross-check against the beneficiary's record. A divergence is
  // a strong fraud signal (the document belongs to a different account) → mismatch → officer.
  const recIban = norm(record?.iban)
  const recAcct = norm(record?.account_number)
  const docIban = norm(extracted.iban)
  const docAcct = norm(extracted.account)
  const accountApplicable = !!record && !wrongType && (!!recIban || !!recAcct) && (!!docIban || !!docAcct)
  const accountMismatch = accountApplicable && (
    (!!docIban && !!recIban && docIban !== recIban) ||
    (!!docAcct && !!recAcct && docAcct !== recAcct)
  )
  checks.push({
    id: 'account_match',
    label: 'Bank account / IBAN matches the record',
    status: !accountApplicable ? 'na' : accountMismatch ? 'fail' : 'pass',
    detail: wrongType
      ? 'Not evaluated — the file is not the requested document type.'
      : !accountApplicable
      ? 'No account / IBAN available to cross-check.'
      : accountMismatch
      ? `The account / IBAN on the document (${extracted.iban || extracted.account}) does not match the beneficiary's record.`
      : 'Account / IBAN on the document matches the record.',
    weight: 12,
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

  // 5b: cryptographic hash integrity — SHA-256 of the document text vs the embedded
  // CryptoSignatureToken. A mismatch is mathematical proof the file was edited after
  // issuance. Only evaluated when the document embeds the token (hasToken=true).
  const hashTamperedFail = !!hashIntegrity && hashIntegrity.hasToken && !hashIntegrity.hashMatch
  checks.push({
    id: 'hash_integrity',
    label: 'Cryptographic document hash matches embedded token',
    status: !hashIntegrity || !hashIntegrity.hasToken
      ? 'na'
      : hashIntegrity.hashMatch
      ? 'pass'
      : 'fail',
    detail: !hashIntegrity || !hashIntegrity.hasToken
      ? 'No cryptographic token found in document — hash verification skipped.'
      : hashIntegrity.hashMatch
      ? `Document content matches the embedded cryptographic token (SHA-256 verified).`
      : `Document content does not match the embedded token — the file has been modified since issuance. Stored: ${hashIntegrity.storedHash?.slice(0, 16)}... Computed: ${hashIntegrity.computedHash?.slice(0, 16)}...`,
    weight: 30,
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

  // 7: date chronology check for termination letters (supporting docs in job loss)
  const nonWorkLetterDateStr = expectedType === 'non_work_letter' ? (extracted.issueDate ?? vision?.observed?.issueDate ?? null) : null
  const validatedSalaryCertDateStr = validatedSalaryCertDate ?? null
  let dateChronologyPass = true
  if (nonWorkLetterDateStr && validatedSalaryCertDateStr) {
    const salaryCertDate = parseDate(validatedSalaryCertDateStr)
    const nonWorkLetterDate = parseDate(nonWorkLetterDateStr)
    if (salaryCertDate && nonWorkLetterDate && nonWorkLetterDate < salaryCertDate) {
      dateChronologyPass = false
    }
  }

  checks.push({
    id: 'date_chronology',
    label: 'Termination letter date matches salary certificate chronology',
    status: expectedType !== 'non_work_letter' || !validatedSalaryCertDateStr || !nonWorkLetterDateStr
      ? 'na'
      : dateChronologyPass
      ? 'pass'
      : 'fail',
    detail: expectedType !== 'non_work_letter'
      ? `Not applicable for a ${profile.label}.`
      : !validatedSalaryCertDateStr || !nonWorkLetterDateStr
      ? 'No prior salary certificate or current termination letter date to compare.'
      : dateChronologyPass
      ? `Termination letter date (${nonWorkLetterDateStr}) matches salary certificate chronology.`
      : `Termination letter date (${nonWorkLetterDateStr}) is older than the salary certificate date (${validatedSalaryCertDateStr}).`,
    weight: 15,
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
  if (hashTamperedFail) verdict = 'hash_tampered'           // cryptographic proof — highest precedence
  else if (visionSuspicious) verdict = 'suspicious'
  else if (wrongType) verdict = 'invalid'
  else if (salaryMismatch || eidMatch === false || nameMatch === false || employerMatch === false || accountMismatch || !dateChronologyPass) verdict = 'mismatch'
  else if (profile.salaryBearing && !recordValid) verdict = 'unverifiable'
  else if (arithmeticFail) verdict = 'tampered'
  else verdict = 'verified'

  const failing = checks.filter((c) => c.status === 'fail').map((c) => c.label)
  const summary =
    verdict === 'hash_tampered'
      ? 'This document has been modified from its original. The cryptographic token embedded at issuance does not match the current content — please resubmit the original, unedited document.'
      : verdict === 'verified'
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

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const clean = dateStr.trim()

  // Match DD/MM/YYYY or DD-MM-YYYY
  let match = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const year = parseInt(match[3], 10)
    return new Date(year, month, day)
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  match = clean.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    return new Date(year, month, day)
  }

  // Fallback parser
  const parsed = new Date(clean)
  return isNaN(parsed.getTime()) ? null : parsed
}
