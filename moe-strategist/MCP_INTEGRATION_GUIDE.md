# MOE Strategist MCP Integration Guide

## Quick Start

### 1. Build the MCP Server

```bash
npm run build:mcp
```

This compiles `mcp-server.ts` to `mcp-server.js`

### 2. Test the MCP Server Locally

```bash
node mcp-server.js
```

Then send JSON requests:
```json
{"method": "tools/list"}
```

### 3. Configure with Claude

#### Option A: Direct Configuration
Add to Claude's config file:
```json
{
  "mcpServers": {
    "moe-strategist": {
      "command": "node",
      "args": ["mcp-server.js"],
      "cwd": "/full/path/to/MOE Stratigest"
    }
  }
}
```

#### Option B: Use Provided Config
```bash
cp mcp-config.json ~/.claude-mcp-config.json
```

## Integration with Existing Features

The MCP server integrates seamlessly with MOE Strategist's existing capabilities:

### Feature: PDF Analysis (upload-file component)
**MCP Tool:** `analyze_pdf`
- Calls the same `extractData()` function from `src/lib/text-extraction.ts`
- Returns metrics, key-value pairs, and summary
- Supports all file types: PDF, PNG, JPG, JPEG

### Feature: Economic Reports (reports-page component)
**MCP Tool:** `generate_report`
- Generates the same report types available in the UI
- Briefing, Analysis, Forecast, and Comparison reports
- Includes economic indicators and recommendations

### Feature: Comparison Analysis (comparison-view component)
**MCP Tool:** `compare_countries`
- Compare economic metrics across regions
- Returns side-by-side comparison data
- Can focus on specific indicators

### Feature: Economic Indicators (kpi-grid component)
**MCP Tool:** `get_economic_indicators`
- Access the same KPI data used in the dashboard
- Returns UAE and global economic metrics
- Can query individual indicators or all data

### Feature: Advanced Analysis (advanced-analysis component)
**MCP Tool:** `sentiment_analysis` + `extract_structured_data`
- Sentiment analysis for market data
- Structured data extraction from documents
- Powers the Advanced Analysis features

## Usage Examples

### Example 1: Extract Data from Economic Report
```javascript
// Call from Claude or AI tool
{
  "method": "tools/call",
  "params": {
    "name": "analyze_pdf",
    "arguments": {
      "filePath": "economic-report.pdf",
      "extractMetrics": true,
      "extractKeyValues": true
    }
  }
}
```

Response:
```
Extracted Metrics:
- GDP: $507.8B (currency)
- Growth: 5.0% (percentage)
- Unemployment: 2.1% (percentage)

Key-Value Pairs:
- Report Date: December 2025
- Country: UAE
- Analysis Period: Q3 2026
```

### Example 2: Generate Economic Briefing
```javascript
{
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {
      "reportType": "briefing",
      "topic": "UAE Energy Sector 2026",
      "dataPoints": ["Energy Production", "Renewable Energy", "Infrastructure"]
    }
  }
}
```

### Example 3: Compare Countries
```javascript
{
  "method": "tools/call",
  "params": {
    "name": "compare_countries",
    "arguments": {
      "country1": "UAE",
      "country2": "Saudi Arabia",
      "indicators": ["gdpGrowth", "inflation"]
    }
  }
}
```

### Example 4: Sentiment Analysis
```javascript
{
  "method": "tools/call",
  "params": {
    "name": "sentiment_analysis",
    "arguments": {
      "text": "UAE's economic outlook shows strong growth momentum with positive infrastructure developments",
      "source": "market"
    }
  }
}
```

## Architecture

```
Claude/AI Tool
      ↓
   MCP Protocol
      ↓
  MCP Server (mcp-server.ts)
      ↓
  Tool Functions
      ↓
┌─────────────────────────────────┐
│  MOE Strategist Backend API      │
├─────────────────────────────────┤
│ ├─ text-extraction.ts           │
│ ├─ Economic Data Service        │
│ ├─ Report Generator             │
│ └─ Analysis Engine              │
└─────────────────────────────────┘
      ↓
  Web Dashboard (React/Next.js)
```

## Data Flow

1. **Claude/AI Tool** sends request via MCP protocol
2. **MCP Server** receives and parses the request
3. **Tool Handler** processes the request
4. **Backend Functions** execute (same logic as web UI)
5. **Result** returned to Claude/AI Tool

## Extending the MCP Server

To add new tools:

1. **Define the tool in the `tools` array:**
```typescript
const tools: Tool[] = [
  {
    name: "my_new_tool",
    description: "Description of what tool does",
    inputSchema: {
      type: "object",
      properties: {
        param1: { type: "string", description: "..." },
        param2: { type: "number", description: "..." }
      },
      required: ["param1"]
    }
  }
]
```

2. **Implement the tool function:**
```typescript
function myNewTool(param1: string, param2: number): ToolResult {
  // Implementation here
  return {
    type: "text",
    content: [{ type: "text", text: "Result" }]
  }
}
```

3. **Add case to processTool:**
```typescript
case "my_new_tool":
  return myNewTool(toolInput.param1, toolInput.param2)
```

4. **Rebuild:**
```bash
npm run build:mcp
```

## Performance Considerations

- MCP server is stateless and can be horizontally scaled
- Each tool call is independent
- Data extraction operations are CPU-intensive (consider caching)
- PDF processing may take several seconds for large files

## Security Best Practices

✅ **Implemented:**
- Input validation via JSON schema
- Tool access is via MCP protocol (secure)
- No direct file system access without validation

⚠️ **TODO for Production:**
- Add authentication tokens
- Implement rate limiting
- Add request logging and monitoring
- Validate file paths against whitelist
- Add CORS headers if hosted as API
- Encrypt sensitive data in transit

## Monitoring

To monitor MCP server health:

```bash
# View server logs
tail -f mcp-server.log

# Check running processes
ps aux | grep mcp-server

# Monitor with PM2
pm2 start mcp-server.js --name "moe-mcp"
pm2 logs moe-mcp
```

## Troubleshooting

### Issue: MCP Server won't start
**Solution:**
```bash
# Check Node.js version
node --version  # Should be 16+

# Rebuild MCP server
npm run build:mcp

# Run with verbose logging
DEBUG=* node mcp-server.js
```

### Issue: Tools not available in Claude
**Solution:**
- Verify MCP config file path is correct
- Check Claude's MCP server logs
- Restart Claude completely
- Verify `mcp-server.js` exists (run `npm run build:mcp`)

### Issue: PDF analysis fails
**Solution:**
- Verify file path exists and is readable
- Check file is not corrupted
- For image-based PDFs, ensure Tesseract.js is installed
- Try with different document format

## Next Steps

1. ✅ Built MCP server with 6 core tools
2. ✅ Created configuration files
3. ✅ Added build scripts to package.json
4. **TODO:** Configure with Claude or AI tool
5. **TODO:** Test all tool functions
6. **TODO:** Monitor usage and performance
7. **TODO:** Add authentication for production
8. **TODO:** Deploy to production environment

## Support & Documentation

- **MCP Protocol Docs:** https://modelcontextprotocol.io/
- **Claude API Docs:** https://claudeai.com/api
- **Project Repo:** MOE Strategist
- **Issues:** Report via project issue tracker

---

**Status:** ✅ Ready for Integration  
**Version:** 1.0.0  
**Last Updated:** June 2026
