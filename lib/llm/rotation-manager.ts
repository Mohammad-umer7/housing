/**
 * Centralized AI provider rotation manager — OpenRouter, multi-key, multi-model.
 *
 * • Discovers all OPENROUTER_API_KEY{n} and OPENROUTER_MODEL_{n} env vars at startup.
 * • Maintains circular round-robin rotation across keys AND models.
 * • On failure, applies a per-error-class cooldown to the offending key (and model
 *   when the model itself is degraded) then advances to the next available slot.
 * • On success, clears failure state for that slot.
 * • Structured logging — key VALUES are never logged; only masked refs (last 4 chars).
 * • Thread-safe: Next.js server routes run in a single Node.js process so module-level
 *   state is safe; JS is single-threaded so index mutations are atomic.
 */

import { ChatOpenAI } from '@langchain/openai'

// ── Provider config ───────────────────────────────────────────────────────────

const BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 20_000

/** Cooldown durations (ms) keyed by failure class. */
const COOLDOWN_MS = {
  rate_limit:   Number(process.env.LLM_RL_COOLDOWN_MS)  || 120_000,
  auth:         24 * 60 * 60 * 1000,   // 24h — treat as permanently failed in-session
  overload:     30_000,
  timeout:      15_000,
  bad_response: 20_000,
  unknown:      60_000,
} as const

const MODEL_OVERLOAD_COOLDOWN_MS = 45_000

// ── Key / model discovery ─────────────────────────────────────────────────────

function discoverKeys(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (v: string | undefined) => {
    const k = v?.trim()
    if (k && !seen.has(k)) { seen.add(k); out.push(k) }
  }
  // Numbered variants: OPENROUTER_API_KEY1 … OPENROUTER_API_KEY99
  for (let i = 1; i <= 99; i++) add(process.env[`OPENROUTER_API_KEY${i}`])
  // Plain unnumbered fallback
  add(process.env.OPENROUTER_API_KEY)
  // Comma-separated batch
  for (const k of String(process.env.OPENROUTER_API_KEYS ?? '').split(',')) add(k)
  return out
}

function discoverModels(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (v: string | undefined) => {
    const m = v?.trim()
    if (m && !seen.has(m)) { seen.add(m); out.push(m) }
  }
  // Numbered variants: OPENROUTER_MODEL_1 … OPENROUTER_MODEL_20
  for (let i = 1; i <= 20; i++) add(process.env[`OPENROUTER_MODEL_${i}`])
  // Legacy / single-model fallback
  if (out.length === 0) {
    add(process.env.LLM_MODEL)
    if (out.length === 0) add('openai/gpt-oss-20b:free')
  }
  return out
}

// ── Module-level singleton state ──────────────────────────────────────────────

interface SlotHealth {
  coolUntil: number
  failures:  number
}

const _keys   = discoverKeys()
const _models = discoverModels()
const _kh: SlotHealth[] = _keys.map(() => ({ coolUntil: 0, failures: 0 }))
const _mh: SlotHealth[] = _models.map(() => ({ coolUntil: 0, failures: 0 }))
let _ki = 0   // current key rotation cursor
let _mi = 0   // current model rotation cursor

// Log startup summary (key values never printed)
if (_keys.length > 0) {
  console.log(`[rotation] init: ${_keys.length} key(s), ${_models.length} model(s) — ${_models.join(', ')}`)
} else {
  console.warn('[rotation] WARNING: no OPENROUTER_API_KEY* vars found — AI calls will fail')
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function ts(): number { return Date.now() }

function mask(key: string): string {
  return `[***${key.slice(-4)}]`
}

function isReady(h: SlotHealth): boolean { return ts() >= h.coolUntil }

// ── Error classification ──────────────────────────────────────────────────────

export type FailureKind = keyof typeof COOLDOWN_MS

export function classifyError(err: unknown): FailureKind {
  const raw    = err as { status?: number; statusCode?: number }
  const status = raw?.status ?? raw?.statusCode
  const msg    = String(err).toLowerCase()

  if (status === 429 || msg.includes('429') || msg.includes('rate limit') || msg.includes('quota'))
    return 'rate_limit'
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('forbidden'))
    return 'auth'
  if (status === 503 || status === 502 || status === 504 || msg.includes('overload') || msg.includes('unavailable') || msg.includes('503'))
    return 'overload'
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('econnreset') || msg.includes('network'))
    return 'timeout'
  if (msg.includes('parse') || msg.includes('invalid json') || msg.includes('schema') || msg.includes('validation failed'))
    return 'bad_response'
  return 'unknown'
}

// ── Public API ────────────────────────────────────────────────────────────────

/** True when at least one API key is configured. */
export function isConfigured(): boolean { return _keys.length > 0 }

/**
 * Record a failure for a specific key+model slot.
 * Applies cooldown proportional to the error kind and advances the key cursor.
 */
