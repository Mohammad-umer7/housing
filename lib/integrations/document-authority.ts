// DOCUMENT AUTHORITY PORT (DB-2) — the authoritative salary-certificate registry.
//
// This is the second system of record SADDAD consumes. In production it is the
// salary authority (WPS / the issuing HR/bank) exposing a verification endpoint:
// you present the beneficiary's Emirates ID and it returns the genuine salary record
// (or nothing if the person has no record). Here it is backed by a separate Supabase
// project (lib/supabase-doc-registry) so the prototype runs end-to-end; swapping to
// the real authority means replacing `lookupCertificateByEmiratesId` — nothing else
// changes. The uploaded certificate's fields are then cross-checked against this
// record by the document-forensics engine.

import { getDocRegistry, isDocRegistryConfigured } from '@/lib/supabase-doc-registry'

export { isDocRegistryConfigured }

export type AuthorityRecord = {
  doc_code: string
  emirates_id: string
  employee_name: string
  employer_name: string
  job_title: string | null
  basic_salary: number
  allowances: number
  gross_salary: number
  issue_date: string
  status: string
}

// Look up the authoritative salary record for a beneficiary by Emirates ID (the
// identity SADDAD already holds from UAE PASS). Returns the record or null (no record
// on file / registry unreachable). Emirates ID is normalised so dash/spacing variants
// match.
export async function lookupCertificateByEmiratesId(
  emiratesId: string | null
): Promise<AuthorityRecord | null> {
  const eid = String(emiratesId ?? '').replace(/[^0-9]/g, '')
  if (!eid) return null
  const db = getDocRegistry()
  if (!db) return null
  const { data, error } = await db.from('salary_certificate_registry').select('*')
  if (error) {
    console.error('[document-authority] lookup error:', error.message)
    return null
  }
  const rows = (data as AuthorityRecord[]) ?? []
  return rows.find((r) => String(r.emirates_id ?? '').replace(/[^0-9]/g, '') === eid) ?? null
}
