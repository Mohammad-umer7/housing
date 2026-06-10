// SADDAD read-only MCP server (built on FastMCP).
//
// Exposes the housing-arrears system's *state* to an MCP client (Claude Desktop)
// as a set of READ-ONLY tools. A housing officer chats with Claude — "how backed
// up is the queue?", "why was case MSZHP_100075 escalated?" — and Claude calls
// these tools to answer. There are NO write tools: every handler issues SELECTs
// only, and each tool is tagged `readOnlyHint: true` so the contract is advertised
// at the protocol level too.
//
// Uses FastMCP (https://github.com/punkpeye/fastmcp) — a thin framework over the
// official MCP SDK that trims boilerplate (tool defs, error handling via UserError,
// stdio/httpStream transports, a `fastmcp dev` inspector). It is intentionally
// self-contained (no Next.js / data-layer import graph), the same pattern as the
// scripts in tools/*.mjs: it parses .env.local and creates its own service-role
// Supabase client. Run with:  node mcp/saddad-server.mjs  (or: npm run mcp)
//
// IMPORTANT: stdout is reserved for the MCP JSON-RPC stream. NEVER console.log here —
// diagnostics go to stderr only, or they corrupt the protocol.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { FastMCP, UserError } from 'fastmcp'

// ── Config / Supabase (read-only) ─────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve creds from the real environment first (Claude Desktop can inject them via
// the config's `env` block), then fall back to the project's .env.local — located
// relative to THIS file, so it works no matter what cwd Claude launches us in.
function loadEnvFromFile() {
  const out = {}
  try {
    const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
  } catch {
    // No .env.local next to the project — rely entirely on process.env.
  }
  return out
}

