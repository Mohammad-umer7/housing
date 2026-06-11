import { z } from 'zod'

// The LLM layer is now built on OpenRouter via the multi-key/model rotation manager
// (see lib/llm/client.ts + lib/llm/rotation-manager.ts). These tests verify the factory
// wiring without touching the network: that the configured model name is exposed, a model
// is constructed, and the structured helper returns an invokable runnable bound to a schema.

// The rotation manager discovers keys at module load and the client throws when none are
// configured — provide a throwaway OpenRouter key BEFORE importing the client.
process.env.OPENROUTER_API_KEY1 = process.env.OPENROUTER_API_KEY1 || 'sk-or-test-key'

import { getChatModel, getStructuredModel, LLM_MODEL } from '../lib/llm/client'

describe('llm client (OpenRouter rotation layer)', () => {
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
