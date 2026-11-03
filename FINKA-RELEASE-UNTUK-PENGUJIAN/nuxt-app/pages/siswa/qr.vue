<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="QR Saya" to="/siswa" dark />
    <div class="stage">
      <div class="kartu">
        <div class="kartu__brand">
          <svg class="kartu__logo" width="25" height="27" viewBox="0 0 40 44" aria-hidden="true">
            <rect x="13" y="0" width="27" height="14" rx="6" />
            <rect x="0" y="10" width="14" height="14" rx="6" />
            <rect x="9" y="15" width="24" height="14" rx="6" />
            <rect x="4" y="30" width="14" height="14" rx="6" />
          </svg>
          <span class="kartu__brand-name">FINKA</span>
          <span class="kartu__brand-label">KARTU SISWA</span>
        </div>
        <div class="kartu__who">
          <div class="av">{{ siswa.inisial }}</div>
          <div>
            <div class="nama display">{{ siswa.nama }}</div>
            <div class="sub">{{ siswa.kelas || '—' }} · NIS {{ siswa.nis || '—' }}</div>
          </div>
        </div>
        <div v-if="kartuDiblokir" class="qr qr--blocked">QR dinonaktifkan</div>
        <div v-else class="qr"><canvas ref="qr"></canvas></div>
        <div class="kartu__footer">
          <div class="garis"></div>
          <div class="timer">
            <i></i><span class="num">QR khusus siswa · Jangan dibagikan</span>
          </div>
        </div>
      </div>
      <div class="pinnote">🔒 <span>Setelah scan, kantin tetap meminta PIN 6 digit kamu</span></div>
      <div v-if="kartuDiblokir" class="blocked-notice" role="status">Kartu diblokir. Hubungi orang tua/wali untuk membuka blokir.</div>
      <div v-else-if="error" class="error" role="alert">{{ error }} <button type="button" @click="muatQr">Coba lagi</button></div>
      <div class="format-cetak">PDF seukuran kartu: 53,98 × 85,6 mm (portrait).</div>
      <button class="cetak" type="button" :disabled="!qrSiap || mengunduhKartu" @click="cetak">
        {{ mengunduhKartu ? 'Menyiapkan PDF…' : 'Unduh PDF kartu ukuran asli' }}
      </button>
      <div v-if="pdfError" class="error" role="alert">{{ pdfError }}</div>
      <button v-if="!kartuDiblokir" class="blokir-qr" type="button" :disabled="memblokir || memuat" @click="blokirKartu">{{ memblokir ? 'Memblokir kartu…' : 'Blokir kartu ini' }}</button>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode'
import { api } from '~/utils/api'

