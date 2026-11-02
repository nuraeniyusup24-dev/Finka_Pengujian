<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div v-if="siswa" class="wrap">
    <div class="stage">
      <div class="ik">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9.5" /></svg>
      </div>
      <div class="judul display">Saldo tidak mencukupi</div>
      <p class="ket">Transaksi dibatalkan. Tidak ada opsi utang atau kasbon.</p>

      <div class="rincian">
        <div><span>Sisa saldo</span><b class="display num">{{ siswa.saldo | rp }}</b></div>
        <div><span>Dibutuhkan</span><b class="display num">{{ total | rp }}</b></div>
        <div class="garis"></div>
        <div><span class="kuat">Kurang</span><b class="display num besar">{{ kurang | rp }}</b></div>
      </div>

      <p class="notif">Notifikasi otomatis dikirim ke orang tua</p>
    </div>

    <div class="aksi">
      <nuxt-link to="/pic/scan" class="btn btn--putih">Scan siswa lain</nuxt-link>
      <button class="btn btn--outline" @click="batal">Batalkan transaksi</button>
    </div>
  </div>
</template>

<script>
export default {

  computed: {
    siswa() { return this.$store.getters['pos/siswaScan'] },
    total() { return this.$store.getters['pos/total'] },
    kurang() { return this.siswa ? Math.max(0, this.total - this.siswa.saldo) : 0 }
  },
  mounted() {
    if (!this.siswa) this.$router.replace('/pic')
  },
  methods: {
    batal() {
      this.$store.commit('pos/reset')
      this.$router.push('/pic')
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--coral); padding: 26px 22px; min-height: 0; overflow-y: auto; }
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
.ik { width: 74px; height: 74px; border-radius: var(--r-pill); background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; }
.judul { font: 700 22px var(--font-display); color: #fff; text-align: center; letter-spacing: -.01em; }
.ket { margin: 0; font: 400 13px/1.5 var(--font-body); color: rgba(255,255,255,.8); text-align: center; max-width: 270px; text-wrap: pretty; }

.rincian { width: 100%; background: rgba(255,255,255,.14); border-radius: var(--r-md); padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.rincian div { display: flex; align-items: center; justify-content: space-between; }
.rincian span { font: 400 13px var(--font-body); color: rgba(255,255,255,.8); }
.rincian .kuat { font-weight: 600; color: #fff; }
.rincian b { font: 700 17px var(--font-display); color: #fff; }
.rincian b.besar { font-size: 20px; font-weight: 800; }
.garis { height: 1px; background: rgba(255,255,255,.25); }

.notif { margin: 0; font: 400 12px var(--font-body); color: rgba(255,255,255,.7); text-align: center; }

.aksi { display: flex; flex-direction: column; gap: 10px; }
.btn--putih { background: #fff; color: var(--coral); }
.btn--outline { background: transparent; border: 1px solid rgba(255,255,255,.4); color: #fff; font: 600 14px var(--font-body); padding: 14px; }
</style>
