<template>
  <aside class="side">
    <div class="brand">
      <svg width="22" height="24" viewBox="0 0 40 44" fill="#FFFFFF"><rect x="13" y="0" width="27" height="14" rx="6" /><rect x="0" y="10" width="14" height="14" rx="6" /><rect x="9" y="15" width="24" height="14" rx="6" /><rect x="4" y="30" width="14" height="14" rx="6" /></svg>
      <div class="brand__name display">Finka</div>
      <div class="brand__tag">YAYASAN</div>
    </div>

    <nav class="menu">
      <nuxt-link v-for="m in menu" :key="m.to" :to="m.to" class="item" :class="isActive(m) ? 'item--on' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path v-for="(d, i) in m.paths" :key="i" :d="d" />
        </svg>
        <span class="item__label">{{ m.label }}</span>
        <span
          v-if="m.to === '/admin/verifikasi' && menunggu"
          class="item__badge"
          :aria-label="menunggu + ' permintaan menunggu verifikasi'"
        >{{ menunggu }}</span>
      </nuxt-link>
      <div v-if="errorAntrean" class="menu__error" role="status">{{ errorAntrean }}</div>
    </nav>

    <div class="spacer"></div>

    <div class="user">
      <div class="user__av">
        <img v-if="avatar" :src="avatar" alt="" />
        <span v-else>{{ inisial }}</span>
      </div>
      <div>
        <div class="user__nama">{{ nama }}</div>
        <div class="user__peran">{{ peranLabel }}</div>
      </div>
    </div>
  </aside>
</template>

<script>
export default {
  name: 'AdminSidebar',
  data() {
    return {
      timerAntrean: null,
      memuatAntrean: false,
      errorAntrean: '',
      menu: [
        { label: 'Dashboard', to: '/admin', paths: ['M3 13h8V3H3zM13 21h8V11h-8zM13 8h8V3h-8zM3 21h8v-5H3z'] },
        { label: 'Verifikasi Pembayaran', to: '/admin/verifikasi', paths: ['M9 12l2 2 4-4', 'M12 3l7.5 3v6c0 4.5-3 7.6-7.5 9-4.5-1.4-7.5-4.5-7.5-9V6z'] },
        { label: 'Tagihan & SPP', to: '/admin/tagihan', paths: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'] },
        { label: 'Outlet & Produk', to: '/admin/outlet', paths: ['M3 9l1.5-5h15L21 9', 'M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1z', 'M9 21v-6h6v6'] },
        { label: 'Laporan', to: '/admin/laporan', paths: ['M4 20V10M10 20V4M16 20v-7M22 20H2'] },
        { label: 'Daftar Akun', to: '/admin/akun', paths: ['M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75'] },
        { label: 'Pengaturan', to: '/admin/pengaturan', paths: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.2V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.1 14H3a2 2 0 110-4h.1a1.6 1.6 0 001.2-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020.9 10H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z'] },
      ]
    }
  },
  mounted() {
    this.perbaruiAntrean()
    this.timerAntrean = window.setInterval(this.perbaruiAntrean, 15000)
    document.addEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  beforeDestroy() {
    window.clearInterval(this.timerAntrean)
    document.removeEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  computed: {
    menunggu() { return this.$store.getters['admin/menunggu'].length },
    nama() { return (this.$store.state.auth.user && this.$store.state.auth.user.nama) || 'Admin' },
    avatar() { return (this.$store.state.auth.user && this.$store.state.auth.user.avatar) || '' },
    inisial() { return this.nama.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() },
    peranLabel() { return 'Admin Yayasan' }
  },
  methods: {
    async perbaruiAntrean() {
      if (this.memuatAntrean) return
      this.memuatAntrean = true
      try {
        await this.$store.dispatch('admin/muatAntreanTopup')
        this.errorAntrean = ''
      } catch (error) {
        this.errorAntrean = 'Gagal memperbarui jumlah verifikasi: ' + (error.message || 'Terjadi kesalahan.')
      } finally {
        this.memuatAntrean = false
      }
    },
    saatVisibilitasBerubah() {
      if (!document.hidden) this.perbaruiAntrean()
    },
    isActive(m) {
      return m.to === '/admin' ? this.$route.path === '/admin' : this.$route.path.indexOf(m.to) === 0
    }
  }
}
</script>

<style scoped>
.side {
  width: 246px; flex: none; background: var(--navy);
  display: flex; flex-direction: column; padding: 22px 0;
}
.brand { display: flex; align-items: center; gap: 11px; padding: 0 22px 26px; }
.brand__name { font: 800 18px var(--font-display); color: #fff; }
.brand__tag {
  font: 500 10px var(--font-body); color: var(--sand);
  border: 1px solid rgba(192,169,127,.4); padding: 2px 6px;
  border-radius: 4px; letter-spacing: .06em;
}
.menu { padding: 0 12px; display: flex; flex-direction: column; gap: 2px; }
.item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 12px; border-radius: var(--r-sm);
  color: rgba(255,255,255,.65); font: 600 13px var(--font-body);
}
.item:hover { background: rgba(255,255,255,.07); color: rgba(255,255,255,.65); }
.item--on, .item--on:hover { background: var(--blue); color: #fff; }
.item__label { flex: 1; }
.item__badge {
  background: var(--coral); color: #fff; font: 700 10.5px var(--font-body);
  min-width: 19px; height: 19px; border-radius: var(--r-pill);
  display: flex; align-items: center; justify-content: center; padding: 0 6px;
}
.menu__error { padding: 8px 12px; color: #ffd2cc; font: 400 11px/1.4 var(--font-body); }
.spacer { flex: 1; }
.user__av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.user {
  margin: 0 22px; padding-top: 18px;
  border-top: 1px solid rgba(255,255,255,.1);
  display: flex; align-items: center; gap: 11px;
}
.user__av {
  width: 34px; height: 34px; border-radius: var(--r-pill);
  background: rgba(255,255,255,.12); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font: 700 12px var(--font-display);
}
.user__nama { font: 600 12.5px var(--font-body); color: #fff; }
.user__peran { font: 400 11px var(--font-body); color: rgba(255,255,255,.5); }
</style>
