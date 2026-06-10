import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/auth/demo-applicants?q=<search>
// Returns up to 50 applicants (id + names) for the UAE PASS demo picker.
// No auth required — only case_number and names are exposed, no sensitive fields.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

  let query = supabaseAdmin
    .from('applicants')
    .select('case_number, full_name, full_name_ar')
    .order('case_number')
    .limit(50)

  if (q) {
    query = query.or(`case_number.ilike.%${q}%,full_name.ilike.%${q}%,full_name_ar.ilike.%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data ?? [] })
}
