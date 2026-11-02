<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Riwayat" to="/siswa" dark />
    <div class="sheet">
      <div v-if="memuat" class="muat">Memuat riwayat…</div>
      <div v-else-if="error" class="muat error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>
      <template v-else>
        <div v-for="h in hari" :key="h.tanggal" class="hari">
          <div class="hari__label">{{ h.tanggal }}</div>
          <TrxRow v-for="t in h.items" :key="t.id" :trx="t" :to="'/siswa/struk/' + t.id" show-sisa />
        </div>
        <div v-if="!hari.length" class="muat">Belum ada transaksi.</div>
      </template>
    </div>
  </div>
</template>

<script>
export default {


  computed: {
    error() { return this.$store.state['profil-siswa'].error },
    memuat() { return this.$store.state['profil-siswa'].memuat },
    hari() {
      const out = []
      this.$store.getters['profil-siswa/transaksi'].forEach((t) => {
        let g = out.find((x) => x.tanggal === t.tanggalLabel)
        if (!g) { g = { tanggal: t.tanggalLabel, items: [] }; out.push(g) }
        g.items.push(t)
      })
      return out
    }
  },
  async mounted() { await this.muat() },
  methods: { muat() { return this.$store.dispatch('profil-siswa/muat') } }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
.sheet { flex: 1; background: #fff; border-radius: 24px 24px 0 0; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.hari { display: flex; flex-direction: column; }
.hari__label { font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .04em; margin-bottom: 10px; }
.error { color: var(--coral); }
.error button { border: 0; background: transparent; color: var(--blue); font-weight: 700; }
</style>
