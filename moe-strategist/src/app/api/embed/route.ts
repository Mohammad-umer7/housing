/**
 * POST /api/embed
 *
 * Proxy to the Python backend's /api/embed endpoint.
 * Called after a document is saved to Supabase to trigger
 * OpenAI embedding generation and pgvector storage.
 */
export const runtime = 'edge'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await upstream.json()
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Backend unreachable'
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
