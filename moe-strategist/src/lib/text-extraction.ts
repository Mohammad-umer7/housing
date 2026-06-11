import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

// Use local worker via unpkg CDN — avoids CORS issues with local node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export interface ExtractedData {
  rawText: string
  metrics: MetricData[]
  tables: TableData[]
  keyValues: KeyValuePair[]
  summary: string
}

export interface MetricData {
  label: string
  value: string | number
  unit?: string
  type: 'currency' | 'percentage' | 'number' | 'text'
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface KeyValuePair {
  key: string
  value: string
}

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pageTexts: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      // Reconstruct text preserving line breaks by grouping items by Y position
      const itemsByLine = new Map<number, string[]>()
      for (const item of textContent.items as { str: string; transform: number[] }[]) {
        const y = Math.round(item.transform[5] / 4) * 4 // quantise to 4px grid
        if (!itemsByLine.has(y)) itemsByLine.set(y, [])
        itemsByLine.get(y)!.push(item.str)
      }

      // Sort lines top-to-bottom (PDF y-axis is inverted)
      const sortedYs = [...itemsByLine.keys()].sort((a, b) => b - a)
      const lines = sortedYs.map(y => itemsByLine.get(y)!.join(' ').trim()).filter(Boolean)
      pageTexts.push(lines.join('\n'))
    }

    const full = pageTexts.join('\n\n').trim()
    // Clean up common PDF artefacts: ligatures, broken encoding
    return full
      .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
      .replace(/â€"/g, '—').replace(/â€œ/g, '"').replace(/â€/g, '"')
      .replace(/Â£/g, '£').replace(/â‚¬/g, '€').replace(/Â©/g, '©')
      .replace(/[ \t]{2,}/g, ' ')
      || 'No text found in PDF'
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

export async function extractTextFromImage(file: File): Promise<string> {
  try {
    // Detect Arabic/RTL content by filename or just run both eng+ara
    const isLikelyArabic = /[\u0600-\u06FF]/.test(file.name)
    const lang = isLikelyArabic ? 'ara+eng' : 'eng'

    const { data } = await Tesseract.recognize(file, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // progress available as m.progress (0..1)
        }
      },
    })

    // Clean up Tesseract output
    const cleaned = (data.text || '')
      .replace(/\f/g, '\n')           // form-feeds → newlines
      .replace(/[ \t]{2,}/g, ' ')     // collapse horizontal whitespace
      .replace(/\n{3,}/g, '\n\n')     // collapse excessive blank lines
      .trim()

    return cleaned || 'No text found in image'
  } catch (error) {
    console.error('Error extracting text from image:', error)
    throw new Error('Failed to extract text from image')
  }
}

// Extract valuable structured data from text
export function extractStructuredData(text: string): ExtractedData {
  const metrics: MetricData[] = []
  const keyValues: KeyValuePair[] = []

  // Currency values
  const currencyPattern = /(?:\$|\u20AC|\u00A3|AED|USD|EUR|GBP|SAR|NOK)\s*[\d,]+(?:\.\d+)?(?:\s*(?:[BbMmTt]illion|[Bb]n|[Mm]n))?/g
  const currencyMatches = text.match(currencyPattern) ?? []
  currencyMatches.forEach((match) => {
    metrics.push({ label: 'Currency Value', value: match.trim(), type: 'currency' })
  })

  // Percentages
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g
  let m: RegExpExecArray | null
  while ((m = percentPattern.exec(text)) !== null) {
    metrics.push({ label: 'Percentage', value: m[0], unit: '%', type: 'percentage' })
  }

  // Large numbers
  const numberPattern = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{5,}(?:\.\d+)?\b/g
  const numberMatches = text.match(numberPattern) ?? []
  numberMatches.slice(0, 10).forEach((match) => {
    const num = parseFloat(match.replace(/,/g, ''))
    if (num > 1000) metrics.push({ label: 'Large Number', value: match, type: 'number' })
  })

  // Key-value pairs
  const kvPattern = /^([A-Za-z][A-Za-z\s\/\-]{2,48}?)[\s:]+([^\n]{3,100})$/gm
  while ((m = kvPattern.exec(text)) !== null) {
    const key = m[1].trim().replace(/\s+/g, ' ')
    const value = m[2].trim()
    if (key.split(' ').length > 6) continue
    if (value.length > 120) continue
    if (!keyValues.find(kv => kv.key === key)) keyValues.push({ key, value })
  }

  const summary = `Extracted ${metrics.length} metrics and ${keyValues.length} key-value pairs from ${Math.ceil(text.length / 100)} text blocks.`

  return {
    rawText: text,
    metrics: metrics.slice(0, 30),
    tables: [],
    keyValues: keyValues.slice(0, 20),
    summary,
  }
}
export async function extractDataFromPDF(file: File): Promise<ExtractedData> {
  const rawText = await extractTextFromPDF(file)
  return extractStructuredData(rawText)
}

export async function extractDataFromImage(file: File): Promise<ExtractedData> {
  const rawText = await extractTextFromImage(file)
  return extractStructuredData(rawText)
}

export async function extractData(file: File): Promise<ExtractedData> {
  if (file.type === 'application/pdf') {
    return extractDataFromPDF(file)
  } else if (file.type.startsWith('image/')) {
    return extractDataFromImage(file)
  } else {
    throw new Error('Unsupported file type')
  }
}

export async function extractText(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return extractTextFromPDF(file)
  } else if (file.type.startsWith('image/')) {
    return extractTextFromImage(file)
  } else {
    throw new Error('Unsupported file type')
  }
}