export default {


  data() { return { error: '', pdfError: '', memuat: false, memblokir: false, mengunduhKartu: false, kartuDiblokir: false, qrSiap: false } },
  computed: {
    siswa() { return this.$store.state['profil-siswa'].profil || { inisial: '', nama: '', kelas: '', nis: '' } }
  },
  async mounted() {
    await this.$store.dispatch('profil-siswa/muat')
    try {
      const control = await api.kontrolSaya(this.$store.state.auth.token)
      this.kartuDiblokir = Boolean(control.kartu_diblokir)
      if (!this.kartuDiblokir) await this.muatQr()
    } catch (e) {
      this.error = e.message || 'Status kartu gagal dimuat.'
    }
  },
  methods: {
    async muatQr() {
      if (this.memuat) return
      this.memuat = true; this.error = ''; this.qrSiap = false
      try {
        const data = await api.qrSiswa(this.$store.state.auth.token)
        await QRCode.toCanvas(this.$refs.qr, data.token, { width: 384, margin: 4, errorCorrectionLevel: 'H' })
        this.qrSiap = true
      } catch (e) { this.error = e.message || 'QR gagal dimuat' }
      finally { this.memuat = false }
    },
    async blokirKartu() {
      if (this.memblokir || this.memuat || this.kartuDiblokir) return
      if (!window.confirm('Blokir kartu ini? QR tidak dapat digunakan untuk transaksi sampai orang tua/wali membuka blokir.')) return
      this.memblokir = true
      this.error = ''
      try {
        await api.blokirKartuSaya(this.$store.state.auth.token)
        this.kartuDiblokir = true
        this.qrSiap = false
        const context = this.$refs.qr && this.$refs.qr.getContext('2d')
        if (context) context.clearRect(0, 0, this.$refs.qr.width, this.$refs.qr.height)
      } catch (e) {
        this.error = e.message || 'Gagal memblokir kartu.'
      } finally {
        this.memblokir = false
      }
    },
    async cetak() {
      if (!this.qrSiap || this.mengunduhKartu || !this.$refs.qr) return
      this.mengunduhKartu = true
      this.pdfError = ''
      try {
        const { jsPDF } = await import('jspdf')
        const width = 53.98
        const height = 85.6
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, height], compress: true })
        const margin = 1.5
        const headerHeight = 14
        const qrSize = 39
        const qrX = (width - qrSize) / 2
        const qrY = 33

        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin, margin, width - margin * 2, height - margin * 2, 2.5, 2.5, 'F')
        doc.setFillColor(10, 13, 59)
        doc.roundedRect(margin, margin, width - margin * 2, headerHeight, 2.5, 2.5, 'F')
        doc.rect(margin, margin + headerHeight / 2, width - margin * 2, headerHeight / 2, 'F')

        doc.setFillColor(255, 255, 255)
        doc.roundedRect(4, 4, 4, 2.3, 0.6, 0.6, 'F')
        doc.roundedRect(4, 5.8, 2.1, 2.2, 0.6, 0.6, 'F')
        doc.roundedRect(5.2, 7.1, 3.5, 2.1, 0.6, 0.6, 'F')
        doc.roundedRect(4.5, 9.1, 2.1, 2.1, 0.6, 0.6, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('FINKA', 10, 9.2)
        doc.setFontSize(5)
        doc.text('KARTU SISWA', width - 4, 9.1, { align: 'right' })

        doc.setFillColor(237, 239, 251)
        doc.circle(9, 22, 4, 'F')
        doc.setTextColor(30, 46, 187)
        doc.setFontSize(6)
        doc.text(String(this.siswa.inisial || '').slice(0, 2), 9, 22.8, { align: 'center' })
        doc.setTextColor(10, 13, 59)
        doc.setFontSize(8)
        const nama = doc.splitTextToSize(String(this.siswa.nama || 'Siswa'), width - 18).slice(0, 2)
        doc.text(nama, 15, 20.8)
        doc.setTextColor(75, 85, 99)
        doc.setFontSize(6)
        doc.text(`${this.siswa.kelas || '—'} · NIS ${this.siswa.nis || '—'}`, 15, 26.5)

        doc.setDrawColor(229, 231, 235)
        doc.setLineWidth(0.35)
        doc.roundedRect(qrX - 1.2, qrY - 1.2, qrSize + 2.4, qrSize + 2.4, 1.5, 1.5, 'S')
        doc.addImage(this.$refs.qr.toDataURL('image/png'), 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST')

        doc.setDrawColor(213, 218, 245)
        doc.line(4, 77, width - 4, 77)
        doc.setFillColor(30, 46, 187)
        doc.circle(5, 80.3, 0.7, 'F')
        doc.setTextColor(10, 13, 59)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.text('QR khusus siswa · Jangan dibagikan', 7, 81)

        const namaFile = String(this.siswa.nis || 'siswa').replace(/[^A-Za-z0-9._-]/g, '_')
        doc.save(`kartu-finka-${namaFile}.pdf`)
      } catch (error) {
        this.pdfError = error.message || 'PDF kartu tidak dapat dibuat.'
      } finally {
        this.mengunduhKartu = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 0 22px 30px; }
.kartu { box-sizing: border-box; background: #fff; border: 1px solid rgba(255,255,255,.55); border-radius: var(--r-lg); padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 260px; box-shadow: 0 14px 36px rgba(0,0,0,.2); }
.kartu__brand { align-self: stretch; display: flex; align-items: center; gap: 7px; margin: -18px -18px 0; padding: 12px 16px; border-radius: var(--r-lg) var(--r-lg) 0 0; background: var(--navy); color: #fff; }
.kartu__logo { flex: none; fill: currentColor; }
.kartu__brand-name { font: 800 17px/1 var(--font-display); letter-spacing: .1em; }
.kartu__brand-label { margin-left: auto; color: rgba(255,255,255,.78); font: 700 8px var(--font-body); letter-spacing: .08em; }
.kartu__who { display: flex; align-items: center; gap: 10px; align-self: stretch; }
.av {
  width: 38px; height: 38px; border-radius: var(--r-pill);
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center; font: 700 13px var(--font-display);
}
.nama { font: 700 14px var(--font-display); }
.sub { font: 400 11.5px var(--font-body); color: var(--muted); }
.qr { width: 100%; max-width: 210px; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
.qr--blocked { color: var(--coral); font: 600 12px var(--font-body); }
.qr canvas { width: 100% !important; height: auto !important; image-rendering: pixelated; }
.kartu__footer { align-self: stretch; }
.garis { height: 1px; margin-bottom: 10px; background: var(--line); }
.timer { display: flex; align-items: center; gap: 9px; font: 500 12px var(--font-body); color: var(--muted); }
.timer i { width: 7px; height: 7px; border-radius: var(--r-pill); background: var(--green); animation: fkPulse 1.6s ease-in-out infinite; }
.cetak { border: 1px solid rgba(255,255,255,.32); border-radius: var(--r-pill); padding: 10px 16px; background: transparent; color: #fff; font: 600 12px var(--font-body); cursor: pointer; }
.cetak:disabled { opacity: .5; cursor: wait; }
.blokir-qr { border: 1px solid rgba(255,255,255,.32); border-radius: var(--r-pill); padding: 10px 16px; background: transparent; color: #ffd4ce; font: 600 12px var(--font-body); cursor: pointer; }
.blokir-qr:disabled { opacity: .5; cursor: wait; }
.error { color: #ffd4ce; font: 500 12px var(--font-body); text-align: center; }
.error button { border: 0; background: transparent; color: #fff; font-weight: 700; cursor: pointer; }
.blocked-notice { color: #ffd4ce; font: 500 12px/1.5 var(--font-body); text-align: center; }
.format-cetak { color:rgba(255,255,255,.7); font:400 11px var(--font-body); text-align:center; }
.pinnote {
  display: flex; align-items: center; gap: 9px;
  background: rgba(255,255,255,.08); border-radius: var(--r-pill); padding: 9px 16px;
  font: 400 12px var(--font-body); color: rgba(255,255,255,.7);
}
</style>

<style>
@media print {
  @page { size:53.98mm 85.6mm; margin:0; }
  html, body { width:53.98mm !important; height:85.6mm !important; min-height:0 !important; margin:0 !important; padding:0 !important; overflow:hidden !important; background:#fff !important; }
  body * { visibility:hidden !important; }
  .stage { display:block !important; width:auto !important; height:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; }
  .phone { position:static !important; display:block !important; width:53.98mm !important; height:85.6mm !important; min-height:0 !important; overflow:visible !important; margin:0 !important; border:0 !important; border-radius:0 !important; }
  .wrap, .wrap .stage, .wrap .stage * { visibility:visible !important; }
  .wrap { position:static !important; display:block !important; width:53.98mm !important; height:85.6mm !important; min-height:0 !important; overflow:visible !important; margin:0 !important; padding:0 !important; background:#fff !important; color:#111 !important; }
  .wrap .stage { display:block !important; box-sizing:border-box !important; width:53.98mm !important; height:85.6mm !important; min-height:0 !important; margin:0 !important; padding:0 !important; }
  .wrap .kartu { box-sizing:border-box !important; flex:none !important; width:53.98mm !important; min-width:53.98mm !important; max-width:53.98mm !important; height:85.6mm !important; min-height:85.6mm !important; max-height:85.6mm !important; margin:0 !important; padding:0 3mm 3mm !important; border:0.35mm solid #0A0D3B !important; border-radius:3mm !important; box-shadow:none !important; display:flex !important; flex-direction:column !important; align-items:stretch !important; justify-content:flex-start !important; gap:2.5mm !important; overflow:hidden !important; page-break-inside:avoid !important; break-inside:avoid !important; print-color-adjust:exact !important; -webkit-print-color-adjust:exact !important; }
  .wrap .kartu__brand { flex:none !important; margin:0 -3mm !important; padding:3mm !important; border-radius:2.5mm 2.5mm 0 0 !important; background:#0A0D3B !important; color:#fff !important; }
  .wrap .kartu__logo { width:6mm !important; height:6.5mm !important; }
  .wrap .kartu__brand-name { color:#fff !important; font-size:11pt !important; }
  .wrap .kartu__brand-label { color:#dce4ff !important; font-size:5.5pt !important; }
  .wrap .kartu__who { flex:none !important; align-self:stretch !important; width:100% !important; gap:2mm !important; }
  .wrap .av { display:flex !important; width:8mm !important; height:8mm !important; flex:none !important; background:#EDEFFB !important; color:#1E2EBB !important; font-size:7pt !important; }
  .wrap .nama { color:#0A0D3B !important; font-size:9pt !important; }
  .wrap .sub { color:#4b5563 !important; font-size:6.5pt !important; }
  .wrap .qr { flex:1 1 auto !important; align-self:center !important; width:39mm !important; height:39mm !important; min-height:39mm !important; max-width:none !important; aspect-ratio:1 !important; border:0.4mm solid #E5E7EB !important; border-radius:2mm !important; padding:1mm !important; background:#fff !important; }
  .wrap .qr canvas { display:block !important; width:37mm !important; height:37mm !important; max-width:none !important; max-height:none !important; image-rendering:pixelated; }
  .wrap .kartu__footer { flex:none !important; align-self:stretch !important; }
  .wrap .garis { display:block !important; height:.25mm !important; margin-bottom:1.5mm !important; background:#d5daf5 !important; }
  .wrap .timer { font-size:6pt !important; color:#0A0D3B !important; }
  .wrap .timer i { display:block !important; width:1.5mm !important; height:1.5mm !important; background:#1E2EBB !important; animation:none !important; }
  .wrap .timer span { color:#0A0D3B !important; }
  .wrap .pinnote, .wrap .format-cetak, .wrap .cetak, .wrap .blokir-qr, .wrap .blocked-notice, .wrap .error { display:none !important; }
}
</style>
