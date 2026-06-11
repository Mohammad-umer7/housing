// ── Module type ──────────────────────────────────────────────────────────────

export type ModuleType = 'comparison' | 'advanced' | 'economic' | 'upload'

// ── Per-module configuration ─────────────────────────────────────────────────

export interface ModuleConfig {
  id: ModuleType
  title: string
  subtitle: string
  badgeLabel: string
  step1Title: string
  step1Subtitle: string
  step3Title: string
  step3Subtitle: string
  /** Messages shown sequentially in the terminal during Step 2 */
  processingMessages: string[]
  /** Agent names shown in the status panel */
  agents: Array<{ name: string; role: string }>
}

export const MODULE_CONFIGS: Record<ModuleType, ModuleConfig> = {
  comparison: {
    id: 'comparison',
    title: 'Comparison Analysis',
    subtitle: 'Cross-country economic intelligence',
    badgeLabel: 'GeoChart + Column Chart',
    step1Title: 'Configure Comparison Parameters',
    step1Subtitle: 'Select countries and metrics for side-by-side analysis',
    step3Title: 'Comparison Results',
    step3Subtitle: 'Geographic and metric visualizations',
    processingMessages: [
      '> Initializing comparison engine...',
      '> Querying global economic database...',
      '> Loading GDP indicators for selected countries...',
      '> Cross-referencing trade balance datasets...',
      '> Normalizing currency to USD baseline...',
      '> Applying PPP (Purchasing Power Parity) adjustment...',
      '> Computing Energy Investment Index...',
      '> Running statistical normalization (Z-score)...',
      '> Generating GeoChart coordinate mapping...',
      '> Building column chart data series...',
      '> Applying executive color gradient...',
      '> Final validation pass...',
      '> Analysis complete. Rendering visualizations...',
    ],
    agents: [
      { name: 'DataAgent-1', role: 'Database Querier' },
      { name: 'NormAgent-2', role: 'Data Normalizer' },
      { name: 'GeoAgent-3', role: 'Map Renderer' },
    ],
  },

  advanced: {
    id: 'advanced',
    title: 'Advanced Analysis',
    subtitle: 'Scenario planning & predictive modeling',
    badgeLabel: 'Line Chart · 5-yr Forecast',
    step1Title: 'Define Scenario Parameters',
    step1Subtitle: 'Set variables for probabilistic forecasting',
    step3Title: 'Scenario Forecast Results',
    step3Subtitle: '5-year predictive trend analysis',
    processingMessages: [
      '> Loading scenario parameters...',
      '> Initializing probabilistic model...',
      '> Running Monte Carlo simulation (10,000 iterations)...',
      '> Applying energy investment coefficient: weighting factor...',
      '> Computing trade policy elasticity...',
      '> Modeling GDP sensitivity to input variables...',
      '> Generating baseline, optimistic & pessimistic scenarios...',
      '> Running sensitivity analysis pass...',
      '> Forecasting 5-year trend lines...',
      '> Computing 95% confidence intervals...',
      '> Finalizing risk score matrix...',
      '> Rendering predictive line chart...',
      '> Forecast ready.',
    ],
    agents: [
      { name: 'ScenarioAgent-1', role: 'Monte Carlo Engine' },
      { name: 'ForecastAgent-2', role: 'Trend Modeler' },
      { name: 'RiskAgent-3', role: 'Risk Scorer' },
    ],
  },

  economic: {
    id: 'economic',
    title: 'Economic Reports',
    subtitle: 'Comprehensive economic data analysis',
    badgeLabel: 'Bar Chart · Country Report',
    step1Title: 'Upload Economic Data',
    step1Subtitle: 'Upload CSV/Excel files and configure report parameters',
    step3Title: 'Economic Report',
    step3Subtitle: 'Full economic indicator breakdown',
    processingMessages: [
      '> Parsing uploaded CSV/Excel file...',
      '> Validating data schema and column headers...',
      '> Detecting currency denominations...',
      '> Cleaning and imputing missing values...',
      '> Computing YoY growth rates...',
      '> Cross-referencing World Bank baseline data...',
      '> Generating sector contribution breakdown...',
      '> Building comparative time series...',
      '> Applying report template...',
      '> Finalizing economic report...',
    ],
    agents: [
      { name: 'ParseAgent-1', role: 'Data Parser' },
      { name: 'CleanAgent-2', role: 'Data Cleaner' },
      { name: 'ReportAgent-3', role: 'Report Builder' },
    ],
  },

  upload: {
    id: 'upload',
    title: 'Upload & Extract',
    subtitle: 'OCR and document intelligence',
    badgeLabel: 'OCR · Key-Value Extraction',
    step1Title: 'Upload Document',
    step1Subtitle: 'Upload PDF or image files for extraction',
    step3Title: 'Extraction Results',
    step3Subtitle: 'Extracted text and key-value pairs',
    processingMessages: [
      '> Loading document processor...',
      '> Running OCR engine (Tesseract v5)...',
      '> Detecting document layout structure...',
      '> Extracting raw text content...',
      '> Identifying table regions...',
      '> Parsing key-value pairs...',
      '> Classifying document type...',
      '> Running entity recognition (NER)...',
      '> Extracting numeric values and dates...',
      '> Structuring output as JSON...',
      '> Extraction complete.',
    ],
    agents: [
      { name: 'OCRAgent-1', role: 'Text Extractor' },
      { name: 'NERAgent-2', role: 'Entity Recognizer' },
      { name: 'StructAgent-3', role: 'Data Structurer' },
    ],
  },
}
