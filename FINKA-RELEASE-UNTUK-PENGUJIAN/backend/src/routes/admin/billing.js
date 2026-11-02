import { Router } from 'express'
import { db, saldoSiswa } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { audit } from '../../audit.js'
import { isValidDateOnly } from '../../validation.js'

export const adminBillingRouter = Router()

// Daftar tagihan administratif dengan filter yang hanya menggunakan kolom/SQL tetap.
adminBillingRouter.get('/tagihan', wajibLogin, hanyaAdmin, async (req, res) => {
  const status = String(req.query.status || '').trim()
  const kelas = String(req.query.kelas || '').trim()
  const bulan = String(req.query.bulan || '').trim()
  const siswaId = req.query.siswa_id == null ? null : Number(req.query.siswa_id)
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100))
  const beforeId = Number(req.query.before_id) > 0 ? Number(req.query.before_id) : null

  if (status && !['belum_bayar', 'lunas', 'dibatalkan'].includes(status)) {
    return res.status(400).json({ error: 'Filter status tidak valid' })
  }
  if (bulan && !/^\d{4}-\d{2}$/.test(bulan)) {
    return res.status(400).json({ error: 'Filter bulan harus berformat YYYY-MM' })
  }
  if (siswaId !== null && (!Number.isInteger(siswaId) || siswaId <= 0)) {
    return res.status(400).json({ error: 'siswa_id tidak valid' })
  }

  const conditions = []
  const params = []
  if (status) { conditions.push('t.status = ?'); params.push(status) }
  if (kelas) { conditions.push('sp.kelas = ?'); params.push(kelas) }
  if (bulan) { conditions.push("strftime('%Y-%m', t.created_at) = ?"); params.push(bulan) }
  if (siswaId !== null) { conditions.push('t.siswa_id = ?'); params.push(siswaId) }
  if (beforeId) { conditions.push('t.id < ?'); params.push(beforeId) }
  params.push(limit)

  try {
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const rows = await db.prepare(`
      SELECT t.id, t.siswa_id, s.nama AS siswa_nama, sp.kelas, sp.nis,
             t.nama, t.nominal, t.jatuh_tempo, t.status, t.created_at
      FROM tagihan t
      JOIN users s ON s.id = t.siswa_id
      LEFT JOIN siswa_profil sp ON sp.user_id = s.id
      ${where}
      ORDER BY t.id DESC
      LIMIT ?
    `).all(...params)
    res.json({ tagihan: rows, next_before_id: rows.length === limit ? rows[rows.length - 1].id : null })
  } catch (error) {
    console.error('Daftar tagihan admin gagal:', error)
    res.status(500).json({ error: 'Gagal mengambil daftar tagihan' })
  }
})

// Tagihan hanya dapat diedit sebelum lunas. Perubahan nominal/nama/tenggat
// dikunci dalam transaksi agar tidak mengubah tagihan yang sedang dibayar.
adminBillingRouter.put('/tagihan/:id', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID tagihan tidak valid' })

  const body = req.body || {}
  const nama = body.nama === undefined ? undefined : String(body.nama).trim()
  const nominal = body.nominal === undefined ? undefined : Number(body.nominal)
  const jatuhTempo = body.jatuh_tempo === undefined ? undefined : String(body.jatuh_tempo).trim()
  if (nama === undefined && nominal === undefined && jatuhTempo === undefined) {
    return res.status(400).json({ error: 'Tidak ada perubahan yang dikirim' })
  }
  if (nama !== undefined && (!nama || nama.length > 120)) return res.status(400).json({ error: 'Nama tagihan wajib diisi (maksimal 120 karakter)' })
  if (nominal !== undefined && (!Number.isSafeInteger(nominal) || nominal <= 0)) return res.status(400).json({ error: 'Nominal harus bilangan bulat positif' })
  if (jatuhTempo !== undefined && jatuhTempo !== '' && !isValidDateOnly(jatuhTempo)) {
    return res.status(400).json({ error: 'jatuh_tempo harus berformat YYYY-MM-DD atau string kosong' })
  }

  try {
    const result = await db.transaction(async () => {
      const current = await db.prepare('SELECT * FROM tagihan WHERE id = ?').get(id)
      if (!current) throw Object.assign(new Error('Tagihan tidak ditemukan'), { status: 404 })
      if (current.status !== 'belum_bayar') throw Object.assign(new Error('Hanya tagihan belum dibayar yang dapat diubah'), { status: 409 })

      const nextNama = nama === undefined ? current.nama : nama
      const nextNominal = nominal === undefined ? Number(current.nominal) : nominal
      const nextJatuhTempo = jatuhTempo === undefined ? current.jatuh_tempo : (jatuhTempo || null)
      await db.prepare('UPDATE tagihan SET nama = ?, nominal = ?, jatuh_tempo = ? WHERE id = ?')
        .run(nextNama, nextNominal, nextJatuhTempo, id)
      return { before: current, after: { id, nama: nextNama, nominal: nextNominal, jatuh_tempo: nextJatuhTempo } }
    })()
    await audit(req, 'UBAH_TAGIHAN', `Tagihan #${id} diperbarui`, 'tagihan', id)
    res.json({ ok: true, tagihan: result.after })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Perubahan tagihan admin gagal:', error)
    res.status(500).json({ error: 'Gagal mengubah tagihan' })
  }
})


