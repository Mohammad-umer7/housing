// Real PDF text extraction using pdfjs-dist (server-side only).
// Falls back to empty string on any extraction failure — pipeline continues.

import { z } from 'zod'
import { getStructuredModel } from './llm/client'

const SalaryCertificateSchema = z.object({
  employeeName: z.string().nullable(),
  monthlySalary: z.number().nullable(),
  employerName: z.string().nullable(),
  issueDate: z.string().nullable(),
  confidence: z.number(),
})

export async function extractTextFromPDF(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    // unpdf wraps a serverless-friendly pdfjs build — no worker-loading headaches in
    // the Next.js server runtime (raw pdfjs-dist fails to load its ESM worker there).
    const { getDocumentProxy, extractText } = await import('unpdf')
    // slice(0) hands pdfjs a private copy; it transfers/detaches the buffer it is
    // given, which would otherwise break a subsequent read of the same upload.
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer.slice(0)))
    const { text } = await extractText(pdf, { mergePages: true })
    return (text || '').trim()
  } catch (error) {
    console.error('[pdf-extractor] extraction failed:', error)
    return ''
  }
}

export async function extractSalaryCertificateFields(
  pdfText: string
): Promise<{
  employeeName: string | null
  monthlySalary: number | null
  employerName: string | null
  issueDate: string | null
  confidence: number
}> {
  const fallback = { employeeName: null, monthlySalary: null, employerName: null, issueDate: null, confidence: 0 }
  if (!pdfText || pdfText.length < 20) return fallback

  const prompt = `Extract the following fields from this salary certificate. Use null for any field you cannot find, and a confidence between 0 and 1.

Certificate text:
${pdfText.slice(0, 2000)}`

  try {
    const model = getStructuredModel(SalaryCertificateSchema, { temperature: 0, maxTokens: 300 })
    const parsed = await model.invoke([
      ['system', 'You extract structured fields from UAE salary certificates.'],
      ['human', prompt],
    ])
    return parsed ?? fallback
  } catch {
    return fallback
  }
}
