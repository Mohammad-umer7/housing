/**
 * MOE Strategist MCP Server
 * Provides tools for economic analysis, data extraction, and report generation
 */

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required: string[]
  }
}

interface TextContent {
  type: 'text'
  text: string
}

interface ToolResult {
  type: string
  content: TextContent[]
}

// Mock economic data for demonstration
const economicData = {
  uae: {
    gdp: 507.8,
    gdpGrowth: 5.0,
    inflation: 2.0,
    unemployment: 2.1,
    currentAccount: 74.0,
    sectors: {
      services: 51.6,
      industry: 47.7,
      agriculture: 0.7,
    },
  },
  global: {
    gdpGrowth: 2.8,
    energyProduction: 4215,
    infrastructureRating: 7.2,
    techAdoptionRate: 84.2,
  },
}

// Available tools
const tools: Tool[] = [
  {
    name: 'get_economic_indicators',
    description: 'Retrieve economic indicators for UAE or global metrics',
    inputSchema: {
      type: 'object',
      properties: {
        region: {
          type: 'string',
          description: 'Region to retrieve data for (uae or global)',
          enum: ['uae', 'global'],
        },
        indicator: {
          type: 'string',
          description:
            'Specific indicator to retrieve (gdp, inflation, unemployment, etc.)',
        },
      },
      required: ['region'],
    },
  },
  {
    name: 'analyze_pdf',
    description:
      'Analyze a PDF document and extract valuable data including metrics, key-value pairs, and summary',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the PDF file to analyze',
        },
        extractMetrics: {
          type: 'boolean',
          description: 'Whether to extract numerical metrics',
          default: true,
        },
        extractKeyValues: {
          type: 'boolean',
          description: 'Whether to extract key-value pairs',
          default: true,
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'compare_countries',
    description: 'Compare economic indicators between two countries or regions',
    inputSchema: {
      type: 'object',
      properties: {
        country1: {
          type: 'string',
          description: 'First country or region',
        },
        country2: {
          type: 'string',
          description: 'Second country or region',
        },
        indicators: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Indicators to compare (gdp, inflation, unemployment, etc.)',
        },
      },
      required: ['country1', 'country2'],
    },
  },
  {
    name: 'generate_report',
    description: 'Generate an AI-powered economic report with analysis and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          description: 'Type of report (briefing, analysis, forecast, comparison)',
          enum: ['briefing', 'analysis', 'forecast', 'comparison'],
        },
        topic: {
          type: 'string',
          description: 'Topic or country for the report',
        },
        dataPoints: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Specific data points to include',
        },
      },
      required: ['reportType', 'topic'],
    },
  },
  {
    name: 'sentiment_analysis',
    description:
      'Perform sentiment analysis on economic text data or news articles',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze for sentiment',
        },
        source: {
          type: 'string',
          description: 'Source of the text (market, news, report, social)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'extract_structured_data',
    description:
      'Extract structured data from unstructured economic text (metrics, currencies, percentages)',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to extract data from',
        },
        dataTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['currencies', 'percentages', 'numbers', 'entities'],
          },
          description: 'Types of data to extract',
        },
      },
      required: ['text'],
    },
  },
]

