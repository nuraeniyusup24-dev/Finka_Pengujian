<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <div v-if="konfirmasi" class="dlg" @click.self="konfirmasi = null">
      <div class="dlg__box" role="alertdialog" aria-modal="true" aria-labelledby="dlg-judul">
        <div id="dlg-judul" class="dlg__judul display">Batalkan pesanan?</div>
        <p class="dlg__teks">{{ konfirmasi.nama }} akan dihapus dari pesanan{{ jumlah === 1 ? ', sehingga pesanan menjadi batal' : '' }}.</p>
        <div class="dlg__aksi">
          <button type="button" class="dlg__btn" @click="konfirmasi = null">Tidak</button>
          <button type="button" class="dlg__btn dlg__btn--bahaya" @click="batalkanPesanan">Ya, batalkan</button>
        </div>
      </div>
    </div>
    <header class="head">
      <div>
        <div class="logo">
          <svg width="20" height="22" viewBox="0 0 40 44" fill="var(--blue)" aria-hidden="true"><rect x="13" y="0" width="27" height="14" rx="6" /><rect x="0" y="10" width="14" height="14" rx="6" /><rect x="9" y="15" width="24" height="14" rx="6" /><rect x="4" y="30" width="14" height="14" rx="6" /></svg>
          <span class="display">Finka</span>
        </div>
        <div class="outlet display">{{ info.nama }}</div>
        <div class="sesi">Sesi {{ info.sesi }}</div>
      </div>
      <div class="kanan">
        <div class="kanan__atas">
          <span class="badge badge--ok">Online</span>
          <button type="button" class="riwayat" :aria-label="jumlahBaru ? jumlahBaru + ' notifikasi transaksi baru' : 'Riwayat transaksi'" :title="notificationError || 'Riwayat transaksi'" @click="bukaRiwayat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10 21h4" /></svg>
            <span v-if="jumlahBaru" class="riwayat__count">{{ jumlahBaru > 99 ? '99+' : jumlahBaru }}</span>
          </button>
          <nuxt-link to="/pic/pengaturan" class="pengaturan" aria-label="Pengaturan akun" title="Pengaturan akun">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.2V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.1 14H3a2 2 0 110-4h.1a1.6 1.6 0 001.2-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.2 2.7h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.4 1.3z" /></svg>
          </nuxt-link>
        </div>
        <span v-if="notificationError" class="notification-error" role="status">Notifikasi belum dapat dimuat</span>
      </div>
    </header>

    <div v-if="memuatProduk" class="produk-status" role="status">Memuat katalog produk…</div>
    <div v-if="productError" class="produk-error" role="alert">{{ productError }}</div>
    <div v-else-if="!memuatProduk && !produk.length" class="produk-status">Belum ada produk untuk outlet ini.</div>
    <div v-if="produkSiap" class="grid">
      <div
        v-for="p in produk"
        :key="p.id"
        class="prod"
        :class="cart[p.id] ? 'prod--on' : ''"
        role="button"
        tabindex="0"
        @click="tambah(p.id)"
        @keydown.enter="tambah(p.id)"
        @keydown.space.prevent="tambah(p.id)"
      >
        <div class="prod__body">
          <div class="prod__heading">
            <div class="prod__nama">{{ p.nama }}</div>
            <div v-if="cart[p.id]" class="stepper" @click.stop>
              <button type="button" class="step" aria-label="Kurangi" @click="kurang(p)">−</button>
              <span class="step__qty num">{{ cart[p.id] }}</span>
              <button type="button" class="step" aria-label="Tambah" @click="tambah(p.id)">+</button>
            </div>
          </div>
          <div class="prod__ket">{{ p.ket }}</div>
        </div>
        <div class="prod__harga display num">{{ p.harga | rp }}</div>
      </div>
    </div>

    <footer class="foot">
      <div class="foot__row">
        <span class="foot__count">{{ jumlah }} item</span>
        <button class="kosong" :class="total ? '' : 'is-off'" @click="kosongkan">Kosongkan</button>
      </div>
      <div class="foot__row foot__row--total">
        <span>Total</span>
        <span class="display num">{{ total | rp }}</span>
      </div>
      <div class="foot__aksi">
        <button class="btn" :class="total ? 'btn--primary' : 'btn--off'" :disabled="!total || !produkSiap" @click="scan">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M3 12h18" /></svg>
          Scan siswa
        </button>
        <nuxt-link to="/pic/tunai" class="tunai display">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></svg>
          Tunai
        </nuxt-link>
      </div>
    </footer>
  </div>
