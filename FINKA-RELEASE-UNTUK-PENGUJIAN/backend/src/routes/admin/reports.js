import { Router } from 'express'
import { db, OUTLET } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { audit } from '../../audit.js'
import { tanggalValid, ringkas, chart14Hari } from '../laporan.js'
import { isValidDateOnly, positiveSafeInteger } from '../../validation.js'

export const adminReportsRouter = Router()
adminReportsRouter.get('/dashboard', wajibLogin, hanyaAdmin, async (req, res) => {
  try {
    const qTanggal = String(req.query.tanggal || '')
    const tanggal = tanggalValid(qTanggal)
      ? qTanggal
      : (await db.prepare("SELECT date('now','+7 hours') AS d").get()).d

    const ringkasan = await ringkas(tanggal)

    const saldo = await db.prepare(`
      SELECT COALESCE(SUM(saldo),0) AS saldo FROM (
        SELECT u.id, COALESCE(SUM(l.nominal),0) AS saldo
        FROM users u
        LEFT JOIN ledger l ON l.siswa_id=u.id
        WHERE u.role='siswa'
        GROUP BY u.id
      )
    `).get().saldo
    const dompetAktif = (await db.prepare(
      "SELECT COUNT(*) AS jumlah FROM users WHERE role='siswa' AND active=1"
    ).get()).jumlah

    const outletRows = await db.prepare(`
      SELECT u.outlet,
             COALESCE(SUM(-l.nominal),0) AS nilai,
             COUNT(*) AS transaksi
      FROM ledger l
      JOIN users u ON u.id=l.dibuat_oleh
      WHERE l.tipe='pembelian'
        AND l.nominal<0
        AND u.role='pic'
        AND date(l.created_at,'+7 hours')=?
      GROUP BY u.outlet
    `).all(tanggal)
    const outletMap = new Map(outletRows.map(r => [r.outlet, r]))
    const outletKeys = [OUTLET.KANTIN_UTAMA, OUTLET.KANTIN_B, OUTLET.KOPERASI]
    const outlets = outletKeys.map((key) => {
      const r = outletMap.get(key)
      return { outlet:key, nilai:Number(r?.nilai || 0), transaksi:Number(r?.transaksi || 0) }
    })

    const waiting = (await db.prepare(
      "SELECT COUNT(*) AS n FROM topup_request WHERE status='menunggu'"
    ).get()).n

    res.json({
      tanggal,
      uang_masuk: ringkasan.uang_masuk,
      uang_keluar: ringkasan.uang_keluar,
      perubahan_saldo_agregat: ringkasan.perubahan_saldo_agregat,
      selisih: ringkasan.selisih,
      topup_disetujui: ringkasan.topup_disetujui,
      pembayaran_tagihan: ringkasan.pembayaran_tagihan,
      kredit_ledger: ringkasan.kredit_ledger,
      debit_ledger: ringkasan.uang_keluar - ringkasan.pembayaran_tagihan,
      selisih_topup_ledger: ringkasan.selisih_topup_ledger,
      saldo_mengendap:Number(saldo),
      dompet_aktif:Number(dompetAktif),
      transaksi_hari_ini:ringkasan.transaksi_ledger + ringkasan.transaksi_tagihan,
      transaksi_ledger:ringkasan.transaksi_ledger,
      transaksi_tagihan:ringkasan.transaksi_tagihan,
      antrean_verifikasi:Number(waiting),
      outlets,
      chart:await chart14Hari(tanggal)
    })
  } catch (e) {
    console.error('Dashboard gagal:', e)
    res.status(500).json({ error: 'Gagal mengambil dashboard' })
  }
})

