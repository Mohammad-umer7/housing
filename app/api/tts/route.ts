import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const lang = searchParams.get('lang') || 'ar'

  if (!q.trim()) {
    return new Response('Missing text query parameter', { status: 400 })
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(q)}`

  try {
    const res = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) {
      return new Response(`Google TTS failed with status: ${res.status}`, { status: res.status })
    }

    const audioBuffer = await res.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    })
  } catch (error) {
    console.error('[tts proxy] error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
