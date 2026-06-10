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
import type { Runnable } from '@langchain/core/runnables'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import type { AIMessageChunk } from '@langchain/core/messages'
import { getAllSlots, buildClient, isConfigured } from './rotation-manager'

/** Active model name — used in audit-trail fields (escalation-agent, etc.). */
export const LLM_MODEL =
  process.env.OPENROUTER_MODEL_1 ?? process.env.LLM_MODEL ?? 'openai/gpt-oss-20b:free'

export type ModelOptions = {
  temperature?: number
  maxTokens?:   number
}

/** True when at least one OpenRouter API key is configured. */
export function isLLMConfigured(): boolean {
  return isConfigured()
}

// Build an ordered list of ChatOpenAI instances for the failover chain.
function buildRotationChain(opts: ModelOptions): ChatOpenAI[] {
  return getAllSlots().map(s => buildClient(s.key, s.model, opts))
}

// Chain runnables so a failure on the current slot automatically falls through
// to the next (rate-limit / 5xx / network / schema validation error).
function withFailover<I, O>(runnables: Runnable<I, O>[]): Runnable<I, O> {
  const [primary, ...rest] = runnables
  return rest.length ? primary.withFallbacks(rest) : primary
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
 * Structured-output model with full rotation failover.
 * Parses the LLM response into the given Zod schema — type-safe, no manual JSON.
 * Used by every single-shot JSON agent: planner, rules, communication, extraction.
 */
export function getStructuredModel<T extends z.ZodTypeAny>(
  schema: T,
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, z.infer<T>> {
  const models = buildRotationChain(opts)
  if (models.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  const runnables = models.map(
    m => m.withStructuredOutput(schema) as unknown as Runnable<BaseLanguageModelInput, z.infer<T>>,
  )
  return withFailover(runnables)
}

/**
 * Tool-calling model with rotation failover.
 * Used by the agentic subgraphs — Critic and Recovery — that call LangGraph tools.
 */
export function getToolCallingModel(
  tools: Parameters<ChatOpenAI['bindTools']>[0],
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const models = buildRotationChain(opts)
  if (models.length === 0) throw new Error('[llm] No OpenRouter API keys configured')
  const runnables = models.map(
    m => m.bindTools(tools) as unknown as Runnable<BaseLanguageModelInput, AIMessageChunk>,
  )
  return withFailover(runnables)
}
