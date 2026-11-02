<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader class="notif__screen-header" title="Notifikasi" to="/ortu" />
    <div class="body">
      <p class="catatan">Notifikasi terbaru akun dan transaksi.</p>
      <div v-if="error" class="kosong error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>
      <div v-else-if="memuat" class="kosong">Memuat notifikasi…</div>
      <div v-else-if="!semuaNotifikasi.length" class="kosong">Tidak ada tagihan mendesak atau status pembayaran baru.</div>
      <details v-else v-for="n in semuaNotifikasi" :key="String(n.tipe) + ':' + String(n.id) + ':' + String(n.siswa_id || n.anakId || '')" class="card notif" :class="n.prioritas === 1 || n.status === 'ditolak' ? 'notif--penting' : ''">
        <summary class="notif__summary">
          <span class="notif__dot" aria-hidden="true"></span>
          <span class="notif__content">
            <span class="notif__head">
              <span class="notif__judul display">{{ n.judul }}</span>
              <time class="notif__waktu">{{ n.waktu | waktu }}</time>
            </span>
            <span class="notif__preview">{{ n.isi }}</span>
            <span class="notif__lebih">Lihat pesan lengkap</span>
          </span>
        </summary>
        <p class="notif__lengkap">{{ n.isi }}</p>
        <div class="notif__actions">
          <nuxt-link
            v-if="n.tagihan_id && n.status === 'disetujui'"
            :to="'/ortu/tagihan/' + n.tagihan_id"
            class="notif__link"
          >Lihat tagihan lunas</nuxt-link>
          <nuxt-link
            v-else-if="n.id && !String(n.id).startsWith('ledger-')"
            :to="'/ortu/transaksi?jenis=pembayaran&id=' + n.id"
            class="notif__link"
          >Lihat detail pembayaran</nuxt-link>
        </div>
      </details>
    </div>
    <OrtuTabBar />
  </div>
</template>

<script>
export default {


  data() { return { memuat: true, error: '', timer: null, sedangMuat: false } },
  async mounted() {
    await this.muat()
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.muat()
    }, 30000)
    document.addEventListener('visibilitychange', this.saatTerlihat)
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
    document.removeEventListener('visibilitychange', this.saatTerlihat)
  },
  computed: {
    semuaNotifikasi() { return this.$store.getters['ortu/semuaNotifikasi'] },
  },
  methods: {
    saatTerlihat() { if (document.visibilityState === 'visible') this.muat() },
    async muat() {
      if (this.sedangMuat) return
      this.sedangMuat = true
      this.error = ''
      try {
        await this.$store.dispatch('ortu/muatAnak')
        const anak = this.$store.state.ortu.anak
        await Promise.all(anak.map((a) => this.$store.dispatch('ortu/muatTagihan', a.id)))
        await this.$store.dispatch('ortu/muatPembayaran')
      } catch (e) {
        this.error = e.message || 'Notifikasi gagal dimuat.'
      } finally {
        this.sedangMuat = false
        this.memuat = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.notif__screen-header { padding: 8px 16px 10px; gap: 10px; }
.body { flex: 1; overflow-y: auto; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 5px; }
.kosong { margin: 14px 0; padding: 18px 14px; text-align: center; color: var(--muted); font: 500 12px/1.45 var(--font-body); }
.catatan { margin: 0 2px 3px; color: var(--muted); font: 400 10px/1.4 var(--font-body); }
.error { color: var(--coral); }
.error button { border: 0; background: transparent; color: var(--blue); font: 700 12px var(--font-body); cursor: pointer; }
.notif { min-height: 0; padding: 0; overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: none; }
.notif--penting { background: #fcfdff; }
.notif__summary { list-style: none; display: grid; grid-template-columns: 6px minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px 10px; cursor: pointer; }
.notif__summary::-webkit-details-marker { display: none; }
.notif__dot { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: #aab3c0; }
.notif--penting .notif__dot { background: var(--blue); }
.notif__content { display: block; min-width: 0; }
.notif__head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 3px 8px; }
.notif__judul { min-width: 0; color: var(--ink); font: 700 12px/1.35 var(--font-display); overflow-wrap: anywhere; }
.notif__waktu { color: var(--muted); font: 400 10px/1.4 var(--font-body); text-align: right; white-space: nowrap; }
.notif__preview { display: -webkit-box; margin-top: 3px; overflow: hidden; color: var(--muted); font: 400 11px/1.4 var(--font-body); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.notif__lebih { display: inline-block; margin-top: 3px; color: var(--muted); font: 500 10px/1.3 var(--font-body); text-decoration: underline; text-decoration-color: #cbd2dc; text-underline-offset: 2px; }
.notif[open] .notif__preview, .notif[open] .notif__lebih { display: none; }
.notif__lengkap { margin: 0; padding: 8px 11px 10px 26px; border-top: 1px solid var(--bg); color: var(--muted); font: 400 11px/1.45 var(--font-body); overflow-wrap: anywhere; }
.notif__actions { padding: 0 11px 9px 26px; }
.notif__link { color: var(--blue); font: 600 11px var(--font-body); text-decoration: none; }
.notif__link:hover { text-decoration: underline; }
.notif__summary:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
@media (max-width: 360px) {
  .body { padding: 10px 11px 14px; gap: 6px; }
  .notif__summary { padding: 9px 10px; gap: 8px; }
  .notif__head { grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .notif__waktu { text-align: left; }
  .notif__lengkap { padding-left: 24px; }
}
</style>
