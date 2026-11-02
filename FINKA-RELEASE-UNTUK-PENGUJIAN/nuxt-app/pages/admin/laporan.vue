<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div class="card rekon">
      <div class="rekon__head">
        <div>
          <div class="h display">Rekonsiliasi harian — 1 September 2026</div>
          <div class="sub">Uang masuk, uang keluar, dan perubahan saldo agregat harus nol selisih</div>
        </div>
        <div class="ekspor">
          <button type="button" class="btn-sm" :disabled="exportingPdf" @click="eksporPdf">{{ exportingPdf ? 'Membuat PDF…' : 'Ekspor PDF' }}</button>
          <button type="button" class="btn-sm" @click="eksporExcel">Ekspor Excel</button>
        </div>
      </div>
      <p v-if="pdfError" class="pdf-error" role="alert">{{ pdfError }}</p>
      <div class="grid">
        <div v-for="r in rekon" :key="r.label" class="box" :class="r.bad ? 'box--bad' : ''">
          <div class="box__label">{{ r.label }}</div>
          <div class="box__nilai display num" :style="'color:' + (r.bad ? 'var(--coral)' : 'var(--ink)')">{{ r.nilai }}</div>
          <div class="box__ket">{{ r.ket }}</div>
        </div>
      </div>
    </div>

    <div class="card tabel">
      <div class="tabel__head h display">Ringkasan per outlet — 1–2 September</div>
      <div class="baris baris--head">
        <div>OUTLET</div><div>TRANSAKSI</div><div>OMZET</div><div>RATA-RATA</div><div>VOID / REFUND</div>
      </div>
      <div v-for="l in rows" :key="l.nama" class="baris">
        <div><b>{{ l.nama }}</b><i>PIC {{ l.pic }}</i></div>
        <div class="muted num">{{ l.trx }}</div>
        <div class="tebal num">{{ l.omzet | rp }}</div>
        <div class="muted num">{{ l.rata | rp }}</div>
        <div class="tebal num" :style="'color:' + (l.void > 50000 ? 'var(--coral)' : l.void ? 'var(--sand-ink)' : 'var(--muted)')">{{ l.void | rp }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return { exportingPdf: false, pdfError: '' }
  },
  computed: {
    // Data top-up mengalir langsung dari store admin (diisi realtime dari halaman
    // Verifikasi Top-up), sehingga setiap Setujui/Tolak langsung terlihat di sini
    // tanpa perlu reload halaman.
    totalTopup() { return this.$store.getters['admin/totalDisetujui'] },
    jumlahTopup() { return this.$store.getters['admin/jumlahDisetujui'] },
    rekon() {
      const posTotal = 3241000
      const posStruk = 386
      const seharusnya = this.totalTopup - posTotal
      const selisih = 24000 // selisih yang belum tertelusuri (contoh kasus rekonsiliasi)
      const tercatat = seharusnya - selisih
      return [
        { label: 'Top-up disetujui', nilai: this.$rp(this.totalTopup), ket: this.jumlahTopup + ' permintaan' },
        { label: 'Transaksi POS', nilai: this.$rp(posTotal), ket: posStruk + ' struk' },
        { label: 'Perubahan saldo agregat', nilai: this.$rp(tercatat), ket: 'seharusnya ' + this.$rp(seharusnya) },
        { label: 'Selisih', nilai: '− ' + this.$num(selisih), ket: 'perlu ditelusuri', bad: true }
      ]
    },
    rows() {
      return [
        { nama: 'Kantin Utama', pic: 'Bu Ratna', trx: 214, omzet: 1840000, rata: 8598, void: 30000 },
        { nama: 'Kantin Blok B', pic: 'Bu Lilis', trx: 97, omzet: 760000, rata: 7835, void: 0 },
        { nama: 'Koperasi Sekolah', pic: 'Pak Yusuf', trx: 36, omzet: 385000, rata: 10694, void: 85000 },
        { nama: 'Ambil tunai (kasir)', pic: 'Bu Ratna', trx: 12, omzet: 640000, rata: 53333, void: 0 }
      ]
    }
  },
  methods: {
    unduhCsv(nama, head, baris) {
      const escapeCell = (value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'
      const csv = [head].concat(baris).map((row) => row.map(escapeCell).join(';')).join('\r\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nama
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    eksporExcel() {
      const head = ['Outlet', 'PIC', 'Transaksi', 'Omzet', 'Rata-rata', 'Void/Refund']
      const baris = this.rows.map((l) => [l.nama, l.pic, l.trx, l.omzet, l.rata, l.void])
      this.unduhCsv('rekonsiliasi-1-september-2026.csv', head, baris)
    },
    async eksporPdf() {
      if (this.exportingPdf) return
      this.exportingPdf = true
      this.pdfError = ''
      try {
        const mod = await import('jspdf')
        const JsPDF = mod.jsPDF || mod.default
        const doc = new JsPDF({ unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()
        const margin = 16
        const blue = [30, 46, 187]
        const navy = [10, 13, 59]
        const muted = [107, 114, 128]
        const line = [229, 231, 235]
        const today = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())
        let y = 20

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(...navy)
        doc.text('Finka - Laporan Rekonsiliasi', margin, y)
        y += 7
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...muted)
        doc.text('Dicetak pada ' + today, margin, y)
        y += 11
        doc.setDrawColor(...line)
        doc.line(margin, y, pageWidth - margin, y)
        y += 9

        const summaryWidth = (pageWidth - margin * 2 - 8) / 2
        this.rekon.forEach((item, index) => {
          const col = index % 2
          const row = Math.floor(index / 2)
          const x = margin + col * (summaryWidth + 8)
          const boxY = y + row * 27
          doc.setDrawColor(...(item.bad ? [223, 74, 55] : line))
          doc.roundedRect(x, boxY, summaryWidth, 22, 2, 2, 'S')
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...muted)
          doc.text(item.label, x + 4, boxY + 6)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.setTextColor(...(item.bad ? [223, 74, 55] : navy))
          doc.text(String(item.nilai), x + 4, boxY + 13)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(...muted)
          doc.text(String(item.ket), x + 4, boxY + 18)
        })
        y += 66

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...navy)
        doc.text('Ringkasan per outlet - 1-2 September', margin, y)
        y += 7

        const columns = [
          { label: 'OUTLET / PIC', x: margin, width: 59 },
          { label: 'TRANSAKSI', x: margin + 60, width: 26 },
          { label: 'OMZET', x: margin + 89, width: 30 },
          { label: 'RATA-RATA', x: margin + 122, width: 27 },
          { label: 'VOID / REFUND', x: margin + 152, width: 26 }
        ]
        doc.setFillColor(244, 244, 244)
        doc.rect(margin, y, pageWidth - margin * 2, 9, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...muted)
        columns.forEach((column) => doc.text(column.label, column.x + 2, y + 6))
        y += 9

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        this.rows.forEach((row) => {
          doc.setDrawColor(...line)
          doc.line(margin, y + 10, pageWidth - margin, y + 10)
          doc.setTextColor(...navy)
          doc.text(String(row.nama), margin + 2, y + 5)
          doc.setFontSize(7)
          doc.setTextColor(...muted)
          doc.text('PIC ' + String(row.pic), margin + 2, y + 9)
          doc.setFontSize(8.5)
          doc.setTextColor(...navy)
          doc.text(String(row.trx), columns[1].x + 2, y + 6)
          doc.text(this.$rp(row.omzet), columns[2].x + 2, y + 6)
          doc.text(this.$rp(row.rata), columns[3].x + 2, y + 6)
          doc.text(this.$rp(row.void), columns[4].x + 2, y + 6)
          y += 11
        })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...muted)
        doc.text('Dokumen dibuat otomatis oleh aplikasi Finka.', margin, 282)
        const namaFile = 'rekonsiliasi-harian-' + new Date().toISOString().slice(0, 10) + '.pdf'
        const pdfBlob = doc.output('blob')
        if (typeof window.showSaveFilePicker === 'function') {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: namaFile,
            types: [{ description: 'Dokumen PDF', accept: { 'application/pdf': ['.pdf'] } }]
          })
          const file = await fileHandle.createWritable()
          await file.write(pdfBlob)
          await file.close()
        } else {
          doc.save(namaFile)
        }
      } catch (error) {
        if (error.name !== 'AbortError') this.pdfError = error.message || 'Gagal membuat file PDF.'
      } finally {
        this.exportingPdf = false
      }
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
.rekon { padding: 22px; display: flex; flex-direction: column; gap: 20px; }
.rekon__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.h { font: 700 15px var(--font-display); }
.sub { font: 400 12.5px var(--font-body); color: var(--muted); margin-top: 3px; }
.ekspor { display: flex; gap: 9px; }
.btn-sm { border: 1px solid var(--blue); background: var(--blue); color: #fff; font: 600 12.5px var(--font-body); padding: 9px 15px; border-radius: var(--r-sm); cursor: pointer; }
.btn-sm:hover:not(:disabled) { border-color: var(--blue-dark); background: var(--blue-dark); }
.btn-sm:focus-visible { outline: 3px solid rgba(30, 46, 187, .3); outline-offset: 2px; }

.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.box { border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 7px; }
.box--bad { border-color: var(--coral); background: rgba(223,74,55,.04); }
.box__label { font: 500 11.5px var(--font-body); color: var(--muted); }
.box__nilai { font: 800 22px var(--font-display); letter-spacing: -.02em; }
.box__ket { font: 400 11px var(--font-body); color: var(--muted); }

.tabel { overflow: hidden; }
.tabel__head { padding: 16px 20px; border-bottom: 1px solid var(--line); font-size: 14px; }
.baris { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr; padding: 14px 20px; border-top: 1px solid var(--bg); align-items: center; }
.baris--head { padding: 11px 20px; background: var(--bg); border-top: none; font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .03em; }
.baris b { display: block; font: 600 13px var(--font-body); }
.baris i { display: block; font: 400 11px var(--font-body); color: var(--muted); font-style: normal; margin-top: 1px; }
.muted { font: 400 13px var(--font-body); color: var(--muted); }
.tebal { font: 600 13px var(--font-body); }
.pdf-error { margin: 0; color: var(--coral); font: 400 12px/1.5 var(--font-body); }
.btn-sm:disabled { cursor: wait; opacity: .65; }
</style>
