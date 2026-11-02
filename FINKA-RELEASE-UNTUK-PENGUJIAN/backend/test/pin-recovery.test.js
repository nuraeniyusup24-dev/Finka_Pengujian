import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { createPinRecoveryService, PinRecoveryError } from '../src/pin-recovery/service.js'

const SECRET_FOR_TESTS_ONLY = 'local-unit-test-secret-that-is-not-used-by-server'

class FakeOtpProvider {
  code = null
  supports(channel) { return channel === 'email' }
  isReady(channel) { return this.supports(channel) }
  async sendOtp({ code }) { this.code = code; return true }
}

class MemoryRepository {
  constructor(now) {
    this.now = now
    this.challenges = new Map()
    this.rates = new Map()
    this.parentId = 7
    this.studentId = 19
    this.pinHash = bcrypt.hashSync('111111', 4)
    this.audit = []
    this.notifications = []
    this.ledger = [{ type: 'existing', amount: 1000 }]
  }
  async findVerifiedContact({ parentId, studentId, channel }) {
    const owned = Number(parentId) === this.parentId && Number(studentId) === this.studentId
    return { owned, verified: owned && channel === 'email', destination: owned && channel === 'email' ? 'parent@example.test' : '' }
  }
  async issueChallenge(challenge) {
    const key = `${challenge.parentId}:${challenge.studentId}:${challenge.channel}`
    const rate = this.rates.get(key)
    const timestamp = this.now()
    if (rate && (timestamp - rate.last < 60_000 || (timestamp - rate.window < 3_600_000 && rate.count >= 3))) {
      const error = new Error('rate limited'); error.code = 'rate_limited'; throw error
    }
    this.rates.set(key, !rate || timestamp - rate.window >= 3_600_000
      ? { window: timestamp, count: 1, last: timestamp }
      : { ...rate, count: rate.count + 1, last: timestamp })
    this.challenges.set(challenge.challengeId, {
      id: challenge.challengeId, parent_id: challenge.parentId, student_id: challenge.studentId,
      purpose: challenge.purpose, channel: challenge.channel, otp_digest: challenge.otpDigest,
      expires_at: challenge.expiresAt, attempts: 0, otp_used_at: null, locked_at: null,
      reset_token_digest: null, reset_expires_at: null, reset_used_at: null
    })
  }
  async cancelChallenge(id) { const item = this.challenges.get(id); if (item) item.locked_at = new Date(this.now()) }
  async withLockedChallenge(id, callback) {
    const challenge = this.challenges.get(id)
    const actions = {
      setAttempts: async (attempts, locked) => { challenge.attempts = attempts; if (locked) challenge.locked_at = new Date(this.now()) },
      verifyOtp: async ({ resetTokenDigest, resetExpiresAt }) => { challenge.otp_used_at = new Date(this.now()); challenge.reset_token_digest = resetTokenDigest; challenge.reset_expires_at = resetExpiresAt },
      stillOwned: async () => Number(challenge?.parent_id) === this.parentId && Number(challenge?.student_id) === this.studentId,
      pinMatches: async (candidatePin) => bcrypt.compare(candidatePin, this.pinHash),
      resetPin: async ({ pinHash, parentId, studentId }) => {
        this.pinHash = pinHash
        challenge.reset_used_at = new Date(this.now())
        this.audit.push(`RESET_PIN_ORTU parent#${parentId} siswa#${studentId}`)
        this.notifications.push(`PIN reset siswa#${studentId}`)
      }
    }
    return callback(challenge, actions)
  }
}

function fixture() {
  let timestamp = Date.parse('2026-01-01T00:00:00Z')
  const now = () => timestamp
  const repository = new MemoryRepository(now)
  const provider = new FakeOtpProvider()
  let grantSequence = 0
  const service = createPinRecoveryService({
    repository, provider, secret: SECRET_FOR_TESTS_ONLY, now,
    makeOtp: () => '482913', makeGrant: () => `opaque-reset-grant-${++grantSequence}`
  })
  return { service, repository, provider, advance: (ms) => { timestamp += ms } }
}

async function start(fx) {
  const result = await fx.service.start({ parentId: 7, studentId: 19, channel: 'email' })
  assert.deepEqual(Object.keys(result).sort(), ['challengeId', 'expiresInSeconds'])
  assert.equal(fx.provider.code, '482913')
  return result
}

