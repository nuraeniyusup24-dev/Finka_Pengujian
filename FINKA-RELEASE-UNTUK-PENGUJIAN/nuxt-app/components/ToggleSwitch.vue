<template>
  <button
    type="button"
    class="switch"
    :class="value ? 'switch--on' : ''"
    :style="value && danger ? 'background: var(--coral)' : ''"
    role="switch"
    :aria-checked="String(value)"
    :disabled="disabled"
    @click="saatKlik"
    @pointerdown="saatTekan"
    @pointerup="saatLepas"
    @pointercancel="saatBatal"
  >
    <div class="knob"></div>
  </button>
</template>

<script>
// Jarak geser minimum (px) supaya dianggap swipe, bukan ketukan biasa.
const JARAK_SWIPE = 10

export default {
  name: 'ToggleSwitch',
  props: {
    value: { type: Boolean, default: false },
    danger: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['input'],
  data() {
    return { awalX: null, baruSwipe: false, timerSwipe: null }
  },
  beforeUnmount() {
    if (this.timerSwipe) clearTimeout(this.timerSwipe)
  },
  methods: {
    // Ketuk atau tombol keyboard (Spasi/Enter): balik status. Klik susulan dari swipe diabaikan.
    saatKlik() {
      if (this.baruSwipe) { this.baruSwipe = false; return }
      this.$emit('input', !this.value)
    },
    saatTekan(e) {
      if (this.disabled) return
      this.awalX = e.clientX
      this.baruSwipe = false
      // Tetap terima gerakan jari walau sudah keluar dari area tombol yang kecil
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* tidak wajib */ }
    },
    // Geser ke kanan = aktif, ke kiri = nonaktif.
    saatLepas(e) {
      if (this.awalX === null) return
      const selisih = e.clientX - this.awalX
      this.awalX = null
      if (Math.abs(selisih) < JARAK_SWIPE) return
      this.baruSwipe = true
      if (this.timerSwipe) clearTimeout(this.timerSwipe)
      this.timerSwipe = setTimeout(() => { this.baruSwipe = false }, 400)
      const maunyaAktif = selisih > 0
      if (maunyaAktif !== this.value) this.$emit('input', maunyaAktif)
    },
    saatBatal() {
      this.awalX = null
    }
  }
}
</script>

<style scoped>
.switch {
  border: 0;
  appearance: none;
  width: 46px; height: 27px; border-radius: var(--r-pill);
  background: var(--disabled); padding: 3px;
  display: flex; justify-content: flex-start; cursor: pointer; flex: none;
  transition: background .15s ease;
  /* Gesek horizontal diterima tombol; scroll vertikal halaman tetap jalan */
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
}
.switch:disabled { opacity: .55; cursor: wait; }
.switch--on { background: var(--blue); justify-content: flex-end; }
.knob { width: 21px; height: 21px; border-radius: var(--r-pill); background: #fff; }
</style>
