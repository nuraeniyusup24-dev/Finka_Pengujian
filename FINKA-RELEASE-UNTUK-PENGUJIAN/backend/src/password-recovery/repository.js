import { db } from '../db.js'

const CONTACT_FIELDS = {
  email: { contact: 'email', verified: 'email_verified_at' },
  whatsapp: { contact: 'no_hp', verified: 'no_hp_verified_at' }
}

function destinationFor(channel, value) {
  if (channel === 'email') return String(value || '').trim().toLowerCase()
  const number = String(value || '').replace(/[\s()-]/g, '')
  if (/^08\d{8,11}$/.test(number)) return '+62' + number.slice(1)
  if (/^\+628\d{8,11}$/.test(number)) return number
  return ''
}

async function eligibleContact(userId, channel) {
  const field = CONTACT_FIELDS[channel]
  if (!field) return null
  const row = await db.prepare(`
    SELECT u.id, u.username, u.role, u.active,
      own.${field.contact} AS own_contact, own.${field.verified} AS own_verified,
      parent.${field.contact} AS parent_contact, parent.${field.verified} AS parent_verified
    FROM users u
    LEFT JOIN user_profiles own ON own.user_id = u.id
    LEFT JOIN siswa_profil sp ON sp.user_id = u.id
    LEFT JOIN user_profiles parent ON parent.user_id = sp.ortu_id
    WHERE u.id = ?
  `).get(userId)
  if (!row || Number(row.active) !== 1) return null
  const ownVerified = Boolean(row.own_verified && row.own_contact)
  const parentVerified = row.role === 'siswa' && Boolean(row.parent_verified && row.parent_contact)
  const contact = ownVerified ? row.own_contact : (parentVerified ? row.parent_contact : '')
  const destination = destinationFor(channel, contact)
  return destination ? { userId: Number(row.id), username: row.username, destination } : null
}

export const passwordRecoveryRepository = {
  async findVerifiedContact({ username, channel }) {
    const field = CONTACT_FIELDS[channel]
    if (!field || !username) return null
    const account = await db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    return account ? eligibleContact(account.id, channel) : null
  },

  async issueChallenge(challenge) {
    return db.transaction(async () => {
      const contact = await eligibleContact(challenge.userId, challenge.channel)
      if (!contact) return false
      const rate = await db.prepare(`
        INSERT INTO password_otp_rate_limits (user_id, channel, window_started_at, request_count, last_requested_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, channel) DO UPDATE SET
          window_started_at = CASE WHEN password_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE password_otp_rate_limits.window_started_at END,
          request_count = CASE WHEN password_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE password_otp_rate_limits.request_count + 1 END,
          last_requested_at = CURRENT_TIMESTAMP
        WHERE password_otp_rate_limits.last_requested_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
          AND (password_otp_rate_limits.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour' OR password_otp_rate_limits.request_count < 3)
        RETURNING user_id
      `).get(challenge.userId, challenge.channel)
      if (!rate) {
        const error = new Error('Permintaan OTP dibatasi. Coba lagi nanti.')
        error.code = 'rate_limited'
        throw error
      }
      await db.prepare(`UPDATE password_otp_challenges SET locked_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND channel = ? AND otp_used_at IS NULL AND locked_at IS NULL`)
        .run(challenge.userId, challenge.channel)
      await db.prepare(`INSERT INTO password_otp_challenges
        (id, user_id, channel, otp_digest, expires_at) VALUES (?, ?, ?, ?, ?)`)
        .run(challenge.challengeId, challenge.userId, challenge.channel, challenge.otpDigest, challenge.expiresAt)
      return true
    })()
  },

  async cancelChallenge(challengeId) {
    await db.prepare('UPDATE password_otp_challenges SET locked_at = CURRENT_TIMESTAMP WHERE id = ? AND otp_used_at IS NULL').run(challengeId)
  },

  async withLockedChallenge(challengeId, callback) {
    return db.transaction(async () => {
      const challenge = await db.prepare(`SELECT c.*, u.username FROM password_otp_challenges c
        JOIN users u ON u.id = c.user_id WHERE c.id = ?`).get(challengeId)
      const actions = {
        setAttempts: async (attempts, locked) => db.prepare(`UPDATE password_otp_challenges
          SET attempts = ?, locked_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE locked_at END WHERE id = ?`)
          .run(attempts, locked, challengeId),
        verifyOtp: async ({ resetTokenDigest, resetExpiresAt }) => db.prepare(`UPDATE password_otp_challenges
          SET otp_used_at = CURRENT_TIMESTAMP, reset_token_digest = ?, reset_expires_at = ? WHERE id = ?`)
          .run(resetTokenDigest, resetExpiresAt, challengeId),
        accountEligible: async () => Boolean(challenge && await eligibleContact(challenge.user_id, challenge.channel)),
        resetPassword: async (passwordHash) => {
          const update = await db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND active = 1").run(passwordHash, challenge?.user_id)
          if (update.changes !== 1) return false
          await db.prepare('UPDATE password_otp_challenges SET reset_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(challengeId)
          return true
        }
      }
      return callback(challenge, actions)
    })()
  }
}
