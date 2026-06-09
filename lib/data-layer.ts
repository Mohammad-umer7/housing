// SADDAD's OWN system of record: the data this service creates and is accountable
// for — cases (decisions), agent_steps (the live trail), audit_logs, and the
// job_queue. This is regulated output and must live in a government-controlled,
// UAE-region store with audit retention (see docs/INTEGRATION.md + docs/SECURITY.md).
//
// Data SADDAD *consumes* from other systems (applicant identity, loan/arrears,
// salary verification) lives behind a separate port — lib/integrations/source-systems.ts —
// because in production it comes from MOEI / bank / UAE PASS systems, not from here.

import { supabaseAdmin } from './supabase'

const AGENT_NAMES = [
  'planner_agent',
  'risk_forecaster',
  'document_agent',
  'db_fetch',
  'financial_agent',
  'rules_agent',
  'fairness_agent',
  'critic_agent',
  'recovery_agent',
  'communication_agent',
  'escalation_agent',
] as const

export type AgentName = typeof AGENT_NAMES[number]

export type CaseInput = {
  case_number: string
  full_name?: string
  emirates_id?: string
  phone?: string
  arrears_amount?: number
  monthly_salary?: number
  monthly_expenses?: number
  status?: string
}

export type CaseDecisionData = {
  full_name?: unknown
  emirates_id?: unknown
  phone?: unknown
  arrears_amount?: number
  monthly_salary?: number
  monthly_expenses?: number
  status: string
  decision_reason?: string
  monthly_payment?: number | null
  duration_months?: number | null
  risk_score?: number
  debt_to_income_ratio?: number
  processed_at?: string
  rationale_ar?: string
  risk_level?: string
  consistency_score?: number
  similar_cases_found?: number
  fairness_note?: string
  // Loan fields
  loan_bank_name?: string
  loan_account_number?: string
  total_loan_amount?: number | null
  remaining_loan_balance?: number | null
  current_installment?: number | null
  remaining_loan_months?: number | null
  total_new_monthly_payment?: number | null
  recovery_guidance?: string | null
  recovery_guidance_ar?: string | null
  case_study?: unknown
  verification_report?: unknown
  // UAE PASS social signal + fast-track flag (officer priority lane)
  social_status?: string
  is_priority?: boolean
  priority_escalation?: boolean
}

export type AuditLogInput = {
  case_number: string
  action: string
  decision?: string
  rule_triggered?: string
  rationale?: string
  financial_snapshot?: unknown
  agent_model?: string
  processed_by?: string
  timestamp?: string
}

export type AgentStepPatch = {
  status?: string
  started_at?: string
  completed_at?: string
  duration_ms?: number
  result_summary?: string
  ran_in_parallel?: boolean
}

// Applicant / loan / salary reads (data SADDAD consumes from other government
// systems of record) live in lib/integrations/source-systems.ts, not here.

// ── Cases ─────────────────────────────────────────────────────────────────────

export async function getCaseByCaseNumber(caseNumber: string) {
  const { data } = await supabaseAdmin
    .from('cases')
    .select(
      'status, phone, monthly_salary, monthly_payment, duration_months, decision_reason, processed_at, rationale_ar, risk_level, consistency_score, similar_cases_found, fairness_note, current_installment, total_new_monthly_payment, recovery_guidance, recovery_guidance_ar, case_study, verification_report'
    )
    .eq('case_number', caseNumber)
    .single()
  return data
}

// All cases (history cards) for one beneficiary, newest first. A person is identified
// by Emirates ID, so every re-submission (its own case_number) appears as its own card.
export async function getCasesByEmiratesId(emiratesId: string) {
  if (!emiratesId) return []
  const { data } = await supabaseAdmin.from('cases').select('*').eq('emirates_id', emiratesId)
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.sort((a, b) => {
    const ta = new Date(String(a.created_at ?? a.processed_at ?? 0)).getTime()
    const tb = new Date(String(b.created_at ?? b.processed_at ?? 0)).getTime()
    return tb - ta
  })
}

