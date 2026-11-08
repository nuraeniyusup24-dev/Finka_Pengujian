import { Router } from 'express'
import { db } from '../db.js'
import { wajibLogin } from '../middleware/auth.js'
import { hanyaAdmin } from '../middleware/role.js'

export const configRouter = Router()

async function bacaRekening() {
  const saved = await db.prepare('SELECT bank_name, bank_account, account_holder FROM payment_settings WHERE id = 1').get()
  const bank = String(saved?.bank_name || process.env.PAYMENT_BANK_NAME || '').trim()
  const nomor = String(saved?.bank_account || process.env.PAYMENT_BANK_ACCOUNT || '').trim()
  const atasNama = String(saved?.account_holder || process.env.PAYMENT_ACCOUNT_HOLDER || '').trim()
  if (!bank || !nomor || !atasNama) return null
  return { bank, nomor, atas_nama: atasNama }
}

configRouter.get('/pembayaran', async (req, res) => {
  try {
    res.json({ rekening: await bacaRekening() })
  } catch (error) {
    console.error('Gagal membaca rekening pembayaran:', error)
    res.status(500).json({ error: 'Informasi rekening pembayaran tidak dapat dimuat' })
  }
})

configRouter.put('/pembayaran', wajibLogin, hanyaAdmin, async (req, res) => {
  const bank = typeof req.body?.bank === 'string' ? req.body.bank.trim() : ''
  const nomor = typeof req.body?.nomor === 'string' ? req.body.nomor.trim() : ''
  const atasNama = typeof req.body?.atas_nama === 'string' ? req.body.atas_nama.trim() : ''
  if (!bank || !nomor || !atasNama) {
    return res.status(400).json({ error: 'Nama bank, nomor rekening, dan nama pemilik wajib diisi' })
  }
  if (bank.length > 80 || nomor.length > 40 || atasNama.length > 100) {
    return res.status(400).json({ error: 'Panjang data rekening melebihi batas' })
  }

  try {
    await db.prepare(`INSERT INTO payment_settings (id, bank_name, bank_account, account_holder)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        bank_name = excluded.bank_name,
        bank_account = excluded.bank_account,
        account_holder = excluded.account_holder,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(bank, nomor, atasNama)
    res.json({ rekening: await bacaRekening() })
  } catch (error) {
    console.error('Gagal menyimpan rekening pembayaran:', error)
    res.status(500).json({ error: 'Rekening pembayaran tidak dapat disimpan' })
  }
})
