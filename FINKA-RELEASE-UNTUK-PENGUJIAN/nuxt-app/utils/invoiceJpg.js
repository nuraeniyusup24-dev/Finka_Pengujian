const NAVY = '#0A0D3B'
const BLUE = '#1E2EBB'
const MUTED = '#6B7280'
const LINE = '#E5E7EB'
const GREEN = '#1A8040'

const invoiceNumber = (tagihan) => `INV-SPP-${String(tagihan.id).padStart(6, '0')}`

function wrapText(context, text, maxWidth) {
  const words = String(text || '-').split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function buatInvoiceJpg({ tagihan, tanggalBayar, tanggalJatuhTempo, rupiah }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1240
  canvas.height = 1754
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Invoice JPG tidak dapat dibuat di browser ini.')

  const width = canvas.width
  const margin = 104
  const contentWidth = width - margin * 2
  const invoice = invoiceNumber(tagihan)

  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = NAVY
  context.fillRect(0, 0, width, 310)

  context.textBaseline = 'alphabetic'
  context.fillStyle = '#FFFFFF'
  context.font = '700 58px Arial, sans-serif'
  context.fillText('FINKA', margin, 112)
  context.font = '600 27px Arial, sans-serif'
  context.fillStyle = '#C0A97F'
  context.fillText('INVOICE PEMBAYARAN', margin, 170)
  context.textAlign = 'right'
  context.fillStyle = '#FFFFFF'
  context.font = '600 28px Arial, sans-serif'
  context.fillText(invoice, width - margin, 112)
  context.textAlign = 'left'

  context.fillStyle = GREEN
  context.font = '700 34px Arial, sans-serif'
  context.fillText('PEMBAYARAN TERVERIFIKASI', margin, 400)
  context.fillStyle = MUTED
  context.font = '26px Arial, sans-serif'
  context.fillText('Invoice ini diterbitkan setelah pembayaran dikonfirmasi oleh admin.', margin, 452)

  const details = [
    ['Nama tagihan', tagihan.nama],
    ['Nama siswa', tagihan.anakNama || '-'],
    ['Nominal dibayar', rupiah(tagihan.nominal)],
    ['Jatuh tempo', tanggalJatuhTempo],
    ['Tanggal verifikasi', tanggalBayar],
    ['Status', 'LUNAS']
  ]

  let y = 550
  for (const [label, value] of details) {
    context.strokeStyle = LINE
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(margin, y)
    context.lineTo(width - margin, y)
    context.stroke()

    context.fillStyle = MUTED
    context.font = '25px Arial, sans-serif'
    context.fillText(label, margin, y + 54)

    context.fillStyle = label === 'Status' ? GREEN : NAVY
    context.font = '700 27px Arial, sans-serif'
    const lines = wrapText(context, value, contentWidth * 0.57)
    lines.forEach((line, index) => {
      context.fillText(line, width - margin - context.measureText(line).width, y + 54 + index * 36)
    })
    y += Math.max(112, lines.length * 38 + 72)
  }

  context.strokeStyle = LINE
  context.beginPath()
  context.moveTo(margin, y)
  context.lineTo(width - margin, y)
  context.stroke()

  context.fillStyle = '#F4F4F4'
  context.fillRect(margin, y + 42, contentWidth, 190)
  context.fillStyle = NAVY
  context.font = '700 27px Arial, sans-serif'
  context.fillText('Bukti pembayaran', margin + 34, y + 96)
  context.fillStyle = MUTED
  context.font = '25px Arial, sans-serif'
  context.fillText('Simpan invoice ini sebagai bukti pembayaran yang telah diverifikasi.', margin + 34, y + 148)

  context.fillStyle = MUTED
  context.textAlign = 'center'
  context.font = '21px Arial, sans-serif'
  context.fillText('Dokumen ini dibuat otomatis oleh aplikasi Finka dan sah tanpa tanda tangan.', width / 2, canvas.height - 70)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Browser gagal mengekspor invoice ke JPG.'))
    }, 'image/jpeg', 0.94)
  })

  return { blob, nama: `${invoice}.jpg` }
}
