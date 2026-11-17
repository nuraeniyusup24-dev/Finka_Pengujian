// Struk digital transaksi kasir (PIC), ukuran kertas thermal 80 mm.
// Dibuat dengan jsPDF (dimuat dinamis) supaya hasil cetak/unduh selalu sama,
// tidak bergantung pada pengaturan kertas browser. Tinggi kertas mengikuti isi struk.

const LEBAR = 80
const MARGIN = 5
const KANAN = LEBAR - MARGIN
const ISI = LEBAR - MARGIN * 2
const LEBAR_NILAI = ISI * 0.62
const TINGGI_BARIS = 3.4

const HITAM = [17, 17, 17]
const ABU = [100, 100, 100]
const GARIS = [150, 150, 150]

const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')

// "17 Nov 2026, 12.01" (zona waktu WIB)
export function formatWaktuStruk(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = {}
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta'
  }).formatToParts(date).forEach((p) => { parts[p.type] = p.value })
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}.${parts.minute}`
}

export function namaFileStruk(idTrx) {
  return `Struk_FINKA_${String(idTrx || 'Digital').replace(/[^\w.-]+/g, '_')}.pdf`
}

function gambar(doc, d) {
  const tengah = LEBAR / 2
  let y = 9

  const warna = (c) => doc.setTextColor(c[0], c[1], c[2])
  const font = (gaya, ukuran) => { doc.setFont('helvetica', gaya); doc.setFontSize(ukuran) }
  const teks = (t, x, yy, opsi) => doc.text(String(t), x, yy, opsi)

  const garis = () => {
    doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2])
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([0.8, 0.8], 0)
    doc.line(MARGIN, y, KANAN, y)
    doc.setLineDashPattern([], 0)
    y += 4.2
  }

  const baris = (label, nilai, tebal) => {
    const lines = doc.splitTextToSize(String(nilai === undefined || nilai === null || nilai === '' ? '—' : nilai), LEBAR_NILAI)
    font('normal', 7.5); warna(ABU)
    teks(label, MARGIN, y)
    font(tebal ? 'bold' : 'normal', 7.5); warna(HITAM)
    lines.forEach((l, i) => teks(l, KANAN, y + i * TINGGI_BARIS, { align: 'right' }))
    y += lines.length * TINGGI_BARIS + 1.1
  }

  // Kepala struk
  font('bold', 15); warna(HITAM)
  teks('FINKA', tengah, y, { align: 'center' }); y += 4.6
  font('normal', 6.5); warna(ABU)
  teks('STRUK DIGITAL', tengah, y, { align: 'center' }); y += 6
  font('bold', 8); warna(HITAM)
  teks('TRANSAKSI BERHASIL', tengah, y, { align: 'center' }); y += 5
  font('bold', 9.5)
  teks(d.tunai ? 'Penarikan tunai' : 'Pembelian kantin', tengah, y, { align: 'center' }); y += 7.2
  font('bold', 17)
  teks('-' + rp(d.total), tengah, y, { align: 'center' }); y += 5.5
  font('normal', 7); warna(ABU)
  teks(formatWaktuStruk(d.waktu), tengah, y, { align: 'center' }); y += 5
  garis()

  // Identitas siswa
  baris('Siswa', d.namaSiswa)
  if (d.kelas) baris('Kelas', d.kelas)
  if (d.nis) baris('NIS', d.nis)
  garis()

  // Rincian
  font('bold', 8); warna(HITAM)
  teks(d.tunai ? 'Rincian penarikan' : 'Rincian pembelian', MARGIN, y); y += 4.6
  ;(d.items || []).forEach((it) => {
    const nama = doc.splitTextToSize(String(it.nama || '—'), LEBAR_NILAI)
    font('normal', 7.5); warna(HITAM)
    nama.forEach((l, i) => teks(l, MARGIN, y + i * TINGGI_BARIS))
    font('bold', 7.5)
    teks(rp(it.harga), KANAN, y, { align: 'right' })
    y += nama.length * TINGGI_BARIS
    if (!d.tunai) {
      const qty = Number(it.qty) || 1
      font('normal', 6.5); warna(ABU)
      teks(`${qty} × ${rp(Number(it.harga) / qty)}`, MARGIN, y)
      y += 3
    }
    y += 1.2
  })
  garis()

  // Ringkasan transaksi
  baris('ID transaksi', d.idTrx, true)
  baris('Kasir', d.kasir, true)
  baris('Outlet', d.outlet, true)
  baris('Total', rp(d.total), true)
  if (d.tunai) baris('Tunai diserahkan', rp(d.total), true)
  baris('Saldo sebelum', rp(d.sebelum), true)
  baris('Saldo sesudah', rp(d.sisa), true)
  garis()

  // Kaki struk
  font('normal', 6.5); warna(ABU)
  teks('Struk digital ini sah tanpa tanda tangan.', tengah, y, { align: 'center' }); y += 3.2
  teks('Terima kasih telah menggunakan FINKA.', tengah, y, { align: 'center' }); y += 3.2
  return y
}

// data: { idTrx, tunai, total, namaSiswa, kelas, nis, items:[{nama, qty, harga}],
//         outlet, kasir, waktu, sebelum, sisa }
export async function buatStrukPdf(data) {
  const { jsPDF } = await import('jspdf')
  // Lintasan pertama hanya untuk mengukur tinggi isi, lintasan kedua membuat kertas yang pas.
  const ukur = new jsPDF({ unit: 'mm', format: [LEBAR, 500] })
  const tinggi = Math.max(gambar(ukur, data) + 5, 60)
  const doc = new jsPDF({ unit: 'mm', format: [LEBAR, tinggi], compress: true })
  doc.setProperties({ title: `Struk FINKA ${data.idTrx || ''}`.trim(), creator: 'FINKA' })
  gambar(doc, data)
  return doc
}

const esc = (v) => String(v === undefined || v === null || v === '' ? '—' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Struk dalam bentuk HTML (tata letak sama dengan PDF) khusus untuk dicetak lewat dialog cetak browser.
export function buatStrukHtml(d) {
  const baris = (label, nilai, tebal) =>
    `<div class="r${tebal ? ' b' : ''}"><span>${esc(label)}</span><span>${esc(nilai)}</span></div>`
  const items = (d.items || []).map((it) => {
    const qty = Number(it.qty) || 1
    return `<div class="r it"><span class="n">${esc(it.nama)}</span><span class="h">${rp(it.harga)}</span></div>` +
      (d.tunai ? '' : `<div class="q">${qty} × ${rp(Number(it.harga) / qty)}</div>`)
  }).join('')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Struk FINKA ${esc(d.idTrx)}</title>
<style>
@page { size: 80mm 200mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: 80mm; padding: 6mm 5mm 5mm; font: 7.5pt/1.4 Helvetica, Arial, sans-serif; color: #111;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.c { text-align: center; }
.m { color: #646464; }
.logo { font-size: 15pt; font-weight: 700; line-height: 1.1; }
.s65 { font-size: 6.5pt; margin-top: 1mm; }
.ok { font-size: 8pt; font-weight: 700; margin-top: 3mm; }
.jdl { font-size: 9.5pt; font-weight: 700; margin-top: 1.5mm; }
.nom { font-size: 17pt; font-weight: 700; line-height: 1.2; margin-top: 1mm; }
.wkt { font-size: 7pt; margin-top: 1mm; }
hr { border: 0; border-top: 1px dashed #969696; margin: 3.2mm 0; }
.r { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; margin: 0 0 1mm; }
.r > span:first-child { flex: none; color: #646464; }
.r > span:last-child { max-width: 62%; text-align: right; overflow-wrap: anywhere; }
.r.b > span:last-child { font-weight: 700; color: #111; }
.sec { font-size: 8pt; font-weight: 700; margin-bottom: 1.5mm; }
.r.it > span:first-child { color: #111; flex: 1; max-width: 62%; }
.r.it > span:last-child { font-weight: 700; }
.q { font-size: 6.5pt; color: #646464; margin: -0.5mm 0 1.4mm; }
.f { font-size: 6.5pt; line-height: 1.5; }
</style></head><body>
<div class="c logo">FINKA</div>
<div class="c m s65">STRUK DIGITAL</div>
<div class="c ok">TRANSAKSI BERHASIL</div>
<div class="c jdl">${d.tunai ? 'Penarikan tunai' : 'Pembelian kantin'}</div>
<div class="c nom">-${rp(d.total)}</div>
<div class="c m wkt">${esc(formatWaktuStruk(d.waktu))}</div>
<hr>
${baris('Siswa', d.namaSiswa)}${d.kelas ? baris('Kelas', d.kelas) : ''}${d.nis ? baris('NIS', d.nis) : ''}
<hr>
<div class="sec">${d.tunai ? 'Rincian penarikan' : 'Rincian pembelian'}</div>
${items}
<hr>
${baris('ID transaksi', d.idTrx, true)}${baris('Kasir', d.kasir, true)}${baris('Outlet', d.outlet, true)}${baris('Total', rp(d.total), true)}${d.tunai ? baris('Tunai diserahkan', rp(d.total), true) : ''}${baris('Saldo sebelum', rp(d.sebelum), true)}${baris('Saldo sesudah', rp(d.sisa), true)}
<hr>
<div class="c m f">Struk digital ini sah tanpa tanda tangan.<br>Terima kasih telah menggunakan FINKA.</div>
</body></html>`
}

