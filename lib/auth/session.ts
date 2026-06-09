// Session token signing + verification (HMAC-SHA256, stored in HTTP-only cookie).
// Uses the Web Crypto API so the same code runs in Node.js routes AND the
// Edge Runtime middleware. No external JWT library.
//
// For production: rotate SESSION_SECRET periodically, consider replacing
// with UAE PASS OIDC for federated identity (see docs/SECURITY.md).

const SECRET = process.env.SESSION_SECRET ?? ''
export const SESSION_COOKIE = 'saddad_session'
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

export type Role = 'admin' | 'officer' | 'readonly'
// `caseNumber` + `name` are set only for demo "log in as a citizen" persona
// sessions, so the submission form can auto-load that applicant's record. They
// are absent on normal officer/admin sessions.
export type Session = { role: Role; username: string; exp: number; caseNumber?: string; name?: string }

const encoder = new TextEncoder()

let cachedKey: CryptoKey | null = null
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey
  if (!SECRET) throw new Error('SESSION_SECRET environment variable is required')
  cachedKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  return cachedKey
}

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): ArrayBuffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return buf
}

export async function signSession(input: Omit<Session, 'exp'>): Promise<string> {
  if (!SECRET) throw new Error('SESSION_SECRET environment variable is required')
  const session: Session = { ...input, exp: Date.now() + SESSION_DURATION_MS }
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)))
  const key = await getKey()
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const sig = toBase64Url(sigBuf)
  return `${payload}.${sig}`
}

export async function verifySession(token: string): Promise<Session | null> {
  if (!SECRET) return null
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const key = await getKey()
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sig),
      encoder.encode(payload)
    )
    if (!ok) return null
    const json = new TextDecoder().decode(new Uint8Array(fromBase64Url(payload)))
    const session = JSON.parse(json) as Session
    if (typeof session.exp !== 'number' || session.exp < Date.now()) return null
    if (!['admin', 'officer', 'readonly'].includes(session.role)) return null
    return session
  } catch {
    return null
  }
}

export async function readSessionFromCookieHeader(cookieHeader: string | null): Promise<Session | null> {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === SESSION_COOKIE) {
      return verifySession(decodeURIComponent(trimmed.slice(eq + 1)))
    }
  }
  return null
}
