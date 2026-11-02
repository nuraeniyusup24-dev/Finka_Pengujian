import { db } from '../db.js'
import { audit } from '../audit.js'
import bcrypt from 'bcryptjs'

const CONTACT_FIELDS = {
  email: { contact: 'email', verified: 'email_verified_at' },
  whatsapp: { contact: 'no_hp', verified: 'no_hp_verified_at' }
}

function destinationFor(channel, value) {
  if (channel === 'email') return String(value || '').trim().toLowerCase()
  if (channel === 'whatsapp') {
    const number = String(value || '').replace(/[\s()-]/g, '')
    if (/^08\d{8,11}$/.test(number)) return '+62' + number.slice(1)
    if (/^\+628\d{8,11}$/.test(number)) return number
  }
  return ''
}

export const pinRecoveryRepository = {
  async findVerifiedContact({ parentId, studentId, channel }) {
    const fields = CONTACT_FIELDS[channel]
    if (!fields) return { owned: false, verified: false, destination: '' }
    const row = await db.prepare(`
      SELECT p.${fields.contact} AS destination, p.${fields.verified} AS verified_at
      FROM siswa_profil sp
      JOIN users parent ON parent.id = sp.ortu_id AND parent.role = 'ortu'
      JOIN users student ON student.id = sp.user_id AND student.role = 'siswa'
      LEFT JOIN user_profiles p ON p.user_id = parent.id
      WHERE parent.id = ? AND student.id = ?
    `).get(parentId, studentId)
    return {
      owned: Boolean(row),
      verified: Boolean(row?.verified_at),
      destination: destinationFor(channel, row?.destination)
    }
  },

  async channelOptions({ parentId, studentId }) {
    const rows = await db.prepare(`
      SELECT p.email, p.email_verified_at, p.no_hp, p.no_hp_verified_at
      FROM siswa_profil sp
      JOIN users parent ON parent.id = sp.ortu_id AND parent.role = 'ortu'
      JOIN users student ON student.id = sp.user_id AND student.role = 'siswa'
      LEFT JOIN user_profiles p ON p.user_id = parent.id
      WHERE parent.id = ? AND student.id = ?
    `).get(parentId, studentId)
    if (!rows) return null
    return {
      email: { configured: Boolean(rows.email), verified: Boolean(rows.email_verified_at) },
      whatsapp: { configured: Boolean(destinationFor('whatsapp', rows.no_hp)), verified: Boolean(rows.no_hp_verified_at) }
    }
  },

  async issueChallenge(challenge) {
    await db.transaction(async () => {
      const verifiedField = challenge.channel === 'email' ? 'email_verified_at' : (challenge.channel === 'whatsapp' ? 'no_hp_verified_at' : null)
      if (!verifiedField) {
        const error = new Error('Metode OTP tidak valid'); error.code = 'not_owned'; throw error
      }
      const eligible = await db.prepare(`SELECT 1 FROM siswa_profil sp
        JOIN users parent ON parent.id = sp.ortu_id AND parent.role = 'ortu'
        JOIN users student ON student.id = sp.user_id AND student.role = 'siswa'
        JOIN user_profiles p ON p.user_id = parent.id
        WHERE sp.ortu_id = ? AND sp.user_id = ? AND p.${verifiedField} IS NOT NULL
`).get(challenge.parentId, challenge.studentId)
      if (!eligible) {
        const error = new Error('Relasi atau verifikasi kontak tidak tersedia'); error.code = 'not_owned'; throw error
      }
      const rate = await db.prepare(`
        INSERT INTO pin_otp_rate_limits (parent_id, student_id, channel, window_started_at, request_count, last_requested_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (parent_id, student_id, channel) DO UPDATE SET
          window_started_at = CASE WHEN pin_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE pin_otp_rate_limits.window_started_at END,
          request_count = CASE WHEN pin_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE pin_otp_rate_limits.request_count + 1 END,
          last_requested_at = CURRENT_TIMESTAMP
        WHERE pin_otp_rate_limits.last_requested_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
          AND (pin_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' OR pin_otp_rate_limits.request_count < 3)
        RETURNING parent_id
      `).get(challenge.parentId, challenge.studentId, challenge.channel)
      if (!rate) {
        const error = new Error('Permintaan OTP dibatasi. Coba lagi nanti.')
        error.code = 'rate_limited'
        throw error
      }
      await db.prepare(`UPDATE pin_otp_challenges SET locked_at = CURRENT_TIMESTAMP
        WHERE parent_id = ? AND student_id = ? AND channel = ? AND otp_used_at IS NULL AND locked_at IS NULL`)
        .run(challenge.parentId, challenge.studentId, challenge.channel)
      await db.prepare(`INSERT INTO pin_otp_challenges
        (id, parent_id, student_id, purpose, channel, otp_digest, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(challenge.challengeId, challenge.parentId, challenge.studentId, challenge.purpose, challenge.channel, challenge.otpDigest, challenge.expiresAt)
    })()
  },

  async cancelChallenge(challengeId) {
    await db.prepare('UPDATE pin_otp_challenges SET locked_at = CURRENT_TIMESTAMP WHERE id = ? AND otp_used_at IS NULL').run(challengeId)
  },

  async withLockedChallenge(challengeId, callback) {
    return db.transaction(async () => {
      const challenge = await db.prepare('SELECT * FROM pin_otp_challenges WHERE id = ?').get(challengeId)
      const actions = {
        setAttempts: async (attempts, locked) => db.prepare(`UPDATE pin_otp_challenges SET attempts = ?, locked_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE locked_at END WHERE id = ?`)
          .run(attempts, locked, challengeId),
        verifyOtp: async ({ resetTokenDigest, resetExpiresAt }) => db.prepare(`UPDATE pin_otp_challenges
          SET otp_used_at = CURRENT_TIMESTAMP, reset_token_digest = ?, reset_expires_at = ? WHERE id = ?`)
          .run(resetTokenDigest, resetExpiresAt, challengeId),
        stillOwned: async () => {
          const verifiedField = challenge?.channel === 'email' ? 'email_verified_at' : (challenge?.channel === 'whatsapp' ? 'no_hp_verified_at' : null)
          if (!verifiedField) return false
          return Boolean(await db.prepare(`SELECT 1 FROM siswa_profil sp
            JOIN users parent ON parent.id = sp.ortu_id AND parent.role = 'ortu'
            JOIN users student ON student.id = sp.user_id AND student.role = 'siswa'
            JOIN user_profiles p ON p.user_id = parent.id
            WHERE sp.user_id = ? AND sp.ortu_id = ? AND p.${verifiedField} IS NOT NULL
`).get(challenge.student_id, challenge.parent_id))
        },
        pinMatches: async (candidatePin) => {
          const student = await db.prepare("SELECT pin_hash FROM users WHERE id = ? AND role = 'siswa'").get(challenge?.student_id)
          return Boolean(student?.pin_hash && await bcrypt.compare(candidatePin, student.pin_hash))
        },
        resetPin: async ({ req, pinHash, parentId, studentId }) => {
          const update = await db.prepare("UPDATE users SET pin_hash = ? WHERE id = ? AND role = 'siswa'").run(pinHash, studentId)
          if (update.changes !== 1) throw new Error('Siswa tidak ditemukan')
          await db.prepare('UPDATE pin_otp_challenges SET reset_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(challengeId)
          await audit(req, 'RESET_PIN_ORTU', `Orang Tua #${parentId} mereset PIN siswa #${studentId}`, 'users', Number(studentId))
          await db.prepare(`INSERT INTO admin_notifications (kategori, judul, pesan, ref_user_id)
            VALUES (?, ?, ?, ?)`)
            .run('PIN_RESET', 'Reset PIN siswa berhasil', `Orang Tua #${parentId} berhasil mengatur ulang PIN siswa #${studentId}`, Number(studentId))
        }
      }
      return callback(challenge, actions)
    })()
  }
}

export function listVerifiedResetMethods(options, provider) {
  return Object.fromEntries(Object.entries(options).map(([channel, status]) => [channel, {
    providerAvailable: Boolean(provider?.supports?.(channel) && provider?.isReady?.(channel)),
    available: Boolean(status.verified && provider?.supports?.(channel) && provider?.isReady?.(channel)),
    contactConfigured: status.configured,
    contactVerified: status.verified
  }]))
}