export async function upsertCase(data: CaseInput) {
  const { error } = await supabaseAdmin.from('cases').upsert(data, { onConflict: 'case_number' })
  if (error) throw new Error(`upsertCase failed: ${error.message}`)
}

export async function upsertCaseDecision(caseNumber: string, data: CaseDecisionData) {
  // Step 1: Core base-schema fields — guaranteed to exist in every deployment.
  // These MUST succeed; a failure here is a real error.
  const coreData: Record<string, unknown> = { case_number: caseNumber, status: data.status }
  if (data.full_name !== undefined) coreData.full_name = data.full_name
  if (data.emirates_id !== undefined) coreData.emirates_id = data.emirates_id
  if (data.phone !== undefined) coreData.phone = data.phone
  if (data.arrears_amount !== undefined) coreData.arrears_amount = data.arrears_amount
  if (data.monthly_salary !== undefined) coreData.monthly_salary = data.monthly_salary
  if (data.monthly_expenses !== undefined) coreData.monthly_expenses = data.monthly_expenses
  if (data.decision_reason !== undefined) coreData.decision_reason = data.decision_reason
  if (data.monthly_payment !== undefined) coreData.monthly_payment = data.monthly_payment
  if (data.duration_months !== undefined) coreData.duration_months = data.duration_months
  if (data.risk_score !== undefined) coreData.risk_score = data.risk_score
  if (data.debt_to_income_ratio !== undefined) coreData.debt_to_income_ratio = data.debt_to_income_ratio
  if (data.processed_at !== undefined) coreData.processed_at = data.processed_at

  const { error: coreErr } = await supabaseAdmin
    .from('cases')
    .upsert(coreData, { onConflict: 'case_number' })
  if (coreErr) throw new Error(`upsertCaseDecision failed: ${coreErr.message}`)

  // Step 2: Extended fields added post-launch via ALTER TABLE.
  // Silently skipped if the columns don't exist yet — run the ALTER TABLE statements
  // in supabase-setup.sql to unlock full data capture.
  const extData: Record<string, unknown> = {}
  if (data.rationale_ar !== undefined) extData.rationale_ar = data.rationale_ar
  if (data.risk_level !== undefined) extData.risk_level = data.risk_level
  if (data.consistency_score !== undefined) extData.consistency_score = data.consistency_score
  if (data.similar_cases_found !== undefined) extData.similar_cases_found = data.similar_cases_found
  if (data.fairness_note !== undefined) extData.fairness_note = data.fairness_note
  if (data.loan_bank_name !== undefined) extData.loan_bank_name = data.loan_bank_name
  if (data.loan_account_number !== undefined) extData.loan_account_number = data.loan_account_number
  if (data.total_loan_amount !== undefined) extData.total_loan_amount = data.total_loan_amount
  if (data.remaining_loan_balance !== undefined) extData.remaining_loan_balance = data.remaining_loan_balance
  if (data.current_installment !== undefined) extData.current_installment = data.current_installment
  if (data.remaining_loan_months !== undefined) extData.remaining_loan_months = data.remaining_loan_months
  if (data.total_new_monthly_payment !== undefined) extData.total_new_monthly_payment = data.total_new_monthly_payment
  if (data.recovery_guidance !== undefined) extData.recovery_guidance = data.recovery_guidance
  if (data.recovery_guidance_ar !== undefined) extData.recovery_guidance_ar = data.recovery_guidance_ar
  if (data.case_study !== undefined) extData.case_study = data.case_study
  if (data.verification_report !== undefined) extData.verification_report = data.verification_report
  if (data.social_status !== undefined) extData.social_status = data.social_status
  if (data.is_priority !== undefined) extData.is_priority = data.is_priority
  if (data.priority_escalation !== undefined) extData.priority_escalation = data.priority_escalation

  if (Object.keys(extData).length > 0) {
    const { error: extErr } = await supabaseAdmin
      .from('cases')
      .update(extData)
      .eq('case_number', caseNumber)
    if (extErr) {
      console.warn(`[upsertCaseDecision] Extended fields skipped (run ALTER TABLE) case=${caseNumber}: ${extErr.message}`)
    }
  }
}

