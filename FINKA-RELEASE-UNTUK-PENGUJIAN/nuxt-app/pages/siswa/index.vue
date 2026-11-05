<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="wrap">
    <div class="atas">
      <div class="bar">
        <div class="logo">
          <FinkaMark :width="20" :height="22" color="#fff" />
          <span class="display">FINKA</span>
        </div>
        <div class="settings-wrap">
          <nuxt-link to="/siswa/pengaturan" class="settings-btn" aria-label="Pengaturan akun">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.2V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.1 14H3a2 2 0 110-4h.1a1.6 1.6 0 001.2-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020.9 10H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" /></svg>
          </nuxt-link>
        </div>
      </div>
      <div class="who">
        <div class="av">
          <img v-if="user.avatar" :src="user.avatar" alt="" />
          <span v-else>{{ siswa.inisial }}</span>
        </div>
        <div>
          <div class="who__nama display">{{ siswa.nama }}</div>
          <div class="who__sub">{{ siswa.kelas }} · NIS {{ siswa.nis }}</div>
        </div>
      </div>
      <div class="saldo">
        <div class="saldo__label">SALDO KAMU</div>
        <div class="saldo__nilai display num">{{ saldo === null ? (memuat ? 'Memuat saldo…' : '—') : $rp(saldo) }}</div>
        <div v-if="labelLimit" class="saldo__limit"><i></i>{{ labelLimit }}</div>
      </div>
    </div>

    <div class="sheet">
      <div v-if="error" class="load-error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>
      <nuxt-link to="/siswa/qr" class="qrcard">
        <div class="qrcard__thumb" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="var(--blue)" stroke-width="2.5"><path d="M4 14V5h9M27 5h9v9M36 26v9h-9M13 35H4v-9M4 20h32"/><path d="M16 13h8v8h-8zM17 25h2v2h-2zM23 25h2v2h-2z"/></svg></div>
        <div class="qrcard__body">
          <div class="qrcard__judul display">Tunjukkan QR</div>
          <p>Lihat identitas kartu FINKA untuk dipindai di kasir.</p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </nuxt-link>

      <div class="sec">
        <span class="display">Jajan hari ini</span>
        <nuxt-link to="/siswa/riwayat" class="link">Semua</nuxt-link>
      </div>
      <div class="list">
        <TrxRow v-for="t in hariIni" :key="t.id" :trx="t" :to="'/siswa/struk/' + t.id" />
        <EmptyState v-if="!memuat && !error && !hariIni.length" ikon="▱" judul="Belum ada jajan hari ini" pesan="Transaksi terbaru akan muncul di sini." />
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() {
    return { kontrol: null }
  },
  async mounted() {
    await this.muat()
    try { this.kontrol = await api.kontrolSaya() } catch (e) { this.kontrol = null }
  },
  computed: {
    user() { return this.$store.state.auth.user || {} },
    siswa() { return this.$store.state['profil-siswa'].profil || { inisial: '', nama: '', kelas: '', nis: '' } },
    saldo() { return this.$store.state['profil-siswa'].saldo },
    memuat() { return this.$store.state['profil-siswa'].memuat },
    error() { return this.$store.state['profil-siswa'].error },
    labelLimit() {
      const k = this.kontrol
      if (!k) return ''
      if (k.kartu_diblokir) return 'Kartu diblokir oleh orang tua'
      return k.limit_aktif ? 'Sisa limit hari ini ' + this.$rp(k.sisa_limit) : 'Tanpa limit harian'
    },
    hariIni() { return this.$store.getters['profil-siswa/hariIni'] }
  },
  methods: {
    muat() { return this.$store.dispatch('profil-siswa/muat') }
  }
  }

</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
.atas { padding: 14px 22px 26px; display: flex; flex-direction: column; gap: 26px; flex: none; }
.bar { display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 8px; color: #fff; font: 800 17px var(--font-display); letter-spacing: .04em; }
.who { display: flex; align-items: center; gap: 11px; }
.av {
  width: 38px; height: 38px; flex: none; overflow: hidden; border-radius: var(--r-pill);
  background: rgba(255,255,255,.12); color: #fff;
  display: flex; align-items: center; justify-content: center; font: 700 13px var(--font-display);
}
.av img { width: 100%; height: 100%; object-fit: cover; }
.who__nama { font: 700 14.5px var(--font-display); color: #fff; }
.who__sub { font: 400 11.5px var(--font-body); color: rgba(255,255,255,.55); }

.saldo { display: flex; flex-direction: column; gap: 7px; }
.saldo__label { font: 500 11.5px var(--font-body); color: rgba(255,255,255,.5); letter-spacing: .1em; }
.saldo__nilai { font: 800 44px var(--font-display); color: #fff; letter-spacing: -.035em; }
.saldo__limit { display: flex; align-items: center; gap: 7px; font: 400 12px var(--font-body); color: rgba(255,255,255,.6); margin-top: 2px; }
.saldo__limit i { width: 6px; height: 6px; border-radius: var(--r-pill); background: var(--green); }

.sheet { flex: 1; background: #fff; border-radius: 24px 24px 0 0; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
.qrcard { border: 1px solid var(--line); border-radius: var(--r-md); padding: 18px; display: flex; align-items: center; gap: 16px; color: inherit; }
.qrcard:hover { border-color: var(--blue); color: inherit; }
.qrcard__thumb {
  width: 78px; height: 78px; flex: none; border-radius: var(--r-sm);
  border: 1px solid var(--line); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.qrcard__body { flex: 1; }
.qrcard__judul { font: 700 15px var(--font-display); }
.qrcard__body p { margin: 3px 0 0; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); text-wrap: pretty; }

.sec { display: flex; align-items: center; justify-content: space-between; font: 700 13px var(--font-display); }
.link { font: 600 12px var(--font-body); }
.list { display: flex; flex-direction: column; }

.settings-wrap { position: relative; }
.load-error { padding: 10px 12px; border-radius: var(--r-sm); background: #fff0ef; color: var(--coral); font: 500 12px/1.5 var(--font-body); }
.load-error button { margin-left: 8px; border: 0; background: transparent; color: var(--blue); font: 700 12px var(--font-body); cursor: pointer; }
.settings-btn { width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.08); color: rgba(255,255,255,.72); display:flex; align-items:center; justify-content:center; cursor:pointer; }
.settings-btn:hover { background: rgba(255,255,255,.15); color:#fff; }
</style>
