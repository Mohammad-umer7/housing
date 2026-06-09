// MCP-compatible notification tool definitions.
// Wraps Twilio as structured tools.
// Replace execute() implementations to switch providers.

type NotificationToolInput = Record<string, unknown>

export const notificationTools = [
  {
    name: 'send_whatsapp',
    description: 'Send WhatsApp message to applicant with case decision',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        message: { type: 'string' },
        caseNumber: { type: 'string' },
      },
      required: ['phone', 'message', 'caseNumber'],
    },
    execute: async (input: { phone: string; message: string; caseNumber: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio')
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await client.messages.create({
        body: input.message,
        from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
        to: `whatsapp:${input.phone}`,
      })
      return { sent: true, phone: input.phone }
    },
  },
  {
    name: 'send_sms',
    description: 'Send SMS fallback if WhatsApp fails',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['phone', 'message'],
    },
    execute: async (input: { phone: string; message: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio')
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await client.messages.create({
        body: input.message,
        from: process.env.TWILIO_SMS_FROM,
        to: input.phone,
      })
      return { sent: true, phone: input.phone }
    },
  },
]

export async function executeNotificationTool(toolName: string, input: NotificationToolInput) {
  const tool = notificationTools.find(t => t.name === toolName)
  if (!tool) throw new Error(`Unknown notification tool: ${toolName}`)
  return await tool.execute(input as never)
}
