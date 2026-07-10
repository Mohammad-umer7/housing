// In-memory stand-in for the Supabase client, used when NO Supabase project is
// configured (portable "demo mode"). It implements just enough of the PostgREST
// query-builder surface that lib/data-layer.ts, lib/integrations/source-systems.ts
// and the API routes use — so the ENTIRE app (11-agent pipeline, officer console,
// admin portal, citizen flow) runs end-to-end with zero external dependencies.
//
// Activation is decided in lib/supabase.ts (isDemoBackend). When real Supabase env
// vars are present the real client is used instead — this file is inert.
//
// Scope: single-process, in-memory. Data seeded from lib/demo/seed.ts; rows created
// during a session persist until the server restarts. Good enough for a demo — NOT a
// production database.

import { buildDemoSeed } from './seed'

type Row = Record<string, unknown>
type Store = Record<string, Row[]>

// One shared store per process. Stashed on globalThis so Next.js dev HMR (which
// re-evaluates modules) keeps the same seeded data instead of resetting every reload.
const GLOBAL_KEY = '__saddad_demo_store__'
function getStore(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = buildDemoSeed()
  return g[GLOBAL_KEY] as Store
}

let _idCounter = 1
function genId(): string {
  // Deterministic-enough unique id (no crypto dependency needed for a demo).
  return `demo-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`
}

// ── Filter matching (PostgREST semantics, minimal subset) ───────────────────────

type Filter =
  | { kind: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; col: string; val: unknown }
  | { kind: 'in'; col: string; vals: unknown[] }
  | { kind: 'like' | 'ilike'; col: string; pattern: string }
  | { kind: 'or'; terms: { col: string; op: string; pattern: string }[] }

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  // Escape regex metachars, then translate SQL LIKE wildcards % and _.
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$'
  return new RegExp(rx, insensitive ? 'i' : '')
}

function cmp(a: unknown, b: unknown): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return String(a ?? '').localeCompare(String(b ?? ''))
}

function matchesOne(row: Row, f: Filter): boolean {
  switch (f.kind) {
    case 'eq':  return row[f.col] === f.val || String(row[f.col] ?? '') === String(f.val ?? '')
    case 'neq': return !(row[f.col] === f.val || String(row[f.col] ?? '') === String(f.val ?? ''))
    case 'gt':  return cmp(row[f.col], f.val) > 0
    case 'gte': return cmp(row[f.col], f.val) >= 0
    case 'lt':  return cmp(row[f.col], f.val) < 0
    case 'lte': return cmp(row[f.col], f.val) <= 0
    case 'in':  return f.vals.some(v => v === row[f.col] || String(v ?? '') === String(row[f.col] ?? ''))
    case 'like':  return likeToRegex(f.pattern, false).test(String(row[f.col] ?? ''))
    case 'ilike': return likeToRegex(f.pattern, true).test(String(row[f.col] ?? ''))
    case 'or':
      return f.terms.some(t => {
        const insensitive = t.op === 'ilike'
        if (t.op === 'ilike' || t.op === 'like') return likeToRegex(t.pattern, insensitive).test(String(row[t.col] ?? ''))
        if (t.op === 'eq') return String(row[t.col] ?? '') === t.pattern
        return false
      })
  }
}

function parseOrString(expr: string): Filter {
  // "full_name.ilike.%foo%,case_number.ilike.%foo%" — split on top-level commas
  // (our usages never nest parens/and inside .or()).
  const terms = expr.split(',').map(part => {
    const first = part.indexOf('.')
    const second = part.indexOf('.', first + 1)
    const col = part.slice(0, first)
    const op = part.slice(first + 1, second)
    const pattern = part.slice(second + 1)
    return { col, op, pattern }
  })
  return { kind: 'or', terms }
}

// ── Query builder ───────────────────────────────────────────────────────────────

type WriteOp =
  | { type: 'insert'; rows: Row[] }
  | { type: 'upsert'; rows: Row[]; onConflict: string }
  | { type: 'update'; patch: Row }
  | { type: 'delete' }
  | null

