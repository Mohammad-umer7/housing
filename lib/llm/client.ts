/**
 * Single LLM access point for the entire pipeline — OpenRouter with circular
 * multi-key, multi-model rotation and automatic failover via rotation-manager.
 *
 * Swapping provider, keys, or model order is a change to .env.local ONLY.
 * Every agent builds its model via getChatModel / getStructuredModel / getToolCallingModel,
 * so all routing, failover, and observability live in rotation-manager.ts.
 */

import { ChatOpenAI } from '@langchain/openai'
import type { z } from 'zod'
import { RunnableLambda, type Runnable } from '@langchain/core/runnables'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import type { AIMessageChunk } from '@langchain/core/messages'
import { getAllSlots, buildClient, isConfigured, recordFailure, recordSuccess, type Slot } from './rotation-manager'

/** Active model name — used in audit-trail fields (escalation-agent, etc.). */
export const LLM_MODEL =
  process.env.OPENROUTER_MODEL_1 ?? process.env.LLM_MODEL ?? 'openai/gpt-oss-20b:free'

// Cap the failover chain: with N keys × M models the full slot list can be 150+
// entries; a degraded provider would make one agent call grind through ALL of
// them sequentially (~20s timeout each → an hour-long "hang"). The first few
// healthy slots are enough — cooldowns rotate dead slots out between calls.
const MAX_FAILOVER_SLOTS = Number(process.env.LLM_MAX_FAILOVER_SLOTS) || 6

// Hard overall deadline per agent LLM call. When it fires, the agent's own
// catch path takes over (every agent has a deterministic fallback), so a slow
// provider can never freeze the pipeline.
const OVERALL_DEADLINE_MS = Number(process.env.LLM_OVERALL_DEADLINE_MS) || 60_000

export type ModelOptions = {
  temperature?: number
  maxTokens?:   number
}

/** True when at least one OpenRouter API key is configured. */
export function isLLMConfigured(): boolean {
  return isConfigured()
}

// Chain runnables so a failure on the current slot automatically falls through
// to the next (rate-limit / 5xx / network / schema validation error).
function withFailover<I, O>(runnables: Runnable<I, O>[]): Runnable<I, O> {
  const [primary, ...rest] = runnables
  return rest.length ? primary.withFallbacks(rest) : primary
}

// Wrap one slot's invocation with rotation telemetry: success clears its
// failure state, failure applies the per-error-class cooldown (and logs a
// masked [rotation] FAIL line) so dead slots rotate out of subsequent calls.
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

// Race the failover chain against the overall deadline. The losing promise is
// abandoned (its per-request 20s timeouts still clean it up server-side).
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

/**
 * Base chat model for free-form generation (assistant chat, streaming).
 * Returns a single ChatOpenAI instance at the current rotation position.
 * Instance methods (bindTools, etc.) are accessible on the returned object.
 */
export function getChatModel(opts: ModelOptions = {}): ChatOpenAI {
  const slots = getAllSlots()
  if (slots.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  return buildClient(slots[0].key, slots[0].model, opts)
}

/**
 * Free-form chat model WITH full rotation failover, telemetry and the overall
 * deadline — same resilience as the structured/tool models. Use this for any
 * single-shot text reply (the SADDAD assistant); getChatModel (single slot)
 * remains for callers that need instance methods like streaming.
 */
export function getFailoverChatModel(opts: ModelOptions = {}): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const slots = getAllSlots().slice(0, MAX_FAILOVER_SLOTS)
  if (slots.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  const runnables = slots.map(s =>
    withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).invoke(input) as Promise<AIMessageChunk>,
    ),
  )
  return withDeadline(withFailover(runnables), 'chat call')
}

/**
 * Structured-output model with full rotation failover.
 * Parses the LLM response into the given Zod schema — type-safe, no manual JSON.
 * Used by every single-shot JSON agent: planner, rules, communication, extraction.
 */
export function getStructuredModel<T extends z.ZodTypeAny>(
  schema: T,
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, z.infer<T>> {
  const slots = getAllSlots().slice(0, MAX_FAILOVER_SLOTS)
  if (slots.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  const runnables = slots.map(s =>
    withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).withStructuredOutput(schema).invoke(input) as Promise<z.infer<T>>,
    ),
  )
  return withDeadline(withFailover(runnables), 'structured call')
}

/**
 * Tool-calling model with rotation failover.
 * Used by the agentic subgraphs — Critic and Recovery — that call LangGraph tools.
 */
export function getToolCallingModel(
  tools: Parameters<ChatOpenAI['bindTools']>[0],
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const slots = getAllSlots().slice(0, MAX_FAILOVER_SLOTS)
  if (slots.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  const runnables = slots.map(s =>
    withTelemetry(s, (input) =>
      buildClient(s.key, s.model, opts).bindTools(tools).invoke(input) as Promise<AIMessageChunk>,
    ),
  )
  return withDeadline(withFailover(runnables), 'tool call')
}
