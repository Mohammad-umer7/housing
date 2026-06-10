# SADDAD read-only MCP server

Lets a housing officer **chat with Claude Desktop about the live system** — "how
backed up is the queue?", "why was case MSZHP_100075 escalated?", "what are
citizens saying?" — by exposing the system's state as MCP **tools**.

- **MCP server** = [`saddad-server.mjs`](saddad-server.mjs) (this repo). You own it.
- **MCP client** = Claude Desktop. It decides which tool to call and turns the JSON
  into a plain-language answer. You don't build any chat UI.
- **Read-only by construction:** every handler issues `SELECT`s only — there are no
  insert/update/delete tools — and each tool is tagged `readOnlyHint: true`.

It's built on **[FastMCP](https://github.com/punkpeye/fastmcp)** (a thin TypeScript
framework over the official MCP SDK — trims the tool-definition boilerplate, gives
clean user-facing errors via `UserError`, stdio + httpStream transports, and a
`fastmcp dev` inspector). It's a self-contained Node script (same pattern as
`tools/*.mjs`): it reads `.env.local` and opens its own Supabase client, so the
Next.js app does **not** need to be running.

## Tools

| Tool | Answers |
|------|---------|
| `get_system_overview` | Overall health: case counts by decision, queue depth, feedback average. |
| `get_queue_status` | Queue depth, avg processing time, longest wait, cases in flight. |
| `list_recent_cases` | Newest decisions (optional `status` filter). |
| `get_case` | One case: decision + agent pipeline + audit trail. |
| `get_case_pipeline` | The agent-by-agent run for a case (durations, parallelism). |
| `get_case_audit_trail` | Immutable audit log — rule triggered, rationale, who processed it. |
| `lookup_applicant` | Source programme record (salary, arrears, loan, social status). |
| `get_beneficiary_cases` | All cases for one Emirates ID. |
| `get_governance_rules` | Active admin-configurable thresholds (overrides only). |
| `get_recent_feedback` | Latest citizen ratings/comments + average. |
| `find_similar_precedent` | Historical approved cases near a given debt-to-income ratio. |
| `search_cases` | Flexible filter: status, social status, priority, arrears/DBR range, date. |
| `get_decision_analytics` | Programme KPIs: approval rate, arrears under management, avg DBR, avg plan. |
| `get_fairness_report` | Approval rate by social status, priority lane, and DBR band — equity view. |
| `get_priority_cases` | G-06 hardship lane: widows, orphans, seniors, People of Determination. |
| `get_agent_performance` | Per-agent run counts, failures, avg duration — pipeline bottlenecks. |
| `get_rule_trigger_stats` | Ranked tally of which governance rules fire, and the decisions they drive. |
| `check_decision_consistency` | Is one case's decision consistent with similar-DBR decisions? |

## Connect it to Claude Desktop (Windows)

1. Make sure `.env.local` (next to `package.json`) has `NEXT_PUBLIC_SUPABASE_URL`
   and `SUPABASE_SERVICE_ROLE_KEY`.
2. Open the Claude Desktop config file (create it if missing):
   `%APPDATA%\Claude\claude_desktop_config.json`
   → `C:\Users\omerj\AppData\Roaming\Claude\claude_desktop_config.json`
3. Add the server (merge into any existing `mcpServers`):

```json
{
  "mcpServers": {
    "saddad": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\omerj\\housing-arrears-agent\\mcp\\saddad-server.mjs"]
    }
  }
}
```

> Use the full path to `node.exe` (run `where node` to find yours) — Claude Desktop
> does not always inherit your shell `PATH`. Paths must use `\\` (escaped backslashes).

4. **Fully quit and reopen Claude Desktop.** The `saddad` server appears under the
   tools (🔌) menu. Ask: *"Using saddad, give me a system overview."*

## Test without Claude Desktop

```
npm run mcp:test
```

Spawns the server over stdio, lists the 11 tools (all flagged read-only), and calls
`get_system_overview` + `get_queue_status` against the live DB.

Or open the **MCP Inspector** (FastMCP's dev UI) to click through every tool:

```
npx fastmcp dev mcp/saddad-server.mjs
```

## Notes

- **Never `console.log` in the server** — stdout is the MCP JSON-RPC stream;
  diagnostics go to stderr (`console.error`) only.
- The service-role key bypasses RLS but is used for `SELECT`s exclusively. To harden
  for multi-officer / production use, switch to the anon key behind row-level
  security, or expose it over FastMCP's `httpStream` transport (`server.start({
  transportType: 'httpStream', httpStream: { port: 8080 } })`) behind a bearer token
  — the same 11 tool definitions carry straight over.
