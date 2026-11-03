<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'pic']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Riwayat Transaksi" to="/pic" />

    <div class="sheet">
      <p v-if="error" class="error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></p>
      <div v-else-if="memuat" class="kosong">Memuat riwayat transaksi…</div>
      <div v-else-if="!hari.length" class="kosong">
        <span>Belum ada transaksi di {{ namaOutlet }} hari ini.</span>
      </div>
      <template v-else>
        <div v-for="h in hari" :key="h.tanggal" class="hari">
          <div class="hari__label">{{ h.tanggal }}</div>
          <div v-for="t in h.items" :key="t.id" class="row">
            <div class="ik">{{ inisial(t) }}</div>
            <div class="body">
              <div class="judul">{{ namaSiswa(t) }}</div>
              <div class="meta">{{ t.meta }}</div>
            </div>
            <div class="kanan">
              <div class="nominal num">− {{ $num(Math.abs(t.nominal)) }}</div>
              <div v-if="t.sisa !== null" class="sisa num">sisa {{ $num(t.sisa) }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { OUTLET_INFO } from '~/store/pos.js'
import { api } from '~/utils/api'

export default {


  data() { return { riwayat: [], memuat: true, error: '' } },
  async mounted() { await this.muat() },
  computed: {
    outlet() { return this.$store.state.pos.outlet },
    namaOutlet() { return (OUTLET_INFO[this.outlet] || OUTLET_INFO[0]).nama },
    trxOutlet() {
      return this.riwayat.map((row) => {
        const waktu = new Date(row.created_at)
        return {
          id: row.id,
          hari: waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }),
          nama: row.siswa_nama,
          kelas: row.kelas,
          meta: waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(':', '.') + ' · ' + row.keterangan,
          nominal: Number(row.nominal),
          sisa: null
        }
      })
    },
    hari() {
      const out = []
      this.trxOutlet.forEach((t) => {
        let g = out.find((x) => x.tanggal === t.hari)
        if (!g) { g = { tanggal: t.hari, items: [] }; out.push(g) }
        g.items.push(t)
      })
      return out
    }
  },
  methods: {
    async muat() {
      this.memuat = true
      this.error = ''
      try {
        const result = await api.riwayatKasir()
        this.riwayat = result.riwayat || []
      } catch (error) {
        this.error = error.message || 'Gagal memuat riwayat transaksi.'
      } finally {
        this.memuat = false
      }
    },
    namaSiswa(t) { return t.nama + (t.kelas ? ' · ' + t.kelas : '') },
    inisial(t) {
      return t.nama.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || '?'
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.sheet { flex: 1; overflow-y: auto; padding: 14px 18px 20px; display: flex; flex-direction: column; gap: 18px; }
.kosong { padding: 30px 4px; text-align: center; font: 400 12.5px var(--font-body); color: var(--muted); }
.error { padding: 12px; color: var(--coral); font: 400 12px/1.5 var(--font-body); }
.error button { border: 0; background: transparent; color: var(--blue); font: 700 12px var(--font-body); cursor: pointer; }
.hari { display: flex; flex-direction: column; }
.hari__label { font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .04em; margin-bottom: 10px; }

.row { display: flex; align-items: center; gap: 12px; padding: 11px 4px; border-bottom: 1px solid var(--bg); }
.ik {
  width: 34px; height: 34px; border-radius: var(--r-pill); flex: none;
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center; font: 700 12px var(--font-display);
}
.body { flex: 1; min-width: 0; }
.judul { font: 600 13.5px var(--font-body); color: var(--ink); }
.meta { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 1px; }
.kanan { text-align: right; }
.nominal { font: 700 13.5px var(--font-body); color: var(--ink); }
.sisa { font: 400 11px var(--font-body); color: var(--muted); margin-top: 1px; }
</style>
