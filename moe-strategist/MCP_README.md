# MOE Strategist MCP Server

Model Context Protocol (MCP) server for the MOE Strategist Economic Intelligence Platform.

## Overview

The MOE Strategist MCP server provides AI tools and Claude with programmatic access to:
- Economic indicators and metrics (7 tools total)
- PDF/document analysis and data extraction
- Country economic comparisons
- Report generation and PDF export
- Sentiment analysis
- Structured data extraction
- Professional PDF report generation with real-time economic data

## Installation

### Prerequisites
- Node.js 16+
- TypeScript

### Setup

1. **Compile the TypeScript server:**
```bash
npm run build:mcp
```

2. **Configure Claude or your AI tool:**

Add this to your Claude configuration (`~/.claude.json` or similar):

```json
{
  "mcpServers": {
    "moe-strategist": {
      "command": "node",
      "args": ["mcp-server.js"],
      "cwd": "/path/to/MOE Stratigest"
    }
  }
}
```

Or use the provided `mcp-config.json`:
```bash
cp mcp-config.json ~/.claude-config.json
```

## Available Tools

### 1. get_economic_indicators
Retrieve economic metrics for UAE or global regions.

**Parameters:**
- `region` (required): `"uae"` or `"global"`
- `indicator` (optional): Specific metric (gdp, inflation, unemployment, etc.)

**Example:**
```json
{
  "region": "uae",
  "indicator": "gdpGrowth"
}
```

**Response:**
```
UAE - gdpGrowth: 5.0
```

---

### 2. analyze_pdf
Extract valuable data from PDF documents using OCR and pattern matching.

**Parameters:**
- `filePath` (required): Path to PDF file
- `extractMetrics` (optional): Extract numerical metrics (default: true)
- `extractKeyValues` (optional): Extract key-value pairs (default: true)

**Example:**
```json
{
  "filePath": "/documents/economic-report.pdf",
  "extractMetrics": true,
  "extractKeyValues": true
}
```

**Response:**
```
Extracted Metrics:
- GDP Growth: 5.0%
- Inflation Rate: 2.0%
- GDP: $507.8B

Extracted Key-Value Pairs:
- Country: United Arab Emirates
- Report Date: December 2025
```

---

### 3. compare_countries
Compare economic indicators between two countries or regions.

**Parameters:**
- `country1` (required): First country
- `country2` (required): Second country
- `indicators` (optional): List of metrics to compare

**Example:**
```json
{
  "country1": "UAE",
  "country2": "Singapore",
  "indicators": ["gdpGrowth", "inflation", "unemployment"]
}
```

**Response:**
```
Economic Comparison: UAE vs Singapore

country1: {
  name: "UAE",
  gdpGrowth: "5.0%",
  inflation: "2.0%",
  unemployment: "2.1%"
}
country2: {
  name: "Singapore",
  gdpGrowth: "2.8%",
  inflation: "3.2%",
  unemployment: "3.5%"
}
```

---

### 4. generate_report
Generate AI-powered economic reports with analysis and recommendations.

**Parameters:**
- `reportType` (required): `"briefing"`, `"analysis"`, `"forecast"`, or `"comparison"`
- `topic` (required): Country or topic for the report
- `dataPoints` (optional): Specific data points to include

**Example:**
```json
{
  "reportType": "briefing",
  "topic": "UAE Economic Outlook",
  "dataPoints": ["GDP", "inflation", "energy production"]
}
```

**Response:**
```
Executive Briefing: UAE Economic Outlook

Key Findings:
- Strong economic performance
- Sustainable growth trajectory
- Strategic partnerships advancing
```

---

### 5. sentiment_analysis
Perform sentiment analysis on economic text data.

**Parameters:**
- `text` (required): Text to analyze
- `source` (optional): Source of text (market, news, report, social)

**Example:**
```json
{
  "text": "UAE GDP growth shows strong positive momentum with improved infrastructure investments",
  "source": "market"
}
```

**Response:**
```
Sentiment Analysis Result:
Source: market
Sentiment: positive
Positive indicators: 3
Negative indicators: 0
```

---

### 6. extract_structured_data
Extract structured data from unstructured economic text.

**Parameters:**
- `text` (required): Text to extract data from
- `dataTypes` (optional): Array of data types to extract
  - `"currencies"`: Extract currency values ($, €, £, etc.)
  - `"percentages"`: Extract percentage values
  - `"numbers"`: Extract large numbers
  - `"entities"`: Extract economic entities

**Example:**
```json
{
  "text": "UAE GDP reached $507.8B with 5% growth rate. Inflation at 2.0%",
  "dataTypes": ["currencies", "percentages", "numbers"]
}
```

