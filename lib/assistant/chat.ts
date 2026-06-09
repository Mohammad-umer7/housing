// The Assistant chat runner. Thin wrapper over the shared LLM client that:
//   • grounds every turn in the SZHP system prompt (assistantSystemPrompt)
//   • keeps the conversation bounded (last N turns) to control latency/cost
//   • degrades gracefully (no GROQ key / LLM error) to an on-topic fallback
// The API route stays thin and just hands user input + resolved case context here.

import { getChatModel } from '@/lib/llm/client'
import {
  assistantSystemPrompt,
  assistantFallbackReply,
  type AssistantCaseContext,
  type AssistantStatsContext,
  type AudiencePortal,
} from '@/lib/assistant/knowledge'

export type ChatRole = 'user' | 'assistant'
export interface ChatMessage {
  role: ChatRole
  content: string
}

const MAX_TURNS = 10 // keep the last 10 messages of history
const MAX_CONTENT = 2000 // clamp any single message length

export interface RunAssistantInput {
  messages: ChatMessage[]
  audience?: AudiencePortal
  caseContext?: AssistantCaseContext | null
  customInstructions?: string | null
  stats?: AssistantStatsContext | null
}

export interface RunAssistantResult {
  reply: string
  /** 'llm' when the model answered, 'fallback' when degraded. */
  source: 'llm' | 'fallback'
}

/** Normalize, validate and clamp the inbound history. */
export function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const cleaned: ChatMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
    const text = content.trim().slice(0, MAX_CONTENT)
    if (text) cleaned.push({ role, content: text })
  }
  return cleaned.slice(-MAX_TURNS)
}

export async function runAssistant({
  messages,
  audience = 'citizen',
  caseContext = null,
  customInstructions = null,
  stats = null,
}: RunAssistantInput): Promise<RunAssistantResult> {
  const history = sanitizeMessages(messages)
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return { reply: 'Please ask a question about your housing arrears rescheduling.', source: 'fallback' }
  }

  // No key → on-topic offline guidance rather than an error.
  if (!process.env.GROQ_API_KEY) {
    return { reply: assistantFallbackReply(), source: 'fallback' }
  }

  const system = assistantSystemPrompt(audience, caseContext, { customInstructions, stats })
  // LangChain accepts [role, content] tuples; map assistant → 'ai', user → 'human'.
  const lcMessages: [string, string][] = [
    ['system', system],
    ...history.map((m): [string, string] => [m.role === 'assistant' ? 'ai' : 'human', m.content]),
  ]

  try {
    const model = getChatModel({ temperature: 0.3, maxTokens: 500 })
    const res = await model.invoke(lcMessages)
    const content = res?.content
    const reply =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((c) => (typeof c === 'string' ? c : typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : ''))
              .join('')
          : ''
    const text = reply.trim()
    return text ? { reply: text, source: 'llm' } : { reply: assistantFallbackReply(), source: 'fallback' }
  } catch (err) {
    console.error('[assistant] LLM error:', err)
    return { reply: assistantFallbackReply(), source: 'fallback' }
  }
}
