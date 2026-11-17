import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, saldoSiswa } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'
import { audit } from '../audit.js'

export const siswaRouter = Router()

siswaRouter.get('/saya/kontrol', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const [control, spent] = await Promise.all([
    db.prepare('SELECT limit_aktif, limit_harian, kartu_diblokir, kartu_diblokir_oleh FROM siswa_kontrol WHERE user_id = ?').get(req.user.id),
    db.prepare(`SELECT COALESCE(SUM(-nominal), 0) AS total FROM ledger
      WHERE siswa_id = ? AND tipe IN ('pembelian', 'tarik_tunai')
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now','+7 hours'), '-7 hours')`).get(req.user.id)
  ])
  const limit = Number(control?.limit_harian || 25000)
  const used = Number(spent?.total || 0)
  const diblokir = Boolean(control?.kartu_diblokir)
  const oleh = diblokir ? (control?.kartu_diblokir_oleh || 'ortu') : null
  res.json({
    limit_aktif: Boolean(control?.limit_aktif), limit, kartu_diblokir: diblokir,
    kartu_diblokir_oleh: oleh,
    // Siswa hanya boleh mengaktifkan kembali blokir yang ia pasang sendiri
    bisa_buka_blokir: diblokir && oleh === 'siswa',
    terpakai_hari_ini: used, sisa_limit: Math.max(0, limit - used)
  })
})

// Blokir kartu (mis. kartu hilang). Kalau sudah diblokir orang tua, pencatat blokir tidak diubah
// supaya siswa tidak bisa "mengambil alih" lalu membukanya sendiri.
siswaRouter.post('/saya/kartu/blokir', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const siswaId = Number(req.user.id)
  await db.prepare(`INSERT INTO siswa_kontrol (user_id, kartu_diblokir, kartu_diblokir_oleh) VALUES (?, TRUE, 'siswa')
    ON CONFLICT (user_id) DO UPDATE SET
      kartu_diblokir_oleh = CASE WHEN siswa_kontrol.kartu_diblokir = 1 THEN siswa_kontrol.kartu_diblokir_oleh ELSE 'siswa' END,
      kartu_diblokir = TRUE`).run(siswaId)
  const row = await db.prepare('SELECT kartu_diblokir_oleh FROM siswa_kontrol WHERE user_id = ?').get(siswaId)
  const oleh = row?.kartu_diblokir_oleh || 'ortu'
  await audit(req, 'BLOKIR_KARTU_SISWA', `Siswa #${siswaId} memblokir kartunya`, 'users', siswaId)
  res.json({
    pesan: oleh === 'siswa'
      ? 'Kartu berhasil diblokir. Kamu bisa mengaktifkannya kembali di Pengaturan akun.'
      : 'Kartu sudah diblokir oleh Orang Tua/Wali. Hanya mereka yang dapat membukanya.',
    kartu_diblokir: true, kartu_diblokir_oleh: oleh, bisa_buka_blokir: oleh === 'siswa'
  })
})

// Aktifkan kembali kartu (mis. kartu yang hilang sudah ketemu). Hanya untuk blokir yang dipasang siswa sendiri.
siswaRouter.post('/saya/kartu/buka-blokir', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const siswaId = Number(req.user.id)
  const hasil = await db.prepare(`UPDATE siswa_kontrol SET kartu_diblokir = 0, kartu_diblokir_oleh = NULL
    WHERE user_id = ? AND kartu_diblokir = 1 AND kartu_diblokir_oleh = 'siswa'`).run(siswaId)
  if (hasil.changes === 0) {
    const row = await db.prepare('SELECT kartu_diblokir FROM siswa_kontrol WHERE user_id = ?').get(siswaId)
    if (row?.kartu_diblokir) {
      return res.status(403).json({ error: 'Kartu diblokir oleh Orang Tua/Wali. Hanya Orang Tua/Wali yang dapat membukanya.' })
    }
    // Sudah aktif: aman dijalankan ulang (mis. dobel tap)
    return res.json({ pesan: 'Kartu sudah aktif.', kartu_diblokir: false, kartu_diblokir_oleh: null, bisa_buka_blokir: false })
  }
  await audit(req, 'BUKA_BLOKIR_KARTU_SISWA', `Siswa #${siswaId} mengaktifkan kembali kartunya`, 'users', siswaId)
  res.json({ pesan: 'Kartu aktif kembali.', kartu_diblokir: false, kartu_diblokir_oleh: null, bisa_buka_blokir: false })
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

// Rincian struk satu transaksi (untuk halaman struk + unduh PDF)
function urai_item(ket) {
  const items = []
  const re = /(.+?) x(\d+)(?:, |$)/g
  let m
  while ((m = re.exec(String(ket || '')))) items.push({ nama: m[1], qty: Number(m[2]) })
  return items
}

siswaRouter.get('/:id/struk/:ledgerId', wajibLogin, async (req, res) => {
  const siswaId = Number(req.params.id)
  const ledgerId = Number(req.params.ledgerId)
  if (!Number.isSafeInteger(siswaId) || !Number.isSafeInteger(ledgerId)) return res.status(400).json({ error: 'ID tidak valid' })
  if (!(await bolehLihat(req.user, siswaId))) return res.status(403).json({ error: 'Tidak punya akses' })
  const l = await db.prepare(`SELECT l.*, u.nama AS oleh_nama, u.role AS oleh_role FROM ledger l
    LEFT JOIN users u ON u.id = l.dibuat_oleh WHERE l.id = ? AND l.siswa_id = ?`).get(ledgerId, siswaId)
  if (!l) return res.status(404).json({ error: 'Transaksi tidak ditemukan' })
  // PIC hanya boleh membuka struk transaksi yang ia proses sendiri
  if (req.user.role === 'pic' && l.dibuat_oleh !== req.user.id) return res.status(403).json({ error: 'Tidak punya akses' })
  const sesudah = Number((await db.prepare('SELECT COALESCE(SUM(nominal),0) AS s FROM ledger WHERE siswa_id = ? AND id <= ?').get(siswaId, ledgerId)).s)
  const siswa = await db.prepare(`SELECT u.nama, sp.kelas, sp.nis FROM users u LEFT JOIN siswa_profil sp ON sp.user_id = u.id WHERE u.id = ?`).get(siswaId)
  const meta = await db.prepare(`SELECT m.outlet, m.status, m.alasan_batal, m.dibatalkan_at, p.nama AS kasir
    FROM pos_transaction_meta m LEFT JOIN users p ON p.id = m.pic_id WHERE m.ledger_id = ?`).get(ledgerId)
  const nominal = Number(l.nominal)
  res.json({ struk: {
    id: l.id, nomor: 'TRX-' + l.id, tipe: l.tipe, nominal, masuk: nominal > 0,
    keterangan: l.keterangan, items: l.tipe === 'pembelian' ? urai_item(l.keterangan) : [],
    waktu: l.created_at, oleh: meta?.kasir || l.oleh_nama || null, outlet: meta?.outlet || null,
    status: meta?.status === 'dibatalkan' ? 'dibatalkan' : 'berhasil', alasan_batal: meta?.alasan_batal || null,
    saldo_sebelum: sesudah - nominal, saldo_sesudah: sesudah,
    siswa: { nama: siswa?.nama || '', kelas: siswa?.kelas || '', nis: siswa?.nis || '' }
  } })
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
