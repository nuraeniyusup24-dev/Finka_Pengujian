/**
 * Membuat & mengunduh struk sebagai PDF langsung dengan jsPDF
 * (tanpa html2canvas, jadi tidak perlu dependensi tambahan).
 *
 * struk = { nomor, judul, status, statusLabel, nominalLabel, waktuLabel,
 *           baris: [[label, nilai], ...], items: [{nama, qty}], siswa: {nama,kelas,nis} }
 */
export async function unduhStrukPdf(struk) {
  const mod = await import('jspdf')
  const JsPDF = mod.jsPDF || mod.default
  const W = 80, M = 6
  const lebar = W - M * 2
  // Hitung tinggi dulu agar halaman pas dengan isi
  const bikin = (doc) => {
    let y = 10
    const teks = (t, x, opt = {}) => doc.text(String(t), x, y, opt)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); teks('FINKA', W / 2, { align: 'center' }); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100); teks('STRUK DIGITAL', W / 2, { align: 'center' }); y += 7
    doc.setTextColor(0)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); teks(struk.statusLabel, W / 2, { align: 'center' }); y += 6
    doc.setFontSize(11); teks(struk.judul, W / 2, { align: 'center' }); y += 7
    doc.setFontSize(15); teks(struk.nominalLabel, W / 2, { align: 'center' }); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100); teks(struk.waktuLabel, W / 2, { align: 'center' }); y += 6
    doc.setTextColor(0)
    const garis = () => { doc.setDrawColor(190); doc.setLineDash([1, 1], 0); doc.line(M, y, W - M, y); doc.setLineDash([]); y += 5 }
    garis()
    const baris = (a, b, tebal) => {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100)
      const kiri = doc.splitTextToSize(String(a), lebar * 0.38)
      doc.text(kiri, M, y)
      doc.setTextColor(0); doc.setFont('helvetica', tebal ? 'bold' : 'normal')
      const kanan = doc.splitTextToSize(String(b), lebar * 0.58)
      doc.text(kanan, W - M, y, { align: 'right' })
      y += Math.max(kiri.length, kanan.length) * 4 + 1.5
    }
    if (struk.siswa && struk.siswa.nama) {
      baris('Siswa', struk.siswa.nama)
      if (struk.siswa.kelas) baris('Kelas', struk.siswa.kelas)
      if (struk.siswa.nis) baris('NIS', struk.siswa.nis)
      garis()
    }
    if (struk.items && struk.items.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); teks('Rincian pembelian', M); y += 5
      struk.items.forEach(it => baris(it.nama, 'x' + it.qty))
      garis()
    }
    struk.baris.forEach(([a, b]) => baris(a, b, true))
    garis()
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120)
    teks('Struk digital ini sah tanpa tanda tangan.', W / 2, { align: 'center' }); y += 4
    teks('Terima kasih telah menggunakan FINKA.', W / 2, { align: 'center' }); y += 4
    return y
  }
  const ukur = new JsPDF({ unit: 'mm', format: [W, 400] })
  const tinggi = Math.max(120, Math.ceil(bikin(ukur)) + 6)
  const doc = new JsPDF({ unit: 'mm', format: [W, tinggi] })
  bikin(doc)
  doc.save('Struk_FINKA_' + String(struk.nomor).replace(/[^\w-]/g, '') + '.pdf')
}

const TIPE = {
  topup: 'Top-up saldo', pembelian: 'Pembelian kantin', tarik_tunai: 'Tarik tunai',
  bayar_tagihan: 'Pembayaran tagihan', penyesuaian: 'Penyesuaian saldo'
}

/** Ubah respons /siswa/:id/struk/:ledgerId menjadi struk siap tampil/unduh. */
export function susunStruk(d, rp, waktu, opsi = {}) {
  const batal = d.status === 'dibatalkan'
  const baris = []
  if (opsi.siswa && d.siswa && d.siswa.nama) baris.push(['Siswa', d.siswa.nama + (d.siswa.kelas ? ' · ' + d.siswa.kelas : '')])
  baris.push(['ID transaksi', d.nomor])
  if (d.oleh) baris.push([d.tipe === 'topup' ? 'Diproses oleh' : 'Kasir', d.oleh])
  if (d.outlet) baris.push(['Outlet', d.outlet])
  if (d.keterangan && d.tipe !== 'pembelian') baris.push(['Keterangan', d.keterangan])
  baris.push(['Saldo sebelum', rp(d.saldo_sebelum)], ['Saldo sesudah', rp(d.saldo_sesudah)])
  if (batal) baris.push(['Status', 'Dibatalkan' + (d.alasan_batal ? ' – ' + d.alasan_batal : '')])
  return {
    nomor: d.nomor, judul: TIPE[d.tipe] || 'Transaksi', status: d.status,
    statusLabel: batal ? 'TRANSAKSI DIBATALKAN' : 'TRANSAKSI BERHASIL',
    nominalLabel: (d.masuk ? '+' : '-') + rp(Math.abs(d.nominal)),
    waktuLabel: waktu(d.waktu), baris, items: d.items || [], siswa: d.siswa
  }
}

/** Struk untuk permintaan top-up / pembayaran tagihan (halaman orang tua). */
export function susunStrukPembayaran(p, rp, waktu) {
  const NAMA = { menunggu: 'Menunggu verifikasi', disetujui: 'Disetujui', ditolak: 'Ditolak' }
  const baris = [['ID permintaan', 'TU-' + p.id], ['Status', NAMA[p.status] || String(p.status || '-')]]
  if (p.kode_unik) baris.push(['Kode unik', String(p.kode_unik)])
  if (p.total_transfer) baris.push(['Total transfer', rp(p.total_transfer)])
  if (p.diproses_at) baris.push(['Diproses', waktu(p.diproses_at)])
  if (p.alasan_tolak) baris.push(['Alasan penolakan', p.alasan_tolak])
  const status = p.status === 'ditolak' ? 'dibatalkan' : p.status === 'menunggu' ? 'menunggu' : 'berhasil'
  const label = { menunggu: 'MENUNGGU VERIFIKASI', dibatalkan: 'PEMBAYARAN DITOLAK', berhasil: 'PEMBAYARAN DISETUJUI' }[status]
  return {
    nomor: 'TU-' + p.id, judul: p.tagihan_id ? 'Pembayaran tagihan' : 'Top-up saldo',
    status, statusLabel: label,
    nominalLabel: rp(p.nominal), waktuLabel: waktu(p.waktu), baris, items: [],
    siswa: { nama: p.siswa, kelas: '', nis: '' }
  }
}
