import { Router } from 'express'
import { db } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'

export const laporanRouter = Router()

export function tanggalValid(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
}

export async function tanggalWib(req) {
  const q = String(req.query.tanggal || '')
  return tanggalValid(q) ? q : (await db.prepare("SELECT date('now','+7 hours') AS tanggal").get()).tanggal
}

// Definisi arus yang sama untuk Dashboard dan Laporan:
// - uang masuk: top-up saldo + pembayaran tagihan langsung
// - uang keluar: seluruh debit ledger + settlement tagihan langsung
// - perubahan saldo agregat: SUM seluruh ledger siswa pada hari tersebut
// Dengan definisi ini: masuk - keluar - perubahan saldo = selisih rekonsiliasi.
export async function ringkas(tanggal) {
  const ledger = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN nominal > 0 THEN nominal ELSE 0 END), 0) AS ledger_masuk,
      COALESCE(SUM(CASE WHEN nominal < 0 THEN -nominal ELSE 0 END), 0) AS ledger_keluar,
      COALESCE(SUM(nominal), 0) AS perubahan_saldo,
      COUNT(*) AS transaksi_ledger
    FROM ledger
    WHERE date(created_at, '+7 hours') = ?
  `).get(tanggal)

  const topup = await db.prepare(`
    SELECT COALESCE(SUM(nominal + kode_unik),0) AS disetujui, COUNT(*) AS jumlah
    FROM topup_request
    WHERE status='disetujui' AND tagihan_id IS NULL
      AND date(COALESCE(diproses_at, created_at), '+7 hours')=?
  `).get(tanggal)

  const tagihan = await db.prepare(`
    SELECT COALESCE(SUM(nominal), 0) AS pembayaran_tagihan, COUNT(*) AS transaksi_tagihan
    FROM topup_request
    WHERE status = 'disetujui' AND tagihan_id IS NOT NULL
      AND date(COALESCE(diproses_at, created_at), '+7 hours') = ?
  `).get(tanggal)

  const uangMasuk = Number(topup.disetujui) + Number(tagihan.pembayaran_tagihan)
  const uangKeluar = Number(ledger.ledger_keluar) + Number(tagihan.pembayaran_tagihan)
  const perubahanSaldoAgregat = Number(ledger.perubahan_saldo)
  const selisih = uangMasuk - uangKeluar - perubahanSaldoAgregat

  return {
    tanggal,
    uang_masuk: uangMasuk,
    uang_keluar: uangKeluar,
    perubahan_saldo_agregat: perubahanSaldoAgregat,
    selisih,
    transaksi_ledger: Number(ledger.transaksi_ledger),
    topup_disetujui: Number(topup.disetujui),
    kredit_ledger: Number(ledger.ledger_masuk),
    selisih_topup_ledger: Number(topup.disetujui) - Number(ledger.ledger_masuk),
    pembayaran_tagihan: Number(tagihan.pembayaran_tagihan),
    transaksi_tagihan: Number(tagihan.transaksi_tagihan)
  }
}

export async function chart14Hari(tanggal) {
  const chart = []
  for (let i = 13; i >= 0; i--) {
    const d = (await db.prepare("SELECT date(?, '-' || ? || ' day') AS tanggal").get(tanggal, i)).tanggal
    const r = await ringkas(d)
    chart.push({
      tanggal: d,
      masuk: r.uang_masuk,
      keluar: r.uang_keluar,
      perubahan_saldo: r.perubahan_saldo_agregat,
      selisih: r.selisih
    })
  }
  return chart
}

laporanRouter.get('/', wajibLogin, wajibRole('admin'), async (req, res) => {
  try {
    const tanggal = await tanggalWib(req)
    res.json({ ringkasan: await ringkas(tanggal), chart: await chart14Hari(tanggal) })
  } catch (e) {
    console.error('Laporan gagal:', e)
    res.status(500).json({ error: 'Gagal mengambil laporan rekonsiliasi' })
  }
})