export async function getRecentCases(limit = 50) {
  const { data } = await supabaseAdmin
    .from('cases')
    .select('*')
    .order('processed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getCaseStats() {
  const { data } = await supabaseAdmin.from('cases').select('status')
  const cases = data ?? []
  return {
    total: cases.length,
    approved: cases.filter((c: { status: string }) => c.status === 'approved').length,
    rejected: cases.filter((c: { status: string }) => c.status === 'rejected').length,
    escalated: cases.filter((c: { status: string }) => c.status === 'escalated').length,
  }
}

// Brief Rule 3 — duplicate / existing active application detection. Counts OTHER
// applications for the same beneficiary (by Emirates ID) that are still OPEN — i.e.
// in progress ('pending') OR awaiting an officer's manual decision ('escalated'), or
// a queued/processing job. Final outcomes ('approved'/'rejected') are NOT open, so a
// citizen may legitimately re-apply later. The current case is always excluded, so
// re-submitting the SAME application (e.g. to re-upload a corrected certificate after
// a documents request) is never treated as a duplicate. Fail-open (errors → 0).
export async function countOtherActiveApplications(
  emiratesId: string,
  currentCaseNumber: string
): Promise<number> {
  if (!emiratesId) return 0
  try {
    const { data: openCases } = await supabaseAdmin
      .from('cases')
      .select('case_number, status')
      .eq('emirates_id', emiratesId)
      .in('status', ['pending', 'escalated'])
      .neq('case_number', currentCaseNumber)
    const openCaseNumbers = (openCases ?? []).map((c: { case_number: string }) => c.case_number)

    const { data: activeJobs } = await supabaseAdmin
      .from('job_queue')
      .select('case_number')
      .in('status', ['queued', 'processing'])
      .neq('case_number', currentCaseNumber)
    const jobCaseNumbers = (activeJobs ?? []).map((j: { case_number: string }) => j.case_number)

    // De-dupe across both sources; only count jobs that belong to this beneficiary's
    // open cases (job_queue has no Emirates ID of its own).
    const all = new Set<string>(openCaseNumbers)
    for (const cn of jobCaseNumbers) if (openCaseNumbers.includes(cn)) all.add(cn)
    return all.size
  } catch (err) {
    console.warn(`[countOtherActiveApplications] failed (fail-open) eid=${emiratesId}:`, err)
    return 0
  }
}

// Re-submission gate for a SINGLE Application ID. A citizen may re-apply with the same
// App ID ONLY once the previous request reached a re-submittable state. The gate keys
// off the case's status AND its §8 recommendation (so it can tell a genuine officer
// escalation apart from a "go upload your documents" outcome, which both land as
// status='escalated'):
//   • currently processing (active job, or status 'pending') → BLOCK ('processing')
//   • escalated to a human officer (recommendation 'Refer to Employee') → BLOCK ('under_review')
//   • already approved → BLOCK ('approved')  — a plan is in place; nothing to resubmit
//   • a "Request Documents" outcome (any status) → ALLOW — the citizen must re-upload
//   • rejected (hard denial or otherwise) → ALLOW — they may fix the issue and re-apply
//   • no prior case → ALLOW (first submission)
// Fail-OPEN (errors → not blocked) so a transient DB hiccup never traps a legit citizen.
export type ResubmissionGate = {
  blocked: boolean
  state: 'processing' | 'under_review' | 'approved' | null
  reason: string | null // citizen-facing message
}

const GATE_PROCESSING_MSG =
  'This application is currently being processed. Please wait for the decision before submitting again.'
const GATE_REVIEW_MSG =
  'This application is under review by a housing officer. You cannot submit a new application until the officer reaches a decision.'
const GATE_APPROVED_MSG =
  'This application has already been approved and a rescheduling plan is in place. No new submission is needed.'

// Pure decision (no I/O) so it can be unit-tested across every branch. `recommendation`
// is the §8 outcome of the LAST decided case; it lets us tell a genuine officer
// escalation ('Refer to Employee') apart from a "go upload your docs" outcome
// ('Request Documents') — both of which land as status='escalated'.
export function decideResubmissionGate(input: {
  hasActiveJob: boolean
  status: string | null
  recommendation: string | null
}): ResubmissionGate {
  const ALLOW: ResubmissionGate = { blocked: false, state: null, reason: null }
  // In flight right now (queued/processing) — block regardless of any prior decision.
  if (input.hasActiveJob) return { blocked: true, state: 'processing', reason: GATE_PROCESSING_MSG }
  // A documents request ALWAYS lets the citizen back in to upload — whether it landed as
  // 'escalated' (recoverable gap during escalation) or 'rejected' (G-01 missing docs).
  if (input.recommendation === 'Request Documents') return ALLOW
  if (input.status === 'pending') return { blocked: true, state: 'processing', reason: GATE_PROCESSING_MSG }
  if (input.status === 'escalated') return { blocked: true, state: 'under_review', reason: GATE_REVIEW_MSG }
  if (input.status === 'approved') return { blocked: true, state: 'approved', reason: GATE_APPROVED_MSG }
  // 'rejected' (hard denial or otherwise) and any other terminal state — may re-apply.
  return ALLOW
}

// Re-submission gate for a SINGLE Application ID — reads the live job + last case and
// delegates to decideResubmissionGate. Fail-OPEN (errors → not blocked) so a transient
// DB hiccup never traps a legitimate citizen.
export async function getResubmissionGate(caseNumber: string): Promise<ResubmissionGate> {
  const ALLOW: ResubmissionGate = { blocked: false, state: null, reason: null }
  // TESTING ONLY — when ALLOW_RESUBMIT_TESTING=true the gate is disabled so the same
  // Application ID can be submitted again and again. REMOVE this flag (and the reset
  // call in the process-application route) to restore the production gate.
  if (process.env.ALLOW_RESUBMIT_TESTING === 'true') return ALLOW
  if (!caseNumber) return ALLOW
  try {
    const activeJob = await getActiveJob(caseNumber)
    const prior = activeJob ? null : await getCaseByCaseNumber(caseNumber)
    const recommendation =
      prior?.case_study && typeof prior.case_study === 'object'
        ? String((prior.case_study as { recommendation?: unknown }).recommendation ?? '')
        : ''
    return decideResubmissionGate({
      hasActiveJob: Boolean(activeJob),
      status: prior ? String(prior.status ?? '') : null,
      recommendation,
    })
  } catch (err) {
    console.warn(`[getResubmissionGate] failed (fail-open) case=${caseNumber}:`, err)
    return ALLOW
  }
}

// TESTING ONLY — wipe a single Application ID's prior submission data (case row, agent
// trace, audit log, queued job) so it can be re-run from a clean slate. Used by the
// process-application route when ALLOW_RESUBMIT_TESTING=true. Feedback is left intact.
export async function resetCaseForResubmit(caseNumber: string) {
  if (!caseNumber) return
  try {
    await supabaseAdmin.from('agent_steps').delete().eq('case_number', caseNumber)
    await supabaseAdmin.from('audit_logs').delete().eq('case_number', caseNumber)
    await supabaseAdmin.from('job_queue').delete().eq('case_number', caseNumber)
    await supabaseAdmin.from('cases').delete().eq('case_number', caseNumber)
  } catch (err) {
    console.warn(`[resetCaseForResubmit] failed case=${caseNumber}:`, err)
  }
}

// Fairness precedent — reads the dedicated historical_cases corpus (the 1,828 real
// approved MSZHP decisions), NOT live `cases`, so processing an applicant never
// erodes the precedent the agent compares against.
export async function getSimilarCases(debtToIncomeRatio: number, limit = 5) {
  const { data } = await supabaseAdmin
    .from('historical_cases')
    .select('status, debt_to_income_ratio, arrears_amount')
    .gte('debt_to_income_ratio', debtToIncomeRatio - 0.10)
    .lte('debt_to_income_ratio', debtToIncomeRatio + 0.10)
    .limit(limit)
  return data ?? []
}

// ── Job Queue ─────────────────────────────────────────────────────────────────

// Postgres JSONB rejects NUL bytes ("unsupported Unicode escape sequence"). PDF text
// / metadata extraction can produce them, so strip NULs from every string value
// before the payload is stored.
const NUL = String.fromCharCode(0)
function stripNulDeep<T>(value: T): T {
  if (typeof value === 'string') return value.split(NUL).join('') as unknown as T
  if (Array.isArray(value)) return value.map((v) => stripNulDeep(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripNulDeep(v)
    return out as T
  }
  return value
}

export async function addToQueue(caseNumber: string, formData: unknown) {
  // Exactly ONE job row per case: clear any stale/terminal/duplicate rows first so the
  // claim is unambiguous (re-submitting a case re-queues it cleanly). Surface errors —
  // a silent insert failure used to leave the UI stuck on "Waiting in queue" forever.
  await supabaseAdmin.from('job_queue').delete().eq('case_number', caseNumber)
  const { error } = await supabaseAdmin.from('job_queue').insert({
    case_number: caseNumber,
    status: 'queued',
    form_data: stripNulDeep(formData),
    queued_at: new Date().toISOString(),
  })
  if (error) throw new Error(`addToQueue failed: ${error.message}`)
}

export async function getActiveJob(caseNumber: string) {
  // maybeSingle + limit(1): never throw on 0 or (defensively) >1 rows.
  const { data } = await supabaseAdmin
    .from('job_queue')
    .select('id, status')
    .eq('case_number', caseNumber)
    .in('status', ['queued', 'processing'])
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getJobStatus(caseNumber: string) {
  const { data } = await supabaseAdmin
    .from('job_queue')
    .select('status, queued_at, started_at, completed_at, error_message')
    .eq('case_number', caseNumber)
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getJobsAheadCount(queuedAt: string) {
  const { count } = await supabaseAdmin
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lt('queued_at', queuedAt)
  return (count ?? 0) + 1
}

export async function countActiveJobs() {
  const { count } = await supabaseAdmin
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .in('status', ['queued', 'processing'])
  return count ?? 0
}

export async function countQueuedJobs() {
  const { count } = await supabaseAdmin
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
  return count ?? 0
}

export async function countProcessingJobs() {
  const { count } = await supabaseAdmin
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')
  return count ?? 0
}

// Atomically claim the queued job AND return its payload in one round-trip. The
// `.eq('status','queued')` makes the claim a transition that only one caller can win:
// if the row is already 'processing'/terminal (e.g. a duplicate after() invocation),
// 0 rows update and this returns null — the caller skips quietly, no false failure.
export async function claimJob(
  caseNumber: string,
  workerId: string
): Promise<{ form_data: unknown } | null> {
  const { data, error } = await supabaseAdmin
    .from('job_queue')
    .update({
      status: 'processing',
      worker_id: workerId,
      started_at: new Date().toISOString(),
      attempt_count: 1,
    })
    .eq('case_number', caseNumber)
    .eq('status', 'queued')
    .select('form_data')
  if (error) throw new Error(`claimJob failed: ${error.message}`)
  return data && data.length > 0 ? (data[0] as { form_data: unknown }) : null
}

export async function updateJobStatus(
  caseNumber: string,
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  const patch: Record<string, unknown> = { status, completed_at: new Date().toISOString() }
  if (errorMessage) patch.error_message = errorMessage
  await supabaseAdmin.from('job_queue').update(patch).eq('case_number', caseNumber)
}

export async function getQueueStats() {
  const { data } = await supabaseAdmin
    .from('job_queue')
    .select('status, queued_at, started_at, completed_at')
    .order('queued_at', { ascending: false })
    .limit(200)
  return data ?? []
}

// ── Feedback ──────────────────────────────────────────────────────────────────
// Citizen feedback after a decision: 1-5 star rating + optional comment + name.
// Stored here and surfaced in the officer Feedback section.

export type FeedbackInput = {
  case_number?: string | null
  name: string
  rating: number
  comment?: string | null
}

// Strip HTML tags (XSS hygiene) like the submission route's sanitizer.
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim()

export async function submitFeedback(input: FeedbackInput) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 0)))
  const name = stripTags(String(input.name ?? '')).slice(0, 120)
  if (!name) throw new Error('submitFeedback failed: name is required')
  const comment = input.comment ? stripTags(String(input.comment)).slice(0, 2000) || null : null
  const { error } = await supabaseAdmin.from('feedback').insert({
    case_number: input.case_number ? String(input.case_number).slice(0, 50) : null,
    name,
    rating,
    comment,
  })
  if (error) throw new Error(`submitFeedback failed: ${error.message}`)
}