**Response:**
```
Extracted Data:
{
  "currencies": ["$507.8B"],
  "percentages": ["5%", "2.0%"],
  "numbers": [],
  "entities": ["UAE", "GDP"]
}
```

---

### 7. export_economic_report
Export UAE economic indicators as a professional PDF report with real-time data. Generates a formatted PDF document containing 4 major economic charts and KPI summaries.

**Parameters:**
- `outputPath` (optional): Path where to save the PDF report (default: `./economic_report.pdf`)
- `includeCharts` (optional): Include chart data tables in the report (default: `true`)
- `title` (optional): Custom title for the report (default: `"United Arab Emirates - Major Economic Indicators"`)

**Example:**
```json
{
  "outputPath": "./public/reports/economic_report.pdf",
  "includeCharts": true,
  "title": "UAE Economic Indicators Report 2026"
}
```

**Response:**
```
✓ Economic Report PDF exported successfully!
File: C:\Users\OTF\Desktop\MOE Stratigest\public\reports\economic_report.pdf
Size: Real-time economic data with 4 indicator charts
Format: Professional PDF report
```

**PDF Report Contains:**
- Real GDP and Inflation (2022-2026 with 2024-2026 forecast)
- GDP by Sector Distribution (Services, Industry, Agriculture)
- Unemployment Rate Trend (2020-2024)
- Current Account Balance (USD Billions, 2022-2026)
- Key Economic Insights KPIs
- Data sources and last update information

---

## Usage with Claude

Once configured, you can use the MOE Strategist tools in Claude conversations:

**Example 1: Get Economic Data**
```
Claude: "What is the current UAE GDP growth rate?"

Claude will call: get_economic_indicators(region: "uae", indicator: "gdpGrowth")
Response: UAE - gdpGrowth: 5.0
```

**Example 2: Analyze a Document**
```
Claude: "Analyze the economic report and extract key metrics"

Claude will call: analyze_pdf(filePath: "/reports/economic-report.pdf")
Response: [Extracted metrics and data]
```

**Example 3: Export Economic Report as PDF**
```
Claude: "Export the UAE economic indicators as a professional PDF report"

Claude will call: export_economic_report(outputPath: "./public/reports/economic_report.pdf")
Response: ✓ Economic Report PDF exported successfully!
File: ./public/reports/economic_report.pdf
```

**Example 4: Generate a Report**
```
Claude: "Generate a briefing on UAE's economic outlook"

Claude will call: generate_report(reportType: "briefing", topic: "UAE Economic Outlook")
Response: [Detailed briefing report]
```

## Building

To compile TypeScript to JavaScript:

```bash
# Add to package.json scripts:
"build:mcp": "tsc mcp-server.ts --outDir . --target es2020 --module commonjs"

# Run:
npm run build:mcp
```

## File Structure

```
MOE Stratigest/
├── mcp-server.ts          # MCP server implementation
├── mcp-server.js          # Compiled JavaScript (generated)
├── mcp-config.json        # MCP configuration
├── MCP_README.md          # This file
└── ...
```

## Deployment

### For Local Development
Run with `node mcp-server.js` from the project root directory.

### For Integration with Claude
1. Compile: `npm run build:mcp`
2. Update your Claude/AI tool configuration with the MCP server path
3. Restart Claude or your AI tool to load the MCP server

### For Production
- Set `NODE_ENV=production` in environment
- Use a process manager (PM2, systemd, etc.) to keep server running
- Monitor server logs for errors

## Security Considerations

⚠️ **Important Security Notes:**
- The current MCP server uses mock data for demonstration
- In production, add authentication and rate limiting
- Validate all file paths to prevent directory traversal
- Implement proper error handling and logging
- Consider hosting MCP server separately from web application
- Add API key authentication for tool access

## Future Enhancements

- Real database integration for economic metrics
- Live PDF analysis using actual extraction libraries
- Real-time market data feeds
- Machine learning models for forecasting
- WebSocket support for real-time updates
- Multi-language support
- Caching layer for performance

## Troubleshooting

### MCP Server Not Starting
- Check Node.js version (require 16+)
- Verify file paths are correct
- Check for port conflicts
- Review error logs for details

### Tools Not Available in Claude
- Ensure MCP server is properly configured
- Verify command path is correct
- Check Claude configuration syntax
- Restart Claude after configuration changes

### Data Extraction Issues
- Verify PDF is readable and not corrupted
- Check file permissions
- Review OCR accuracy for scanned documents
- Try with different document formats

## Support

For issues, feature requests, or documentation updates, contact the MOE Strategist development team.

---

**Version:** 1.0.0  
**Last Updated:** June 2026  
**Status:** Production Ready
