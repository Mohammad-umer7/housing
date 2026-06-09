// Single LLM access point for the whole pipeline — now built on LangChain's
// ChatGroq.
//
// Swapping the model or provider — e.g. Groq → a UAE-sovereign model (G42 Jais /
// TII Falcon-Arabic) for production — is a change to THIS FILE ONLY. Every agent
// node builds its model via getChatModel()/getStructuredModel()/getToolCallingModel(),
// so the provider, model name, timeout, retry policy and API-key failover live in one
// place (overridable by env).
//
// Resilience the regulated pipeline depends on is configured here:
//   • request timeout so a hung connection never stalls a case
//   • bounded retries with backoff on transient failures (429 / 5xx / network)
//   • MULTI-KEY FAILOVER — if the primary Groq key is rate-limited or errors, the next
//     configured key is tried automatically (LangChain .withFallbacks).
// Callers keep their own try/catch + graceful fallbacks, so an LLM outage degrades a
// step — it never hangs the pipeline.

import { ChatGroq } from '@langchain/groq'
import type { z } from 'zod'
import type { Runnable } from '@langchain/core/runnables'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import type { AIMessageChunk } from '@langchain/core/messages'

export const LLM_MODEL = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile'
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15000
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES) || 2

export type ModelOptions = {
  temperature?: number
  maxTokens?: number
}

// All configured Groq API keys, primary first. Failover order:
//   GROQ_API_KEY → GROQ_API_KEY_2 → GROQ_API_KEY_3 (plus any comma-separated GROQ_API_KEYS).
// NOTE: Groq's DAILY token limit is per-ORGANIZATION. A backup key from the SAME Groq
// account shares that daily cap — failover still rescues per-minute rate limits and
// transient 5xx/network errors, but for true daily-cap failover the backup key must
// belong to a SEPARATE Groq account.
function groqApiKeys(): string[] {
  const raw = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    ...String(process.env.GROQ_API_KEYS ?? '').split(','),
  ]
  const keys = raw.map((k) => (k ?? '').trim()).filter(Boolean)
  return Array.from(new Set(keys))
}

// One ChatGroq instance per configured key (primary first).
function buildModels(opts: ModelOptions): ChatGroq[] {
  const keys = groqApiKeys()
  // If none parsed, fall back to a single instance that reads GROQ_API_KEY itself.
  const list: (string | undefined)[] = keys.length ? keys : [process.env.GROQ_API_KEY]
  return list.map(
    (apiKey) =>
      new ChatGroq({
        model: LLM_MODEL,
        apiKey,
        temperature: opts.temperature ?? 0.1,
        maxTokens: opts.maxTokens ?? 800,
        timeout: TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      }),
  )
}

// Chain per-key runnables so a failure on the primary key automatically retries on the
// next key (rate limit / 5xx / network). Single key → returned as-is (no overhead).
function withKeyFailover<I, O>(runnables: Runnable<I, O>[]): Runnable<I, O> {
  const [primary, ...rest] = runnables
  return rest.length ? primary.withFallbacks(rest) : primary
}

// Base chat model on the PRIMARY key (no failover wrapper, so callers can still call
// instance methods like .bindTools). Tool-calling agents should prefer
// getToolCallingModel() below to get failover.
export function getChatModel(opts: ModelOptions = {}): ChatGroq {
  return buildModels(opts)[0]
}

// Structured-output model with automatic key failover: parses the response into the
// given Zod schema (type-safe, no manual JSON handling). Used by every single-shot JSON
// agent (planner, rules, reconcile, communication, document extraction).
export function getStructuredModel<T extends z.ZodTypeAny>(
  schema: T,
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, z.infer<T>> {
  const runnables = buildModels(opts).map(
    (m) =>
      m.withStructuredOutput(schema) as unknown as Runnable<BaseLanguageModelInput, z.infer<T>>,
  )
  return withKeyFailover(runnables)
}

// Tool-calling model (for the agentic subgraphs — Critic, Recovery) with automatic key
// failover. Binds the given tools to each per-key instance before chaining the fallback.
export function getToolCallingModel(
  tools: Parameters<ChatGroq['bindTools']>[0],
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, AIMessageChunk> {
  const runnables = buildModels(opts).map(
    (m) => m.bindTools(tools) as unknown as Runnable<BaseLanguageModelInput, AIMessageChunk>,
  )
  return withKeyFailover(runnables)
}