const fileEnv = loadEnvFromFile()
const getEnv = (k) => process.env[k] ?? fileEnv[k] ?? ''

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
// Service-role key reads everything past RLS; we only ever SELECT with it.
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[saddad-mcp] FATAL: missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'SUPABASE_SERVICE_ROLE_KEY in .env.local (next to package.json) or in the Claude Desktop env block.'
  )
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Strip the "-rN" re-submission suffix to resolve the base Application ID (matches
// lib/integrations/source-systems.ts → baseApplicationId).
const baseApplicationId = (cn) => String(cn ?? '').replace(/-r\d+$/i, '')

// ── Helpers ───────────────────────────────────────────────────────────────────

// FastMCP wraps a returned string as text content automatically.
const j = (data) => JSON.stringify(data, null, 2)

// A Supabase error means the query genuinely failed (vs. an empty result) — surface
// it to the officer rather than pretending the system is empty.
const orThrow = ({ data, error }, what) => {
  if (error) throw new UserError(`Failed to read ${what}: ${error.message}`)
  return data
}

const RO = { readOnlyHint: true, openWorldHint: false } // advertised on every tool

// Trim a case row down to the fields an officer actually asks about, so the model
// isn't handed a wall of internal columns. Unknown/missing fields are simply absent.
function summariseCase(c) {
  if (!c) return null
  return {
    case_number: c.case_number,
    full_name: c.full_name,
    emirates_id: c.emirates_id,
    status: c.status,
    recommendation: c.case_study?.recommendation,
    arrears_amount: c.arrears_amount,
    monthly_salary: c.monthly_salary,
    debt_to_income_ratio: c.debt_to_income_ratio,
    risk_level: c.risk_level,
    monthly_payment: c.monthly_payment,
    duration_months: c.duration_months,
    decision_reason: c.decision_reason,
    is_priority: c.is_priority,
    social_status: c.social_status,
    processed_at: c.processed_at,
    created_at: c.created_at,
  }
}

// ── Server + tools ────────────────────────────────────────────────────────────

const server = new FastMCP({ name: 'saddad-housing-arrears', version: '1.0.0' })

// 1) System-wide snapshot — the "how is the system doing right now" question.
server.addTool({
  name: 'get_system_overview',
  description:
    'High-level health snapshot of the SADDAD housing-arrears agent: total cases and their ' +
    'breakdown by decision (approved / rejected / escalated / pending), how many jobs are ' +
    'queued or processing right now, and the citizen-feedback average. Start here for ' +
    '"what is the state of the system" questions.',
  annotations: RO,
  execute: async () => {
    const [caseRows, queuedRes, processingRes, fbRes] = await Promise.all([
      db.from('cases').select('status'),
      db.from('job_queue').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      db.from('job_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      db.from('feedback').select('rating'),
    ])
    const rows = orThrow(caseRows, 'cases') ?? []
    const by = (s) => rows.filter((c) => c.status === s).length
    const ratings = (fbRes.data ?? []).map((r) => Number(r.rating)).filter(Number.isFinite)
    const avg = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
      : 0
    return j({
      cases: {
        total: rows.length,
        approved: by('approved'),
        rejected: by('rejected'),
        escalated: by('escalated'),
        pending: by('pending'),
      },
      queue: { queued: queuedRes.count ?? 0, processing: processingRes.count ?? 0 },
      feedback: { count: ratings.length, average_rating: avg },
      generated_at: new Date().toISOString(),
    })
  },
})

// 2) Queue depth + in-flight cases — "is anything backed up / stuck?"
server.addTool({
  name: 'get_queue_status',
  description:
    'State of the background processing queue: counts of queued vs processing jobs, average ' +
    'processing time, longest wait, and the case numbers currently in flight. Use for ' +
    '"is the queue backed up", "what is being processed", or "is anything stuck".',
  annotations: RO,
  execute: async () => {
    const jobs =
      orThrow(
        await db
          .from('job_queue')
          .select('case_number, status, queued_at, started_at, completed_at')
          .order('queued_at', { ascending: false })
          .limit(200),
        'job_queue'
      ) ?? []
    const done = jobs.filter((q) => q.status === 'completed' && q.started_at && q.completed_at)
    const avgMs = done.length
      ? Math.round(
          done.reduce(
            (s, q) => s + (new Date(q.completed_at).getTime() - new Date(q.started_at).getTime()),
            0
          ) / done.length
        )
      : 0
    const longestWaitMs = jobs.reduce((max, q) => {
      if (!q.started_at || !q.queued_at) return max
      return Math.max(max, new Date(q.started_at).getTime() - new Date(q.queued_at).getTime())
    }, 0)
    const inFlight = jobs
      .filter((q) => q.status === 'queued' || q.status === 'processing')
      .map((q) => ({ case_number: q.case_number, status: q.status, queued_at: q.queued_at }))
    return j({
      queued: jobs.filter((q) => q.status === 'queued').length,
      processing: jobs.filter((q) => q.status === 'processing').length,
      avg_processing_ms: avgMs,
      longest_wait_ms: longestWaitMs,
      in_flight: inFlight,
    })
  },
})

// 3) Recent decisions.
server.addTool({
  name: 'list_recent_cases',
  description:
    'The most recently processed cases (newest first), summarised. Optionally filter by ' +
    'status. Use for "show me the last N decisions" or "which cases were escalated".',
  parameters: z.object({
    limit: z.number().int().min(1).max(100).optional().describe('How many cases (default 20).'),
    status: z
      .enum(['approved', 'rejected', 'escalated', 'pending'])
      .optional()
      .describe('Only return cases with this decision status.'),
  }),
  annotations: RO,
  execute: async ({ limit = 20, status }) => {
    let q = db.from('cases').select('*').order('processed_at', { ascending: false }).limit(limit)
    if (status) q = q.eq('status', status)
    const data = orThrow(await q, 'cases') ?? []
    return j(data.map(summariseCase))
  },
})

// 4) Full detail of one case: decision + agent pipeline + audit trail in one shot.
server.addTool({
  name: 'get_case',
  description:
    'Everything about a single case by its case number (Application ID, e.g. "MSZHP_100075" ' +
    'or a re-submission like "MSZHP_100075-r2"): the decision record, the agent pipeline run ' +
    '(which of the 10 agents ran and how long each took), and the full audit trail.',
  parameters: z.object({
    caseNumber: z.string().min(1).describe('The case number / Application ID.'),
  }),
  annotations: RO,
  execute: async ({ caseNumber }) => {
    const [caseRes, stepsRes, auditRes] = await Promise.all([
      db.from('cases').select('*').eq('case_number', caseNumber).maybeSingle(),
      db
        .from('agent_steps')
        .select('agent_name, status, duration_ms, ran_in_parallel, result_summary, started_at, completed_at')
        .eq('case_number', caseNumber)
        .order('started_at', { ascending: true, nullsFirst: true }),
      db
        .from('audit_logs')
        .select('action, decision, rule_triggered, rationale, processed_by, agent_model, timestamp')
        .eq('case_number', caseNumber)
        .order('timestamp', { ascending: false }),
    ])
    const caseRow = orThrow(caseRes, 'case')
    if (!caseRow) throw new UserError(`No case found for case_number "${caseNumber}".`)
    return j({ case: caseRow, pipeline: stepsRes.data ?? [], audit_trail: auditRes.data ?? [] })
  },
})

// 5) Agent pipeline only (lighter than get_case).
server.addTool({
  name: 'get_case_pipeline',
  description:
    'The agent-by-agent execution trace for one case: each of the pipeline agents ' +
    '(planner, risk_forecaster, document, db_fetch, financial, rules, fairness, critic, ' +
    'communication, escalation), its status, duration, whether it ran in parallel, and a ' +
    'one-line result summary. Use for "which agents ran" / "where did processing spend time".',
  parameters: z.object({
    caseNumber: z.string().min(1).describe('The case number / Application ID.'),
  }),
  annotations: RO,
  execute: async ({ caseNumber }) => {
    const data = orThrow(
      await db
        .from('agent_steps')
        .select('agent_name, status, duration_ms, ran_in_parallel, result_summary, started_at, completed_at')
        .eq('case_number', caseNumber)
        .order('started_at', { ascending: true, nullsFirst: true }),
      'agent_steps'
    )
    if (!data || data.length === 0) throw new UserError(`No pipeline steps found for "${caseNumber}".`)
    return j(data)
  },
})

// 6) Audit trail only — the compliance question, "why this decision".
server.addTool({
  name: 'get_case_audit_trail',
  description:
    'The immutable audit log for one case: actions taken, the decision, which governance rule ' +
    'was triggered, the rationale, and who/what processed it. Use for "why was this escalated/' +
    'rejected" or compliance questions.',
  parameters: z.object({
    caseNumber: z.string().min(1).describe('The case number / Application ID.'),
  }),
  annotations: RO,
  execute: async ({ caseNumber }) => {
    const data = orThrow(
      await db.from('audit_logs').select('*').eq('case_number', caseNumber).order('timestamp', { ascending: false }),
      'audit_logs'
    )
    if (!data || data.length === 0) throw new UserError(`No audit logs found for "${caseNumber}".`)
    return j(data)
  },
})

// 7) Applicant / programme record lookup (the source-system data the agent consumes).
server.addTool({
  name: 'lookup_applicant',
  description:
    'The beneficiary / programme record for an Application ID (identity, on-record salary, ' +
    'arrears, installment, loan balance, family + social status, payment history). This is the ' +
    'source data the agent evaluates — distinct from the SADDAD decision (use get_case for that).',
  parameters: z.object({
    applicationId: z
      .string()
      .min(1)
      .describe('The Application ID (the "-rN" re-submission suffix is stripped automatically).'),
  }),
  annotations: RO,
  execute: async ({ applicationId }) => {
    const base = baseApplicationId(applicationId)
    let data = orThrow(
      await db.from('applicants').select('*').eq('case_number', applicationId).maybeSingle(),
      'applicants'
    )
    if (!data && base !== applicationId) {
      data = orThrow(
        await db.from('applicants').select('*').eq('case_number', base).maybeSingle(),
        'applicants'
      )
    }
    if (!data) throw new UserError(`No applicant record for "${applicationId}".`)
    return j(data)
  },
})

// 8) All cases for one beneficiary (Emirates ID), across re-submissions.
server.addTool({
  name: 'get_beneficiary_cases',
  description:
    'Every case for one beneficiary, identified by Emirates ID (a person may re-submit, each ' +
    'attempt being its own case). Newest first. Use for "show this person\'s history".',
  parameters: z.object({
    emiratesId: z.string().min(1).describe('The 15-digit Emirates ID.'),
  }),
  annotations: RO,
  execute: async ({ emiratesId }) => {
    const rows = (orThrow(await db.from('cases').select('*').eq('emirates_id', emiratesId), 'cases') ?? []).sort(
      (a, b) =>
        new Date(b.created_at ?? b.processed_at ?? 0).getTime() -
        new Date(a.created_at ?? a.processed_at ?? 0).getTime()
    )
    if (rows.length === 0) throw new UserError(`No cases found for Emirates ID "${emiratesId}".`)
    return j(rows.map(summariseCase))
  },
})

// 9) Current governance thresholds (admin-configurable overrides).
server.addTool({
  name: 'get_governance_rules',
  description:
    'The currently active, admin-configurable governance thresholds (deduction caps, hardship ' +
    'parameters, DBR caps, certificate freshness, salary-discrepancy tolerance). Returns only ' +
    'keys that have been overridden in system_settings; anything absent is using the code default.',
  annotations: RO,
  execute: async () => {
    const keys = [
      'maxDeductionPercent',
      'hardshipDeductionPercent',
      'hardshipPerMemberIncome',
      'certFreshnessDays',
      'dbrCapSalaried',
      'dbrCapRetiree',
      'salaryDiscrepancyThresholdPct',
    ]
    const data =
      orThrow(
        await db.from('system_settings').select('key, value').in('key', keys.map((k) => `rule_${k}`)),
        'system_settings'
      ) ?? []
    const overrides = {}
    for (const row of data) {
      const k = String(row.key).replace(/^rule_/, '')
      const n = Number(row.value)
      if (Number.isFinite(n)) overrides[k] = n
    }
    return j({ overrides, note: 'Keys not listed are using the hardcoded default in governance/.' })
  },
})

// 10) Recent citizen feedback + rolling stats.
server.addTool({
  name: 'get_recent_feedback',
  description:
    'The latest citizen feedback (1–5 star rating + optional comment) plus the overall average ' +
    'and count. Use for "what are citizens saying" or service-quality questions.',
  parameters: z.object({
    limit: z.number().int().min(1).max(100).optional().describe('How many entries (default 20).'),
  }),
  annotations: RO,
  execute: async ({ limit = 20 }) => {
    const [recentRes, allRes] = await Promise.all([
      db
        .from('feedback')
        .select('case_number, name, rating, comment, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      db.from('feedback').select('rating'),
    ])
    const ratings = (orThrow(allRes, 'feedback') ?? []).map((r) => Number(r.rating)).filter(Number.isFinite)
    const average = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
      : 0
    return j({ stats: { count: ratings.length, average }, recent: recentRes.data ?? [] })
  },
})

// 11) Fairness precedent — historical approved decisions near a given DBR.
server.addTool({
  name: 'find_similar_precedent',
  description:
    'Historical approved decisions whose debt-to-income ratio is close to the value given — the ' +
    'same precedent corpus (historical_cases) the fairness + critic agents compare against. Use ' +
    'to sanity-check "is this decision consistent with past ones".',
  parameters: z.object({
    debtToIncomeRatio: z
      .number()
      .min(0)
      .max(5)
      .describe('The DBR to find neighbours for, e.g. 0.15. Returns cases within ±0.10.'),
    limit: z.number().int().min(1).max(50).optional().describe('Max precedents (default 10).'),
  }),
  annotations: RO,
  execute: async ({ debtToIncomeRatio, limit = 10 }) => {
    const data = orThrow(
      await db
        .from('historical_cases')
        .select('case_number, status, debt_to_income_ratio, arrears_amount')
        .gte('debt_to_income_ratio', debtToIncomeRatio - 0.1)
        .lte('debt_to_income_ratio', debtToIncomeRatio + 0.1)
        .limit(limit),
      'historical_cases'
    )
    return j({ query_dbr: debtToIncomeRatio, matches: data ?? [] })
  },
})

// ── Analytics helpers ─────────────────────────────────────────────────────────

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const median = (a) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const pct = (part, whole) => (whole ? round((part / whole) * 100, 1) : 0)

// A beneficiary is on the G-06 priority / hardship lane if explicitly flagged, or the
// social status is anything other than "regular" (none / مستفيد عادي).
const isPriority = (c) =>
  Boolean(
    c.is_priority ||
      c.priority_escalation ||
      (c.social_status && !['none', 'regular', 'مستفيد عادي', ''].includes(String(c.social_status)))
  )

// ── Analytics / fairness / explainability tools ───────────────────────────────

// 12) Flexible search across decided cases.
server.addTool({
  name: 'search_cases',
  description:
    'Flexible read-only search over decided cases with any combination of filters: status, ' +
    'social_status, priority lane, arrears range, debt-to-income range, and a "since" date. Newest ' +
    'first. Use for "show high-arrears escalated cases" or "approved widows with DBR under 0.2".',
  parameters: z.object({
    status: z.enum(['approved', 'rejected', 'escalated', 'pending']).optional(),
    social_status: z.string().optional().describe('e.g. widow, orphan, senior, determination.'),
    priority_only: z.boolean().optional().describe('Only G-06 priority / hardship-lane cases.'),
    min_arrears: z.number().optional(),
    max_arrears: z.number().optional(),
    min_dbr: z.number().optional().describe('Minimum debt-to-income ratio.'),
    max_dbr: z.number().optional().describe('Maximum debt-to-income ratio.'),
    since: z.string().optional().describe('ISO date; only cases processed on/after this.'),
    limit: z.number().int().min(1).max(100).optional().describe('Max results (default 25).'),
  }),
  annotations: RO,
  execute: async (f) => {
    const all = orThrow(await db.from('cases').select('*'), 'cases') ?? []
    const sinceTs = f.since ? new Date(f.since).getTime() : null
    const out = all
      .filter((c) => {
        if (f.status && c.status !== f.status) return false
        if (f.social_status && String(c.social_status ?? '').toLowerCase() !== f.social_status.toLowerCase())
          return false
        if (f.priority_only && !isPriority(c)) return false
        const arr = toNum(c.arrears_amount)
        if (f.min_arrears != null && (arr == null || arr < f.min_arrears)) return false
        if (f.max_arrears != null && (arr == null || arr > f.max_arrears)) return false
        const dbr = toNum(c.debt_to_income_ratio)
        if (f.min_dbr != null && (dbr == null || dbr < f.min_dbr)) return false
        if (f.max_dbr != null && (dbr == null || dbr > f.max_dbr)) return false
        if (sinceTs != null) {
          const t = new Date(c.processed_at ?? c.created_at ?? 0).getTime()
          if (!(t >= sinceTs)) return false
        }
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.processed_at ?? b.created_at ?? 0).getTime() -
          new Date(a.processed_at ?? a.created_at ?? 0).getTime()
      )
    return j({ count: out.length, results: out.slice(0, f.limit ?? 25).map(summariseCase) })
  },
})

// 13) Programme-wide KPIs.
server.addTool({
  name: 'get_decision_analytics',
  description:
    'Portfolio-level analytics across all decided cases: decision mix + approval rate, arrears under ' +
    'management (total / average / median), average debt-to-income ratio, the average approved ' +
    'rescheduling (monthly payment + duration), and the share on the priority lane. Use for ' +
    '"give me the KPIs for the whole programme".',
  annotations: RO,
  execute: async () => {
    const rows = orThrow(await db.from('cases').select('*'), 'cases') ?? []
    const by = (s) => rows.filter((c) => c.status === s)
    const approved = by('approved')
    const arrears = rows.map((c) => toNum(c.arrears_amount)).filter((n) => n != null)
    const dbrs = rows.map((c) => toNum(c.debt_to_income_ratio)).filter((n) => n != null)
    const payments = approved.map((c) => toNum(c.monthly_payment)).filter((n) => n != null)
    const durations = approved.map((c) => toNum(c.duration_months)).filter((n) => n != null)
    const prio = rows.filter(isPriority)
    return j({
      total_cases: rows.length,
      decisions: {
        approved: approved.length,
        rejected: by('rejected').length,
        escalated: by('escalated').length,
        pending: by('pending').length,
      },
      approval_rate_pct: pct(approved.length, rows.length),
      arrears_under_management: {
        total: round(arrears.reduce((a, b) => a + b, 0), 2),
        average: round(mean(arrears), 2),
        median: round(median(arrears), 2),
      },
      avg_debt_to_income_ratio: round(mean(dbrs), 3),
      approved_plan: {
        avg_monthly_payment: round(mean(payments), 2),
        avg_duration_months: round(mean(durations), 1),
      },
      priority_lane: { count: prio.length, share_pct: pct(prio.length, rows.length) },
    })
  },
})

// 14) Equity / consistency view.
server.addTool({
  name: 'get_fairness_report',
  description:
    'Equity view of decisions: approval rate broken down by social-status category, by priority vs ' +
    'standard lane, and by debt-to-income band — so an auditor can see whether like cases are treated ' +
    'alike and that affordability (not category) drives outcomes. Read-only aggregate of live decisions.',
  annotations: RO,
  execute: async () => {
    const rows = orThrow(await db.from('cases').select('*'), 'cases') ?? []
    const rate = (subset) => ({
      count: subset.length,
      approved: subset.filter((c) => c.status === 'approved').length,
      approval_rate_pct: pct(subset.filter((c) => c.status === 'approved').length, subset.length),
      avg_dbr: round(mean(subset.map((c) => toNum(c.debt_to_income_ratio)).filter((n) => n != null)), 3),
    })
    const bySocial = {}
    for (const c of rows) {
      const k = String(c.social_status ?? 'unknown') || 'unknown'
      ;(bySocial[k] ??= []).push(c)
    }
    const bands = { '0.0-0.2': [], '0.2-0.4': [], '0.4-0.6': [], '0.6+': [] }
    for (const c of rows) {
      const d = toNum(c.debt_to_income_ratio)
      if (d == null) continue
      if (d < 0.2) bands['0.0-0.2'].push(c)
      else if (d < 0.4) bands['0.2-0.4'].push(c)
      else if (d < 0.6) bands['0.4-0.6'].push(c)
      else bands['0.6+'].push(c)
    }
    return j({
      by_social_status: Object.fromEntries(Object.entries(bySocial).map(([k, v]) => [k, rate(v)])),
      by_lane: { priority: rate(rows.filter(isPriority)), standard: rate(rows.filter((c) => !isPriority(c))) },
      by_dbr_band: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, rate(v)])),
      note: 'Approval rates falling as the DBR band rises indicates affordability — not category — is driving decisions.',
    })
  },
})

