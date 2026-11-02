import test from 'node:test'
import assert from 'node:assert/strict'
import { configuredOtpProvider } from '../src/pin-recovery/provider.js'

const ENV_KEYS = [
  'RESEND_API_KEY',
  'OTP_FROM_EMAIL',
  'WHATSAPP_CLOUD_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_OTP_TEMPLATE',
  'WHATSAPP_OTP_TEMPLATE_LANGUAGE',
  'WHATSAPP_GRAPH_API_VERSION'
]

function configure(t, values) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  const previousFetch = globalThis.fetch
  for (const key of ENV_KEYS) {
    if (key in values) process.env[key] = values[key]
    else delete process.env[key]
  }
  t.after(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    globalThis.fetch = previousFetch
  })
}

test('Resend mengirim OTP email dan melaporkan respons provider', async (t) => {
  configure(t, {
    RESEND_API_KEY: 're_test_key',
    OTP_FROM_EMAIL: 'Finka <otp@example.test>'
  })
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true }
  }

  const provider = configuredOtpProvider()
  assert.equal(provider.isReady('email'), true)
  assert.equal(await provider.sendOtp({
    channel: 'email',
    destination: 'parent@example.test',
    code: '123456',
    expiresInSeconds: 300
  }), true)
  assert.equal(request.url, 'https://api.resend.com/emails')
  assert.equal(request.options.headers.Authorization, 'Bearer re_test_key')
  assert.equal(request.options.signal instanceof AbortSignal, true)
  const message = JSON.parse(request.options.body)
  assert.deepEqual(message.to, ['parent@example.test'])
  assert.match(message.text, /123456/)
  assert.match(message.text, /5 menit/)
})

test('WhatsApp Cloud mengirim OTP ke template dan menormalkan nomor tujuan', async (t) => {
  configure(t, {
    WHATSAPP_CLOUD_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_OTP_TEMPLATE: 'finka_otp',
    WHATSAPP_OTP_TEMPLATE_LANGUAGE: 'id',
    WHATSAPP_GRAPH_API_VERSION: 'v24.0'
  })
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true }
  }

  const provider = configuredOtpProvider()
  assert.equal(provider.isReady('whatsapp'), true)
  assert.equal(await provider.sendOtp({
    channel: 'whatsapp',
    destination: '+628123456789',
    code: '654321',
    expiresInSeconds: 300
  }), true)
  assert.equal(request.url, 'https://graph.facebook.com/v24.0/123456789/messages')
  assert.equal(request.options.headers.Authorization, 'Bearer test-token')
  const message = JSON.parse(request.options.body)
  assert.equal(message.to, '628123456789')
  assert.equal(message.template.name, 'finka_otp')
  assert.deepEqual(message.template.components[0].parameters, [
    { type: 'text', text: '654321' },
    { type: 'text', text: '5' }
  ])
})

test('provider yang belum lengkap atau menolak request tidak dianggap berhasil', async (t) => {
  configure(t, { RESEND_API_KEY: 're_test_key' })
  const provider = configuredOtpProvider()
  assert.equal(provider.isReady('email'), false)
  assert.equal(await provider.sendOtp({
    channel: 'email',
    destination: 'parent@example.test',
    code: '123456',
    expiresInSeconds: 300
  }), false)

  process.env.OTP_FROM_EMAIL = 'Finka <otp@example.test>'
  globalThis.fetch = async () => ({ ok: false, status: 401 })
  assert.equal(await provider.sendOtp({
    channel: 'email',
    destination: 'parent@example.test',
    code: '123456',
    expiresInSeconds: 300
  }), false)
})
