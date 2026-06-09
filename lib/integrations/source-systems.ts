// SOURCE-SYSTEMS PORT — data SADDAD *consumes* from other systems of record.
//
// This is the boundary where SADDAD plugs into the government's existing systems.
// In production each function below is an adapter over a different owner's system;
// SADDAD never owns this data, it reads it:
//
//   getApplicant / getLoanDetails  → the loan servicer's core system
//                                    (e.g. Emirates Development Bank) — arrears,
//                                    installment, remaining term. Usually via an
//                                    API behind a data-sharing agreement, or a
//                                    read-only nightly sync, NOT direct DB access.
//   identity (name, Emirates ID)   → UAE PASS (federal identity provider).
//   verifySalary                   → an authoritative salary source (WPS / a
//                                    salary-certificate authority), which in
//                                    production replaces PDF OCR as the trusted
//                                    salary signal.
//   submitApprovalToLoanServicer   → OUTBOUND write-back: an approved rescheduling
//                                    must post the new installment / direct-debit
//                                    (DDA) instruction back to the servicer.
//
// Today every function is backed by the same Supabase `applicants` table so the
// prototype runs end-to-end. Swapping to the real systems means replacing the
// bodies here — nothing in /agents, /tools or the rest of /lib changes.
// See docs/INTEGRATION.md for the full mapping.

import { supabaseAdmin } from '../supabase'

// ── Inbound reads (systems of record owned by others) ─────────────────────────

// A re-submission case number carries a "-rN" suffix (e.g. MSZHP_123-r2) so each
// attempt is its own case/card; the underlying applicant/loan record is still keyed by
// the BASE Application ID. Strip the suffix to resolve the source record.
export function baseApplicationId(caseNumber: string): string {
  return String(caseNumber ?? '').replace(/-r\d+$/i, '')
}

export async function getApplicant(caseNumber: string) {
  const fetchOne = async (cn: string) => {
    const { data } = await supabaseAdmin.from('applicants').select('*').eq('case_number', cn).maybeSingle()
    return data
  }
  let data = await fetchOne(caseNumber)
  if (!data) {
    const base = baseApplicationId(caseNumber)
    if (base !== caseNumber) data = await fetchOne(base)
  }
  return data
}

export async function getApplicantByEmiratesId(emiratesId: string) {
  const { data } = await supabaseAdmin
    .from('applicants')
    .select('*')
    .eq('emirates_id', emiratesId)
    .single()
  return data
}

export async function getAllApplicants() {
  const { data } = await supabaseAdmin.from('applicants').select('*')
  return data ?? []
}

// Loan + arrears detail for a case. Currently the same applicant record; in
// production this is a distinct call to the bank's loan-servicing API.
export async function getLoanDetails(caseNumber: string) {
  return getApplicant(caseNumber)
}

// ── Outbound write-back (instruct the system of record) ───────────────────────

export type ApprovalInstruction = {
  monthlyPayment: number
  durationMonths: number
}

// When SADDAD approves a rescheduling, the new installment / direct-debit
// instruction must be posted back to the loan servicer's core system. Stubbed in
// the prototype (logs + returns a stub reference); production replaces the body
// with the servicer's API call. Callers treat failures as non-fatal.
export async function submitApprovalToLoanServicer(
  caseNumber: string,
  instruction: ApprovalInstruction
): Promise<{ submitted: boolean; reference: string }> {
  console.log(
    `[integration:loan-servicer] (stub) would post DDA for ${caseNumber}: ` +
    `AED ${instruction.monthlyPayment}/mo × ${instruction.durationMonths}mo`
  )
  return { submitted: false, reference: `STUB-${caseNumber}` }
}