// Pembatalan tagihan tercatat sebagai status terminal. Jika sebelumnya dibayar
// dari saldo, ledger dibalik di transaksi yang sama. Pembayaran transfer tidak
// otomatis dikembalikan ke saldo siswa; harus diselesaikan manual di luar sistem.
adminBillingRouter.post('/tagihan/:id/batal', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const alasan = String(req.body?.alasan || '').trim()
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'ID tagihan tidak valid' })
  if (!alasan || alasan.length > 500) return res.status(400).json({ error: 'Alasan pembatalan wajib diisi (maksimal 500 karakter)' })
  try {
    const result = await db.transaction(async () => {
      const tagihan = await db.prepare('SELECT * FROM tagihan WHERE id = ?').get(id)
      if (!tagihan) throw { status: 404, message: 'Tagihan tidak ditemukan' }
      if (tagihan.status === 'dibatalkan') throw { status: 409, message: 'Tagihan sudah dibatalkan' }
      const existing = await db.prepare("SELECT id FROM ledger WHERE ref_tabel = 'pembatalan_tagihan' AND ref_id = ? LIMIT 1").get(id)
      if (existing) throw { status: 409, message: 'Tagihan sudah memiliki pembalikan ledger' }
      let reversalLedgerId = null
      if (tagihan.status === 'lunas') {
        const external = await db.prepare(`SELECT id FROM topup_request WHERE tagihan_id = ? AND status = 'disetujui' LIMIT 1`).get(id)
        if (external) throw { status: 409, message: 'Tagihan dibayar melalui transfer. Refund transfer harus diselesaikan manual sebelum pembatalan dicatat.' }
        await db.prepare('SELECT id FROM users WHERE id = ?').get(tagihan.siswa_id)
        const payment = await db.prepare(`SELECT * FROM ledger WHERE ref_tabel = 'tagihan' AND ref_id = ? AND tipe = 'bayar_tagihan' AND nominal < 0 ORDER BY id DESC LIMIT 1`).get(id)
        if (!payment) throw { status: 409, message: 'Pembayaran tidak ditemukan di ledger; pembatalan otomatis ditolak agar saldo tidak salah.' }
        const reversal = await db.prepare(`INSERT INTO ledger
          (siswa_id, tipe, nominal, keterangan, ref_tabel, ref_id, dibuat_oleh)
          VALUES (?, 'penyesuaian', ?, ?, 'pembatalan_tagihan', ?, ?)`)
          .run(tagihan.siswa_id, Math.abs(Number(payment.nominal)), `Pengembalian pembayaran tagihan #${id}: ${alasan}`, id, req.user.id)
        reversalLedgerId = reversal.lastInsertRowid
      }
      await db.prepare("UPDATE tagihan SET status = 'dibatalkan' WHERE id = ?").run(id)
      await audit(req, 'BATAL_TAGIHAN', `Tagihan #${id} · siswa #${tagihan.siswa_id} · status awal ${tagihan.status} · ${alasan}`, 'tagihan', id)
      return { id, siswa_id: tagihan.siswa_id, status_sebelumnya: tagihan.status, status: 'dibatalkan', reversal_ledger_id: reversalLedgerId }
    })()
    res.json({ ok: true, tagihan: result, ...(result.reversal_ledger_id ? { saldo_baru: await saldoSiswa(result.siswa_id) } : {}) })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Gagal membatalkan tagihan:', error)
    res.status(500).json({ error: 'Gagal membatalkan tagihan' })
  }
})
