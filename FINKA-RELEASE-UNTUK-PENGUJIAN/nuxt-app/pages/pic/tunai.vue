<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Ambil Tunai" to="/pic" />
    <div class="body">
      <div class="info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>
        <p>Saldo siswa dipotong dan kasir menyerahkan uang tunai. Pastikan uang tersedia secara fisik sebelum memproses penarikan. Tetap butuh scan barcode dan PIN siswa.</p>
      </div>

      <div>
        <div class="label">Nominal penarikan</div>
        <div class="input">
          <span class="display">Rp</span>
          <span class="input__nilai display num" :class="tunai ? '' : 'is-empty'">{{ tunai ? $num(tunai) : '0' }}</span>
          <button class="hapus" @click="set(0)">Hapus</button>
        </div>
        <div class="chips">
          <button
            v-for="n in cepat"
            :key="n"
            class="chip num"
            :class="tunai === n ? 'chip--on' : ''"
            @click="set(n)"
          >{{ $num(n) }}</button>
        </div>
      </div>

      <div class="pad">
        <button v-for="(k, i) in padKeys" :key="i" class="key" @click="tekan(k)">{{ k }}</button>
      </div>

      <button class="btn" :class="valid ? 'btn--primary' : 'btn--off'" :disabled="!valid" @click="lanjut">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M3 12h18" /></svg>
        Scan barcode siswa
      </button>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return {
      cepat: [20000, 50000, 100000, 200000],
      padKeys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫']
    }
  },
  computed: {
    tunai() { return this.$store.state.pos.tunai },
    valid() { return this.tunai > 0 }
  },
  created() {
    this.$store.commit('pos/setMode', 'tunai')
    this.$store.commit('pos/setScan', null)
  },
  methods: {
    set(n) { this.$store.commit('pos/setTunai', n) },
    tekan(k) {
      if (k === '⌫') return this.set(Math.floor(this.tunai / 10))
      if (k === '000') return this.set(this.tunai * 1000)
      this.set(this.tunai * 10 + Number(k))
    },
    lanjut() { if (this.valid) this.$router.push('/pic/scan') }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }

.info { background: var(--blue-soft); border-radius: var(--r-md); padding: 14px; display: flex; gap: 10px; }
.info svg { flex: none; margin-top: 1px; }
.info p { margin: 0; font: 400 12.5px/1.5 var(--font-body); text-wrap: pretty; }

.label { font: 500 12px var(--font-body); color: var(--muted); margin-bottom: 8px; }
.input { border: 1.5px solid var(--blue); border-radius: var(--r-sm); padding: 14px 16px; display: flex; align-items: center; gap: 8px; }
.input > span:first-child { font: 700 19px var(--font-display); }
.input__nilai { flex: 1; font: 700 26px var(--font-display); letter-spacing: -.02em; }
.input__nilai.is-empty { color: var(--disabled); }
.hapus { border: none; background: none; color: var(--coral); font: 600 12px var(--font-body); cursor: pointer; }
.chips { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

.pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.key {
  height: 50px; border: none; border-radius: var(--r-sm);
  background: var(--bg); font: 600 20px var(--font-display); color: var(--ink);
  cursor: pointer; user-select: none;
}
.key:hover { background: var(--blue-soft); }
</style>
