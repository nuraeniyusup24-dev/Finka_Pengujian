import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, saldoSiswa } from '../db.js'
import { wajibLogin } from '../middleware/auth.js'
import { audit } from '../audit.js'

export const tagihanRouter = Router()

tagihanRouter.get('/', wajibLogin, async (req, res) => {
  const siswaId = req.query.siswa_id
  if (!siswaId) return res.status(400).json({ error: 'siswa_id wajib diisi sebagai query param' })
  const profil = await db.prepare('SELECT ortu_id FROM siswa_profil WHERE user_id = ?').get(siswaId)
  const boleh = ['admin','pic'].includes(req.user.role) || (req.user.role === 'siswa' && Number(req.user.id) === Number(siswaId)) || (req.user.role === 'ortu' && profil && profil.ortu_id === req.user.id)
  if (!boleh) return res.status(403).json({ error: 'Tidak punya akses ke tagihan siswa ini' })

  const rows = await db.prepare(
    'SELECT * FROM tagihan WHERE siswa_id = ? ORDER BY jatuh_tempo ASC'
  ).all(siswaId)
  res.json({ tagihan: rows })
})

// Bayar tagihan dari saldo. Cek saldo & tulis ledger dalam SATU transaksi
// SQLite supaya tidak mungkin ada kondisi "lunas" tapi saldo belum
// terpotong (atau sebaliknya) walau ada request lain masuk bersamaan.
tagihanRouter.post('/:id/bayar', wajibLogin, async (req, res) => {
  const id = req.params.id

  const target = await db.prepare('SELECT t.*, sp.ortu_id FROM tagihan t LEFT JOIN siswa_profil sp ON sp.user_id=t.siswa_id WHERE t.id=?').get(id)
  if (!target) return res.status(404).json({ error: 'Tagihan tidak ditemukan' })
  const bolehBayar = ['admin'].includes(req.user.role) || (req.user.role === 'siswa' && req.user.id === target.siswa_id) || (req.user.role === 'ortu' && req.user.id === target.ortu_id)
  if (!bolehBayar) return res.status(403).json({ error: 'Tidak punya akses membayar tagihan ini' })

  if (['siswa', 'ortu'].includes(req.user.role)) {
    const pin = String(req.body?.pin || '')
    if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'PIN pembayaran 6 digit wajib diisi' })
    const user = await db.prepare('SELECT pin_hash FROM users WHERE id = ? AND role = ?').get(req.user.id, req.user.role)
    if (!user?.pin_hash) return res.status(428).json({ error: 'Buat PIN akun terlebih dahulu sebelum membayar tagihan' })
    if (!await bcrypt.compare(pin, user.pin_hash)) {
      await audit(req, 'PIN_PEMBAYARAN_GAGAL', `${req.user.role} memasukkan PIN tagihan yang salah`, 'users', Number(req.user.id))
      return res.status(401).json({ error: 'PIN pembayaran salah' })
    }
  }

  const trx = db.transaction(async () => {
    // Transaksi SQLite berjalan satu per satu (BEGIN IMMEDIATE), jadi dua request paralel
    // tidak bisa sama-sama membaca status belum_bayar lalu mendebit dua kali.
    const tagihan = await db.prepare('SELECT * FROM tagihan WHERE id = ?').get(id)
    if (!tagihan) throw { code: 404, msg: 'Tagihan tidak ditemukan' }
    if (tagihan.status === 'lunas') throw { code: 409, msg: 'Tagihan sudah lunas' }
    if (tagihan.status === 'dibatalkan') throw { code: 409, msg: 'Tagihan sudah dibatalkan dan tidak dapat dibayar' }

    const saldo = await saldoSiswa(tagihan.siswa_id)
    if (saldo < tagihan.nominal) throw { code: 402, msg: 'Saldo tidak mencukupi' }

    await db.prepare(
      `INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, ref_tabel, ref_id, dibuat_oleh)
       VALUES (?, 'bayar_tagihan', ?, ?, 'tagihan', ?, ?)`
    ).run(tagihan.siswa_id, -tagihan.nominal, 'Bayar: ' + tagihan.nama, id, req.user.id)

    await db.prepare(`UPDATE tagihan SET status = 'lunas' WHERE id = ?`).run(id)

    const ledgerRow = await db.prepare("SELECT id FROM ledger WHERE ref_tabel='tagihan' AND ref_id=? ORDER BY id DESC LIMIT 1").get(id)
    const ledgerId = ledgerRow?.id || null
    await audit(req, 'BAYAR_TAGIHAN', `Tagihan #${id} · siswa #${tagihan.siswa_id} · Rp ${Number(tagihan.nominal).toLocaleString('id-ID')}`, 'tagihan', Number(id))
    return { siswa_id: tagihan.siswa_id, ledger_id: ledgerId }
  })

  try {
    const hasil = await trx()
    res.json({ ok: true, saldo_baru: await saldoSiswa(hasil.siswa_id) })
  } catch (e) {
    res.status(e.code || 500).json({ error: e.msg || 'Gagal memproses pembayaran' })
  }
})
