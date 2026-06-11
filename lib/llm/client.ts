/**
 * Single LLM access point for the entire pipeline.
 *
 * Provider order (text): GROQ first, then OpenRouter as automatic failover.
 *   • Primary  — Groq (all GROQ_API_KEY* keys), model GROQ_MODEL.
 *   • Fallback — OpenRouter circular multi-key / multi-model rotation (rotation-manager).
 * Every agent builds its model via getStructuredModel / getToolCallingModel /
 * getFailoverChatModel, so a Groq outage (rate-limit / 5xx / network / schema error)
 * transparently rolls over to OpenRouter without the caller knowing. Swapping providers,
 * keys, or model order is a change to .env.local + THIS file only.
 */

import { ChatGroq } from '@langchain/groq'
import { ChatOpenAI } from '@langchain/openai'
import type { z } from 'zod'
import { RunnableLambda, type Runnable } from '@langchain/core/runnables'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import type { AIMessageChunk } from '@langchain/core/messages'
import { getAllSlots, buildClient, isConfigured, recordFailure, recordSuccess, type Slot } from './rotation-manager'

// ── Provider config ───────────────────────────────────────────────────────────

const GROQ_MODEL       = process.env.GROQ_MODEL ?? process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile'
const GROQ_TIMEOUT_MS  = Number(process.env.LLM_TIMEOUT_MS) || 15_000
const GROQ_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES) || 1

// All configured Groq keys, primary first: GROQ_API_KEY → _2 → _3 (+ comma-separated
// GROQ_API_KEYS). Deduplicated, blanks dropped.
function groqApiKeys(): string[] {
  const raw = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    ...String(process.env.GROQ_API_KEYS ?? '').split(','),
  ]
  return Array.from(new Set(raw.map(k => (k ?? '').trim()).filter(Boolean)))
}

/** Active PRIMARY model name — used in audit-trail fields (escalation-agent, etc.). */
export const LLM_MODEL = groqApiKeys().length > 0
  ? GROQ_MODEL
  : (process.env.OPENROUTER_MODEL_1 ?? process.env.LLM_MODEL ?? 'openai/gpt-oss-20b:free')

// Cap the OpenRouter failover tail: with N keys × M models the slot list can be 150+
// entries; a degraded provider would otherwise grind through ALL of them sequentially
// (~20s timeout each). The first few healthy slots are enough — cooldowns rotate dead
// slots out between calls.
const MAX_FAILOVER_SLOTS = Number(process.env.LLM_MAX_FAILOVER_SLOTS) || 6

// Hard overall deadline per agent LLM call (across the whole Groq→OpenRouter chain). When
// it fires, the agent's own catch path takes over (every agent has a deterministic
// fallback), so a slow provider can never freeze the pipeline.
const OVERALL_DEADLINE_MS = Number(process.env.LLM_OVERALL_DEADLINE_MS) || 60_000

export type ModelOptions = {
  temperature?: number
  maxTokens?:   number
}

/** True when at least one provider is configured (Groq OR OpenRouter). */
export function isLLMConfigured(): boolean {
  return groqApiKeys().length > 0 || isConfigured()
}

// ── Failover plumbing ──────────────────────────────────────────────────────────

// Chain runnables so a failure on the current one automatically falls through to the
// next (rate-limit / 5xx / network / schema validation error). Groq runnables come
// first, OpenRouter slots after — so OpenRouter is only ever hit once Groq is exhausted.
function withFailover<I, O>(runnables: Runnable<I, O>[]): Runnable<I, O> {
  const [primary, ...rest] = runnables
  return rest.length ? primary.withFallbacks(rest) : primary
}

// Wrap one OpenRouter slot's invocation with rotation telemetry: success clears its
// failure state, failure applies the per-error-class cooldown (and logs a masked
// [rotation] FAIL line) so dead slots rotate out of subsequent calls. (Groq instances
// rely on their own maxRetries and don't participate in the rotation health map.)
function withTelemetry<O>(slot: Slot, run: (input: BaseLanguageModelInput) => Promise<O>): Runnable<BaseLanguageModelInput, O> {
  return RunnableLambda.from(async (input: BaseLanguageModelInput) => {
    try {
      const out = await run(input)
      recordSuccess(slot.keyIdx, slot.modelIdx)
      return out
    } catch (err) {
      recordFailure(slot.keyIdx, slot.modelIdx, err)
      throw err
    }
  })
}