export async function getRecentFeedback(limit = 100) {
  const { data } = await supabaseAdmin
    .from('feedback')
    .select('id, case_number, name, rating, comment, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getFeedbackStats() {
  const { data } = await supabaseAdmin.from('feedback').select('rating')
  const rows = (data ?? []) as { rating: number }[]
  const count = rows.length
  const average = count ? Math.round((rows.reduce((s, r) => s + Number(r.rating), 0) / count) * 100) / 100 : 0
  return { count, average }
}

// ── Agent Steps ───────────────────────────────────────────────────────────────

export async function initAgentSteps(caseNumber: string) {
  await supabaseAdmin.from('agent_steps').delete().eq('case_number', caseNumber)
  await supabaseAdmin.from('agent_steps').insert(
    AGENT_NAMES.map(name => ({
      case_number: caseNumber,
      agent_name: name,
      status: 'pending',
    }))
  )
}

export async function updateAgentStep(
  caseNumber: string,
  agentName: AgentName,
  patch: AgentStepPatch
) {
  await supabaseAdmin
    .from('agent_steps')
    .update(patch)
    .eq('case_number', caseNumber)
    .eq('agent_name', agentName)
}

export async function getAgentSteps(caseNumber: string) {
  const { data } = await supabaseAdmin
    .from('agent_steps')
    .select('agent_name, status, duration_ms, ran_in_parallel, result_summary, started_at, completed_at')
    .eq('case_number', caseNumber)
    .order('started_at', { ascending: true, nullsFirst: true })
  return data ?? []
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export async function createAuditLog(data: AuditLogInput) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    case_number: data.case_number,
    action: data.action,
    decision: data.decision,
    rule_triggered: data.rule_triggered,
    rationale: data.rationale,
    financial_snapshot: data.financial_snapshot,
    agent_model: data.agent_model,
    processed_by: data.processed_by,
    timestamp: data.timestamp ?? new Date().toISOString(),
  })
  if (error) throw new Error(`createAuditLog failed: ${error.message}`)
}

