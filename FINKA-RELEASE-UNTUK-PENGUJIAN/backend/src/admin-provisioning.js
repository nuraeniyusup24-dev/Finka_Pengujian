import bcrypt from 'bcryptjs'
import { db } from './db.js'

export async function createInitialAdmin({ nama, username, password }) {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Provisioning admin hanya diizinkan saat NODE_ENV=production.')
  }

  const cleanName = typeof nama === 'string' ? nama.trim() : ''
  const cleanUsername = typeof username === 'string' ? username.trim() : ''
  if (!cleanName || cleanName.length > 100) {
    throw new Error('Nama admin wajib diisi dan maksimal 100 karakter.')
  }
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(cleanUsername)) {
    throw new Error('Username admin harus 3–64 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).')
  }
  if (typeof password !== 'string' || password.length < 14 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password admin harus minimal 14 karakter dan maksimal 72 byte.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  return db.transaction(async () => {
    const userCount = await db.prepare('SELECT COUNT(*) AS count FROM users').get()
    if (Number(userCount.count) !== 0) {
      throw new Error('Provisioning ditolak: database harus benar-benar kosong.')
    }

    const adminCount = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()
    if (Number(adminCount.count) !== 0) {
      throw new Error('Provisioning ditolak: akun admin sudah tersedia.')
    }

    const result = await db.prepare(
      "INSERT INTO users (role, nama, username, password_hash, active) VALUES ('admin', ?, ?, ?, 1)"
    ).run(cleanName, cleanUsername, passwordHash)
    return { id: result.lastInsertRowid, username: cleanUsername }
  })()
}