// Race the failover chain against the overall deadline. The losing promise is abandoned
// (its per-request timeouts still clean it up server-side).
function withDeadline<O>(chain: Runnable<BaseLanguageModelInput, O>, label: string): Runnable<BaseLanguageModelInput, O> {
  return RunnableLambda.from((input: BaseLanguageModelInput) => {
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`[llm] ${label} exceeded ${OVERALL_DEADLINE_MS}ms overall deadline`)),
        OVERALL_DEADLINE_MS,
      )
      ;(timer as { unref?: () => void }).unref?.()
    })
    return Promise.race([chain.invoke(input).finally(() => clearTimeout(timer)), deadline])
  })
}

// One ChatGroq instance per configured key (primary provider).
function groqInstances(opts: ModelOptions): ChatGroq[] {
  return groqApiKeys().map(apiKey =>
    new ChatGroq({
      apiKey,
      model:       GROQ_MODEL,
      temperature: opts.temperature ?? 0.1,
      maxTokens:   opts.maxTokens ?? 800,
      timeout:     GROQ_TIMEOUT_MS,
      maxRetries:  GROQ_MAX_RETRIES,
    }),
  )
}

// The OpenRouter fallback slots (bounded), at the current rotation position.
function openRouterSlots(): Slot[] {
  return getAllSlots().slice(0, MAX_FAILOVER_SLOTS)
}

function noProviderError(): never {
  throw new Error('[llm] No LLM provider configured — set GROQ_API_KEY* or OPENROUTER_API_KEY*')
}

// ── Public model factories ──────────────────────────────────────────────────────

/**
 * Base chat model — Groq if configured, else an OpenRouter slot. Returns a single
 * instance (no failover wrapper) so callers can use instance methods (bindTools,
 * streaming). Prefer getFailoverChatModel for resilient single-shot replies.
 */
export function getChatModel(opts: ModelOptions = {}): ChatGroq | ChatOpenAI {
  const groq = groqInstances(opts)
  if (groq.length > 0) return groq[0]
  const slots = openRouterSlots()
  if (slots.length === 0) noProviderError()
  return buildClient(slots[0].key, slots[0].model, opts)
}

/**
 * Free-form chat model WITH full Groq→OpenRouter failover + overall deadline.
 * Used for any single-shot text reply (the SADDAD assistant).
 */
export function getFailoverChatModel(opts: ModelOptions = {}): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const runnables: Runnable<BaseLanguageModelInput, AIMessageChunk>[] = []
  for (const m of groqInstances(opts)) {
    runnables.push(m as unknown as Runnable<BaseLanguageModelInput, AIMessageChunk>)
  }
  for (const s of openRouterSlots()) {
    runnables.push(withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).invoke(input) as Promise<AIMessageChunk>,
    ))
  }
  if (runnables.length === 0) noProviderError()
  return withDeadline(withFailover(runnables), 'chat call')
}

/**
 * Structured-output model with full Groq→OpenRouter failover.
 * Parses the response into the given Zod schema — type-safe, no manual JSON.
 * Used by every single-shot JSON agent: planner, rules, communication, extraction.
 */
export function getStructuredModel<T extends z.ZodTypeAny>(
  schema: T,
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, z.infer<T>> {
  const runnables: Runnable<BaseLanguageModelInput, z.infer<T>>[] = []
  for (const m of groqInstances(opts)) {
    runnables.push(m.withStructuredOutput(schema) as unknown as Runnable<BaseLanguageModelInput, z.infer<T>>)
  }
  for (const s of openRouterSlots()) {
    runnables.push(withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).withStructuredOutput(schema).invoke(input) as Promise<z.infer<T>>,
    ))
  }
  if (runnables.length === 0) noProviderError()
  return withDeadline(withFailover(runnables), 'structured call')
}

/**
 * Tool-calling model with Groq→OpenRouter failover.
 * Used by the agentic subgraphs — Critic and Recovery — that call LangGraph tools.
 */
export function getToolCallingModel(
  tools: Parameters<ChatOpenAI['bindTools']>[0],
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const runnables: Runnable<BaseLanguageModelInput, AIMessageChunk>[] = []
  for (const m of groqInstances(opts)) {
    runnables.push(
      m.bindTools(tools as Parameters<ChatGroq['bindTools']>[0]) as unknown as Runnable<BaseLanguageModelInput, AIMessageChunk>,
    )
  }
  for (const s of openRouterSlots()) {
    runnables.push(withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).bindTools(tools).invoke(input) as Promise<AIMessageChunk>,
    ))
  }
  if (runnables.length === 0) noProviderError()
  return withDeadline(withFailover(runnables), 'tool call')
}
