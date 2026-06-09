// Single LLM access point for the whole pipeline — now built on LangChain's
// ChatGroq.
//
// Swapping the model or provider — e.g. Groq → a UAE-sovereign model (G42 Jais /
// TII Falcon-Arabic) for production — is a change to THIS FILE ONLY. Every agent
// node builds its model via getChatModel()/getStructuredModel(), so the provider,
// model name, timeout and retry policy live in one place (overridable by env).
//
// Resilience the regulated pipeline depends on is configured on the ChatGroq
// instance itself:
//   • request timeout so a hung connection never stalls a case
//   • bounded retries with backoff on transient failures (429 / 5xx / network)
// Callers keep their own try/catch + graceful fallbacks, so an LLM outage
// degrades a step — it never hangs the pipeline.

import { ChatGroq } from '@langchain/groq'
import type { z } from 'zod'
import type { Runnable } from '@langchain/core/runnables'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'

export const LLM_MODEL = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile'
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15000
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES) || 2

export type ModelOptions = {
  temperature?: number
  maxTokens?: number
}

// Base chat model. Use directly for tool-calling agents via `.bindTools(...)`.
export function getChatModel(opts: ModelOptions = {}): ChatGroq {
  return new ChatGroq({
    model: LLM_MODEL,
    apiKey: process.env.GROQ_API_KEY,
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 800,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  })
}

// Structured-output model: returns a runnable that parses the model response into
// the given Zod schema (type-safe, no manual JSON.parse / markdown-fence stripping).
// Every single-shot JSON agent (planner, rules, reconcile, document extraction)
// uses this instead of hand-rolling JSON handling.
export function getStructuredModel<T extends z.ZodTypeAny>(
  schema: T,
  opts: ModelOptions = {},
): Runnable<BaseLanguageModelInput, z.infer<T>> {
  return getChatModel(opts).withStructuredOutput(schema) as unknown as Runnable<
    BaseLanguageModelInput,
    z.infer<T>
  >
}
