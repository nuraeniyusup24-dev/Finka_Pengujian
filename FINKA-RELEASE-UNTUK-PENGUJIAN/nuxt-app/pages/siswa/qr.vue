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
        <div class="kartu__who">
          <div class="av">{{ siswa.inisial }}</div>
          <div>
            <div class="nama display">{{ siswa.nama }}</div>
            <div class="sub">{{ siswa.kelas || '—' }} - NIS {{ siswa.nis || '—' }}</div>
          </div>
        </div>
        <div v-if="kartuDiblokir" class="qr qr--blocked">QR dinonaktifkan</div>
        <div v-else class="qr"><canvas ref="qr"></canvas></div>
        <div class="garis"></div>
        <div class="timer">
          <i></i><span class="num">QR kartu tetap khusus · Jaga dengan baik, jangan sampai hilang</span>
        </div>
      </div>
      <div class="pinnote">🔒 <span>Setelah scan, kantin tetap meminta PIN 6 digit kamu</span></div>
      <div v-if="kartuDiblokir" class="blocked-notice" role="status">Kartu diblokir. Hubungi orang tua/wali untuk membuka blokir.</div>
      <div v-else-if="error" class="error" role="alert">{{ error }} <button type="button" @click="muatQr">Coba lagi</button></div>
      <div class="format-cetak">Ukuran kartu standar: 85,6 × 54 mm.</div>
      <button class="cetak" type="button" :disabled="!qrSiap" @click="cetak">Simpan / cetak QR kartu</button>
      <button v-if="!kartuDiblokir" class="blokir-qr" type="button" :disabled="memblokir || memuat" @click="blokirKartu">{{ memblokir ? 'Memblokir kartu…' : 'Blokir kartu ini' }}</button>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode'
import { api } from '~/utils/api'

export default {


  data() { return { error: '', memuat: false, memblokir: false, kartuDiblokir: false, qrSiap: false } },
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
    cetak() { if (this.qrSiap) window.print() }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 0 22px 30px; }
.kartu { box-sizing: border-box; background: #fff; border-radius: var(--r-lg); padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 294px; }
.kartu__who { display: flex; align-items: center; gap: 10px; align-self: stretch; }
.av {
  width: 38px; height: 38px; border-radius: var(--r-pill);
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center; font: 700 13px var(--font-display);
}
.nama { font: 700 14px var(--font-display); }
.sub { font: 400 11.5px var(--font-body); color: var(--muted); }
.qr { width: 100%; max-width: 230px; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
.qr--blocked { color: var(--coral); font: 600 12px var(--font-body); }
.qr canvas { width: 100% !important; height: auto !important; image-rendering: pixelated; }
.garis { align-self: stretch; height: 1px; background: var(--line); }
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
  @page { size:85.6mm 54mm; margin:0; }
  html, body { width:85.6mm !important; height:54mm !important; min-height:0 !important; margin:0 !important; padding:0 !important; overflow:hidden !important; background:#fff !important; }
  body * { visibility:hidden !important; }
  .stage { display:block !important; width:auto !important; height:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; }
  .phone { position:static !important; display:block !important; width:auto !important; height:auto !important; min-height:0 !important; overflow:visible !important; margin:0 !important; border:0 !important; border-radius:0 !important; }
  .wrap, .wrap .stage, .wrap .stage * { visibility:visible !important; }
  .wrap { position:static !important; display:block !important; width:auto !important; height:auto !important; min-height:0 !important; overflow:visible !important; margin:0 !important; padding:0 !important; background:#fff !important; color:#111 !important; }
  .wrap .stage { display:block !important; box-sizing:border-box !important; width:auto !important; height:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; }
  .wrap .kartu { box-sizing:border-box !important; flex:none !important; width:85.6mm !important; min-width:85.6mm !important; max-width:85.6mm !important; height:54mm !important; min-height:54mm !important; max-height:54mm !important; margin:0 !important; padding:2mm !important; border:0.25mm solid #222 !important; border-radius:2mm !important; box-shadow:none !important; display:grid !important; grid-template-columns:1fr !important; grid-template-rows:auto 1fr auto !important; align-items:center !important; justify-items:center !important; gap:1mm !important; page-break-inside:avoid !important; break-inside:avoid !important; }
  .wrap .kartu__who { grid-column:1; grid-row:1; align-self:center; width:100%; gap:2mm !important; }
  .wrap .av { display:none !important; }
  .wrap .nama { color:#111 !important; font-size:9pt !important; }
  .wrap .sub { color:#333 !important; font-size:7pt !important; }
  .wrap .qr { grid-column:1; grid-row:2; width:31mm !important; height:31mm !important; }
  .wrap .qr canvas { display:block !important; width:31mm !important; height:31mm !important; max-width:none !important; max-height:none !important; image-rendering:pixelated; }
  .wrap .garis { display:none !important; }
  .wrap .timer { grid-column:1; grid-row:3; font-size:5.5pt !important; color:#333 !important; }
  .wrap .timer i { display:none !important; }
  .wrap .pinnote, .wrap .format-cetak, .wrap .cetak, .wrap .blokir-qr, .wrap .blocked-notice, .wrap .error { display:none !important; }
}
</style>
