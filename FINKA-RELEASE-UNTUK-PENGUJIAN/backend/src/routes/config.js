import { Router } from 'express'

export const configRouter = Router()

configRouter.get('/pembayaran', (req, res) => {
  const bank = String(process.env.PAYMENT_BANK_NAME || '').trim()
  const nomor = String(process.env.PAYMENT_BANK_ACCOUNT || '').trim()
  const atasNama = String(process.env.PAYMENT_ACCOUNT_HOLDER || '').trim()
  if (!bank || !nomor || !atasNama) return res.json({ rekening: null })
  res.json({ rekening: { bank, nomor, atas_nama: atasNama } })
})
