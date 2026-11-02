import { Router } from 'express'
import { db } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { isValidDateOnly } from '../../validation.js'

export const adminCashRouter = Router()

async function todayJakarta() {
  const row = await db.prepare("SELECT date('now','+7 hours') AS tanggal").get()
  return String(row.tanggal).slice(0, 10)
}

// Laporan penutupan kas PIC, dapat difilter untuk satu tanggal kalender.
adminCashRouter.get('/tutup-kas', wajibLogin, hanyaAdmin, async (req, res) => {
  const requested = req.query.tanggal == null ? '' : String(req.query.tanggal)
  if (requested && !isValidDateOnly(requested)) {
    return res.status(400).json({ error: 'tanggal harus berformat YYYY-MM-DD' })
  }
  try {
    const tanggal = requested || await todayJakarta()
    const rows = await db.prepare(`SELECT c.id, c.pic_id, u.nama AS pic_nama, c.outlet, c.tanggal,
        c.kas_awal, c.total_pembelian, c.total_tarik_tunai, c.kas_estimasi,
        c.kas_fisik, c.selisih, c.dibuat_oleh, c.created_at
      FROM pos_cash_closeouts c JOIN users u ON u.id = c.pic_id
      WHERE c.tanggal = ? ORDER BY u.nama ASC, c.id ASC`).all(tanggal)
    const summary = rows.reduce((acc, row) => {
      acc.jumlah_pic += 1
      acc.kas_awal += Number(row.kas_awal || 0)
      acc.total_pembelian += Number(row.total_pembelian || 0)
      acc.total_tarik_tunai += Number(row.total_tarik_tunai || 0)
      acc.kas_estimasi += Number(row.kas_estimasi || 0)
      acc.kas_fisik += Number(row.kas_fisik || 0)
      acc.selisih += Number(row.selisih || 0)
      return acc
    }, { jumlah_pic: 0, kas_awal: 0, total_pembelian: 0, total_tarik_tunai: 0, kas_estimasi: 0, kas_fisik: 0, selisih: 0 })
    res.json({ tanggal, jumlah_penutupan: rows.length, ringkasan: summary, penutupan: rows })
  } catch (error) {
    console.error('Laporan tutup kas admin gagal:', error)
    res.status(500).json({ error: 'Gagal mengambil laporan tutup kas' })
  }
})
