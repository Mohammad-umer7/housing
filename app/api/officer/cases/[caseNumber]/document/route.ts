import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { getJobFormDataBase64 } from '@/lib/data-layer'
import { errorResponse } from '@/lib/api-response'

// GET /api/officer/cases/[caseNumber]/document
// Streams the citizen-uploaded salary certificate back to the officer.
// ?download=1  → Content-Disposition: attachment  (forces Save As)
// (default)    → Content-Disposition: inline       (opens in browser PDF viewer)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseNumber: string }> }
) {
  try {
    await requireAuth(req, ['admin', 'officer'])
  } catch (authError) {
    return NextResponse.json(errorResponse(String(authError), 401), { status: 401 })
  }

  try {
    const { caseNumber } = await params
    const base64 = await getJobFormDataBase64(caseNumber)

    if (!base64) {
      return NextResponse.json(
        errorResponse('No document was uploaded for this case.', 404),
        { status: 404 }
      )
    }

    const buffer = Buffer.from(base64, 'base64')
    const forceDownload = req.nextUrl.searchParams.get('download') === '1'
    const filename = `salary-certificate-${caseNumber}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': forceDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        // Officers may only access this through the portal session — no caching.
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[officer/document] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