export async function getAuditLogsByCaseNumber(caseNumber: string) {
  const { data } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('case_number', caseNumber)
    .order('timestamp', { ascending: false })
  return data ?? []
}

// ── Uploaded Document Retrieval ───────────────────────────────────────────────

// Returns the base64-encoded PDF that was uploaded with a submission, or null
// if no document was attached. Reads form_data from the most recent job_queue
// row for the case (completed rows are kept — never deleted after processing).
export async function getJobFormDataBase64(caseNumber: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('job_queue')
    .select('form_data')
    .eq('case_number', caseNumber)
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const fd = data.form_data as Record<string, unknown> | null
  if (!fd || typeof fd.pdfBase64 !== 'string' || !fd.pdfBase64) return null
  return fd.pdfBase64
}

// ── System Settings (admin-configurable key-value store) ─────────────────────
// Used to persist admin-edited chatbot custom instructions per role and the
// governance rule overrides. The system_settings table may not exist in all
// environments — all functions are fail-open (return null / skip silently) so
// the app keeps working.

export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) return null
    return (data?.value as string | null) ?? null
  } catch {
    return null
  }
}

export async function saveSystemSetting(key: string, value: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) console.warn(`[saveSystemSetting] ${key}: ${error.message}`)
  } catch (err) {
    console.warn('[saveSystemSetting] failed:', err)
  }
}

