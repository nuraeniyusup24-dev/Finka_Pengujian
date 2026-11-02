// Pembuat invoice tagihan (PDF) di sisi klien — dipakai orang tua untuk mengunduh invoice SPP.
// jsPDF dimuat dinamis (hanya saat tombol unduh ditekan) supaya tidak membebani bundel awal.

const NAVY = [10, 13, 59]
const SAND = [192, 169, 127]
const MUTED = [107, 114, 128]
const LINE = [229, 231, 235]
const STATUS_WARNA = {
  Lunas: { fg: [26, 128, 64], teks: 'LUNAS' },
  'Belum Bayar': { fg: [223, 74, 55], teks: 'BELUM DIBAYAR' },
  'Menunggu Verifikasi': { fg: [122, 101, 55], teks: 'MENUNGGU VERIFIKASI' }
}

import { nomorInvoice } from './invoiceNo'

const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')

export const namaFileInvoice = (tagihan) =>
  'invoice-' + nomorInvoice(tagihan).replace(/\//g, '-').toLowerCase() + '-' + tagihan.anak.toLowerCase().replace(/\s+/g, '-') + '.pdf'

/**
 * @param {object} d { tagihan, siswa: {nama, kelas, nis}, ortu, rekening, dicetak }
 * @returns {Promise<{ blob: Blob, nama: string }>}
 */
export async function buatInvoicePdf(d) {
  const mod = await import('jspdf/dist/jspdf.umd.min.js')
  const JsPDF = mod.jsPDF || (mod.default && mod.default.jsPDF) || mod.default
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const t = d.tagihan
  const W = 210
  const M = 18
  const status = STATUS_WARNA[t.status] || STATUS_WARNA['Belum Bayar']

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 38, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Finka', M, 19)
  doc.setFontSize(8)
  doc.setTextColor(...SAND)
  doc.text('YAYASAN', M, 25)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(t.status === 'Lunas' ? 'INVOICE LUNAS' : 'INVOICE', W - M, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(nomorInvoice(t), W - M, 26, { align: 'right' })

  // Status
  let y = 52
  doc.setDrawColor(...status.fg)
  doc.setTextColor(...status.fg)
  doc.setLineWidth(0.6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const lebar = doc.getTextWidth(status.teks) + 10
  doc.roundedRect(W - M - lebar, y - 6, lebar, 9, 2, 2, 'S')
  doc.text(status.teks, W - M - lebar / 2, y, { align: 'center' })

  // Info kiri
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('DITAGIHKAN KEPADA', M, y - 2)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(d.ortu || '-', M, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text('Orang tua / wali dari ' + d.siswa.nama, M, y + 11)

  // Detail grid
  y += 24
  const kolom = [
    ['Nama siswa', d.siswa.nama],
    ['Kelas', d.siswa.kelas || '-'],
    ['NIS', d.siswa.nis || '-'],
    ['Tanggal terbit', t.terbit || '-'],
    ['Jatuh tempo', t.jatuhTempo || '-'],
    [t.dibayar ? 'Tanggal bayar' : 'Periode', t.dibayar || t.periode]
  ]
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(M, y - 5, W - M, y - 5)
  kolom.forEach((k, i) => {
    const cx = M + (i % 3) * 58
    const cy = y + Math.floor(i / 3) * 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(k[0].toUpperCase(), cx, cy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text(String(k[1]), cx, cy + 5.5)
  })
  y += 28
  doc.line(M, y - 5, W - M, y - 5)

  // Tabel rincian
  doc.setFillColor(244, 244, 244)
  doc.rect(M, y, W - 2 * M, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text('DESKRIPSI', M + 4, y + 6)
  doc.text('JUMLAH', W - M - 4, y + 6, { align: 'right' })
  y += 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...NAVY)
  doc.text(t.nama, M + 4, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text((t.jenis || 'Tagihan') + ' · ' + t.periode, M + 4, y + 13.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...NAVY)
  doc.text(rupiah(t.nominal), W - M - 4, y + 8, { align: 'right' })
  y += 19
  doc.setDrawColor(...LINE)
  doc.line(M, y, W - M, y)

  // Total
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text('Total tagihan', W - M - 70, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(rupiah(t.nominal), W - M - 4, y, { align: 'right' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(t.status === 'Lunas' ? 'Sudah dibayar' : 'Sisa yang harus dibayar', W - M - 70, y + 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...status.fg)
  doc.text(rupiah(t.nominal), W - M - 4, y + 4, { align: 'right' })

  // Cara bayar
  y += 20
  doc.setFillColor(237, 239, 251)
  doc.roundedRect(M, y, W - 2 * M, 36, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(t.status === 'Lunas' ? 'Terima kasih' : 'Cara pembayaran', M + 6, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const catatan = t.status === 'Lunas'
    ? 'Pembayaran tagihan ini sudah diverifikasi oleh Admin Yayasan (transfer ' + d.rekening + '). Invoice ini terbit otomatis setelah verifikasi dan berlaku sebagai bukti pembayaran.'
    : 'Transfer ke rekening ' + d.rekening + ' dengan nominal berkode unik dari aplikasi Finka, lalu unggah bukti transfer. Tagihan menjadi lunas setelah admin memverifikasi. Denda keterlambatan berlaku setelah tanggal jatuh tempo.'
  doc.text(doc.splitTextToSize(catatan, W - 2 * M - 12), M + 6, y + 15)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Dokumen ini dibuat otomatis oleh aplikasi Finka pada ' + d.dicetak + ' dan sah tanpa tanda tangan.', W / 2, 285, { align: 'center' })

  return { blob: doc.output('blob'), nama: namaFileInvoice(t) }
}