export function recordFailure(keyIdx: number, modelIdx: number, err: unknown): void {
  const kind    = classifyError(err)
  const kMask   = mask(_keys[keyIdx] ?? '')
  const model   = _models[modelIdx] ?? '?'
  const keyCool = COOLDOWN_MS[kind]

  if (keyIdx < _kh.length) {
    _kh[keyIdx].failures++
    _kh[keyIdx].coolUntil = ts() + keyCool
    console.warn(
      `[rotation] FAIL key[${keyIdx}]=${kMask} model[${modelIdx}]=${model} ` +
      `kind=${kind} cool=${keyCool}ms failures=${_kh[keyIdx].failures}`
    )
  }

  // Also cool the model itself on overload / bad-response (model-level degradation)
  if ((kind === 'overload' || kind === 'bad_response') && modelIdx < _mh.length) {
    const mCool = kind === 'overload' ? MODEL_OVERLOAD_COOLDOWN_MS : COOLDOWN_MS.bad_response
    _mh[modelIdx].failures++
    _mh[modelIdx].coolUntil = ts() + mCool
    console.warn(`[rotation] DEGRADE model[${modelIdx}]=${model} kind=${kind} cool=${mCool}ms`)
  }

  // Advance key cursor so the next request starts on a different key
  _ki = (_ki + 1) % Math.max(_keys.length, 1)
}

/**
 * Record a successful response — clears failure/cooldown state for the slot.
 */
export function recordSuccess(keyIdx: number, modelIdx: number): void {
  if (keyIdx < _kh.length && _kh[keyIdx].failures > 0) {
    console.log(`[rotation] RECOVER key[${keyIdx}]=${mask(_keys[keyIdx])}`)
    _kh[keyIdx].failures  = 0
    _kh[keyIdx].coolUntil = 0
  }
  if (modelIdx < _mh.length && _mh[modelIdx].failures > 0) {
    _mh[modelIdx].failures  = 0
    _mh[modelIdx].coolUntil = 0
  }
}

/** A resolved key+model slot reference. */
export interface Slot {
  keyIdx:   number
  modelIdx: number
  key:      string
  model:    string
}

/**
 * Build the full ordered slot list for a single request.
 *
 * Starts at the current rotation cursors; available (not-cooled) slots come first.
 * Within available slots the ordering is: current model → next model → ... and
 * current key → next key → ... so requests fan out evenly.
 *
 * Side-effect: advances the key cursor by 1 (round-robin) for the next caller.
 */
export function getAllSlots(): Slot[] {
  if (_keys.length === 0 || _models.length === 0) return []

  const now  = ts()
  type ScoredSlot = Slot & { score: number }
  const combos: ScoredSlot[] = []

  for (let mi = 0; mi < _models.length; mi++) {
    const modelIdx = (_mi + mi) % _models.length
    const mCool    = Math.max(0, _mh[modelIdx].coolUntil - now)
    for (let ki = 0; ki < _keys.length; ki++) {
      const keyIdx = (_ki + ki) % _keys.length
      const kCool  = Math.max(0, _kh[keyIdx].coolUntil - now)
      // score=0 → fully available; higher → cooled; tie-break by rotation distance
      combos.push({
        keyIdx, modelIdx,
        key:   _keys[keyIdx],
        model: _models[modelIdx],
        score: mCool + kCool + mi * _keys.length + ki,
      })
    }
  }

  // Advance key cursor for round-robin across healthy keys
  _ki = (_ki + 1) % _keys.length

  combos.sort((a, b) => a.score - b.score)
  return combos.map(({ keyIdx, modelIdx, key, model }) => ({ keyIdx, modelIdx, key, model }))
}

/**
 * Instantiate a ChatOpenAI client pointed at OpenRouter for the given slot.
 * maxRetries is 0 — the rotation manager handles retries across the failover chain.
 */
export function buildClient(
  key:   string,
  model: string,
  opts:  { temperature?: number; maxTokens?: number } = {},
): ChatOpenAI {
  return new ChatOpenAI({
    apiKey:      key,
    model,
    temperature: opts.temperature ?? 0.1,
    maxTokens:   opts.maxTokens ?? 800,
    timeout:     DEFAULT_TIMEOUT_MS,
    maxRetries:  0,
    configuration: {
      baseURL: BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://saddad.moei.gov.ae',
        'X-Title':      'SADDAD Housing Arrears',
      },
    },
  })
}

// ── Health reporting ──────────────────────────────────────────────────────────

export interface HealthReport {
  configured:  boolean
  keys:        { total: number; available: number; rotation: number }
  models:      { total: number; available: number; rotation: number }
  keySlots:    { index: number; masked: string; available: boolean; failures: number; coolsInMs: number }[]
  modelSlots:  { model: string; available: boolean; failures: number; coolsInMs: number }[]
}

export function healthReport(): HealthReport {
  const now = ts()
  const avail = (h: SlotHealth[]) => h.filter(isReady).length
  return {
    configured: _keys.length > 0,
    keys:   { total: _keys.length,   available: avail(_kh), rotation: _ki },
    models: { total: _models.length, available: avail(_mh), rotation: _mi },
    keySlots: _keys.map((k, i) => ({
      index:     i,
      masked:    mask(k),
      available: isReady(_kh[i]),
      failures:  _kh[i].failures,
      coolsInMs: Math.max(0, _kh[i].coolUntil - now),
    })),
    modelSlots: _models.map((m, i) => ({
      model:     m,
      available: isReady(_mh[i]),
      failures:  _mh[i].failures,
      coolsInMs: Math.max(0, _mh[i].coolUntil - now),
    })),
  }
}
