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

export type NotifyResult = {
  sent: boolean
  channel: 'WhatsApp' | 'SMS' | 'disabled' | 'none'
  recipient: string | null
  error?: string
}

// Robust applicant notifier shared by the manual officer/admin decision routes (the
// automated Communication Agent already resolves the recipient the same way). Rules:
//   • DEMO_NOTIFY_PHONE overrides the recipient in demo mode — that handset is the one
//     that JOINED the Twilio WhatsApp sandbox, so it actually receives messages. A raw
//     applicant phone that never joined the sandbox is silently dropped by Twilio — which
//     is exactly why an officer reject "sent" but never arrived.
//   • NOTIFICATIONS_ENABLED=false composes but does NOT send (0 Twilio credit).
//   • WhatsApp first; SMS only if WhatsApp throws (never both — one message per decision).
//   • Never throws — returns a structured result the caller logs / surfaces to the UI.
export async function notifyApplicant(input: {
  phone?: string | null
  message: string
  caseNumber: string
}): Promise<NotifyResult> {
  const recipient = process.env.DEMO_NOTIFY_PHONE || String(input.phone || '')
  if (process.env.NOTIFICATIONS_ENABLED === 'false') {
    return { sent: false, channel: 'disabled', recipient: recipient || null }
  }
  if (!recipient) {
    return { sent: false, channel: 'none', recipient: null, error: 'no recipient phone on file' }
  }
  try {
    await executeNotificationTool('send_whatsapp', {
      phone: recipient, message: input.message, caseNumber: input.caseNumber,
    })
    return { sent: true, channel: 'WhatsApp', recipient }
  } catch (waErr) {
    try {
      await executeNotificationTool('send_sms', { phone: recipient, message: input.message })
      return { sent: true, channel: 'SMS', recipient }
    } catch (smsErr) {
      console.warn(
        `[notifyApplicant] both channels failed case=${input.caseNumber} to=${recipient}: wa=${String(waErr)} sms=${String(smsErr)}`,
      )
      return { sent: false, channel: 'none', recipient, error: String(waErr) }
    }
  }
}
