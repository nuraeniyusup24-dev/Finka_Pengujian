import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { buatToken, wajibLogin } from '../middleware/auth.js'
import { audit } from '../audit.js'
import { configuredOtpProvider } from '../pin-recovery/provider.js'
import { createPasswordRecoveryService, PasswordRecoveryError } from '../password-recovery/service.js'
import { passwordRecoveryRepository } from '../password-recovery/repository.js'

export const authRouter = Router()

const passwordRecovery = createPasswordRecoveryService({
  repository: passwordRecoveryRepository,
  provider: configuredOtpProvider(),
  secret: process.env.PIN_OTP_SECRET
})

function passwordRecoveryFailure(res, error) {
  if (error instanceof PasswordRecoveryError) return res.status(error.status).json({ error: error.message })
  console.error('Operasi pemulihan password gagal (kesalahan internal).')
  return res.status(500).json({ error: 'Operasi pemulihan password gagal.' })
}

authRouter.post('/login', async (req, res) => {
  const identifier = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Nama lengkap/username dan password wajib diisi' })
  }

  let user = await db.prepare('SELECT * FROM users WHERE username = ?').get(identifier)
  if (!user) {
    const matches = await db.prepare(
      'SELECT * FROM users WHERE lower(trim(nama)) = lower(trim(?)) ORDER BY id ASC LIMIT 2'
    ).all(identifier)
    if (matches.length > 1) {
      await audit(req, 'LOGIN_GAGAL_NAMA_GANDA', 'Nama login cocok dengan lebih dari satu akun')
      return res.status(409).json({ error: 'Nama lengkap digunakan oleh lebih dari satu akun. Masuk menggunakan username atau NIS.' })
    }
    user = matches[0] || null
  }
  if (user && Number(user.active) !== 1) {
    await audit(req, 'LOGIN_DITOLAK_NONAKTIF', `login ${identifier}`)
    return res.status(403).json({ error: 'Akun sedang dinonaktifkan oleh Admin' })
  }
  if (!user || !user.password_hash) {
    await audit(req, 'LOGIN_GAGAL', `login ${identifier}`)
    return res.status(401).json({ error: 'Username atau password salah' })
  }

  const cocok = bcrypt.compareSync(password, user.password_hash)
  if (!cocok) {
    await audit(req, 'LOGIN_GAGAL', `login ${identifier}`)
    return res.status(401).json({ error: 'Username atau password salah' })
  }

  const token = buatToken(user)
  req.user = user
  await audit(req, 'LOGIN_BERHASIL', `${user.role} · ${user.nama}`)
  res.json({
    token,
    user: { id: user.id, nama: user.nama, role: user.role, username: user.username, outlet: user.outlet || null, active: Number(user.active) === 1 }
  })
})

authRouter.get('/me', wajibLogin, async (req, res) => {
  const user = await db.prepare(`SELECT u.id, u.nama, u.role, u.username, u.outlet, u.active,
      (u.role IN ('siswa', 'ortu') AND u.pin_hash IS NULL) AS wajib_buat_pin,
      COALESCE(own.email, parent.email) AS email,
      COALESCE(own.no_hp, parent.no_hp) AS no_hp,
      own.email AS email_akun,
      own.no_hp AS no_hp_akun,
      CASE WHEN u.role = 'siswa' AND own.user_id IS NULL AND parent.user_id IS NOT NULL THEN true ELSE false END AS kontak_orang_tua,
      CASE WHEN avatar.user_id IS NOT NULL THEN 'data:' || avatar.content_type || ';base64,' || avatar.data_base64 ELSE NULL END AS avatar
    FROM users u
    LEFT JOIN user_profiles own ON own.user_id = u.id
    LEFT JOIN siswa_profil sp ON sp.user_id = u.id AND u.role = 'siswa'
    LEFT JOIN user_profiles parent ON parent.user_id = sp.ortu_id
    LEFT JOIN user_avatars avatar ON avatar.user_id = u.id
    WHERE u.id = ?`).get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
  res.json({ user: { ...user, active: Number(user.active) === 1, wajib_buat_pin: Boolean(user.wajib_buat_pin), kontak_orang_tua: Boolean(user.kontak_orang_tua) } })
})

authRouter.post('/me/avatar', wajibLogin, async (req, res) => {
  const { data_url, mime, ukuran } = req.body || {}
  const matched = typeof data_url === 'string'
    ? data_url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
    : null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || !matched || matched[1] !== mime) {
    return res.status(400).json({ error: 'Foto harus berupa gambar JPG, PNG, atau WEBP yang valid' })
  }
  if (data_url.length > 1_500_000) return res.status(413).json({ error: 'Ukuran foto profil maksimal 1 MB' })

  const bytes = Buffer.from(matched[2], 'base64')
  if (bytes.toString('base64') !== matched[2] || bytes.length < 1 || bytes.length > 1024 * 1024 || Number(ukuran) !== bytes.length) {
    return res.status(400).json({ error: 'Ukuran foto profil tidak valid atau melebihi 1 MB' })
  }
  const signatureValid = mime === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!signatureValid) return res.status(400).json({ error: 'Isi file tidak sesuai dengan format foto yang dipilih' })

  await db.prepare(
    `INSERT INTO user_avatars (user_id, content_type, data_base64, file_size)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       data_base64 = EXCLUDED.data_base64,
       file_size = EXCLUDED.file_size,
       updated_at = CURRENT_TIMESTAMP`
  ).run(req.user.id, mime, matched[2], bytes.length)
  await audit(req, 'UBAH_FOTO_PROFIL', `${req.user.role} memperbarui foto profil`, 'users', Number(req.user.id))
  res.json({ pesan: 'Foto profil berhasil diperbarui', avatar: data_url })
})

