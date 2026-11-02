<template>
  <div class="qrcode" :style="{ width: size + 'px', height: size + 'px' }" v-html="svg"></div>
</template>

<script>
// QR code asli (bukan pola dekoratif) — isinya data siswa (NIS + nama) supaya
// bisa dipindai sungguhan oleh kamera di halaman scan PIC (lihat pages/pic/scan.vue).
import QRCode from 'qrcode'

export default {
  name: 'QrCode',
  props: {
    // Nilai yang di-encode ke QR. Gunakan helper encodeSiswaQr() di bawah supaya format konsisten.
    value: { type: String, required: true },
    size: { type: Number, default: 224 }
  },
  data() {
    return { svg: '' }
  },
  watch: {
    value: 'render'
  },
  created() {
    this.render()
  },
  methods: {
    async render() {
      try {
        this.svg = await QRCode.toString(this.value, {
          type: 'svg',
          margin: 0,
          color: { dark: '#0A0D3B', light: '#0000' }
        })
      } catch (e) {
        this.svg = ''
      }
    }
  }
}

// Format isi QR siswa: "FINKA-QR|<nis>|<nama>". Dipakai bareng oleh siswa/qr.vue (generate)
// dan pic/scan.vue (decode saat kamera membaca QR).
export const QR_PREFIX = 'FINKA-QR'
export function encodeSiswaQr(siswa) {
  return [QR_PREFIX, siswa.nis, siswa.nama].join('|')
}
export function decodeSiswaQr(text) {
  const parts = String(text || '').split('|')
  if (parts.length < 3 || parts[0] !== QR_PREFIX) return null
  return { nis: parts[1], nama: parts.slice(2).join('|') }
}
</script>

<style scoped>
.qrcode { display: flex; align-items: center; justify-content: center; }
.qrcode >>> svg { width: 100%; height: 100%; display: block; }
</style>
