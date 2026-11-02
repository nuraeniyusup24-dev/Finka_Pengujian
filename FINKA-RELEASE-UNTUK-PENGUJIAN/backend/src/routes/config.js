import { Router } from 'express'

export const configRouter = Router()

configRouter.get('/pembayaran', (req, res) => {
  const rekening = {
    bank: process.env.PAYMENT_BANK_NAME || 'BCA',
    nomor: process.env.PAYMENT_BANK_ACCOUNT || '872 011 4556',
    atas_nama: process.env.PAYMENT_ACCOUNT_HOLDER || 'Yayasan Nurul Ilmi'
  }
  res.json({ rekening })
})