// Tool implementations
function getEconomicIndicators(region: string, indicator?: string): ToolResult {
  const data = economicData[region as keyof typeof economicData]

  if (!data) {
    return {
      type: 'text',
      content: [
        {
          type: 'text',
          text: `Error: Region "${region}" not found. Available regions: uae, global`,
        },
      ],
    }
  }

  if (indicator) {
    const value = (data as Record<string, unknown>)[indicator]
    if (value === undefined) {
      return {
        type: 'text',
        content: [
          {
            type: 'text',
            text: `Indicator "${indicator}" not found for region "${region}"`,
          },
        ],
      }
    }
    return {
      type: 'text',
      content: [
        {
          type: 'text',
          text: `${region.toUpperCase()} - ${indicator}: ${JSON.stringify(value)}`,
        },
      ],
    }
  }

  return {
    type: 'text',
    content: [
      {
        type: 'text',
        text: `${region.toUpperCase()} Economic Indicators:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  }
}

function analyzePDF(filePath: string, extractMetrics = true, extractKeyValues = true): ToolResult {
  // Mock implementation - in production, this would call the actual extraction logic
  const mockMetrics = [
    { label: 'GDP Growth', value: '5.0%', type: 'percentage' },
    { label: 'Inflation Rate', value: '2.0%', type: 'percentage' },
    { label: 'GDP', value: '$507.8B', type: 'currency' },
  ]

  const mockKeyValues = [
    { key: 'Country', value: 'United Arab Emirates' },
    { key: 'Report Date', value: 'December 2025' },
    { key: 'Analysis Period', value: 'Q3 2026' },
  ]

  let result = `PDF Analysis: ${filePath}\n\n`

  if (extractMetrics) {
    result += `Extracted Metrics:\n${JSON.stringify(mockMetrics, null, 2)}\n\n`
  }

  if (extractKeyValues) {
    result += `Extracted Key-Value Pairs:\n${JSON.stringify(mockKeyValues, null, 2)}`
  }

  return {
    type: 'text',
    content: [{ type: 'text', text: result }],
  }
}

function compareCountries(country1: string, country2: string, indicators?: string[]): ToolResult {
  const comparison = {
    country1: {
      name: country1,
      gdpGrowth: '5.0%',
      inflation: '2.0%',
      unemployment: '2.1%',
    },
    country2: {
      name: country2,
      gdpGrowth: '2.8%',
      inflation: '3.2%',
      unemployment: '3.5%',
    },
  }

  let result = `Economic Comparison: ${country1} vs ${country2}\n\n`
  result += JSON.stringify(comparison, null, 2)

  return {
    type: 'text',
    content: [{ type: 'text', text: result }],
  }
}

function generateReport(reportType: string, topic: string, dataPoints?: string[]): ToolResult {
  const reports: Record<string, string> = {
    briefing: `Executive Briefing: ${topic}\n\nKey Findings:\n- Strong economic performance\n- Sustainable growth trajectory\n- Strategic partnerships advancing`,
    analysis: `Economic Analysis: ${topic}\n\nDetailed Analysis:\n- Macro indicators trending positively\n- Sector-specific growth drivers identified\n- Risk factors monitored`,
    forecast: `Economic Forecast: ${topic}\n\nProjections (2026-2027):\n- Expected growth: 4-5%\n- Inflation forecasted at 2.5%\n- Investment opportunities identified`,
    comparison: `Comparative Analysis: ${topic}\n\nRegional Comparison:\n- Competitive advantages identified\n- Benchmarking insights provided\n- Strategic recommendations included`,
  }

  const report = reports[reportType] || `Report for ${topic}`

  return {
    type: 'text',
    content: [
      {
        type: 'text',
        text: report,
      },
    ],
  }
}

function sentimentAnalysis(text: string, source?: string): ToolResult {
  // Simple sentiment detection
  const positiveWords = ['growth', 'strong', 'positive', 'improved', 'opportunity']
  const negativeWords = ['decline', 'weak', 'negative', 'risk', 'challenge']

  const textLower = text.toLowerCase()
  const positiveCount = positiveWords.filter((w) => textLower.includes(w)).length
  const negativeCount = negativeWords.filter((w) => textLower.includes(w)).length

  let sentiment = 'neutral'
  if (positiveCount > negativeCount) sentiment = 'positive'
  if (negativeCount > positiveCount) sentiment = 'negative'

  return {
    type: 'text',
    content: [
      {
        type: 'text',
        text: `Sentiment Analysis Result:\nSource: ${source || 'unknown'}\nSentiment: ${sentiment}\nPositive indicators: ${positiveCount}\nNegative indicators: ${negativeCount}`,
      },
    ],
  }
}

function extractStructuredData(text: string, dataTypes?: string[]): ToolResult {
  const extracted: Record<string, unknown> = {}

  if (!dataTypes || dataTypes.includes('currencies')) {
    extracted.currencies = text.match(/\$[\d,]+\.?\d*[BMT]?/g) || []
  }

  if (!dataTypes || dataTypes.includes('percentages')) {
    extracted.percentages = text.match(/\d+\.?\d*%/g) || []
  }

  if (!dataTypes || dataTypes.includes('numbers')) {
    extracted.numbers = text.match(/\d{4,}/g) || []
  }

  if (!dataTypes || dataTypes.includes('entities')) {
    extracted.entities = ['UAE', 'GDP', 'Economic', 'Growth'].filter((e) =>
      text.includes(e)
    )
  }

  return {
    type: 'text',
    content: [
      {
        type: 'text',
        text: `Extracted Data:\n${JSON.stringify(extracted, null, 2)}`,
      },
    ],
  }
}

// Process tool calls
function processTool(
  toolName: string,
  toolInput: Record<string, unknown>
): ToolResult {
  switch (toolName) {
    case 'get_economic_indicators':
      return getEconomicIndicators(
        toolInput.region as string,
        toolInput.indicator as string | undefined
      )

    case 'analyze_pdf':
      return analyzePDF(
        toolInput.filePath as string,
        toolInput.extractMetrics !== false,
        toolInput.extractKeyValues !== false
      )

    case 'compare_countries':
      return compareCountries(
        toolInput.country1 as string,
        toolInput.country2 as string,
        toolInput.indicators as string[] | undefined
      )

    case 'generate_report':
      return generateReport(
        toolInput.reportType as string,
        toolInput.topic as string,
        toolInput.dataPoints as string[] | undefined
      )

    case 'sentiment_analysis':
      return sentimentAnalysis(
        toolInput.text as string,
        toolInput.source as string | undefined
      )

    case 'extract_structured_data':
      return extractStructuredData(
        toolInput.text as string,
        toolInput.dataTypes as string[] | undefined
      )

    default:
      return {
        type: 'text',
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
      }
  }
}

// Main MCP Server
interface McpRequest {
  method: string
  params?: Record<string, unknown>
}

function handleRequest(request: McpRequest): unknown {
  const method = request.method
  
  if (method === 'tools/list') {
    return {
      tools,
    }
  }

  if (method === 'tools/call') {
    const params = request.params as Record<string, unknown>
    const toolName = params.name as string
    const toolInput = params.arguments as Record<string, unknown>

    return processTool(toolName, toolInput)
  }

  return {
    error: 'Unknown method',
  }
}

// Listen for stdin and process requests
async function main() {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let inputBuffer = ''

  rl.on('line', (line: string) => {
    try {
      const request = JSON.parse(line) as McpRequest
      const response = handleRequest(request)
      console.log(JSON.stringify(response))
    } catch (error) {
      console.error(JSON.stringify({ error: (error as Error).message }))
    }
  })

  rl.on('close', () => {
    process.exit(0)
  })
}

main().catch(console.error)
