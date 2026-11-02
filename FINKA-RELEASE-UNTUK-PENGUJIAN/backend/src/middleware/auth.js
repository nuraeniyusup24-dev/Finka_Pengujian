import jwt from 'jsonwebtoken'
import { db } from '../db.js'

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET wajib diisi pada production')
  console.warn('[peringatan] JWT_SECRET kosong, memakai secret bawaan khusus development. Isi JWT_SECRET di .env.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-ganti-saat-produksi'

export function buatToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, nama: user.nama },
    JWT_SECRET,
    { expiresIn: '12h' }
  )
}

// Mewajibkan token valid. Ini yang menggantikan "tinggal klik kartu role"
// di prototipe — setiap request ke endpoint yang butuh identitas harus
// bawa token, dan token itu yang menentukan role, bukan parameter dari
// klien (klien tidak bisa mengaku-ngaku jadi admin).
export async function wajibLogin(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token tidak ada' })

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Status akun selalu dibaca ulang dari DB agar akun yang dinonaktifkan
    // langsung kehilangan akses walaupun JWT-nya belum kedaluwarsa.
    const user = await db.prepare('SELECT id, role, nama, username, outlet, active FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan' })
    if (Number(user.active) !== 1) return res.status(403).json({ error: 'Akun sedang dinonaktifkan oleh Admin' })
    req.user = { ...req.user, ...user }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' })
  }
}

// Dipakai setelah wajibLogin. Blokir di level API (bukan cuma sembunyikan
// tombol di UI, seperti mode "Monitoring" admin di prototipe).
export function wajibRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Tidak punya akses untuk aksi ini' })
    }
    next()
  }
}

