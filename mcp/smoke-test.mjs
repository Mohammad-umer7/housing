// Smoke test for the SADDAD read-only MCP server: spawns it over stdio, lists the
// tools, and calls a couple of them against the live (read-only) DB.
//   Run:  node mcp/smoke-test.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const transport = new StdioClientTransport({
  command: process.execPath, // the node binary running this script
  args: [resolve(here, 'saddad-server.mjs')],
})

const client = new Client({ name: 'smoke-test', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log(`\n✓ connected — ${tools.length} tools:`)
for (const t of tools) console.log(`  • ${t.name} — ${t.annotations?.readOnlyHint ? 'read-only' : 'WRITE?!'}`)

const overview = await client.callTool({ name: 'get_system_overview', arguments: {} })
console.log('\n✓ get_system_overview:\n' + overview.content[0].text)

const queue = await client.callTool({ name: 'get_queue_status', arguments: {} })
console.log('\n✓ get_queue_status:\n' + queue.content[0].text)

await client.close()
console.log('\n✓ smoke test passed')
process.exit(0)
