import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'

const OTP_TTL_MS = 5 * 60 * 1000
const GRANT_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

function digest(secret, purpose, value) {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex')
}

function equalDigest(a, b) {
  if (!a || !b || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export class PasswordRecoveryError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'PasswordRecoveryError'
    this.code = code
    this.status = status
  }
}

export function createPasswordRecoveryService({
  repository, provider, secret, now = () => Date.now(),
  makeOtp = () => String(randomInt(0, 1000000)).padStart(6, '0'),
  makeGrant = () => randomUUID()
}) {
  async function start({ username, channel }) {
    if (!['email', 'whatsapp'].includes(channel)) {
      throw new PasswordRecoveryError('invalid_channel', 'Pilih email atau WhatsApp.', 400)
    }
    if (!provider?.supports?.(channel) || !provider.isReady(channel)) {
      throw new PasswordRecoveryError('provider_unavailable', 'Pengiriman OTP untuk metode ini belum dikonfigurasi.', 503)
    }
    if (!secret || String(secret).length < 32) {
      throw new PasswordRecoveryError('otp_secret_unavailable', 'Layanan pemulihan password belum dikonfigurasi.', 503)
    }

    const challengeId = randomUUID()
    const account = await repository.findVerifiedContact({ username: String(username || '').trim(), channel })
    if (!account) return { challengeId, expiresInSeconds: OTP_TTL_MS / 1000 }

    const otp = makeOtp()
    if (!/^\d{6}$/.test(otp)) throw new Error('OTP generator must return 6 digits')
    const expiresAt = new Date(now() + OTP_TTL_MS)
    try {
      const issued = await repository.issueChallenge({
        challengeId, userId: account.userId, channel,
        otpDigest: digest(secret, 'otp', otp), expiresAt
      })
      if (!issued) return { challengeId, expiresInSeconds: OTP_TTL_MS / 1000 }
    } catch (error) {
      if (error.code === 'rate_limited') throw new PasswordRecoveryError('rate_limited', error.message, 429)
      throw error
    }

    try {
      const sent = await provider.sendOtp({ channel, destination: account.destination, code: otp, expiresInSeconds: OTP_TTL_MS / 1000 })
      if (sent !== true) throw new Error('OTP provider did not confirm delivery')
    } catch {
      await repository.cancelChallenge(challengeId)
      throw new PasswordRecoveryError('delivery_failed', 'OTP tidak dapat dikirim. Password tidak diubah.', 503)
    }
    return { challengeId, expiresInSeconds: OTP_TTL_MS / 1000 }
  }

  async function verify({ challengeId, otp }) {
    if (!/^\d{6}$/.test(String(otp || ''))) {
      throw new PasswordRecoveryError('invalid_otp', 'OTP tidak valid atau sudah kedaluwarsa.', 400)
    }
    if (!secret || String(secret).length < 32) {
      throw new PasswordRecoveryError('otp_secret_unavailable', 'Layanan pemulihan password belum dikonfigurasi.', 503)
    }
    const grant = makeGrant()
    const result = await repository.withLockedChallenge(challengeId, async (challenge, actions) => {
      const timestamp = now()
      if (!challenge || challenge.otp_used_at || new Date(challenge.expires_at).getTime() <= timestamp) return { error: 'invalid_otp' }
      if (challenge.locked_at || Number(challenge.attempts) >= MAX_ATTEMPTS) return { error: 'attempts_exceeded' }
      if (!await actions.accountEligible()) return { error: 'invalid_otp' }
      if (!equalDigest(challenge.otp_digest, digest(secret, 'otp', String(otp)))) {
        const attempts = Number(challenge.attempts) + 1
        await actions.setAttempts(attempts, attempts >= MAX_ATTEMPTS)
        return { error: attempts >= MAX_ATTEMPTS ? 'attempts_exceeded' : 'invalid_otp' }
      }
      await actions.verifyOtp({
        resetTokenDigest: digest(secret, 'grant', grant),
        resetExpiresAt: new Date(timestamp + GRANT_TTL_MS)
      })
      return { resetToken: grant, expiresInSeconds: GRANT_TTL_MS / 1000 }
    })
    if (result?.error) {
      const limited = result.error === 'attempts_exceeded'
      throw new PasswordRecoveryError(result.error, limited ? 'Batas percobaan OTP tercapai. Minta OTP baru.' : 'OTP tidak valid atau sudah kedaluwarsa.', limited ? 429 : 400)
    }
    if (!result) throw new PasswordRecoveryError('invalid_otp', 'OTP tidak valid atau sudah kedaluwarsa.', 400)
    return result
  }

  async function complete({ req, challengeId, resetToken, password, confirmation }) {
    const newPassword = String(password || '')
    if (newPassword.length < 8 || newPassword.length > 72 || newPassword !== String(confirmation || '')) {
      throw new PasswordRecoveryError('invalid_password', 'Password harus 8–72 karakter dan konfirmasi harus sama.', 400)
    }
    if (!secret || String(secret).length < 32) {
      throw new PasswordRecoveryError('otp_secret_unavailable', 'Layanan pemulihan password belum dikonfigurasi.', 503)
    }
    const result = await repository.withLockedChallenge(challengeId, async (challenge, actions) => {
      const timestamp = now()
      if (!challenge || !challenge.otp_used_at || challenge.reset_used_at || !challenge.reset_token_digest ||
        new Date(challenge.reset_expires_at).getTime() <= timestamp ||
        !equalDigest(challenge.reset_token_digest, digest(secret, 'grant', String(resetToken || '')))) return null
      if (!await actions.accountEligible()) return null
      const passwordHash = await bcrypt.hash(newPassword, 10)
      const updated = await actions.resetPassword(passwordHash)
      return updated ? { userId: Number(challenge.user_id), username: challenge.username } : null
    })
    if (!result) throw new PasswordRecoveryError('invalid_grant', 'Verifikasi OTP tidak valid atau sudah kedaluwarsa. Minta OTP baru.', 400)
    return result
  }

  return { start, verify, complete }
}