test('OTP valid hanya menghasilkan grant; notifikasi baru dibuat setelah reset berhasil dan ledger tetap', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  const verified = await fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code })
  assert.equal(fx.repository.notifications.length, 0)
  await assert.rejects(() => fx.service.complete({ req: {}, parentId: 7, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '222222', confirmation: '333333' }), PinRecoveryError)
  assert.equal(fx.repository.notifications.length, 0)
  const result = await fx.service.complete({ req: {}, parentId: 7, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '222222', confirmation: '222222' })
  assert.equal(JSON.stringify(result).includes('222222'), false)
  assert.equal(await bcrypt.compare('111111', fx.repository.pinHash), false)
  assert.equal(await bcrypt.compare('222222', fx.repository.pinHash), true)
  assert.equal(fx.repository.notifications.length, 1)
  assert.equal(fx.repository.audit.length, 1)
  assert.deepEqual(fx.repository.ledger, [{ type: 'existing', amount: 1000 }])
  assert.equal(JSON.stringify(fx.repository.audit).includes('222222'), false)
  assert.equal(JSON.stringify(fx.repository.audit).includes(fx.provider.code), false)
  await assert.rejects(() => fx.service.complete({ req: {}, parentId: 7, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '333333', confirmation: '333333' }), (e) => e.code === 'invalid_grant')
  assert.equal(fx.repository.notifications.length, 1)
})

test('PIN baru yang sama dengan PIN lama ditolak', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  const verified = await fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code })
  await assert.rejects(() => fx.service.complete({ req: {}, parentId: 7, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '111111', confirmation: '111111' }), (e) => e.code === 'pin_reused')
  assert.equal(await bcrypt.compare('111111', fx.repository.pinHash), true)
  assert.equal(fx.repository.notifications.length, 0)
})

test('OTP salah menambah percobaan dan challenge dikunci setelah batas percobaan', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  for (let i = 0; i < 5; i++) await assert.rejects(() => fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: '000000' }), PinRecoveryError)
  await assert.rejects(() => fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code }), (e) => e.code === 'attempts_exceeded')
  assert.equal(fx.repository.challenges.get(challengeId).attempts, 5)
})

test('OTP kedaluwarsa ditolak', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  fx.advance(5 * 60 * 1000 + 1)
  await assert.rejects(() => fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code }), (e) => e.code === 'invalid_otp')
})

test('OTP yang sudah dipakai untuk verifikasi tidak dapat dipakai ulang', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  await fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code })
  await assert.rejects(() => fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code }), (e) => e.code === 'invalid_otp')
})

test('permintaan OTP dibatasi cooldown dan maksimum tiga per jam', async () => {
  const fx = fixture()
  await start(fx)
  await assert.rejects(() => start(fx), (e) => e.code === 'rate_limited')
  fx.advance(60_000)
  await start(fx)
  fx.advance(60_000)
  await start(fx)
  fx.advance(60_000)
  await assert.rejects(() => start(fx), (e) => e.code === 'rate_limited')
})

test('peminta tidak dapat meminta OTP untuk anak yang bukan miliknya', async () => {
  const fx = fixture()
  await assert.rejects(() => fx.service.start({ parentId: 7, studentId: 20, channel: 'email' }), (e) => e.code === 'not_owned')
  assert.equal(fx.provider.code, null)
})

test('grant terikat pada Orang Tua dan siswa serta kedaluwarsa', async () => {
  const fx = fixture()
  const { challengeId } = await start(fx)
  await assert.rejects(() => fx.service.verify({ parentId: 8, studentId: 19, challengeId, otp: fx.provider.code }), (e) => e.code === 'invalid_otp')
  const verified = await fx.service.verify({ parentId: 7, studentId: 19, challengeId, otp: fx.provider.code })
  await assert.rejects(() => fx.service.complete({ req: {}, parentId: 8, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '222222', confirmation: '222222' }), (e) => e.code === 'invalid_grant')
  fx.advance(5 * 60 * 1000 + 1)
  await assert.rejects(() => fx.service.complete({ req: {}, parentId: 7, studentId: 19, challengeId, resetToken: verified.resetToken, pin: '222222', confirmation: '222222' }), (e) => e.code === 'invalid_grant')
  assert.equal(fx.repository.notifications.length, 0)
})

test('sender yang tidak tersedia gagal tertutup tanpa membuat challenge atau mengirim OTP', async () => {
  const fx = fixture()
  const disabledProvider = { supports: () => false, isReady: () => false, sendOtp: async () => false }
  const service = createPinRecoveryService({ repository: fx.repository, provider: disabledProvider, secret: SECRET_FOR_TESTS_ONLY })
  await assert.rejects(() => service.start({ parentId: 7, studentId: 19, channel: 'email' }), (e) => e.code === 'provider_unavailable')
  assert.equal(fx.repository.challenges.size, 0)
})