</template>

<script>
import { OUTLET_INFO, OUTLET_KEYS } from '~/store/pos.js'
import { api } from '~/utils/api'

export default {

  data() {
    return { konfirmasi: null, transaksiBaru: [], notificationError: '', notificationTimer: null, notificationStorageKey: '', memuatProduk: true, productError: '' }
  },
  mounted() {
    const userId = this.$store.state.auth.user && this.$store.state.auth.user.id
    this.notificationStorageKey = `finka_pic_seen_transactions_${userId || 'account'}`
    this.muatNotifikasi()
    this.muatProduk()
    this.notificationTimer = setInterval(() => {
      if (document.visibilityState === 'visible') this.muatNotifikasi()
    }, 30000)
    document.addEventListener('visibilitychange', this.saatTerlihat)
  },
  beforeDestroy() {
    if (this.notificationTimer) clearInterval(this.notificationTimer)
    document.removeEventListener('visibilitychange', this.saatTerlihat)
  },
  computed: {
    outlet() { return this.$store.state.pos.outlet },
    info() { return OUTLET_INFO[this.outlet] || OUTLET_INFO[0] },
    cart() { return this.$store.state.pos.cart },
    produk() { return this.$store.getters.produkOutlet(this.outlet) },
    total() { return this.$store.getters['pos/totalBelanja'] },
    jumlah() { return this.$store.getters['pos/jumlahItem'] },
    jumlahBaru() { return this.transaksiBaru.length },
    produkSiap() { return !this.memuatProduk && !this.productError }
  },
  methods: {
    saatTerlihat() { if (document.visibilityState === 'visible') this.muatNotifikasi() },
    async muatNotifikasi() {
      try {
        const { riwayat } = await api.riwayatKasir()
        const ids = (riwayat || []).map((item) => String(item.id))
        const stored = window.localStorage.getItem(this.notificationStorageKey)
        if (stored === null) {
          window.localStorage.setItem(this.notificationStorageKey, JSON.stringify([]))
          this.transaksiBaru = ids
        } else {
          const seen = new Set(JSON.parse(stored))
          this.transaksiBaru = ids.filter((id) => !seen.has(id))
        }
        this.notificationError = ''
      } catch (error) {
        this.notificationError = error.message || 'Notifikasi transaksi gagal dimuat.'
      }
    },
    async muatProduk() {
      this.memuatProduk = true
      this.productError = ''
      try {
        const data = await api.produk()
        if (!data.outlet) throw new Error('Outlet akun PIC belum diatur oleh Admin.')
        const outlet = OUTLET_KEYS.indexOf(String(data.outlet))
        if (outlet < 0) throw new Error('Outlet akun PIC tidak dikenali. Hubungi Admin.')
        this.$store.commit('setProduk', (data.produk || []).map((p) => Object.assign({}, p, { outlet })))
        this.$store.commit('pos/setOutlet', outlet)
      } catch (error) {
        this.productError = error.message || 'Katalog produk gagal dimuat.'
      } finally {
        this.memuatProduk = false
      }
    },
    async bukaRiwayat() {
      await this.muatNotifikasi()
      if (this.notificationStorageKey) {
        const ids = this.transaksiBaru.map(String)
        try {
          const stored = JSON.parse(window.localStorage.getItem(this.notificationStorageKey) || '[]')
          window.localStorage.setItem(this.notificationStorageKey, JSON.stringify(Array.from(new Set(stored.concat(ids)))))
        } catch (error) {
          this.notificationError = 'Status notifikasi gagal disimpan.'
        }
        this.transaksiBaru = []
      }
      this.$router.push('/pic/riwayat')
    },
    tambah(id) { this.$store.commit('pos/tambah', id) },
    // Sisa 1 lalu klik "−" = minta konfirmasi untuk membatalkan pesanan item itu
    kurang(p) {
      if (this.cart[p.id] <= 1) {
        this.konfirmasi = { id: p.id, nama: p.nama }
        return
      }
      this.$store.commit('pos/kurang', p.id)
    },
    batalkanPesanan() {
      if (this.konfirmasi) this.$store.commit('pos/hapusItem', this.konfirmasi.id)
      this.konfirmasi = null
    },
    kosongkan() { this.$store.commit('pos/kosongkan') },
    scan() {
      if (!this.total) return
      this.$store.commit('pos/setMode', 'belanja')
      this.$router.push('/pic/scan')
    }
  }
}
</script>

