<script setup>
definePageMeta({ layout: 'phone', middleware: ['auth', 'siswa'] })
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Struk Digital" :to="'/siswa/riwayat'" />
    <div class="body">
      <div v-if="memuat" class="state">Memuat struk…</div>
      <div v-else-if="error" class="state error" role="alert">
        {{ error }} <button type="button" class="retry" @click="muat">Coba lagi</button>
      </div>

      <template v-else-if="struk">
        <StrukCard :struk="struk" />

        <button type="button" class="unduh" :disabled="isExporting" @click="unduh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          {{ isExporting ? 'Menyiapkan PDF…' : 'Unduh struk (PDF)' }}
        </button>
        <p v-if="pesanUnduh" class="state error" role="alert">{{ pesanUnduh }}</p>
      </template>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'
import { unduhStrukPdf, susunStruk } from '~/utils/struk-pdf'

export default {
  data() {
    return { detail: { items: [] }, struk: null, memuat: true, error: '', isExporting: false, pesanUnduh: '' }
  },
  mounted() { this.muat() },
  methods: {
    kembali() {
      if (window.history.length > 1) this.$router.back()
      else this.$router.push('/siswa/riwayat')
    },
    async muat() {
      this.memuat = true; this.error = ''
      try {
        const user = this.$store.state.auth.user || {}
        const { struk } = await api.strukSiswa(user.id, this.$route.params.id)
        this.detail = struk
        this.struk = susunStruk(struk, this.$rp, this.$waktu)
      } catch (e) {
        this.struk = null
        this.error = e.status === 404 ? 'Struk tidak ditemukan.' : (e.message || 'Gagal memuat struk.')
      } finally {
        this.memuat = false
      }
    },
    async unduh() {
      this.pesanUnduh = ''; this.isExporting = true
      try { await unduhStrukPdf(this.struk) }
      catch (e) { this.pesanUnduh = 'Gagal membuat PDF. Coba lagi.' }
      finally { this.isExporting = false }
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
.unduh { display:flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:var(--r-md); background:var(--blue); color:#fff; padding:14px; font:700 14px var(--font-body); cursor:pointer; }
.unduh:disabled { opacity:.6; cursor:wait; }
</style>