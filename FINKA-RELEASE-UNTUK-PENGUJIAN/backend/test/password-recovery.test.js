import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { createPasswordRecoveryService, PasswordRecoveryError } from '../src/password-recovery/service.js'

const SECRET_FOR_TESTS_ONLY = 'password-recovery-unit-test-secret'

class FakeOtpProvider {
  code = null
  supports(channel) { return ['email', 'whatsapp'].includes(channel) }
  isReady(channel) { return this.supports(channel) }
  async sendOtp({ code }) { this.code = code; return true }
}

class MemoryRepository {
  constructor() {
    this.challenges = new Map()
    this.passwordHash = bcrypt.hashSync('old-password', 4)
    this.cancelled = []
  }
  async findVerifiedContact({ username, channel }) {
    return username === 'person' && channel === 'email'
      ? { userId: 4, destination: 'person@example.test' }
      : null
  }
  async issueChallenge(challenge) {
    this.challenges.set(challenge.challengeId, {
      id: challenge.challengeId, user_id: challenge.userId, username: 'person',
      otp_digest: challenge.otpDigest, expires_at: challenge.expiresAt, attempts: 0,
      otp_used_at: null, locked_at: null, reset_token_digest: null, reset_expires_at: null, reset_used_at: null
    })
    return true
  }
  async cancelChallenge(id) { this.cancelled.push(id) }
  async withLockedChallenge(id, callback) {
    const challenge = this.challenges.get(id)
    const actions = {
      setAttempts: async (attempts, locked) => { challenge.attempts = attempts; if (locked) challenge.locked_at = new Date() },
      verifyOtp: async ({ resetTokenDigest, resetExpiresAt }) => {
        challenge.otp_used_at = new Date()
        challenge.reset_token_digest = resetTokenDigest
        challenge.reset_expires_at = resetExpiresAt
      },
      accountEligible: async () => true,
      resetPassword: async (passwordHash) => {
        this.passwordHash = passwordHash
        challenge.reset_used_at = new Date()
        return true
      }
    }
    return callback(challenge, actions)
  }
}

function fixture() {
  let timestamp = Date.parse('2026-01-01T00:00:00Z')
  let grantNumber = 0
  const repository = new MemoryRepository()
  const provider = new FakeOtpProvider()
  const service = createPasswordRecoveryService({
    repository, provider, secret: SECRET_FOR_TESTS_ONLY,
    now: () => timestamp, makeOtp: () => '482913',
    makeGrant: () => `opaque-grant-${++grantNumber}`
  })
  return { service, repository, provider, advance: (ms) => { timestamp += ms } }
}

async function request(fx) {
  const result = await fx.service.start({ username: 'person', channel: 'email' })
  assert.equal(result.expiresInSeconds, 300)
  assert.equal(fx.provider.code, '482913')
  return result.challengeId
}

test('OTP verified menghasilkan grant satu kali dan password diganti', async () => {
  const fx = fixture()
  const challengeId = await request(fx)
  const verification = await fx.service.verify({ challengeId, otp: fx.provider.code })
  assert.equal(JSON.stringify(verification).includes(fx.provider.code), false)
  const result = await fx.service.complete({
    req: {}, challengeId, resetToken: verification.resetToken,
    password: 'new-password-123', confirmation: 'new-password-123'
  })
  assert.equal(result.userId, 4)
  assert.equal(await bcrypt.compare('new-password-123', fx.repository.passwordHash), true)
  await assert.rejects(
    () => fx.service.complete({ challengeId, resetToken: verification.resetToken, password: 'another-pass', confirmation: 'another-pass' }),
    (error) => error.code === 'invalid_grant'
  )
})

test('username tanpa kontak eligible tidak membuat challenge atau mengirim OTP', async () => {
  const fx = fixture()
  const result = await fx.service.start({ username: 'missing', channel: 'email' })
  assert.equal(fx.repository.challenges.size, 0)
  assert.equal(fx.provider.code, null)
  await assert.rejects(
    () => fx.service.verify({ challengeId: result.challengeId, otp: '482913' }),
    (error) => error.code === 'invalid_otp'
  )
})

test('OTP salah dibatasi percobaannya dan OTP kedaluwarsa ditolak', async () => {
  const fx = fixture()
  const challengeId = await request(fx)
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(() => fx.service.verify({ challengeId, otp: '000000' }), PasswordRecoveryError)
  }
  await assert.rejects(
    () => fx.service.verify({ challengeId, otp: fx.provider.code }),
    (error) => error.code === 'attempts_exceeded'
  )

  const second = fixture()
  const expiringChallenge = await request(second)
  second.advance(5 * 60 * 1000 + 1)
  await assert.rejects(
    () => second.service.verify({ challengeId: expiringChallenge, otp: second.provider.code }),
    (error) => error.code === 'invalid_otp'
  )
})

test('password salah konfirmasi atau panjang tidak dapat dipasang', async () => {
  const fx = fixture()
  const challengeId = await request(fx)
  const verification = await fx.service.verify({ challengeId, otp: fx.provider.code })
  await assert.rejects(
    () => fx.service.complete({ challengeId, resetToken: verification.resetToken, password: 'short', confirmation: 'short' }),
    (error) => error.code === 'invalid_password'
  )
  assert.equal(await bcrypt.compare('old-password', fx.repository.passwordHash), true)
})
