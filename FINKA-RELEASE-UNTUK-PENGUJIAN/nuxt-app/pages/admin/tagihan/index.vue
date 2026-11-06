<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div class="kpi">
      <div v-for="k in kpi" :key="k.label" class="card kpi__box">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__nilai display num" :style="'color:' + k.fg">{{ k.nilai }}</div>
        <div class="kpi__ket">{{ k.ket }}</div>
      </div>
    </div>

    <div v-if="error" class="pesan pesan--error" role="alert">{{ error }}</div>
    <div v-if="pesanPengingat" class="pesan" role="status">{{ pesanPengingat }}</div>
    <div class="card tabel">
      <div class="tabel__head">
        <span class="h display">Tunggakan per kelas — {{ bulanLabel }}</span>
        <div class="tabel__aksi">
          <button class="btn-sm btn-sm--ghost" @click="eksporExcel">Ekspor Excel</button>
          <button v-if="admin" class="btn-sm btn-sm--ghost" :disabled="mengirimPengingat" @click="kirimPengingat">
            {{ mengirimPengingat ? 'Mengirim...' : 'Kirim pengingat' }}
          </button>
          <nuxt-link v-if="admin" to="/admin/tagihan/buat" class="btn-sm btn-sm--primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Buat tagihan
          </nuxt-link>
        </div>
      </div>

      <div class="baris baris--head">
        <div>KELAS</div><div>SISWA</div><div>SUDAH LUNAS</div><div>NILAI TUNGGAKAN</div><div>STATUS</div>
      </div>
      <div v-if="memuat" class="pesan tabel__kosong">Memuat ringkasan tagihan...</div>
      <div v-else-if="!kelas.length" class="pesan tabel__kosong">Belum ada data tagihan untuk bulan ini.</div>
      <div v-for="k in kelas" :key="k.kelas" class="baris">
        <div class="kelas">{{ k.kelas }}</div>
        <div class="muted num">{{ k.n }}</div>
        <div class="lunas">
          <span class="progress"><i :style="'width:' + k.lunas + '%; background:' + warna(k.lunas)"></i></span>
          <b class="num">{{ k.lunas }}%</b>
        </div>
        <div class="num nilai" :style="'color:' + (k.lunas >= 80 ? 'var(--ink)' : 'var(--coral)')">{{ k.tunggakan | rp }}</div>
        <div><span class="badge" :class="badge(k.lunas)">{{ statusLabel(k.lunas) }}</span></div>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {

  data() {
    const now = new Date()
    return {
      bulan: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      ringkasan: null,
      memuat: true,
      error: '',
      pesanPengingat: '',
      mengirimPengingat: false
    }
  },
  computed: {
    admin() { return this.$store.getters['admin/admin'] },
    kelas() {
      return (this.ringkasan && this.ringkasan.kelas || []).map((row) => ({
        kelas: row.kelas,
        n: row.siswa,
        lunas: row.persen_lunas,
        tunggakan: row.tunggakan
      }))
    },
    bulanLabel() {
      const [tahun, bulan] = this.bulan.split('-').map(Number)
      return new Date(tahun, bulan - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    },
    kpi() {
      const total = this.ringkasan && this.ringkasan.total || {}
      const terbit = Number(total.terbit || 0)
      const lunas = Number(total.lunas || 0)
      const persenLunas = terbit ? (lunas / terbit * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '0'
      return [
        { label: 'Tagihan diterbitkan', nilai: this.$rp(terbit), ket: `${Number(total.invoice || 0)} tagihan`, fg: 'var(--ink)' },
        { label: 'Sudah lunas', nilai: this.$rp(lunas), ket: `${persenLunas}% dari nilai terbit`, fg: 'var(--green)' },
        { label: 'Menunggu verifikasi', nilai: this.$rp(total.menunggu_verifikasi || 0), ket: `${Number(total.permintaan_menunggu || 0)} permintaan`, fg: 'var(--sand-ink)' },
        { label: 'Tunggakan', nilai: this.$rp(total.tunggakan || 0), ket: `${Number(total.invoice - total.invoice_lunas || 0)} tagihan belum lunas`, fg: 'var(--coral)' }
      ]
    }
  },
  mounted() { this.muatRingkasan() },
  methods: {
    async muatRingkasan() {
      this.memuat = true
      this.error = ''
      try {
        this.ringkasan = await api.tagihanRingkasan(this.bulan)
      } catch (error) {
        this.error = error.message || 'Gagal memuat ringkasan tagihan.'
      } finally {
        this.memuat = false
      }
    },
    warna(p) { return p >= 80 ? 'var(--green)' : p >= 50 ? 'var(--sand)' : 'var(--coral)' },
    statusLabel(p) { return p >= 80 ? 'Aman' : p >= 50 ? 'Perlu perhatian' : 'Kritis' },
    badge(p) { return p >= 80 ? 'badge--ok' : p >= 50 ? 'badge--warn' : 'badge--bad' },
    eksporExcel() {
      const head = ['Kelas', 'Siswa', 'Sudah Lunas (%)', 'Nilai Tunggakan']
      const baris = this.kelas.map((k) => [k.kelas, k.n, k.lunas, k.tunggakan].join(';'))
      const csv = [head.join(';')].concat(baris).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tunggakan-per-kelas-' + this.bulan + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    },
    async kirimPengingat() {
      if (this.mengirimPengingat) return
      this.mengirimPengingat = true
      this.pesanPengingat = ''
      this.error = ''
      try {
        const hasil = await api.kirimPengingatTagihan()
        this.pesanPengingat = hasil.jumlah_tagihan
          ? `Pengingat terkirim untuk ${hasil.jumlah_tagihan} tagihan ke ${hasil.jumlah_ortu} akun orang tua.`
          : 'Tidak ada tagihan belum dibayar yang perlu diingatkan.'
      } catch (error) {
        this.error = error.message || 'Gagal mengirim pengingat.'
      } finally {
        this.mengirimPengingat = false
      }
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
.pesan { padding: 10px 14px; border-radius: var(--r-sm); background: #fff; font: 500 12px/1.5 var(--font-body); color: var(--green); }
.pesan--error { color: var(--coral); }
.kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi__box { padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.kpi__label { font: 500 12px var(--font-body); color: var(--muted); }
.kpi__nilai { font: 800 24px var(--font-display); letter-spacing: -.02em; }
.kpi__ket { font: 400 11.5px var(--font-body); color: var(--muted); }

.tabel { overflow: hidden; }
.tabel__head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.h { font: 700 14px var(--font-display); }
.tabel__aksi { display: flex; gap: 9px; }
.btn-sm { border: none; border-radius: var(--r-sm); font: 600 12.5px var(--font-body); padding: 8px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.btn-sm--ghost { background: #fff; border: 1px solid var(--line); color: var(--ink); }
.btn-sm:disabled { opacity: .65; cursor: wait; }
.btn-sm--primary { background: var(--blue); color: #fff; }
.btn-sm--primary:hover { background: var(--blue-dark); color: #fff; }

.baris { display: grid; grid-template-columns: 1fr 1fr 1.2fr 1.2fr 1fr; padding: 14px 20px; border-top: 1px solid var(--bg); align-items: center; }
.baris--head { padding: 11px 20px; background: var(--bg); border-top: none; font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .03em; }
.kelas { font: 600 13px var(--font-body); }
.muted { font: 400 13px var(--font-body); color: var(--muted); }
.lunas { display: flex; align-items: center; gap: 10px; }
.progress { width: 70px; height: 6px; border-radius: var(--r-pill); background: var(--bg); overflow: hidden; }
.progress i { display: block; height: 100%; border-radius: var(--r-pill); }
.lunas b { font: 500 12.5px var(--font-body); }
.nilai { font: 600 13px var(--font-body); }
.tabel__kosong { padding: 18px 20px; border-radius: 0; background: var(--bg); color: var(--muted); }
</style>
