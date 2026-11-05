<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <div class="scroll">
      <header class="top">
        <div class="top__bar">
          <div class="logo">
            <FinkaMark :width="20" :height="22" color="var(--blue)" />
            <span class="display">FINKA</span>
          </div>
          <div class="top__actions">
            <nuxt-link to="/ortu/notifikasi" class="bell" aria-label="Notifikasi">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>
              <i v-if="jumlahNotifikasi">{{ jumlahNotifikasi > 9 ? '9+' : jumlahNotifikasi }}</i>
            </nuxt-link>
            <nuxt-link to="/ortu/pengaturan" class="settings" aria-label="Pengaturan akun">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.2V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.1 14H3a2 2 0 110-4h.1a1.6 1.6 0 001.2-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020.9 10H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" /></svg>
            </nuxt-link>
          </div>
        </div>
        <div>
          <div class="halo">{{ $sapaan() }},</div>
          <div class="nama display">{{ namaOrtu }}</div>
        </div>
      </header>

      <div v-if="memuat" class="muat">Memuat data…</div>

      <div v-else-if="error" class="muat error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>


      <div v-else class="sec">
        <div class="sec__head">
          <span class="display">Dompet anak</span>
          <span class="sec__meta">{{ siswa.length }} anak</span>
        </div>
        <EmptyState v-if="!siswa.length" ikon="▱" judul="Belum ada anak terhubung" pesan="Hubungi sekolah untuk memastikan akun anak terhubung ke akun Orang Tua ini." />
        <div class="kartu-list">
          <nuxt-link
            v-for="(a, i) in siswa"
            :key="a.id"
            :to="'/ortu/riwayat?anak=' + a.id"
            class="kartu"
            :class="i === 0 ? 'kartu--navy' : ''"
          >
            <div class="kartu__top">
              <div class="av">{{ a.inisial }}</div>
              <div class="kartu__id">
                <div class="kartu__nama display">{{ a.nama }}</div>
                <div class="kartu__sub">{{ a.kelas }} · NIS {{ a.nis }}</div>
              </div>
              <div class="kartu__sub">Lihat</div>
            </div>
            <div class="kartu__bot">
              <div>
                <div class="kartu__label">SALDO</div>
                <div class="kartu__saldo display num" :class="!menipis(a) ? '' : 'is-low'">{{ $rp(a.saldo) }}</div>
              </div>
              <span v-if="menipis(a)" class="tag-low">Saldo menipis</span>
            </div>
          </nuxt-link>
        </div>
      </div>

      <div class="aksi">
        <nuxt-link to="/ortu/isi-saldo" class="aksi__box aksi__box--primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          <span class="display">Isi Saldo</span>
        </nuxt-link>
        <nuxt-link to="/ortu/tagihan" class="aksi__box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>
          <span class="aksi__label"><span class="display">Tagihan SPP</span><i class="pip">{{ belumBayar }}</i></span>
        </nuxt-link>
      </div>

      <div class="sec">
        <div class="sec__head">
          <span class="display">Riwayat transaksi</span>
          <nuxt-link to="/ortu/notifikasi" class="link">Lihat status</nuxt-link>
        </div>
        <div v-if="!riwayatPembayaran.length" class="card">
          <EmptyState
            ikon="▱"
            judul="Belum ada transaksi"
            pesan="Pengajuan top-up dan pembayaran tagihan akan muncul di sini."
          />
        </div>
        <div v-else class="card payment-list">
          <nuxt-link v-for="r in riwayatPembayaran.slice(0, 4)" :key="r.id" :to="tujuanPembayaran(r)" class="payment-row">
            <div class="payment-main">
              <b>{{ r.judul }}</b>
              <span>{{ r.siswa }}</span>
              <time>{{ r.waktu | waktu }}</time>
            </div>
            <div class="payment-right">
              <strong class="num">{{ r.nominal | rp }}</strong>
              <StatusBadge :status="r.status" />
            </div>
          </nuxt-link>
        </div>
      </div>

      <div class="sec sec--last">
        <div class="sec__head">
          <span class="display">Aktivitas terakhir</span>
          <nuxt-link to="/ortu/riwayat" class="link">Semua</nuxt-link>
        </div>
        <div class="card">
          <TrxRow v-for="t in terakhir" :key="t.siswaId + '-' + t.id" :trx="t" :to="'/ortu/transaksi?jenis=ledger&id=' + t.id + '&anak=' + t.siswaId" />
        </div>
      </div>
    </div>

    <OrtuTabBar />
  </div>