// ── Login Log ─────────────────────────────────────────────────────────────────

export async function logLogin(data: {
  username: string
  role: string
  caseNumber?: string | null
  displayName?: string | null
  ipAddress?: string | null
}): Promise<void> {
  try {
    await supabaseAdmin.from('login_log').insert({
      username:     data.username,
      role:         data.role,
      case_number:  data.caseNumber ?? null,
      display_name: data.displayName ?? null,
      ip_address:   data.ipAddress ?? null,
      logged_in_at: new Date().toISOString(),
    })
  } catch (err) {
    // Login logging is best-effort — never block the sign-in flow
    console.warn('[logLogin] failed:', err)
  }
}

export type LoginLogEntry = {
  id: number
  username: string | null
  role: string
  case_number: string | null
  display_name: string | null
  ip_address: string | null
  logged_in_at: string
}

export async function getLoginLogs(opts?: {
  limit?: number
  role?: string
  caseNumber?: string
}): Promise<LoginLogEntry[]> {
  let q = supabaseAdmin
    .from('login_log')
    .select('*')
    .order('logged_in_at', { ascending: false })
    .limit(opts?.limit ?? 200)
  if (opts?.role) q = q.eq('role', opts.role)
  if (opts?.caseNumber) q = q.eq('case_number', opts.caseNumber)
  const { data } = await q
  return (data ?? []) as LoginLogEntry[]
}

