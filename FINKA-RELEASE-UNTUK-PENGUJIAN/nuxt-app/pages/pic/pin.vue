<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="PIN Siswa" to="/pic/konfirmasi" dark />
    <div class="intro">
      <div class="intro__who display">{{ nama }} · {{ total | rp }}</div>
      <p>Serahkan perangkat ke siswa. Masukkan 6 digit PIN.</p>
    </div>

    <div class="dots">
      <span v-for="i in 6" :key="i" class="dot" :class="i <= pin.length ? 'dot--on' : ''"></span>
    </div>
    <div v-if="error" class="salah" role="alert">{{ error }}</div>
    <div v-if="memproses" class="memproses" role="status">Memproses pembayaran…</div>

    <div class="spacer"></div>
    <div class="pad">
      <NumPad :keys="keypad" @key="tekan" @hapus="hapus" />
    </div>
    <div class="acak">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>
      <span>Posisi angka diacak setiap transaksi</span>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'
import { OUTLET_INFO } from '~/store/pos.js'

export default {
  data() { return { error: '', memproses: false } },

  computed: {
    pin() { return this.$store.state.pos.pin },
    keypad() { return this.$store.state.pos.keypad },
    total() { return this.$store.getters['pos/total'] },
    siswa() { return this.$store.getters['pos/siswaScan'] },
    nama() {
      const s = this.$store.getters['pos/siswaScan']
      return s ? s.nama : ''
    }
  },
  mounted() {
    if (!this.$store.getters['pos/siswaScan']) this.$router.replace('/pic')
  },
  methods: {
    tekan(d) {
      if (this.memproses) return
      const pin = (this.pin + d).slice(0, 6)
      this.$store.commit('pos/setPin', pin)
      if (pin.length < 6) return
      setTimeout(() => this.selesaikan(pin), 260)
    },
    hapus() {
      if (!this.memproses) this.$store.commit('pos/setPin', this.pin.slice(0, -1))
    },
    async selesaikan(pin) {
      if (this.memproses) return
      this.memproses = true
      this.error = ''
      const state = this.$store.state.pos
      const items = Object.keys(state.cart).map((id) => ({ produk_id: Number(id), qty: state.cart[id] }))
      const rincian = this.$store.getters['pos/items']
      const info = OUTLET_INFO[state.outlet] || {
        nama: this.$store.state.auth.user && this.$store.state.auth.user.outlet || 'Outlet',
        kasir: this.$store.state.auth.user && this.$store.state.auth.user.nama || 'Kasir'
      }
      try {
        const hasil = state.mode === 'tunai'
          ? await api.tarikTunai(state.scanId, pin, this.total, state.qrToken)
          : await api.transaksi(state.scanId, pin, items, state.qrToken)
        const now = new Date()
        this.$store.commit('pos/setTransactionResult', {
          ledgerId: hasil.ledger_id,
          total: Number(hasil.total || this.total),
          saldoSebelum: Number(hasil.saldo_baru) + Number(hasil.total || this.total),
          saldoBaru: Number(hasil.saldo_baru),
          tunai: state.mode === 'tunai',
          nama: this.siswa.nama,
          kelas: this.siswa.kelas,
          items: rincian,
          outlet: info.nama,
          kasir: info.kasir,
          waktu: now.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':').replace(',', '')
        })
        this.$store.commit('pos/setPin', '')
        await this.$router.replace('/pic/sukses')
      } catch (e) {
        if (e.status === 401) this.$store.commit('pos/gagalPin')
        this.$store.commit('pos/setPin', '')
        this.$store.commit('pos/acakKeypad')
        this.error = e.message || 'Transaksi gagal. Coba lagi.'
      } finally {
        this.memproses = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--navy); padding-bottom: 26px; min-height: 0; }
.intro { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 6px; padding: 0 22px; }
.intro__who { font: 600 14px var(--font-display); color: #fff; }
.intro p { margin: 0; font: 400 12.5px var(--font-body); color: rgba(255,255,255,.55); text-align: center; max-width: 250px; text-wrap: pretty; }

.dots { display: flex; justify-content: center; gap: 12px; margin-top: 26px; }
.dot { width: 14px; height: 14px; border-radius: var(--r-pill); border: 1.5px solid rgba(255,255,255,.35); }
.dot--on { background: #fff; border-color: #fff; }
.salah { margin-top: 16px; text-align: center; font: 600 12.5px var(--font-body); color: var(--coral); }
.memproses { margin-top: 16px; text-align: center; font: 500 12px var(--font-body); color: rgba(255,255,255,.65); }

.spacer { flex: 1; }
.pad { padding: 0 22px; }
.acak { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font: 400 11px var(--font-body); color: rgba(255,255,255,.4); }
</style>
