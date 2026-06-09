# `/tools` — MCP-Compatible Tool Layer

The agents in [`/agents`](../agents/) don't talk to the database, Twilio, or any other external system directly. They go through this layer. Every tool here is shaped as an **MCP (Model Context Protocol) function definition** — name, description, JSON Schema for inputs, and an `execute()` implementation.

This shape was chosen deliberately:

1. **Swap-out at the boundary.** Replacing the database from Supabase to AWS RDS, or notifications from Twilio to UAE Telecom, means rewriting one file in this folder. No agent code changes.
2. **MCP-server ready.** If MOEI wants to expose these tools to other AI systems (Claude Desktop, GPT-4 with tools, internal agent frameworks), the definitions already match the MCP standard.
3. **Function-calling ready.** The same shape feeds directly into Groq/OpenAI function-calling. The Critic agent (`agents/critic-agent.ts`) consumes these tools verbatim.

---

## What's in here

| File | Provider | Tools |
|---|---|---|
| [`database-tools.ts`](database-tools.ts) | Supabase (replaceable) | `get_applicant`, `update_case`, `create_audit_log` |
| [`document-tools.ts`](document-tools.ts) | pdfjs-dist + Groq | `check_completeness`, `extract_pdf_fields` |
| [`notification-tools.ts`](notification-tools.ts) | Twilio (replaceable) | `send_whatsapp`, `send_sms` |

---

## Tool definition shape

```typescript
{
  name: 'get_applicant',
  description: 'Fetch applicant record from database by case number',
  input_schema: {
    type: 'object',
    properties: {
      caseNumber: { type: 'string', description: 'The case number to look up' },
    },
    required: ['caseNumber'],
  },
  execute: async (input) => { /* implementation */ },
}
```

This is identical to the OpenAI function-calling format and the MCP tool definition format. No translation layer needed.

---

## Why this matters for production

A common failure mode in AI government projects is tight coupling between agent logic and a specific vendor (Supabase, Twilio, OpenAI). When the procurement team picks a different vendor for production, the agent code needs a rewrite.

In SADDAD, each external dependency is one file in `/tools`. Swapping Supabase for a sovereign UAE database means rewriting `database-tools.ts`. Swapping Twilio for Etisalat means rewriting `notification-tools.ts`. The 11 agents stay untouched.

See [`docs/SCALING.md`](../docs/SCALING.md) for the full production-replacement matrix.

---

## How to add a new tool

1. Decide which tool file it belongs in (or create a new one for a new external dependency)
2. Add the definition to the `[tool]Tools` array with a clear `description` (the LLM uses this to decide when to call it)
3. Implement `execute()` — return JSON-serializable data
4. If the tool should be callable by an LLM agent, add it to that agent's `tools` array in the Groq function-calling request

For an example of an LLM autonomously calling tools, see [`agents/critic-agent.ts`](../agents/critic-agent.ts) — `CRITIC_TOOLS` defines the tool set, `executeCriticTool` dispatches calls, and the multi-turn loop lets the LLM call zero, one, or many tools before forming its verdict.
