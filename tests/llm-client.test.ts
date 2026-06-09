import { z } from 'zod'

// The LLM layer is now built on LangChain's ChatGroq (see lib/llm/client.ts).
// These tests verify the factory wiring without touching the network: that the
// configured model name is exposed, a model is constructed, and the structured
// helper returns an invokable runnable bound to the given schema.

// ChatGroq requires an API key at construction — provide a throwaway one.
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-key'

import { getChatModel, getStructuredModel, LLM_MODEL } from '../lib/llm/client'

describe('llm client (ChatGroq layer)', () => {
  test('exposes the configured model name', () => {
    expect(typeof LLM_MODEL).toBe('string')
    expect(LLM_MODEL.length).toBeGreaterThan(0)
  })

  test('getChatModel builds a chat model', () => {
    const model = getChatModel({ temperature: 0, maxTokens: 100 })
    expect(model).toBeDefined()
    expect(typeof model.invoke).toBe('function')
  })

  test('getStructuredModel returns an invokable runnable for a schema', () => {
    const runnable = getStructuredModel(z.object({ ok: z.boolean() }))
    expect(runnable).toBeDefined()
    expect(typeof runnable.invoke).toBe('function')
  })
})
