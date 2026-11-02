<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Scan Barcode" :to="kembali" dark />
    <div class="stage">
      <div class="viewfinder">
        <video ref="video" v-show="kameraOn" class="video" autoplay playsinline muted></video>
        <span v-if="!kameraOn" class="ph">{{ kameraError ? 'kamera tidak aktif' : 'membuka kamera…' }}</span>
        <i class="c c--tl"></i><i class="c c--tr"></i><i class="c c--bl"></i><i class="c c--br"></i>
        <i v-if="kameraOn" class="laser"></i>
      </div>

      <p class="hint">
        {{ kameraError || (kameraOn ? 'Arahkan kamera ke QR di layar HP siswa' : 'Arahkan ke QR di HP siswa atau kartu fisik') }}
      </p>
      <button v-if="kameraError || scanError" type="button" class="ulang" @click="cobaScan">Coba scan lagi</button>
      <p v-if="scanError" class="scan-error" role="alert">{{ scanError }}</p>

      <canvas ref="canvas" class="canvas-tersembunyi"></canvas>
    </div>
  </div>
</template>

<script>
import jsQR from 'jsqr'
import { api } from '~/utils/api'

export default {

  data() {
    return {
      kameraOn: false,
      kameraError: '',
      scanError: '',
      scanProcessing: false,
      stream: null,
      rafId: null
    }
  },
  computed: {
    kembali() { return this.$store.state.pos.mode === 'tunai' ? '/pic/tunai' : '/pic' }
  },
  mounted() {
    this.mulaiKamera()
  },
  beforeDestroy() {
    this.berhentiKamera()
  },
  methods: {
    async mulaiKamera() {
      this.kameraError = ''
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.kameraError = 'Perangkat/browser ini tidak mendukung kamera. Gunakan browser yang mengizinkan akses kamera.'
        return
      }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        this.$refs.video.srcObject = this.stream
        await this.$refs.video.play()
        this.kameraOn = true
        this.tick()
      } catch (e) {
        this.kameraError = 'Kamera tidak dapat diakses. Izinkan akses kamera lalu coba lagi.'
        this.kameraOn = false
      }
    },
    berhentiKamera() {
      this.kameraOn = false
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null }
    },
    // Loop baca frame kamera dan coba decode QR tiap frame (via jsQR)
    tick() {
      if (!this.kameraOn) return
      const video = this.$refs.video
      const canvas = this.$refs.canvas
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const kode = jsQR(frame.data, frame.width, frame.height)
        if (kode && kode.data && !this.scanProcessing) {
          this.scanProcessing = true
          this.berhentiKamera()
          this.pilihQr(kode.data)
          return
        }
      }
      this.rafId = requestAnimationFrame(this.tick)
    },
    async pilihQr(token) {
      this.scanError = ''
      try {
        const data = await api.resolveQr(token)
        this.$store.commit('pos/setScannedStudent', { student: data.siswa, token: data.token })
        await this.$router.push('/pic/konfirmasi')
      } catch (e) {
        this.scanError = e.message || 'QR tidak valid atau sudah tidak berlaku.'
        this.scanProcessing = false
      }
    },
    cobaScan() {
      this.scanError = ''
      this.scanProcessing = false
      this.mulaiKamera()
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--navy); min-height: 0; }
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 0 22px 26px; overflow-y: auto; }

.viewfinder {
  width: 250px; height: 250px; border-radius: var(--r-lg);
  background: rgba(255,255,255,.05); position: relative;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex: none;
}
.video { width: 100%; height: 100%; object-fit: cover; }
.c { position: absolute; width: 44px; height: 44px; border: 0 solid var(--sand); pointer-events: none; }
.c--tl { top: 0; left: 0; border-top-width: 3px; border-left-width: 3px; border-radius: 16px 0 0 0; }
.c--tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-radius: 0 16px 0 0; }
.c--bl { bottom: 0; left: 0; border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 16px; }
.c--br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 16px 0; }
.ph { font: 400 11.5px/1.5 var(--font-body); color: rgba(255,255,255,.35); text-align: center; padding: 0 30px; }
.laser { position: absolute; left: 14px; right: 14px; height: 2px; background: var(--sand); animation: fkPulse 1.4s ease-in-out infinite; }

.hint { margin: 0; font: 400 12.5px var(--font-body); color: rgba(255,255,255,.6); text-align: center; text-wrap: pretty; }
.ulang { border: 1px solid rgba(255,255,255,.3); border-radius: var(--r-pill); padding: 10px 16px; background: transparent; color: #fff; font: 600 12px var(--font-body); cursor: pointer; }
.scan-error { margin: 0; color: #ffd4ce; font: 500 12px/1.5 var(--font-body); text-align: center; }

.canvas-tersembunyi { display: none; }
</style>
