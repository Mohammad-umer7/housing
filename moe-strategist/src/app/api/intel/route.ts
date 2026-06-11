/**
 * POST /api/intel
 *
 * Thin SSE proxy — forwards the request to the Python FastAPI backend and
 * streams the response back to the browser.  When the backend is not
 * reachable, returns a graceful error event so the frontend can fall back
 * to its local intelligence engine.
 */
export const runtime = 'edge'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('{"error":"Invalid JSON body"}', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))

      try {
        const upstream = await fetch(`${BACKEND}/api/intel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          // @ts-expect-error — duplex required for streaming in some envs
          duplex: 'half',
          signal: request.signal,
        })

        if (!upstream.ok) {
          const txt = await upstream.text()
          enqueue(JSON.stringify({ event: 'error', message: `Backend ${upstream.status}`, detail: txt }))
          controller.close()
          return
        }

        const reader = upstream.body?.getReader()
        if (!reader) {
          enqueue(JSON.stringify({ event: 'error', message: 'No response body from backend' }))
          controller.close()
          return
        }

        // Pass-through: backend already formats as SSE
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }

        controller.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Backend unreachable'
        enqueue(JSON.stringify({ event: 'error', message: msg }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