</template>

<script>
import { trxDariLedger } from '~/utils/adapt'

const AMBANG_MENIPIS = 20000

export default {
  name: 'OrtuDashboard',


  data() {
    return { memuat: true, aktivitas: [], error: '' }
  },
  computed: {
    siswa() { return this.$store.state.ortu.anak },
    namaOrtu() { return (this.$store.state.auth.user && this.$store.state.auth.user.nama) || 'Orang Tua' },
    terakhir() { return this.aktivitas.slice(0, 3) },
    belumBayar() { return this.$store.getters['ortu/belumBayarSemua'] },
    jumlahNotifikasi() { return this.$store.getters['ortu/jumlahNotifikasi'] },
    riwayatPembayaran() { return this.$store.state.ortu.riwayatPembayaran || [] }
  },
  async mounted() { await this.muat() },
  methods: {
    async muat() {
      this.memuat = true
      this.error = ''
      try {
        await this.$store.dispatch('ortu/muatAnak')
        const anak = this.$store.state.ortu.anak
        await Promise.all(anak.map((a) => Promise.all([
          this.$store.dispatch('ortu/muatTagihan', a.id),
          this.$store.dispatch('ortu/muatRiwayat', a.id)
        ])))
        await this.$store.dispatch('ortu/muatPembayaran')
        const semua = anak.reduce((acc, a) => acc.concat((this.$store.state.ortu.riwayat[a.id] || []).map((row) => Object.assign(trxDariLedger(row), { siswaId: a.id }))), [])
        semua.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        this.aktivitas = semua.slice(0, 3)
      } catch (e) {
        this.error = e.message || 'Data Orang Tua gagal dimuat.'
      } finally { this.memuat = false }
    },
    menipis(a) {
      return a.saldo < AMBANG_MENIPIS
    },
    tujuanPembayaran(r) {
      if (String(r.id).startsWith('ledger-')) {
        return '/ortu/transaksi?jenis=ledger&id=' + String(r.id).slice(7) + '&anak=' + r.siswa_id
      }
      return '/ortu/transaksi?jenis=pembayaran&id=' + r.id
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.scroll { flex: 1; overflow-y: auto; background: var(--bg); }

.top { background: #fff; padding: 8px 20px 22px; display: flex; flex-direction: column; gap: 20px; }
.top__bar { display: flex; align-items: center; justify-content: space-between; }
.top__actions { display: flex; align-items: center; gap: 8px; }
.logo { display: flex; align-items: center; gap: 10px; font: 800 17px var(--font-display); letter-spacing: .04em; color: var(--ink); }
.bell {
  position: relative; width: 38px; height: 38px; border-radius: var(--r-pill);
  background: var(--bg); display: flex; align-items: center; justify-content: center;
}
.bell:hover { background: var(--blue-soft); }
.settings { width: 38px; height: 38px; border-radius: var(--r-pill); background: var(--bg); display:flex; align-items:center; justify-content:center; color:var(--ink); }
.settings:hover { background: var(--blue-soft); color:var(--blue); }
.bell i { position: absolute; top: 4px; right: 4px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: var(--r-pill); background: var(--coral); color: #fff; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font: 700 9px var(--font-body); font-style: normal; }
.halo { font: 400 13px var(--font-body); color: var(--muted); }
.nama { font: 700 20px var(--font-display); margin-top: 2px; }

.muat { padding: 40px 20px; text-align: center; font: 500 13px var(--font-body); color: var(--muted); }
.error { color: var(--coral); }
.error button { border: 0; background: transparent; color: var(--blue); font-weight: 700; cursor: pointer; }
.sec { padding: 18px 20px 0; }
.sec--last { padding-bottom: 24px; }
.payment-empty { padding:16px; color:var(--muted); font:400 12px/1.5 var(--font-body); }
.payment-list { overflow:hidden; }
.payment-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 14px; border-bottom:1px solid var(--bg); color:inherit; text-decoration:none; cursor:pointer; }
.payment-row:hover { background:#fafafb; }
.payment-row:last-child { border-bottom:none; }
.payment-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.payment-main b { font:600 12.5px var(--font-body); }
.payment-main span,.payment-main time { color:var(--muted); font:400 10.5px/1.4 var(--font-body); }
.payment-main time { font-size:10px; }
.payment-right { display:flex; flex:none; flex-direction:column; align-items:flex-end; gap:5px; }
.payment-right strong { font:700 12px var(--font-display); white-space:nowrap; }
.sec__head { display: flex; align-items: center; justify-content: space-between; font: 700 13px var(--font-display); margin-bottom: 12px; }
.sec__meta { font: 500 12px var(--font-body); color: var(--muted); }
.link { font: 600 12px var(--font-body); }

.kartu-list { display: flex; flex-direction: column; gap: 12px; }
.kartu {
  background: #fff; border: 1px solid var(--line); border-radius: var(--r-md);
  padding: 16px; display: flex; flex-direction: column; gap: 14px; color: var(--ink);
  text-decoration: none; transition: none; -webkit-tap-highlight-color: transparent;
}
.kartu--navy { background: var(--navy); border-color: var(--navy); color: #fff; }
.kartu:hover, .kartu:focus, .kartu:focus-visible, .kartu:active,
.kartu--navy:hover, .kartu--navy:focus, .kartu--navy:focus-visible, .kartu--navy:active { color: inherit; }
.kartu__top { display: flex; align-items: center; gap: 12px; }
.av {
  width: 44px; height: 44px; border-radius: var(--r-pill); flex: none;
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
  font: 700 15px var(--font-display);
}
.kartu--navy .av { background: rgba(255,255,255,.14); color: #fff; }
.kartu__id { flex: 1; min-width: 0; }
.kartu__nama { color: var(--ink); font: 700 15px var(--font-display); }
.kartu--navy .kartu__nama { color: #fff; }
.kartu__sub { font: 400 12.5px var(--font-body); color: var(--muted); margin-top: 2px; }
.kartu--navy .kartu__sub { color: rgba(255,255,255,.55); }
.kartu--navy .kartu__nama,
.kartu--navy:hover .kartu__nama,
.kartu--navy:focus .kartu__nama,
.kartu--navy:focus-visible .kartu__nama,
.kartu--navy:active .kartu__nama,
.kartu--navy .kartu__saldo,
.kartu--navy:hover .kartu__saldo,
.kartu--navy:focus .kartu__saldo,
.kartu--navy:focus-visible .kartu__saldo,
.kartu--navy:active .kartu__saldo { color: #fff; }
.kartu--navy .kartu__label,
.kartu--navy:hover .kartu__label,
.kartu--navy:focus .kartu__label,
.kartu--navy:focus-visible .kartu__label,
.kartu--navy:active .kartu__label,
.kartu--navy .kartu__sub,
.kartu--navy:hover .kartu__sub,
.kartu--navy:focus .kartu__sub,
.kartu--navy:focus-visible .kartu__sub,
.kartu--navy:active .kartu__sub { color: rgba(255,255,255,.55); }
.kartu__bot { display: flex; align-items: flex-end; justify-content: space-between; }
.kartu__label { font: 500 11px var(--font-body); color: var(--muted); letter-spacing: .04em; }
.kartu--navy .kartu__label { color: rgba(255,255,255,.55); }
.kartu__saldo { color: var(--ink); font: 700 26px var(--font-display); letter-spacing: -.02em; margin-top: 2px; }
.kartu--navy .kartu__saldo { color: #fff; }
.kartu__saldo.is-low { color: var(--coral); }
.kartu--navy .kartu__saldo.is-low { color: #fff; }
.tag-low { background: var(--coral); color: #fff; font: 600 11px var(--font-body); padding: 5px 10px; border-radius: var(--r-pill); }

.aksi { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.aksi__box {
  background: #fff; border: 1px solid var(--line); border-radius: var(--r-md);
  padding: 16px; display: flex; flex-direction: column; gap: 24px;
  color: var(--ink); font: 700 14px var(--font-display);
}
.aksi__box:hover { border-color: var(--blue); color: var(--ink); }
.aksi__box--primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.aksi__box--primary:hover { background: var(--blue-dark); color: #fff; }
.aksi__label { display: flex; align-items: center; gap: 8px; }
.pip {
  background: var(--coral); color: #fff; font: 700 10px var(--font-body); font-style: normal;
  min-width: 17px; height: 17px; border-radius: var(--r-pill);
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
}
</style>
