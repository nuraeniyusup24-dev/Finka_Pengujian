<template>
  <div class="shell">
    <AdminSidebar />
    <div class="main">
      <header class="topbar">
        <div>
          <div class="judul display">{{ meta.judul }}</div>
          <div class="sub">{{ meta.sub }}</div>
        </div>
        <div class="kanan">
          <div v-if="false" class="peran">
            <button
              v-for="r in peranOpsi"
              :key="r.k"
              class="peran__btn"
              :class="peran === r.k ? 'peran__btn--on' : ''"
              @click="setPeran(r.k)"
            >{{ r.l }}</button>
          </div>
          <div class="tanggal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
            <span>{{ tanggalHariIni }}</span>
          </div>
        </div>
      </header>
      <div class="content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script>
const META = {
  '/admin': { judul: 'Dashboard Yayasan', sub: 'Ringkasan arus uang seluruh unit — WIB' },
  '/admin/verifikasi': { judul: 'Verifikasi Top-up', sub: 'Cocokkan bukti transfer dengan mutasi bank sebelum menyetujui' },
  '/admin/tagihan': { judul: 'Tagihan & SPP', sub: 'Penerbitan tagihan dan tunggakan per kelas' },
  '/admin/tagihan/buat': { judul: 'Buat Tagihan Baru', sub: 'Terbitkan invoice ke orang tua — kode unik dibuat otomatis' },
  '/admin/outlet': { judul: 'Outlet & Produk', sub: 'Katalog kantin dan koperasi' },
  '/admin/laporan': { judul: 'Laporan & Rekonsiliasi', sub: 'Uang masuk, uang keluar, dan selisih harian' },
  '/admin/akun': { judul: 'Daftar Akun', sub: 'Akun siswa, orang tua, PIC, dan admin' },
  '/admin/pengaturan': { judul: 'Pengaturan', sub: 'Rekening tujuan, aturan kode unik, dan keamanan akun' }
}

export default {
  mounted() { this.tanggalHariIni = new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Jakarta' }).format(new Date()) },
  data() {
    return { peranOpsi: [], tanggalHariIni: '' }
  },
  computed: {
    peran() { return 'admin' },
    meta() { return META[this.$route.path] || META['/admin'] }
  },
  methods: {
    setPeran() {}
  }
}
</script>

<style scoped>
.shell { display: flex; min-height: 100vh; background: var(--bg); }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.topbar {
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: 16px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex: none;
}
.judul { font: 700 19px var(--font-display); letter-spacing: -.01em; }
.sub { font: 400 12.5px var(--font-body); color: var(--muted); margin-top: 3px; }
.kanan { display: flex; align-items: center; gap: 10px; }
.peran { display: flex; background: var(--bg); border-radius: var(--r-sm); padding: 3px; }
.peran__btn {
  border: none; background: transparent; color: var(--muted);
  font: 600 12.5px var(--font-body); padding: 7px 14px;
  border-radius: 6px; cursor: pointer;
}
.peran__btn--on { background: #fff; color: var(--ink); }

.tanggal {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--line); border-radius: var(--r-sm);
  padding: 8px 13px; font: 500 12.5px var(--font-body);
}

.content { flex: 1; overflow-y: auto; padding: 24px 30px 40px; min-height: 0; }

@media (max-width: 760px) {
  .topbar { padding: 14px 18px; align-items: flex-start; flex-wrap: wrap; }
  .kanan { flex-wrap: wrap; }
  .content { padding: 18px 18px 32px; }
}

@media (max-width: 480px) {
  .topbar { gap: 12px; }
  .kanan { justify-content: flex-start; }
  .tanggal { padding: 8px 10px; font-size: 11.5px; }
}
</style>
