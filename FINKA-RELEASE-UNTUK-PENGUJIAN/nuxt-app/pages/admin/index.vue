<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div v-if="dashboard && dashboard.selisih !== 0" class="alert">
      <div class="alert__ik">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linecap="round"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9.5" /></svg>
      </div>
      <div class="alert__body">
        <div class="alert__judul display">Rekonsiliasi {{ tanggalDashboard }} memiliki selisih {{ Math.abs(dashboard.selisih) | rp }}</div>
        <div class="alert__ket">Periksa ringkasan transaksi hari ini di Laporan &amp; Rekonsiliasi.</div>
      </div>
      <nuxt-link to="/admin/laporan" class="alert__aksi">Telusuri</nuxt-link>
    </div>

    <div v-if="error" class="status-pesan status-pesan--error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="muatDashboard">Coba lagi</button>
    </div>
    <div v-else-if="memuat && !dashboard" class="status-pesan" role="status">Memuat ringkasan dashboard…</div>

    <div class="kpi">
      <div v-for="k in kpi" :key="k.label" class="card kpi__box">
        <div class="kpi__head">
          <span>{{ k.label }}</span>
          <i :style="'background:' + k.bg"></i>
        </div>
        <div class="kpi__nilai display num">{{ k.nilai }}</div>
        <div class="kpi__delta">{{ k.ket }}</div>
      </div>
    </div>
    <div v-if="dashboard" class="waktu-update">Data per {{ waktuPembaruan }}</div>

    <div class="split">
      <div class="card chart">
        <div class="chart__head">
          <div>
            <div class="h display">Arus uang 14 hari terakhir</div>
            <div class="sub">Top-up masuk dibanding transaksi POS keluar</div>
          </div>
          <div class="legend">
            <span><i style="background: var(--blue)"></i>Masuk</span>
            <span><i style="background: var(--sand)"></i>Keluar</span>
          </div>
        </div>
        <div v-if="chart.length" class="bars">
          <div v-for="(c, i) in chart" :key="i" class="bar">
            <div class="bar__pair">
              <i :title="'Masuk ' + $rp(c.masuk)" :style="'height:' + tinggiBar(c.masuk) + '%; background: var(--blue)'"></i>
              <i :title="'Keluar ' + $rp(c.keluar)" :style="'height:' + tinggiBar(c.keluar) + '%; background: var(--sand)'"></i>
            </div>
            <span class="num">{{ c.hari }}</span>
          </div>
        </div>
        <div v-else class="kosong">Belum ada data arus uang.</div>
      </div>

      <div class="kolom">
        <div class="card panel">
          <div class="panel__head">
            <span class="h display">Antrean verifikasi</span>
            <nuxt-link to="/admin/verifikasi" class="link">Buka</nuxt-link>
          </div>
          <div class="panel__angka">
            <b class="display num">{{ antrean.length }}</b>
            <span>permintaan menunggu</span>
          </div>
          <div class="antrean">
            <div v-for="a in antrean.slice(0, 3)" :key="a.id" class="antrean__row">
              <span class="av">{{ inisial(a.siswa) }}</span>
              <span class="antrean__id"><b>{{ a.siswa }}</b><i>{{ formatWaktu(a.waktu) }}</i></span>
              <b class="num">{{ (a.dasar + a.kode) | rp }}</b>
            </div>
            <div v-if="!antrean.length" class="kosong">Tidak ada permintaan yang menunggu.</div>
          </div>
        </div>

        <div class="card panel">
          <div class="h display">Transaksi per outlet hari ini</div>
          <div v-for="o in outlets" :key="o.nama" class="outlet">
            <div class="outlet__row">
              <span>{{ o.nama }}</span>
              <b class="num">{{ o.nilai | rp }}</b>
            </div>
            <div class="outlet__meta">{{ o.transaksi.toLocaleString('id-ID') }} transaksi</div>
            <div class="progress"><i :style="'width:' + o.pct + '%; background:' + o.warna"></i></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {

  data() {
    return {
      dashboard: null,
      antrean: [],
      memuat: true,
      error: '',
      diperbaruiPada: null,
      refreshTimer: null,
      sedangMemuat: false
    }
  },
  computed: {
    chart() {
      if (!this.dashboard || !Array.isArray(this.dashboard.chart)) return []
      return this.dashboard.chart.map((item) => ({
        hari: this.formatTanggal(item.tanggal, { day: 'numeric' }),
        masuk: Number(item.masuk) || 0,
        keluar: Number(item.keluar) || 0
      }))
    },
    outlets() {
      if (!this.dashboard || !Array.isArray(this.dashboard.outlets)) return []
      const label = {
        kantin_utama: 'Kantin Utama',
        kantin_b: 'Kantin Blok B',
        koperasi: 'Koperasi Sekolah'
      }
      const maks = Math.max(1, ...this.dashboard.outlets.map((o) => Number(o.nilai) || 0))
      return this.dashboard.outlets.map((item, index) => ({
        nama: label[item.outlet] || item.outlet,
        nilai: Number(item.nilai) || 0,
        transaksi: Number(item.transaksi) || 0,
        pct: Math.round((Number(item.nilai) || 0) / maks * 100),
        warna: index === 2 ? 'var(--sand)' : 'var(--blue)'
      }))
    },
    tanggalDashboard() {
      if (!this.dashboard) return ''
      return this.formatTanggal(this.dashboard.tanggal, { day: 'numeric', month: 'long', year: 'numeric' })
    },
    waktuPembaruan() {
      return this.diperbaruiPada
        ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).format(this.diperbaruiPada)
        : ''
    },
    maksimumChart() {
      return Math.max(0, ...this.chart.reduce((nilai, item) => nilai.concat([item.masuk, item.keluar]), []))
    },
    kpi() {
      if (!this.dashboard) return []
      const d = this.dashboard
      return [
        { label: 'Uang masuk hari ini', nilai: this.$rp(d.uang_masuk), ket: 'Top-up dan pembayaran tercatat', bg: 'var(--blue-soft)' },
        { label: 'Uang keluar hari ini', nilai: this.$rp(d.uang_keluar), ket: 'Pengeluaran tercatat hari ini', bg: 'rgba(192,169,127,.2)' },
        { label: 'Saldo mengendap', nilai: this.$rp(d.saldo_mengendap), ket: Number(d.dompet_aktif).toLocaleString('id-ID') + ' dompet aktif', bg: 'rgba(26,128,64,.1)' },
        { label: 'Transaksi hari ini', nilai: Number(d.transaksi_hari_ini).toLocaleString('id-ID'), ket: 'Transaksi tercatat di backend', bg: 'var(--bg)' }
      ]
    }
  },
  mounted() {
    this.muatDashboard()
    this.refreshTimer = window.setInterval(() => {
      if (!document.hidden) this.muatDashboard()
    }, 15000)
    document.addEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  beforeDestroy() {
    window.clearInterval(this.refreshTimer)
    document.removeEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  methods: {
    tanggalDariApi(nilai) {
      if (nilai instanceof Date) return Number.isNaN(nilai.getTime()) ? null : nilai
      if (typeof nilai !== 'string' && typeof nilai !== 'number') return null

      const teks = String(nilai)
      const tanggalSaja = /^\d{4}-\d{2}-\d{2}$/.test(teks)
      const tanggal = new Date(tanggalSaja ? teks + 'T12:00:00+07:00' : teks)
      return Number.isNaN(tanggal.getTime()) ? null : tanggal
    },
    formatTanggal(nilai, opsi) {
      const tanggal = this.tanggalDariApi(nilai)
      if (!tanggal) return '-'
      return new Intl.DateTimeFormat('id-ID', Object.assign({}, opsi, { timeZone: 'Asia/Jakarta' })).format(tanggal)
    },
    async muatDashboard() {
      if (this.sedangMemuat) return
      this.sedangMemuat = true
      this.error = ''
      try {
        const [dashboard, topup] = await Promise.all([
          api.dashboard(),
          api.antreanTopup('menunggu')
        ])
        this.dashboard = dashboard
        this.antrean = Array.isArray(topup.topup) ? topup.topup : []
        this.diperbaruiPada = new Date()
      } catch (error) {
        this.error = error.message || 'Gagal memuat data dashboard dari server.'
      } finally {
        this.memuat = false
        this.sedangMemuat = false
      }
    },
    saatVisibilitasBerubah() {
      if (!document.hidden) this.muatDashboard()
    },
    inisial(nama) {
      return String(nama || '').split(' ').filter(Boolean).map((kata) => kata[0]).join('').slice(0, 2).toUpperCase()
    },
    formatWaktu(waktu) {
      const tanggal = this.tanggalDariApi(waktu)
      if (!tanggal) return 'Waktu tidak tersedia'
      return this.formatTanggal(tanggal, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    tinggiBar(nilai) {
      return nilai > 0 && this.maksimumChart ? Math.max(3, Math.round(nilai / this.maksimumChart * 100)) : 0
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

.alert { background: #fff; border: 1px solid var(--coral); border-radius: var(--r-md); padding: 16px 18px; display: flex; align-items: center; gap: 14px; min-width: 0; }
.alert__ik { width: 36px; height: 36px; border-radius: var(--r-pill); background: rgba(223,74,55,.1); display: flex; align-items: center; justify-content: center; flex: none; }
.alert__body { flex: 1; min-width: 0; }
.alert__judul { font: 700 13.5px var(--font-display); }
.alert__ket { font: 400 12.5px var(--font-body); color: var(--muted); margin-top: 2px; }
.alert__aksi { flex: none; border: 1px solid var(--coral); color: var(--coral); font: 600 12.5px var(--font-body); padding: 9px 15px; border-radius: var(--r-sm); }

.kpi { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi__box { min-width: 0; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.kpi__head { display: flex; align-items: center; justify-content: space-between; font: 500 12px var(--font-body); color: var(--muted); }
.kpi__head span { min-width: 0; }
.kpi__head i { width: 26px; height: 26px; border-radius: var(--r-sm); display: block; flex: none; }
.kpi__nilai { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 clamp(20px, 2vw, 27px) var(--font-display); letter-spacing: -.025em; }
.kpi__delta { min-height: 16px; font: 400 11.5px/1.4 var(--font-body); color: var(--muted); }
.waktu-update { margin-top: -12px; color: var(--muted); text-align: right; font: 400 11px var(--font-body); }
.status-pesan { padding: 18px; border: 1px solid var(--line); border-radius: var(--r-md); background: #fff; color: var(--muted); font: 500 13px/1.5 var(--font-body); }
.status-pesan--error { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-color: rgba(223, 74, 55, .35); color: var(--coral); }
.status-pesan button { flex: none; padding: 8px 12px; border: 1px solid var(--coral); border-radius: var(--r-sm); background: #fff; color: var(--coral); cursor: pointer; font: 600 12px var(--font-body); }

.split { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
.chart { min-width: 0; overflow: hidden; padding: 20px; }
.chart__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.h { font: 700 14px var(--font-display); }
.sub { font: 400 12px var(--font-body); color: var(--muted); margin-top: 3px; }
.legend { display: flex; flex: none; gap: 16px; font: 500 11.5px var(--font-body); color: var(--muted); }
.legend span { display: flex; align-items: center; gap: 7px; }
.legend i { width: 9px; height: 9px; border-radius: 2px; }

.bars { display: flex; align-items: flex-end; gap: clamp(2px, .8vw, 10px); height: 210px; }
.bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
.bar__pair { width: 100%; display: flex; gap: 3px; align-items: flex-end; height: 100%; }
.bar__pair i { flex: 1; border-radius: 3px 3px 0 0; min-height: 3px; }
.bar span { font: 500 10.5px var(--font-body); color: var(--muted); }
.kosong { padding: 20px 10px; color: var(--muted); text-align: center; font: 400 12px var(--font-body); }

.kolom { display: flex; flex-direction: column; gap: 16px; }
.panel { min-width: 0; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.panel__head { display: flex; align-items: center; justify-content: space-between; }
.link { font: 600 12px var(--font-body); }
.panel__angka { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; font: 400 12.5px var(--font-body); color: var(--muted); }
.panel__angka b { font: 800 34px var(--font-display); color: var(--ink); letter-spacing: -.03em; }
.antrean { display: flex; flex-direction: column; gap: 10px; }
.antrean__row { display: flex; align-items: center; gap: 11px; min-width: 0; }
.av { width: 30px; height: 30px; border-radius: var(--r-pill); background: var(--blue-soft); color: var(--blue); display: flex; align-items: center; justify-content: center; font: 700 11px var(--font-display); flex: none; }
.antrean__id { flex: 1; min-width: 0; }
.antrean__id b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 12.5px var(--font-body); }
.antrean__id i { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 11px var(--font-body); color: var(--muted); font-style: normal; }
.antrean__row > b { flex: none; font: 700 12px var(--font-body); white-space: nowrap; }

.outlet { display: flex; flex-direction: column; gap: 5px; }
.outlet__row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font: 500 12.5px var(--font-body); }
.outlet__row span { min-width: 0; }
.outlet__row b { font-weight: 600; }
.outlet__meta { color: var(--muted); font: 400 10.5px var(--font-body); }
.progress { height: 7px; border-radius: var(--r-pill); background: var(--bg); overflow: hidden; }
.progress i { display: block; height: 100%; border-radius: var(--r-pill); }

@media (max-width: 1150px) {
  .kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .split { grid-template-columns: minmax(0, 1fr); }
  .kolom { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .page { gap: 14px; }
  .kpi { gap: 10px; }
  .kpi__box { padding: 14px; gap: 9px; }
  .kpi__head { gap: 8px; font-size: 11px; }
  .kpi__head i { width: 22px; height: 22px; }
  .kpi__nilai { font-size: clamp(17px, 5vw, 23px); }
  .kpi__delta { font-size: 10.5px; }
  .split { gap: 12px; }
  .chart, .panel { padding: 16px; }
  .chart__head { flex-direction: column; margin-bottom: 14px; }
  .legend { gap: 12px; }
  .bars { height: 170px; }
  .kolom { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .alert { align-items: flex-start; flex-wrap: wrap; padding: 14px; gap: 10px; }
  .alert__body { flex-basis: calc(100% - 48px); }
  .alert__aksi { margin-left: 46px; }
  .status-pesan--error { align-items: flex-start; flex-direction: column; }
  .waktu-update { margin-top: -8px; }
}

@media (max-width: 380px) {
  .kpi { grid-template-columns: minmax(0, 1fr); }
  .kpi__nilai { font-size: 24px; }
  .antrean__row { gap: 8px; }
  .antrean__row > b { font-size: 11px; }
}
</style>