// 15) Priority / hardship lane.
server.addTool({
  name: 'get_priority_cases',
  description:
    'Cases on the G-06 priority / hardship lane — widows, orphans, seniors and People of Determination, ' +
    'plus anything flagged for priority escalation — with their decision breakdown. Use for "show ' +
    'vulnerable / fast-tracked beneficiaries".',
  parameters: z.object({ limit: z.number().int().min(1).max(100).optional().describe('Max cases (default 50).') }),
  annotations: RO,
  execute: async ({ limit = 50 }) => {
    const rows = (orThrow(await db.from('cases').select('*'), 'cases') ?? [])
      .filter(isPriority)
      .sort(
        (a, b) =>
          new Date(b.processed_at ?? b.created_at ?? 0).getTime() -
          new Date(a.processed_at ?? a.created_at ?? 0).getTime()
      )
    return j({
      count: rows.length,
      by_status: {
        approved: rows.filter((c) => c.status === 'approved').length,
        rejected: rows.filter((c) => c.status === 'rejected').length,
        escalated: rows.filter((c) => c.status === 'escalated').length,
      },
      cases: rows.slice(0, limit).map(summariseCase),
    })
  },
})

// 16) Multi-agent pipeline performance.
server.addTool({
  name: 'get_agent_performance',
  description:
    'Performance of the multi-agent pipeline aggregated across every case: for each agent (planner, ' +
    'risk_forecaster, document, db_fetch, financial, rules, fairness, critic, communication, escalation) ' +
    'the run count, completed/failed counts, average duration, and how often it ran in parallel. Use for ' +
    '"how is the agent pipeline performing" or "which agent is the bottleneck".',
  annotations: RO,
  execute: async () => {
    const steps = orThrow(await db.from('agent_steps').select('agent_name, status, duration_ms, ran_in_parallel'), 'agent_steps') ?? []
    const agg = {}
    for (const s of steps) {
      const a = (agg[s.agent_name] ??= { runs: 0, completed: 0, failed: 0, parallel: 0, _durs: [] })
      a.runs++
      if (s.status === 'completed') a.completed++
      else if (s.status === 'failed' || s.status === 'error') a.failed++
      if (s.ran_in_parallel) a.parallel++
      const d = toNum(s.duration_ms)
      if (d != null) a._durs.push(d)
    }
    const perAgent = Object.fromEntries(
      Object.entries(agg).map(([k, v]) => [
        k,
        { runs: v.runs, completed: v.completed, failed: v.failed, parallel_runs: v.parallel, avg_duration_ms: round(mean(v._durs), 0) },
      ])
    )
    const slowest = Object.entries(perAgent).sort((a, b) => b[1].avg_duration_ms - a[1].avg_duration_ms)[0]?.[0] ?? null
    return j({ total_steps: steps.length, slowest_agent: slowest, per_agent: perAgent })
  },
})