// ── Governance Rules (admin-configurable, DB overrides hardcoded defaults) ───

export type GovernanceRuleOverrides = {
  maxDeductionPercent?: number
  hardshipDeductionPercent?: number
  hardshipPerMemberIncome?: number
  certFreshnessDays?: number
  dbrCapSalaried?: number
  dbrCapRetiree?: number
  salaryDiscrepancyThresholdPct?: number
}

const RULE_KEYS: (keyof GovernanceRuleOverrides)[] = [
  'maxDeductionPercent',
  'hardshipDeductionPercent',
  'hardshipPerMemberIncome',
  'certFreshnessDays',
  'dbrCapSalaried',
  'dbrCapRetiree',
  'salaryDiscrepancyThresholdPct',
]

export async function getGovernanceRuleOverrides(): Promise<GovernanceRuleOverrides> {
  const overrides: GovernanceRuleOverrides = {}
  for (const key of RULE_KEYS) {
    const raw = await getSystemSetting(`rule_${key}`)
    if (raw !== null && raw.trim() !== '') {
      const n = Number(raw)
      if (Number.isFinite(n)) (overrides as Record<string, number>)[key] = n
    }
  }
  return overrides
}

export async function saveGovernanceRuleOverrides(data: GovernanceRuleOverrides): Promise<void> {
  const saves: Promise<void>[] = []
  for (const key of RULE_KEYS) {
    const val = (data as Record<string, unknown>)[key]
    if (val !== undefined && val !== null) {
      saves.push(saveSystemSetting(`rule_${key}`, String(val)))
    }
  }
  await Promise.all(saves)
}
