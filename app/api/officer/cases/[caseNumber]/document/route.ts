import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { getCaseAttachments, getCaseDocumentManifest } from '@/lib/data-layer'
import { errorResponse } from '@/lib/api-response'

// GET /api/officer/cases/[caseNumber]/document
// Streams a citizen-uploaded document back to the officer.
//
// Query params:
//   ?list=1        → returns JSON manifest (no binary, all docs metadata)
//   ?index=N       → download specific document by index (0=primary, 1=supporting, 2+=additional)
//   ?download=1    → Content-Disposition: attachment  (forces Save As)
//   (default)      → index 0, Content-Disposition: inline
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
    const sp = req.nextUrl.searchParams

    // ?list=1 — return metadata manifest (no base64 blobs)
    if (sp.get('list') === '1') {
      const manifest = await getCaseDocumentManifest(caseNumber)
      return NextResponse.json({ success: true, data: manifest })
    }

    const docs = await getCaseAttachments(caseNumber)

    if (docs.length === 0) {
      return NextResponse.json(
        errorResponse('No document was uploaded for this case.', 404),
        { status: 404 }
      )
    }

    // Which document to serve (default: first / primary)
    const rawIndex = sp.get('index')
    const targetIndex = rawIndex != null ? parseInt(rawIndex, 10) : 0
    const doc = docs.find(d => d.index === targetIndex) ?? docs[0]

    const buffer = Buffer.from(doc.base64, 'base64')
    const forceDownload = sp.get('download') === '1'
    const ext = doc.filename.split('.').pop() || 'bin'
    const safeFilename = `document-${caseNumber.replace(/[^a-zA-Z0-9-]/g, '_')}-${doc.index}.${ext}`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': forceDownload
          ? `attachment; filename="${safeFilename}"`
          : `inline; filename="${safeFilename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[officer/document] error:', error)
    return NextResponse.json(errorResponse(String(error), 500), { status: 500 })
  }
}
