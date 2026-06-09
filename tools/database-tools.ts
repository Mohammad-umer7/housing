// MCP-compatible database tool definitions.
// Wraps data-layer.ts as structured tools.
// Any MCP server can replace these tool implementations.

import {
  upsertCaseDecision,
  createAuditLog,
  type CaseDecisionData,
  type AuditLogInput,
} from '@/lib/data-layer'
import { getApplicant } from '@/lib/integrations/source-systems'

type DatabaseToolInput = Record<string, unknown>

export const databaseTools = [
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
    execute: async (input: { caseNumber: string }) => {
      return await getApplicant(input.caseNumber)
    },
  },
  {
    name: 'update_case',
    description: 'Upsert case record with full decision data in database',
    input_schema: {
      type: 'object',
      properties: {
        caseNumber: { type: 'string' },
        caseData: { type: 'object' },
      },
      required: ['caseNumber', 'caseData'],
    },
    execute: async (input: { caseNumber: string; caseData: CaseDecisionData }) => {
      return await upsertCaseDecision(input.caseNumber, input.caseData)
    },
  },
  {
    name: 'create_audit_log',
    description: 'Write immutable audit log entry for a case action',
    input_schema: {
      type: 'object',
      properties: {
        case_number: { type: 'string' },
        action: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['case_number', 'action'],
    },
    execute: async (input: AuditLogInput) => {
      return await createAuditLog(input)
    },
  },
]

export async function executeDatabaseTool(toolName: string, input: DatabaseToolInput) {
  const tool = databaseTools.find(t => t.name === toolName)
  if (!tool) throw new Error(`Unknown database tool: ${toolName}`)
  return await tool.execute(input as never)
}
