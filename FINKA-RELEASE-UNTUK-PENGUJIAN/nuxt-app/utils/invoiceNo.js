// Nomor invoice: INV/<yymm periode>/<id tagihan 4 digit>
export const nomorInvoice = (tagihan) => {
  if (tagihan.invoiceNo) return tagihan.invoiceNo
  const bulan = { Agustus: '2608', September: '2609' }
  const kunci = Object.keys(bulan).find((k) => (tagihan.periode || '').indexOf(k) === 0)
  return 'INV/' + (kunci ? bulan[kunci] : '2609') + '/' + String(tagihan.id).padStart(4, '0')
}
