// DB-Fetch Agent (graph node) — pulls the applicant + loan record from the
// source system (lib/integrations via the database tool). Runs in parallel with
// the Document node; falls back to form data for a brand-new applicant.

import { updateAgentStep, countOtherActiveApplications, type AgentName } from '@/lib/data-layer'
import { executeDatabaseTool } from '@/tools/database-tools'
import { lookupUaePassProfile, isPrioritySocialStatus, SOCIAL_STATUS_LABELS } from '@/lib/integrations/uae-pass'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'

export async function dbFetchNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, formData } = state
  console.log(`[DbFetchAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'db_fetch'

  try {
    await updateAgentStep(caseNumber, agent, {
      status: 'running',
      started_at: new Date().toISOString(),
      ran_in_parallel: true,
    })

    const dbApplicant = await executeDatabaseTool('get_applicant', { caseNumber })

    const applicant = (dbApplicant ?? {
      full_name: formData.full_name,
      emirates_id: formData.emirates_id,
      phone: formData.phone,
      case_number: caseNumber,
      arrears_amount: Number(formData.arrears_amount),
      monthly_salary: Number(formData.monthly_salary),
      monthly_expenses: Number(formData.monthly_expenses),
      previous_default: false,
    }) as Record<string, unknown>

    // Brief §4/§7 — retrieve the beneficiary's verified identity + social situation
    // from UAE PASS (DB-3, a separate system of record), keyed by Application ID. UAE
    // PASS is authoritative for identity/family/social; the loan record stays
    // authoritative for the financials. A miss (or UAE PASS unreachable) is non-fatal —
    // the pipeline falls back to the Programme record.
    const uaePass = await lookupUaePassProfile(caseNumber)
    let uaeNote = ''
    if (uaePass) {
      applicant.full_name = uaePass.full_name || applicant.full_name
      applicant.full_name_ar = uaePass.full_name_ar ?? applicant.full_name_ar
      applicant.emirates_id = uaePass.emirates_id || applicant.emirates_id
      applicant.phone = uaePass.phone ?? applicant.phone
      applicant.marital_status = uaePass.marital_status ?? applicant.marital_status
      applicant.family_size = uaePass.family_size ?? applicant.family_size
      applicant.number_of_children = uaePass.number_of_children
      applicant.social_status = uaePass.social_status
      applicant.social_status_ar = uaePass.social_status_ar
      // Brief G-06 — a priority/hardship social category routes to fast-track human care.
      applicant.priority_group = uaePass.is_priority || isPrioritySocialStatus(uaePass.social_status)
      // A senior/retiree is assessed against the lower (50%) bank-deduction cap.
      if (uaePass.social_status === 'senior') applicant.is_retiree = true
      const label = SOCIAL_STATUS_LABELS[uaePass.social_status]?.en ?? uaePass.social_status
      uaeNote = ` · UAE PASS: ${label}, family ${uaePass.family_size} (${uaePass.number_of_children} children)`
    }

    // Brief Rule 3 — flag an existing active application. Combine the Programme's own
    // record (MOEI "previous applications" signal) with a live cross-case duplicate
    // check by Emirates ID, so a genuine concurrent re-submission is caught too.
    const emiratesId = String(applicant.emirates_id ?? formData.emirates_id ?? '')
    const liveDuplicates = await countOtherActiveApplications(emiratesId, caseNumber)
    const hasActiveApplication = Boolean(applicant.has_active_application) || liveDuplicates > 0
    applicant.has_active_application = hasActiveApplication

    const duration = Date.now() - start
    const dupNote = hasActiveApplication ? ' · ⚠ active duplicate application detected' : ''
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: dbApplicant
        ? `DB record found: ${applicant.full_name}, arrears AED ${Number(applicant.arrears_amount).toLocaleString()}${uaeNote}${dupNote}`
        : `New applicant: ${applicant.full_name} — using form data${uaeNote}${dupNote}`,
    })

    console.log(`[DbFetchAgent] DONE case=${caseNumber} duration=${duration}ms`)
    return { dbApplicant: applicant }
  } catch (err) {
    await updateAgentStep(caseNumber, agent, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result_summary: String(err),
    })
    throw err
  }
}
