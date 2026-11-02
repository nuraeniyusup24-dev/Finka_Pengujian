/** Contract: supports(channel), isReady(channel), sendOtp({ channel, destination, code, expiresInSeconds }).
 * Delivery implementations must never persist/log the code or return it to a caller.
 */
export class DisabledOtpProvider {
  supports() { return false }
  isReady() { return false }
  async sendOtp() { return false }
}

class ResendEmailOtpAdapter {
  isReady() { return Boolean(process.env.RESEND_API_KEY && process.env.OTP_FROM_EMAIL) }
  async sendOtp({ destination, code, expiresInSeconds }) {
    if (!this.isReady()) return false
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: process.env.OTP_FROM_EMAIL,
        to: [destination],
        subject: 'Kode OTP Finka',
        text: `Kode OTP Anda: ${code}. Kode berlaku ${Math.ceil(expiresInSeconds / 60)} menit. Jangan bagikan kode ini kepada siapa pun.`,
        html: `<p>Kode OTP Finka Anda: <strong>${code}</strong></p><p>Kode berlaku ${Math.ceil(expiresInSeconds / 60)} menit. Jangan bagikan kode ini kepada siapa pun.</p>`
      })
    })
    return response.ok
  }
}

class WhatsAppCloudOtpAdapter {
  isReady() {
    return Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE)
  }
  async sendOtp({ destination, code, expiresInSeconds }) {
    if (!this.isReady()) return false
    const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v24.0'
    const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destination.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_OTP_TEMPLATE,
          language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'id' },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: code },
            { type: 'text', text: String(Math.ceil(expiresInSeconds / 60)) }
          ] }]
        }
      })
    })
    return response.ok
  }
}

export class OtpProviderAdapter {
  constructor(adapters = {}) { this.adapters = adapters }
  supports(channel) { return Boolean(this.adapters[channel]) }
  isReady(channel) { return Boolean(this.adapters[channel]?.isReady?.()) }
  async sendOtp(message) {
    const adapter = this.adapters[message.channel]
    if (!adapter || !adapter.isReady?.()) return false
    return adapter.sendOtp(message)
  }
}

export function configuredOtpProvider() {
  return new OtpProviderAdapter({
    email: new ResendEmailOtpAdapter(),
    whatsapp: new WhatsAppCloudOtpAdapter()
  })
}
