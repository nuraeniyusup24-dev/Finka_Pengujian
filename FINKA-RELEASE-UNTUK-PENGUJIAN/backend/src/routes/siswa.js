import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, saldoSiswa } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'
import { audit } from '../audit.js'

export const siswaRouter = Router()

siswaRouter.get('/saya/kontrol', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const [control, spent] = await Promise.all([
    db.prepare('SELECT limit_aktif, limit_harian, kartu_diblokir FROM siswa_kontrol WHERE user_id = ?').get(req.user.id),
    db.prepare(`SELECT COALESCE(SUM(-nominal), 0) AS total FROM ledger
      WHERE siswa_id = ? AND tipe IN ('pembelian', 'tarik_tunai')
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now','+7 hours'), '-7 hours')`).get(req.user.id)
  ])
  const limit = Number(control?.limit_harian || 25000)
  const used = Number(spent?.total || 0)
  res.json({ limit_aktif: Boolean(control?.limit_aktif), limit, kartu_diblokir: Boolean(control?.kartu_diblokir), terpakai_hari_ini: used, sisa_limit: Math.max(0, limit - used) })
})

siswaRouter.post('/saya/kartu/blokir', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const siswaId = Number(req.user.id)
  await db.prepare(`INSERT INTO siswa_kontrol (user_id, kartu_diblokir) VALUES (?, TRUE)
    ON CONFLICT (user_id) DO UPDATE SET kartu_diblokir = TRUE`).run(siswaId)
  await audit(req, 'BLOKIR_KARTU_SISWA', `Siswa #${siswaId} memblokir kartunya`, 'users', siswaId)
  res.json({ pesan: 'Kartu berhasil diblokir. Hubungi Orang Tua/Wali untuk membuka blokir.', kartu_diblokir: true })
})

siswaRouter.post('/saya/ganti-pin', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const { pin_lama, pin_baru } = req.body || {}
  if (!/^\d{6}$/.test(String(pin_lama || '')) || !/^\d{6}$/.test(String(pin_baru || ''))) return res.status(400).json({ error: 'PIN lama dan baru harus terdiri dari 6 digit' })
  try {
    await db.transaction(async () => {
      const user = await db.prepare("SELECT pin_hash FROM users WHERE id = ? AND role = 'siswa'").get(req.user.id)
      if (!user?.pin_hash || !await bcrypt.compare(String(pin_lama), user.pin_hash)) {
        const error = new Error('PIN lama tidak benar')
        error.status = 401
        throw error
      }
      const hash = await bcrypt.hash(String(pin_baru), 10)
      await db.prepare("UPDATE users SET pin_hash = ? WHERE id = ? AND role = 'siswa'").run(hash, req.user.id)
      await audit(req, 'GANTI_PIN_SISWA', 'Siswa mengganti PIN pembayaran', 'users', Number(req.user.id))
    })()
    res.json({ pesan: 'PIN pembayaran berhasil diubah' })
  } catch (error) {
    if (error.status === 401) return res.status(401).json({ error: error.message })
    console.error('Gagal mengganti PIN siswa:', error.message)
    res.status(500).json({ error: 'Gagal mengganti PIN pembayaran' })
  }
})

siswaRouter.get('/', wajibLogin, async (req, res) => {
  if (!['admin', 'pic'].includes(req.user.role)) return res.status(403).json({ error: 'Tidak punya akses' })
  const rows = await db.prepare(`
    SELECT u.id, u.nama, sp.kelas, sp.nis, sp.ortu_id,
           o.nama AS ortu_nama
    FROM users u
    LEFT JOIN siswa_profil sp ON sp.user_id = u.id
    LEFT JOIN users o ON o.id = sp.ortu_id
    WHERE u.role = 'siswa'
    ORDER BY u.nama ASC
  `).all()
  const siswa = await Promise.all(rows.map(async (r) => ({ ...r, saldo: await saldoSiswa(r.id), inisial: (r.nama || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() })))
  res.json({ siswa })
})

siswaRouter.get('/:id', wajibLogin, async (req, res) => {
  const siswaId = Number(req.params.id)
  if (!(await bolehLihat(req.user, siswaId))) return res.status(403).json({ error: 'Tidak punya akses' })
  const row = await db.prepare(`
    SELECT u.id, u.nama, u.username, sp.kelas, sp.nis, sp.ortu_id,
           o.nama AS ortu_nama
    FROM users u
    LEFT JOIN siswa_profil sp ON sp.user_id = u.id
    LEFT JOIN users o ON o.id = sp.ortu_id
    WHERE u.id = ? AND u.role = 'siswa'
  `).get(siswaId)
  if (!row) return res.status(404).json({ error: 'Siswa tidak ditemukan' })
  res.json({ siswa: { ...row, saldo: await saldoSiswa(siswaId), inisial: (row.nama || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() } })
})

async function bolehLihat(reqUser, siswaId) {
  if (['admin', 'pic'].includes(reqUser.role)) return true
  if (reqUser.role === 'siswa' && reqUser.id === Number(siswaId)) return true
  if (reqUser.role === 'ortu') {
    const profil = await db.prepare('SELECT ortu_id FROM siswa_profil WHERE user_id = ?').get(siswaId)
    return profil && profil.ortu_id === reqUser.id
  }
  return false
}

siswaRouter.get('/:id/saldo', wajibLogin, async (req, res) => {
  const siswaId = req.params.id
  if (!(await bolehLihat(req.user, siswaId))) return res.status(403).json({ error: 'Tidak punya akses' })
  res.json({ siswa_id: Number(siswaId), saldo: await saldoSiswa(siswaId) })
})

siswaRouter.get('/:id/riwayat', wajibLogin, async (req, res) => {
  const siswaId = req.params.id
  if (!(await bolehLihat(req.user, siswaId))) return res.status(403).json({ error: 'Tidak punya akses' })

  const rows = await db.prepare(
    `SELECT l.id, l.tipe, l.nominal, l.keterangan, l.ref_tabel, l.ref_id, l.created_at, u.nama AS oleh_nama,
            SUM(l.nominal) OVER (ORDER BY l.id) AS sisa
     FROM ledger l
     LEFT JOIN users u ON u.id = l.dibuat_oleh
     WHERE l.siswa_id = ?
     ORDER BY l.id DESC LIMIT 100`
  ).all(siswaId)
  res.json({ riwayat: rows })
})