authRouter.post('/me/pin', wajibLogin, async (req, res) => {
  if (!['siswa', 'ortu'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Pembuatan PIN hanya tersedia untuk akun siswa dan orang tua' })
  }
  const pin = String(req.body?.pin || '')
  const confirmation = String(req.body?.konfirmasi_pin || '')
  if (!/^\d{6}$/.test(pin) || pin !== confirmation) {
    return res.status(400).json({ error: 'PIN dan konfirmasi harus sama dan terdiri dari 6 digit' })
  }

  try {
    await db.transaction(async () => {
      const user = await db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(req.user.id)
      if (!user) {
        const error = new Error('Akun tidak ditemukan')
        error.status = 404
        throw error
      }
      if (user.pin_hash) {
        const error = new Error('PIN akun sudah pernah dibuat')
        error.status = 409
        throw error
      }
      const pinHash = await bcrypt.hash(pin, 10)
      await db.prepare("UPDATE users SET pin_hash = ? WHERE id = ? AND role IN ('siswa', 'ortu')").run(pinHash, req.user.id)
      await audit(req, 'BUAT_PIN_AKUN', `${req.user.role} membuat PIN`, 'users', Number(req.user.id))
    })()
    res.json({ pesan: 'PIN berhasil dibuat' })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Gagal membuat PIN akun:', error.message)
    res.status(500).json({ error: 'Gagal membuat PIN akun' })
  }
})

authRouter.put('/me/contact', wajibLogin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const inputPhone = String(req.body?.no_hp || '').trim()
  const phoneDigits = inputPhone.replace(/[\s()-]/g, '')
  let noHp = phoneDigits
  if (/^\+628\d{8,11}$/.test(phoneDigits)) noHp = '08' + phoneDigits.slice(3)
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) {
    return res.status(400).json({ error: 'Format email tidak valid' })
  }
  if (phoneDigits && !/^08\d{8,11}$/.test(noHp)) {
    return res.status(400).json({ error: 'Nomor WhatsApp harus 10–13 digit dengan awalan 08 atau +62' })
  }

  await db.prepare(`INSERT INTO user_profiles (user_id, no_hp, email)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      no_hp_verified_at = CASE WHEN user_profiles.no_hp IS DISTINCT FROM EXCLUDED.no_hp THEN NULL ELSE user_profiles.no_hp_verified_at END,
      email_verified_at = CASE WHEN user_profiles.email IS DISTINCT FROM EXCLUDED.email THEN NULL ELSE user_profiles.email_verified_at END,
      no_hp = EXCLUDED.no_hp, email = EXCLUDED.email`)
    .run(req.user.id, noHp || null, email || null)

  await audit(req, 'UBAH_KONTAK_AKUN', `${req.user.role} · kontak diperbarui`, 'users', Number(req.user.id))
  const profile = await db.prepare(`SELECT u.id, u.nama, u.role, u.username, u.outlet, u.active,
      p.email, p.no_hp, false AS kontak_orang_tua
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?`).get(req.user.id)
  res.json({ pesan: 'Informasi kontak berhasil disimpan', user: { ...profile, active: Number(profile.active) === 1, kontak_orang_tua: Boolean(profile.kontak_orang_tua) } })
})

authRouter.post('/ganti-password', wajibLogin, async (req, res) => {
  const passwordLama = String(req.body?.password_lama || '')
  const passwordBaru = String(req.body?.password_baru || '')
  if (!passwordLama || passwordBaru.length < 8 || passwordBaru.length > 72) {
    return res.status(400).json({ error: 'Password lama wajib diisi; password baru harus 8–72 karakter' })
  }
  const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id)
  if (!user?.password_hash || !bcrypt.compareSync(passwordLama, user.password_hash)) return res.status(401).json({ error: 'Password lama tidak benar' })
  const passwordHash = bcrypt.hashSync(passwordBaru, 10)
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.id)
  await audit(req, 'GANTI_PASSWORD', 'Pengguna mengganti password', 'users', Number(req.user.id))
  res.json({ pesan: 'Password berhasil diubah' })
})

authRouter.post('/password-reset/request', async (req, res) => {
  try {
    const result = await passwordRecovery.start({
      username: String(req.body?.username || ''),
      channel: String(req.body?.channel || '')
    })
    res.status(202).json({
      pesan: 'Jika akun cocok dan memiliki kontak terverifikasi, OTP akan dikirim ke kanal yang dipilih.',
      ...result
    })
  } catch (error) { passwordRecoveryFailure(res, error) }
})

authRouter.post('/password-reset/verify', async (req, res) => {
  try {
    const result = await passwordRecovery.verify({
      challengeId: String(req.body?.challenge_id || ''),
      otp: String(req.body?.otp || '')
    })
    res.json(result)
  } catch (error) { passwordRecoveryFailure(res, error) }
})

authRouter.post('/password-reset/complete', async (req, res) => {
  try {
    const result = await passwordRecovery.complete({
      req,
      challengeId: String(req.body?.challenge_id || ''),
      resetToken: String(req.body?.reset_token || ''),
      password: String(req.body?.password_baru || ''),
      confirmation: String(req.body?.konfirmasi_password || '')
    })
    await audit(req, 'RESET_PASSWORD_MANDIRI', 'Pengguna menyelesaikan pemulihan password', 'users', result.userId)
    res.json({ pesan: 'Password berhasil diatur ulang. Silakan masuk dengan password baru.' })
  } catch (error) { passwordRecoveryFailure(res, error) }
})