// Mencetak struk lewat iframe tersembunyi yang satu origin dengan aplikasi, sehingga dialog
// cetak browser hanya berisi struk (bukan halaman aplikasi). Tinggi kertas disesuaikan isi.
// Mengembalikan true bila dialog cetak sudah dipanggil, false bila browser menolak.
export function cetakStrukHtml(data, batasWaktuMs = 6000) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return }
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.setAttribute('tabindex', '-1')
    frame.title = 'Cetak struk'
    Object.assign(frame.style, {
      position: 'fixed', left: '-10000px', top: '0', width: '80mm', height: '100px',
      border: '0', opacity: '0', pointerEvents: 'none'
    })
    let selesai = false
    const lepas = () => { if (frame.parentNode) frame.remove() }
    const akhiri = (hasil) => {
      if (selesai) return
      selesai = true
      clearTimeout(pembatas)
      if (!hasil) lepas()
      resolve(hasil)
    }
    const pembatas = setTimeout(() => akhiri(false), batasWaktuMs)
    frame.onload = () => {
      setTimeout(() => {
        try {
          const w = frame.contentWindow
          const d = w.document
          const mm = Math.ceil((d.documentElement.scrollHeight * 25.4) / 96) + 4
          const gaya = d.createElement('style')
          gaya.textContent = `@page { size: 80mm ${Math.max(mm, 60)}mm; margin: 0; }`
          d.head.appendChild(gaya)
          w.onafterprint = () => setTimeout(lepas, 500)
          setTimeout(lepas, 300000)
          w.focus()
          w.print()
          akhiri(true)
        } catch (e) {
          akhiri(false)
        }
      }, 150)
    }
    frame.srcdoc = buatStrukHtml(data)
    document.body.appendChild(frame)
  })
}