<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Tagihan" to="/ortu" />
    <div class="body">
      <div v-if="belumBayar" class="peringatan">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        <p><b>{{ belumBayar }} tagihan belum dibayar.</b> Denda keterlambatan berlaku setelah tanggal jatuh tempo.</p>
      </div>

      <div v-if="memuat" class="muat">Memuat tagihan…</div>

      <nuxt-link
        v-for="b in tagihan"
        v-else
        :key="b.id"
        :to="'/ortu/tagihan/' + b.id"
        class="card bill"
        :class="b.status === 'belum_bayar' ? 'bill--due' : ''"
      >
        <div class="bill__top">
          <div>
            <div class="bill__nama display">{{ b.nama }}</div>
            <div class="bill__sub">{{ b.anakNama }}</div>
          </div>
          <span class="badge" :class="badge(b.status)">{{ label(b.status) }}</span>
        </div>
        <div class="bill__bot">
          <span class="bill__nominal display num">{{ b.nominal | rp }}</span>
          <span class="bill__tempo" :class="b.status === 'belum_bayar' ? 'is-due' : ''">Jatuh tempo {{ tanggalIndo(b.jatuh_tempo) }}</span>
        </div>
      </nuxt-link>
    </div>
    <OrtuTabBar />
  </div>
</template>

<script>
import { tanggalIndo } from '~/utils/adapt'

export default {


  data() {
    return { memuat: true }
  },
  computed: {
    tagihan() { return this.$store.getters['ortu/tagihanSemua'] },
    belumBayar() { return this.tagihan.filter((b) => b.status === 'belum_bayar').length }
  },
  async mounted() {
    await this.$store.dispatch('ortu/muatAnak')
    const anak = this.$store.state.ortu.anak
    await Promise.all(anak.map((a) => this.$store.dispatch('ortu/muatTagihan', a.id)))
    this.memuat = false
  },
  methods: {
    tanggalIndo,
    label(s) { return s === 'lunas' ? 'Lunas' : 'Belum Bayar' },
    badge(s) { return s === 'lunas' ? 'badge--ok' : 'badge--bad' }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.muat { padding: 40px 20px; text-align: center; font: 500 13px var(--font-body); color: var(--muted); }

.peringatan { background: var(--coral); border-radius: var(--r-md); padding: 16px; display: flex; align-items: center; gap: 13px; }
.peringatan svg { flex: none; }
.peringatan p { margin: 0; font: 400 12.5px/1.45 var(--font-body); color: #fff; text-wrap: pretty; }

.bill { padding: 16px; display: flex; flex-direction: column; gap: 12px; color: inherit; }
.bill:hover { color: inherit; border-color: var(--blue); }
.bill--due { border-color: var(--coral); }
.bill__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.bill__nama { font: 700 14.5px var(--font-display); }
.bill__sub { font: 400 12px var(--font-body); color: var(--muted); margin-top: 3px; }
.bill__bot { display: flex; align-items: flex-end; justify-content: space-between; }
.bill__nominal { font: 700 19px var(--font-display); }
.bill__tempo { font: 400 11.5px var(--font-body); color: var(--muted); }
.bill__tempo.is-due { color: var(--coral); }
</style>