<style scoped>
.wrap { position: relative; flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.head { padding: 8px 18px 14px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: none; }
.logo { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: var(--ink); font: 800 16px var(--font-display); }
.outlet { font: 700 15px var(--font-display); }
.sesi { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 2px; }
.kanan { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.kanan__atas { display: flex; align-items: center; gap: 8px; }
.kas { font: 400 10.5px var(--font-body); color: var(--muted); }
.riwayat, .pengaturan { position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; background: transparent; color: var(--muted); padding: 3px; border-radius: var(--r-pill); cursor: pointer; }
.riwayat:hover, .pengaturan:hover { color: var(--blue); background: var(--blue-soft); }
.riwayat__count { position: absolute; top: -3px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; border: 1px solid #fff; border-radius: 999px; background: var(--coral); color: #fff; font: 700 9px/14px var(--font-body); text-align: center; }
.notification-error { color: var(--coral); font: 400 9px var(--font-body); }

.grid { flex: 1; overflow-y: auto; padding: 14px 18px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start; }
.produk-status, .produk-error { padding: 10px 18px; font: 500 12px/1.5 var(--font-body); }
.produk-status { color: var(--muted); }
.produk-error { color: var(--coral); }
.prod {
  border: 1px solid var(--line); background: #fff; border-radius: var(--r-md);
  padding: 13px; display: flex; flex-direction: column; gap: 10px;
  cursor: pointer; min-height: 104px; text-align: left;
}
.prod--on { border-color: var(--blue); background: var(--blue-soft); }
.prod__heading { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.stepper {
  display: flex; align-items: center; gap: 1px;
  background: var(--blue); border-radius: var(--r-pill); padding: 2px;
}
.step {
  width: 20px; height: 20px; border: none; flex: none;
  background: rgba(255,255,255,.16); color: #fff; border-radius: var(--r-pill);
  display: flex; align-items: center; justify-content: center;
  font: 700 14px var(--font-display); line-height: 1; cursor: pointer; padding: 0;
}
.step:hover { background: rgba(255,255,255,.32); }
.step:active { background: rgba(255,255,255,.42); }
.step__qty { min-width: 16px; text-align: center; color: #fff; font: 700 11.5px var(--font-body); }
.prod__body { flex: 1; }
.prod__nama { min-width:0; font: 600 13px/1.35 var(--font-body); text-wrap: pretty; }
.prod__ket { font: 400 11px var(--font-body); color: var(--muted); margin-top: 2px; }
.prod__harga { font: 700 13.5px var(--font-display); }

.foot { border-top: 1px solid var(--line); padding: 14px 18px 22px; display: flex; flex-direction: column; gap: 12px; flex: none; }
.foot__row { display: flex; align-items: center; justify-content: space-between; font: 400 12.5px var(--font-body); color: var(--muted); }
.foot__row--total { align-items: flex-end; }
.foot__row--total span:last-child { font: 800 26px var(--font-display); color: var(--ink); letter-spacing: -.02em; }
.kosong { border: none; background: none; font: 600 12px var(--font-body); color: var(--coral); cursor: pointer; padding: 0; }
.kosong.is-off { color: var(--disabled); }
.foot__aksi { display: flex; gap: 10px; }
.foot__aksi .btn { flex: 1; }
.tunai {
  flex: none; border: 1.5px solid var(--blue); color: var(--blue);
  font: 700 15px var(--font-display); padding: 16px 18px; border-radius: var(--r-sm);
  display: flex; align-items: center; gap: 9px;
}
.tunai:hover { color: var(--blue); background: var(--blue-soft); }
.dlg { position: absolute; inset: 0; z-index: 20; background: rgba(10, 13, 59, .45); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dlg__box { background: #fff; border-radius: var(--r-md); padding: 20px; width: 100%; box-shadow: 0 16px 40px rgba(10, 13, 59, .3); }
.dlg__judul { font: 700 16px var(--font-display); }
.dlg__teks { margin: 6px 0 16px; font: 400 13px/1.5 var(--font-body); color: var(--muted); }
.dlg__aksi { display: flex; gap: 10px; }
.dlg__btn { flex: 1; padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: #fff; color: var(--ink); font: 700 13.5px var(--font-display); cursor: pointer; }
.dlg__btn:hover { border-color: #CBD0DB; }
.dlg__btn--bahaya { background: var(--coral); border-color: var(--coral); color: #fff; }
.dlg__btn--bahaya:hover { background: #C73C2B; border-color: #C73C2B; }
</style>