// 17) Which governance rules fire most.
server.addTool({
  name: 'get_rule_trigger_stats',
  description:
    'Which governance rules fire most often, from the audit log: a ranked tally of triggered rules and ' +
    'the decisions they led to. Use for "which rules drive escalations / rejections" or "what is our ' +
    'most-triggered governance rule".',
  annotations: RO,
  execute: async () => {
    const logs = orThrow(await db.from('audit_logs').select('rule_triggered, decision'), 'audit_logs') ?? []
    const tally = {}
    for (const l of logs) {
      const r = l.rule_triggered
      if (!r) continue
      const t = (tally[r] ??= { count: 0, decisions: {} })
      t.count++
      const d = l.decision ?? 'unknown'
      t.decisions[d] = (t.decisions[d] ?? 0) + 1
    }
    const ranked = Object.entries(tally)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([rule, v]) => ({ rule, ...v }))
    return j({ rules_triggered: ranked.length, ranked })
  },
})

// 18) Fairness check for a single decision vs. precedent.
server.addTool({
  name: 'check_decision_consistency',
  description:
    "Fairness check for one case: compares its decision against SADDAD's own previously decided cases " +
    'with a similar debt-to-income ratio (both approvals and rejections), and reports whether the ' +
    'outcome aligns with how those comparable cases were decided. Also surfaces the agent-computed ' +
    'consistency score. Use for "is this decision consistent / defensible".',
  parameters: z.object({
    caseNumber: z.string().min(1).describe('The case number / Application ID.'),
    band: z.number().min(0.01).max(1).optional().describe('DBR neighbourhood half-width (default 0.10).'),
  }),
  annotations: RO,
  execute: async ({ caseNumber, band = 0.1 }) => {
    const c = orThrow(await db.from('cases').select('*').eq('case_number', caseNumber).maybeSingle(), 'case')
    if (!c) throw new UserError(`No case found for case_number "${caseNumber}".`)
    const dbr = toNum(c.debt_to_income_ratio)
    if (dbr == null) throw new UserError(`Case "${caseNumber}" has no debt_to_income_ratio to compare.`)
    // Compare against SADDAD's OWN decided cases (approved + rejected) with a similar DBR —
    // excluding this case — so the consistency verdict is meaningful, not a corpus of approvals.
    const neighbours =
      orThrow(
        await db
          .from('cases')
          .select('case_number, status, debt_to_income_ratio')
          .gte('debt_to_income_ratio', dbr - band)
          .lte('debt_to_income_ratio', dbr + band)
          .in('status', ['approved', 'rejected'])
          .neq('case_number', caseNumber),
        'cases'
      ) ?? []
    const approvedN = neighbours.filter((n) => n.status === 'approved').length
    const peerApprovalRate = pct(approvedN, neighbours.length)
    const caseApproved = c.status === 'approved'
    // Only call it consistent/divergent when precedent is CLEAR (≥60% one way). A roughly
    // even split means DBR alone doesn't decide it — the outcome turns on case-specific
    // factors (documents, rules, hardship), so we flag it borderline rather than guess.
    let assessment
    if (neighbours.length === 0) {
      assessment = 'No comparable decided cases yet — cannot assess.'
    } else if (peerApprovalRate > 40 && peerApprovalRate < 60) {
      assessment =
        'BORDERLINE — similar-DBR cases split ~50/50, so the outcome turns on case-specific factors ' +
        '(documents, rules, hardship), not DBR alone.'
    } else if (caseApproved === (peerApprovalRate >= 60)) {
      assessment = 'CONSISTENT — outcome matches how clearly-similar cases were decided.'
    } else {
      assessment = 'REVIEW — outcome diverges from how clearly-similar cases were decided.'
    }
    return j({
      case_number: caseNumber,
      case_status: c.status,
      case_dbr: round(dbr, 3),
      comparable_decisions: {
        neighbourhood: `DBR ±${band}`,
        similar_cases: neighbours.length,
        approved: approvedN,
        rejected: neighbours.length - approvedN,
        approval_rate_pct: peerApprovalRate,
      },
      assessment,
      agent_consistency_score: c.consistency_score ?? null,
      agent_fairness_note: c.fairness_note ?? null,
    })
  },
})

// ── Boot ──────────────────────────────────────────────────────────────────────

server
  .start({ transportType: 'stdio' })
  .then(() => console.error('[saddad-mcp] ready — 18 read-only tools (FastMCP), stdio transport'))
  .catch((err) => {
    console.error('[saddad-mcp] fatal:', err)
    process.exit(1)
  })
