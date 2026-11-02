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

export class PinRecoveryError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'PinRecoveryError'
    this.code = code
    this.status = status
  }
}

export function createPinRecoveryService({ repository, provider, secret, now = () => Date.now(), makeOtp = () => String(randomInt(0, 1000000)).padStart(6, '0'), makeGrant = () => randomUUID() }) {
  async function start({ parentId, studentId, channel }) {
    const contact = await repository.findVerifiedContact({ parentId, studentId, channel })
    if (!contact?.owned) throw new PinRecoveryError('not_owned', 'Siswa bukan anak dari akun Orang Tua ini', 404)
    if (!contact.verified || !contact.destination) throw new PinRecoveryError('contact_unverified', 'Kontak Orang Tua belum terverifikasi untuk metode ini', 409)
    if (!provider?.supports?.(channel) || !provider.isReady(channel)) {
      throw new PinRecoveryError('provider_unavailable', 'Layanan pengiriman OTP belum dikonfigurasi', 503)
    }
    if (!secret || String(secret).length < 32) throw new PinRecoveryError('otp_secret_unavailable', 'Layanan pemulihan PIN belum dikonfigurasi', 503)

    const otp = makeOtp()
    if (!/^\d{6}$/.test(otp)) throw new Error('OTP generator must return 6 digits')
    const challengeId = randomUUID()
    const expiresAt = new Date(now() + OTP_TTL_MS)
    try {
      await repository.issueChallenge({
        challengeId, parentId, studentId, channel, purpose: 'pin_reset',
        otpDigest: digest(secret, 'otp', otp), expiresAt
      })
    } catch (error) {
      if (error.code === 'rate_limited') throw new PinRecoveryError('rate_limited', error.message, 429)
      if (error.code === 'not_owned') throw new PinRecoveryError('not_owned', 'Siswa atau kontak tidak memenuhi syarat pemulihan PIN', 404)
      throw error
    }
    try {
      const sent = await provider.sendOtp({ channel, destination: contact.destination, code: otp, expiresInSeconds: OTP_TTL_MS / 1000 })
      if (sent !== true) throw new Error('OTP provider did not confirm delivery')
    } catch {
      await repository.cancelChallenge(challengeId)
      throw new PinRecoveryError('delivery_failed', 'OTP tidak dapat dikirim. PIN tidak diubah.', 503)
    }
    return { challengeId, expiresInSeconds: OTP_TTL_MS / 1000 }
  }

  async function verify({ parentId, studentId, challengeId, otp }) {
    if (!/^\d{6}$/.test(String(otp || ''))) throw new PinRecoveryError('invalid_otp', 'OTP tidak valid atau sudah kedaluwarsa', 400)
    if (!secret || String(secret).length < 32) throw new PinRecoveryError('otp_secret_unavailable', 'Layanan pemulihan PIN belum dikonfigurasi', 503)
    const grant = makeGrant()
    const result = await repository.withLockedChallenge(challengeId, async (challenge, actions) => {
      const timestamp = now()
      if (!challenge || Number(challenge.parent_id) !== Number(parentId) || Number(challenge.student_id) !== Number(studentId) || challenge.purpose !== 'pin_reset') return { error: 'invalid_otp' }
      if (challenge.otp_used_at || new Date(challenge.expires_at).getTime() <= timestamp) return { error: 'invalid_otp' }
      if (challenge.locked_at || Number(challenge.attempts) >= MAX_ATTEMPTS) return { error: 'attempts_exceeded' }
      if (!await actions.stillOwned()) return { error: 'not_owned' }
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
    if (result?.error === 'not_owned') throw new PinRecoveryError('not_owned', 'Siswa atau kontak tidak lagi memenuhi syarat pemulihan PIN', 404)
    if (result?.error) throw new PinRecoveryError(result.error, result.error === 'attempts_exceeded' ? 'Batas percobaan OTP tercapai. Minta OTP baru.' : 'OTP tidak valid atau sudah kedaluwarsa', result.error === 'attempts_exceeded' ? 429 : 400)
    if (!result) throw new PinRecoveryError('invalid_otp', 'OTP tidak valid atau sudah kedaluwarsa', 400)
    return result
  }

  async function complete({ req, parentId, studentId, challengeId, resetToken, pin, confirmation }) {
    if (!/^\d{6}$/.test(String(pin || '')) || String(pin) !== String(confirmation || '')) {
      throw new PinRecoveryError('invalid_pin', 'PIN baru dan konfirmasi harus sama dan terdiri dari 6 digit', 400)
    }
    if (!secret || String(secret).length < 32) throw new PinRecoveryError('otp_secret_unavailable', 'Layanan pemulihan PIN belum dikonfigurasi', 503)
    const result = await repository.withLockedChallenge(challengeId, async (challenge, actions) => {
      const timestamp = now()
      if (!challenge || Number(challenge.parent_id) !== Number(parentId) || Number(challenge.student_id) !== Number(studentId) || challenge.purpose !== 'pin_reset') return { error: 'invalid_grant' }
      if (!challenge.otp_used_at || challenge.reset_used_at || !challenge.reset_token_digest || new Date(challenge.reset_expires_at).getTime() <= timestamp || !equalDigest(challenge.reset_token_digest, digest(secret, 'grant', String(resetToken || '')))) return { error: 'invalid_grant' }
      if (!await actions.stillOwned()) return { error: 'not_owned' }
      if (await actions.pinMatches(String(pin))) return { error: 'pin_reused' }
      const pinHash = await bcrypt.hash(String(pin), 10)
      await actions.resetPin({ req, pinHash, parentId, studentId })
      return { ok: true }
    })
    if (result?.error === 'not_owned') throw new PinRecoveryError('not_owned', 'Siswa bukan anak dari akun Orang Tua ini', 404)
    if (result?.error === 'pin_reused') throw new PinRecoveryError('pin_reused', 'PIN baru harus berbeda dari PIN yang saat ini tersimpan', 400)
    if (result?.error || !result) throw new PinRecoveryError('invalid_grant', 'Verifikasi OTP tidak valid atau sudah kedaluwarsa. Minta OTP baru.', 400)
    return { pesan: 'PIN pembayaran berhasil diatur ulang' }
  }

  return { start, verify, complete }
}
