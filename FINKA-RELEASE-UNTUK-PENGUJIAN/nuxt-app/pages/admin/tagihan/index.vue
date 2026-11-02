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

    <div class="card tabel">
      <div class="tabel__head">
        <span class="h display">Tunggakan per kelas — September 2026</span>
        <div class="tabel__aksi">
          <button class="btn-sm btn-sm--ghost" @click="eksporExcel">Ekspor Excel</button>
          <button v-if="admin" class="btn-sm btn-sm--ghost" @click="kirimPengingat">{{ terkirim ? 'Terkirim ✓' : 'Kirim pengingat' }}</button>
          <nuxt-link v-if="admin" to="/admin/tagihan/buat" class="btn-sm btn-sm--primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Buat tagihan
          </nuxt-link>
        </div>
      </div>

      <div class="baris baris--head">
        <div>KELAS</div><div>SISWA</div><div>SUDAH LUNAS</div><div>NILAI TUNGGAKAN</div><div>STATUS</div>
      </div>
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
export default {

  data() {
    return { terkirim: false }
  },
  computed: {
    admin() { return this.$store.getters['admin/admin'] },
    kelas() { return this.$store.state.admin.kelas },
    kpi() {
      return [
        { label: 'Tagihan terbit September', nilai: this.$rp(561600000), ket: '1.284 siswa', fg: 'var(--ink)' },
        { label: 'Sudah lunas', nilai: this.$rp(438750000), ket: '78,1% siswa', fg: 'var(--green)' },
        { label: 'Menunggu verifikasi', nilai: this.$rp(23400000), ket: '52 permintaan', fg: 'var(--sand-ink)' },
        { label: 'Tunggakan', nilai: this.$rp(99450000), ket: '227 siswa · 12 lewat tempo', fg: 'var(--coral)' }
      ]
    }
  },
  methods: {
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
      a.download = 'tunggakan-per-kelas-september-2026.csv'
      a.click()
      URL.revokeObjectURL(url)
    },
    kirimPengingat() {
      this.terkirim = true
      setTimeout(() => { this.terkirim = false }, 1800)
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
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
</style>
