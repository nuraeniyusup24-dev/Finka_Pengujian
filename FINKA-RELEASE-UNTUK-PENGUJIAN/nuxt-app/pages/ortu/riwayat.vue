<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Riwayat Transaksi" to="/ortu" />
    <div class="filter">
      <button
        class="chip chip--pill"
        :class="filterAnakId === null ? 'chip--on' : ''"
        @click="filterAnakId = null"
      >Semua</button>
      <button
        v-for="a in siswa"
        :key="a.id"
        class="chip chip--pill"
        :class="filterAnakId === a.id ? 'chip--on' : ''"
        @click="filterAnakId = a.id"
      >{{ a.nama.split(' ')[0] }}</button>
    </div>
    <div class="body">
      <div v-if="memuat" class="muat">Memuat riwayat…</div>
      <div v-else-if="error" class="muat error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>
      <template v-else>
      <section v-if="pembayaranTerlihat.length" class="section">
        <div class="section__title display">Top-up & pembayaran</div>
        <div class="card payments">
          <nuxt-link v-for="r in pembayaranTerlihat" :key="r.id" :to="tujuanPembayaran(r)" class="payment-row">
            <div class="payment-main">
              <b>{{ r.judul }}</b>
              <small>{{ r.siswa }}</small>
              <time>{{ r.waktu | waktu }}</time>
            </div>
            <div class="payment-right"><strong class="num">{{ r.nominal | rp }}</strong><StatusBadge :status="r.status" /></div>
          </nuxt-link>
        </div>
      </section>
      <div v-for="h in hari" :key="h.tanggal" class="hari">
        <div class="hari__head">
          <span>{{ h.tanggal }}</span>
          <span class="num">{{ h.total }}</span>
        </div>
        <div class="card">
          <TrxRow v-for="t in h.items" :key="t.siswaId + '-' + t.id" :trx="t" :to="'/ortu/transaksi?jenis=ledger&id=' + t.id + '&anak=' + t.siswaId" show-sisa />
        </div>
      </div>
      <div v-if="!hari.length && !pembayaranTerlihat.length" class="muat">Belum ada transaksi.</div>
      </template>
    </div>
    <OrtuTabBar />
  </div>
</template>

<script>
import { trxDariLedger } from '~/utils/adapt'

export default {


  data() {
    return { filterAnakId: null, memuat: true, error: '' }
  },
  computed: {
    siswa() { return this.$store.state.ortu.anak },
    daftar() {
      const semua = []
      this.siswa.forEach((a) => {
        const rows = this.$store.state.ortu.riwayat[a.id] || []
        rows.forEach((row) => semua.push(Object.assign(trxDariLedger(row), { siswaId: a.id })))
      })
      semua.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      return this.filterAnakId === null ? semua : semua.filter((t) => t.siswaId === this.filterAnakId)
    },
    pembayaranTerlihat() {
      const all = this.$store.state.ortu.riwayatPembayaran || []
      return this.filterAnakId === null ? all : all.filter((r) => Number(r.siswa_id) === Number(this.filterAnakId))
    },
    hari() {
      const out = []
      this.daftar.forEach((t) => {
        let g = out.find((x) => x.tanggalKey === t.tanggalKey)
        if (!g) { g = { tanggalKey: t.tanggalKey, tanggal: t.tanggalLabel, keluar: 0, items: [] }; out.push(g) }
        g.items.push(t)
        if (t.nominal < 0) g.keluar += -t.nominal
      })
      return out.map((g) => ({
        tanggal: g.tanggal,
        total: g.keluar ? '− ' + this.$num(g.keluar) : '—',
        items: g.items
      }))
    }
  },
  async mounted() {
    const q = this.$route.query.anak
    if (q !== undefined && Number.isSafeInteger(Number(q))) this.filterAnakId = Number(q)
    await this.muat()
  },
  methods: {
    async muat() {
      this.memuat = true; this.error = ''
      try {
        await this.$store.dispatch('ortu/muatAnak')
        await Promise.all(this.siswa.map((a) => this.$store.dispatch('ortu/muatRiwayat', a.id)))
        await this.$store.dispatch('ortu/muatPembayaran')
        if (this.filterAnakId !== null && !this.siswa.some((a) => Number(a.id) === Number(this.filterAnakId))) this.filterAnakId = null
      } catch (e) { this.error = e.message || 'Riwayat gagal dimuat.' }
      finally { this.memuat = false }
    },
    tujuanPembayaran(r) {
      if (String(r.id).startsWith('ledger-')) return '/ortu/transaksi?jenis=ledger&id=' + String(r.id).slice(7) + '&anak=' + r.siswa_id
      return '/ortu/transaksi?jenis=pembayaran&id=' + r.id
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.filter { display: flex; gap: 8px; padding: 14px 18px; background: #fff; border-bottom: 1px solid var(--line); flex: none; }
.body { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 18px; }
.hari { display: flex; flex-direction: column; gap: 9px; }
.hari__head { display: flex; align-items: center; justify-content: space-between; font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .04em; }
.section { display:flex; flex-direction:column; gap:9px; }
.section__title { font-size:14px; }
.payments { overflow:hidden; }
.payment-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 14px; border-bottom:1px solid var(--bg); color:inherit; text-decoration:none; }
.payment-row:last-child { border-bottom:0; }
.payment-row:hover { background:#fafafb; }
.payment-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.payment-main b,.payment-main small,.payment-main time { display:block; }
.payment-main b { font:600 12.5px var(--font-body); overflow-wrap:anywhere; }
.payment-main small,.payment-main time { color:var(--muted); font:400 10.5px/1.4 var(--font-body); }
.payment-main time { font-size:10px; }
.payment-right { display:flex; flex:none; flex-direction:column; align-items:flex-end; gap:5px; }
.payment-right strong { white-space:nowrap; }
.error { color:var(--coral); }
.error button { border:0; background:transparent; color:var(--blue); font-weight:700; cursor:pointer; }
.muat { padding: 40px 20px; text-align: center; font: 500 13px var(--font-body); color: var(--muted); }
</style>
