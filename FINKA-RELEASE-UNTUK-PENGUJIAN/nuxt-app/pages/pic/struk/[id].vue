<script setup>
definePageMeta({ layout: 'phone', middleware: ['auth', 'pic'] })
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Struk Transaksi" to="/pic/riwayat" />
    <div class="body">
      <div v-if="memuat" class="state">Memuat struk…</div>
      <div v-else-if="error" class="state error" role="alert">
        {{ error }} <button type="button" class="retry" @click="muat">Coba lagi</button>
      </div>
      <template v-else-if="struk">
        <StrukCard :struk="struk" />
        <button type="button" class="unduh" :disabled="mengunduh" @click="unduh">{{ mengunduh ? 'Menyiapkan PDF…' : 'Unduh struk (PDF)' }}</button>
        <p v-if="pesanUnduh" class="state error" role="alert">{{ pesanUnduh }}</p>
      </template>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'
import { unduhStrukPdf, susunStruk } from '~/utils/struk-pdf'

export default {
  data() { return { struk: null, memuat: true, error: '', mengunduh: false, pesanUnduh: '' } },
  mounted() { this.muat() },
  methods: {
    async muat() {
      this.memuat = true; this.error = ''
      try {
        const siswaId = Number(this.$route.query.siswa)
        if (!Number.isSafeInteger(siswaId) || siswaId <= 0) throw new Error('Referensi transaksi tidak valid.')
        const { struk } = await api.strukSiswa(siswaId, this.$route.params.id)
        this.struk = susunStruk(struk, this.$rp, this.$waktu, { siswa: true })
      } catch (e) {
        this.struk = null
        this.error = e.status === 404 ? 'Struk tidak ditemukan.' : (e.message || 'Gagal memuat struk.')
      } finally { this.memuat = false }
    },
    async unduh() {
      this.pesanUnduh = ''; this.mengunduh = true
      try { await unduhStrukPdf(this.struk) }
      catch (e) { this.pesanUnduh = 'Gagal membuat PDF. Coba lagi.' }
      finally { this.mengunduh = false }
    }
  }
}
</script>

<style scoped>
.wrap { flex:1; display:flex; flex-direction:column; min-height:0; background:var(--bg); }
.body { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:14px; }
.state { padding:32px 18px; text-align:center; color:var(--muted); font:500 13px/1.5 var(--font-body); }
.error { color:var(--coral); }
.retry { border:0; background:none; color:var(--blue); font:700 13px var(--font-body); cursor:pointer; }
.unduh { border:0; border-radius:var(--r-md); background:var(--blue); color:#fff; padding:14px; font:700 14px var(--font-body); cursor:pointer; }
.unduh:disabled { opacity:.6; cursor:wait; }
</style>