adminReportsRouter.get('/tagihan-ringkasan', wajibLogin, hanyaAdmin, async (req, res) => {
  try {
    const bulan = /^\d{4}-\d{2}$/.test(String(req.query.bulan || '')) ? String(req.query.bulan) : (await db.prepare("SELECT strftime('%Y-%m','now','+7 hours') AS b").get()).b
    const total = await db.prepare(`
      SELECT COALESCE(SUM(nominal),0) AS terbit,
             COALESCE(SUM(CASE WHEN status='lunas' THEN nominal ELSE 0 END),0) AS lunas,
             COALESCE(SUM(CASE WHEN status='belum_bayar' THEN nominal ELSE 0 END),0) AS tunggakan,
             COUNT(*) AS invoice,
             SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) AS invoice_lunas
      FROM tagihan WHERE strftime('%Y-%m',created_at)=?
    `).get(bulan)
    const waiting = await db.prepare(`
      SELECT COALESCE(SUM(nominal),0) AS nominal, COUNT(*) AS jumlah
      FROM topup_request WHERE status='menunggu' AND tagihan_id IS NOT NULL
    `).get()
    const kelas = await db.prepare(`
      SELECT COALESCE(sp.kelas,'Tanpa kelas') AS kelas,
        COUNT(*) AS siswa,
        SUM(CASE WHEN t.status='lunas' THEN 1 ELSE 0 END) AS sudah_lunas,
        COALESCE(SUM(CASE WHEN t.status='belum_bayar' THEN t.nominal ELSE 0 END),0) AS tunggakan
      FROM tagihan t JOIN users s ON s.id=t.siswa_id
      LEFT JOIN siswa_profil sp ON sp.user_id=s.id
      WHERE strftime('%Y-%m',t.created_at)=?
      GROUP BY COALESCE(sp.kelas,'Tanpa kelas') ORDER BY kelas
    `).all(bulan)
    res.json({ bulan, total: {
      terbit: Number(total.terbit || 0), lunas: Number(total.lunas || 0), tunggakan: Number(total.tunggakan || 0),
      invoice: Number(total.invoice || 0), invoice_lunas: Number(total.invoice_lunas || 0),
      menunggu_verifikasi: Number(waiting.nominal || 0), permintaan_menunggu: Number(waiting.jumlah || 0)
    }, kelas: kelas.map((r) => ({ kelas:r.kelas, siswa:Number(r.siswa), sudah_lunas:Number(r.sudah_lunas), tunggakan:Number(r.tunggakan), persen_lunas:r.siswa ? Math.round(Number(r.sudah_lunas)/Number(r.siswa)*100) : 0 })) })
  } catch (e) {
    console.error('Ringkasan tagihan gagal:', e)
    res.status(500).json({ error: 'Gagal mengambil ringkasan tagihan' })
  }
})

adminReportsRouter.post('/tagihan/bulk', wajibLogin, hanyaAdmin, async (req, res) => {
  const { nama, nominal, jatuh_tempo, siswa_ids } = req.body || {}
  const namaBersih = String(nama || '').trim()
  const nilai = Number(nominal)
  const tanggal = String(jatuh_tempo || '')
  const tanggalValid = isValidDateOnly(tanggal)
  if (!namaBersih || namaBersih.length > 120 || !Number.isSafeInteger(nilai) || nilai <= 0 || !tanggalValid || !Array.isArray(siswa_ids) || !siswa_ids.length) {
    return res.status(400).json({ error: 'Nama (maks. 120 karakter), nominal positif, jatuh_tempo yang valid (YYYY-MM-DD), dan siswa_ids wajib diisi' })
  }
  const ids = [...new Set(siswa_ids.map(Number).filter(positiveSafeInteger))]
  if (!ids.length) return res.status(400).json({ error: 'Pilih setidaknya satu siswa dengan ID valid' })
  const placeholders = ids.map(() => '?').join(',')
  const valid = await db.prepare(`SELECT id FROM users WHERE role='siswa' AND id IN (${placeholders})`).all(...ids)
  if (valid.length !== ids.length) return res.status(400).json({ error: 'Ada siswa yang tidak ditemukan' })
  try {
    const tx = db.transaction(async () => {
      const stmt = await db.prepare('INSERT INTO tagihan (siswa_id,nama,nominal,jatuh_tempo) VALUES (?,?,?,?)')
      let total = 0
      for (const id of ids) { await stmt.run(id, namaBersih, nilai, tanggal); total += nilai }
      return total
    })
    const total = await tx()
    await audit(req, 'TERBIT_TAGIHAN', `${ids.length} invoice · ${namaBersih} · Rp ${total.toLocaleString('id-ID')}`, 'tagihan', null)
    res.status(201).json({ ok:true, jumlah:ids.length, total, nama:namaBersih, jatuh_tempo: tanggal })
  } catch (e) {
    console.error('Terbit tagihan gagal:', e)
    res.status(500).json({ error: 'Gagal menerbitkan tagihan' })
  }
})

// Log audit terbaru (hanya admin). ?limit= 1–500, default 100.
adminReportsRouter.get('/audit', wajibLogin, hanyaAdmin, async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100))
  const rows = await db.prepare(`
    SELECT a.id, a.aktor_id, u.nama AS aktor_nama, a.aksi, a.perubahan, a.ip, a.ref_tabel, a.ref_id, a.created_at
    FROM audit_log a LEFT JOIN users u ON u.id = a.aktor_id
    ORDER BY a.id DESC LIMIT ?`).all(limit)
  res.json({ audit: rows })
})
