/**
 * Legacy re-export shim — all vision logic has moved to lib/llm/vision.ts.
 * Kept so existing imports (pdf-extractor, document-agent, tests) continue to work
 * without any changes.
 */
export {
  assessDocumentAuthenticity,
  extractFieldsWithVision as extractFieldsWithGemini,
  isVisionConfigured as isGeminiConfigured,
} from './vision'

export type { GeminiOCRFields, VisionOCRFields } from './vision'