class MockQuery implements PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  private filters: Filter[] = []
  private orderBy: { col: string; ascending: boolean; nullsFirst: boolean } | null = null
  private limitN: number | null = null
  private rangeFromTo: [number, number] | null = null
  private wantCount = false
  private headOnly = false
  private singleMode: 'single' | 'maybe' | null = null
  private selectAfterWrite = false
  private write: WriteOp = null

  constructor(private store: Store, private table: string) {}

  // ── filters ──
  eq(col: string, val: unknown)  { this.filters.push({ kind: 'eq', col, val });  return this }
  neq(col: string, val: unknown) { this.filters.push({ kind: 'neq', col, val }); return this }
  gt(col: string, val: unknown)  { this.filters.push({ kind: 'gt', col, val });  return this }
  gte(col: string, val: unknown) { this.filters.push({ kind: 'gte', col, val }); return this }
  lt(col: string, val: unknown)  { this.filters.push({ kind: 'lt', col, val });  return this }
  lte(col: string, val: unknown) { this.filters.push({ kind: 'lte', col, val }); return this }
  in(col: string, vals: unknown[]) { this.filters.push({ kind: 'in', col, vals }); return this }
  like(col: string, pattern: string)  { this.filters.push({ kind: 'like', col, pattern });  return this }
  ilike(col: string, pattern: string) { this.filters.push({ kind: 'ilike', col, pattern }); return this }
  or(expr: string) { this.filters.push(parseOrString(expr)); return this }

  // ── shaping ──
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst ?? false }
    return this
  }
  limit(n: number) { this.limitN = n; return this }
  range(from: number, to: number) { this.rangeFromTo = [from, to]; return this }

  // ── projection / mode ──
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.headOnly = true
    // A .select() chained AFTER a write means "return the affected rows".
    if (this.write) this.selectAfterWrite = true
    return this
  }
  single()      { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybe';  return this }
  throwOnError() { return this } // errors are already surfaced via resolved value

  // ── writes ──
  insert(rows: Row | Row[]) { this.write = { type: 'insert', rows: Array.isArray(rows) ? rows : [rows] }; return this }
  update(patch: Row)        { this.write = { type: 'update', patch }; return this }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.write = { type: 'upsert', rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict ?? 'id' }
    return this
  }
  delete() { this.write = { type: 'delete' }; return this }

  // ── execution ──
  private table_(): Row[] {
    if (!this.store[this.table]) this.store[this.table] = []
    return this.store[this.table]
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter(r => this.filters.every(f => matchesOne(r, f)))
  }

  private run(): { data: unknown; error: unknown; count: number | null } {
    const table = this.table_()
    let affected: Row[] = []

    if (this.write) {
      if (this.write.type === 'insert') {
        affected = this.write.rows.map(r => this.withDefaults(r))
        table.push(...affected)
      } else if (this.write.type === 'upsert') {
        const key = this.write.onConflict
        for (const incoming of this.write.rows) {
          const idx = table.findIndex(r => String(r[key] ?? '') === String(incoming[key] ?? ''))
          if (idx >= 0) {
            table[idx] = { ...table[idx], ...incoming }
            affected.push(table[idx])
          } else {
            const created = this.withDefaults(incoming)
            table.push(created)
            affected.push(created)
          }
        }
      } else if (this.write.type === 'update') {
        const matches = this.applyFilters(table)
        for (const r of matches) Object.assign(r, this.write.patch)
        affected = matches
      } else if (this.write.type === 'delete') {
        const matches = this.applyFilters(table)
        const keep = table.filter(r => !matches.includes(r))
        table.length = 0
        table.push(...keep)
        affected = matches
      }
      const data = this.selectAfterWrite ? affected.map(clone) : null
      return this.finalizeSingle(data, affected.length)
    }

    // Read path
    let rows = this.applyFilters(table)
    const total = rows.length
    if (this.orderBy) {
      const { col, ascending, nullsFirst } = this.orderBy
      rows = rows.slice().sort((a, b) => {
        const av = a[col], bv = b[col]
        const aNull = av === null || av === undefined
        const bNull = bv === null || bv === undefined
        if (aNull && bNull) return 0
        if (aNull) return nullsFirst ? -1 : 1
        if (bNull) return nullsFirst ? 1 : -1
        return ascending ? cmp(av, bv) : -cmp(av, bv)
      })
    }
    if (this.rangeFromTo) rows = rows.slice(this.rangeFromTo[0], this.rangeFromTo[1] + 1)
    if (this.limitN != null) rows = rows.slice(0, this.limitN)

    const count = this.wantCount ? total : null
    if (this.headOnly) return { data: [], error: null, count }
    return this.finalizeSingle(rows.map(clone), count ?? rows.length, count)
  }

  private finalizeSingle(data: unknown, rowCount: number, count: number | null = null) {
    if (this.singleMode) {
      const arr = (data as Row[]) ?? []
      if (this.singleMode === 'single') {
        if (arr.length !== 1) {
          return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count }
        }
        return { data: arr[0], error: null, count }
      }
      return { data: arr[0] ?? null, error: null, count } // maybeSingle
    }
    void rowCount
    return { data, error: null, count }
  }

  private withDefaults(r: Row): Row {
    const out = clone(r)
    if (out.id === undefined) out.id = genId()
    if (out.created_at === undefined) out.created_at = new Date().toISOString()
    return out
  }

  then<TR1 = { data: unknown; error: unknown; count: number | null }, TR2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count: number | null }) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    } catch (err) {
      return Promise.resolve({ data: null, error: { message: String(err) }, count: null }).then(onfulfilled, onrejected)
    }
  }
}

function clone<T>(v: T): T {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

// ── The mock client (shape-compatible with the bits of SupabaseClient we use) ────

export class MockSupabaseClient {
  private store: Store
  constructor(store?: Store) { this.store = store ?? getStore() }

  from(table: string) { return new MockQuery(this.store, table) }

  // Only ever hit by ensureSystemSettings — the demo seeds system_settings, so the
  // pre-check select succeeds and rpc is never reached. Stubbed for completeness.
  rpc(_fn: string, _args?: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return {
      throwOnError: () => Promise.resolve({ data: null, error: null }),
      then: (onf: (v: { data: unknown; error: unknown }) => unknown) => Promise.resolve({ data: null, error: null }).then(onf),
    }
  }
}

let _mock: MockSupabaseClient | null = null
export function getMockSupabase(): MockSupabaseClient {
  if (!_mock) _mock = new MockSupabaseClient()
  return _mock
}
