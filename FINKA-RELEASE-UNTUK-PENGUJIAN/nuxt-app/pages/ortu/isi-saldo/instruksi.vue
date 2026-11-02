<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Instruksi Transfer" to="/ortu/isi-saldo" />
    <div class="body">
      <div class="hero">
        <div class="hero__top">
          <span class="hero__eyebrow">NOMINAL TRANSFER</span>
        </div>
        <div class="hero__angka">
          <span class="hero__rp display">Rp</span>
          <span class="display num">{{ transfer | num }}</span>
        </div>
        <p class="hero__ket">
          Total transfer harus tepat. Terdiri dari nominal dasar <b>Rp {{ dasarStr }}</b> dan kode unik <b>{{ kodeStr }}</b>.
          <template v-if="tagihanId">Kode unik hanya untuk pencocokan transfer; pembayaran ini khusus untuk tagihan.</template>
          <template v-else>Kode unik ikut ditambahkan ke saldo anak.</template>
        </p>
        <button class="hero__btn display" @click="salin('nominal')">
          {{ tersalin === 'nominal' ? 'Nominal tersalin ✓' : 'Salin nominal' }}
        </button>
      </div>

      <div class="card bank">
        <div>
          <div class="bank__label">Bank tujuan</div>
          <div v-if="rekening" class="bank__rek display num">{{ rekening.bank }} · {{ rekening.nomor }}</div>
          <div v-if="rekening" class="bank__an">a.n. {{ rekening.atas_nama }}</div>
          <div v-else class="bank__an">{{ infoError || 'Memuat rekening…' }}</div>
        </div>
        <button v-if="rekening" class="bank__salin" @click="salin('rek')">{{ tersalin === 'rek' ? 'Tersalin ✓' : 'Salin' }}</button>
      </div>

      <div class="card langkah">
        <div class="langkah__judul display">Langkah selanjutnya</div>
        <div v-for="(l, i) in langkah" :key="i" class="langkah__item">
          <span class="langkah__no">{{ i + 1 }}</span>
          <p>{{ l }}</p>
        </div>
      </div>

      <div class="spacer"></div>
      <p v-if="infoError" class="error">{{ infoError }}</p>
      <button
        v-if="rekening && requestId && permintaanSiap"
        type="button"
        class="btn btn--primary"
        :disabled="memuatPermintaan"
        @click="lanjutUnggah"
      >{{ memuatPermintaan ? 'Menyiapkan unggah bukti…' : 'Saya sudah transfer' }}</button>
      <nuxt-link v-else-if="!memuatPermintaan && !permintaanSiap" to="/ortu/isi-saldo" class="btn btn--ghost">Kembali ke isi saldo</nuxt-link>
    </div>
  </div>
</template>

<script>
export default {


  data() {
    return {
      tersalin: '',
      infoError: '',
      memuatPermintaan: true,
      permintaanSiap: false,
      langkah: [
        'Transfer dari m-banking mana pun ke rekening di atas, nominal harus sama persis.',
        'Simpan atau screenshot bukti transfer.',
        'Kembali ke Finka dan unggah bukti untuk diverifikasi admin.'
      ]
    }
  },
  computed: {
    transfer() { return this.$store.getters['topup/transfer'] },
    // Ambil langsung dari nominal & kode aslinya (bukan dipotong dari total)
    // supaya tidak salah kalau nominalnya bukan kelipatan 1000 genap.
    dasarStr() { return this.$num(this.$store.state.topup.nominal) },
    kodeStr() { return this.$store.getters['topup/kodeStr'] },
    tagihanId() { return this.$store.state.topup.tagihanId },
    info() { return this.$store.state.infoPembayaran },
    rekening() { return this.info && this.info.rekening },
    requestId() { return Number(this.$route.query.id || this.$store.state.topup.id) || null }
  },
  async mounted() {
    this.infoError = ''
    try {
      const jobs = [this.$store.dispatch('muatInfoPembayaran')]
      if (this.requestId) {
        jobs.push(this.$store.dispatch('topup/refreshStatus', this.requestId).then((topup) => {
          if (topup.status !== 'menunggu') {
            this.$router.replace('/ortu/isi-saldo/status?id=' + topup.id)
            return
          }
          this.permintaanSiap = true
        }))
      }
      await Promise.all(jobs)
      if (!this.rekening || !this.rekening.bank || !this.rekening.nomor || !this.rekening.atas_nama) {
        this.infoError = 'Rekening tujuan belum dikonfigurasi. Hubungi admin sekolah.'
      } else if (!this.requestId) {
        this.infoError = 'Pengajuan transfer tidak ditemukan. Silakan ajukan transfer terlebih dahulu.'
      }
    } catch (e) {
      this.infoError = e.message || 'Informasi transfer tidak dapat dimuat.'
    } finally {
      this.memuatPermintaan = false
    }
  },
  methods: {
    lanjutUnggah() {
      if (!this.requestId) {
        this.infoError = 'Pengajuan transfer tidak ditemukan. Silakan ajukan transfer terlebih dahulu.'
        return
      }
      this.$router.push('/ortu/isi-saldo/unggah-bukti?id=' + this.requestId)
    },
    // Benar-benar menyalin ke clipboard: nominal total (tanpa titik) atau nomor rekening.
    async salin(apa) {
      const teks = apa === 'nominal' ? String(this.transfer) : String((this.rekening && this.rekening.nomor) || '').replace(/\s+/g, '')
      if (!teks) return
      try {
        await navigator.clipboard.writeText(teks)
      } catch (e) {
        const ta = document.createElement('textarea')
        ta.value = teks; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        try { document.execCommand('copy') } catch (_) {}
        document.body.removeChild(ta)
      }
      this.tersalin = apa
      setTimeout(() => { this.tersalin = '' }, 1600)
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }

.hero { background: var(--navy); border-radius: var(--r-md); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.hero__top { display: flex; align-items: center; justify-content: space-between; }
.hero__eyebrow { font: 500 11.5px var(--font-body); color: var(--sand); letter-spacing: .08em; }
.hero__timer { background: rgba(255,255,255,.1); color: #fff; font: 600 11px var(--font-body); padding: 4px 9px; border-radius: var(--r-pill); }
.hero__angka { display: flex; align-items: baseline; gap: 2px; color: #fff; font: 800 34px var(--font-display); letter-spacing: -.03em; }
.hero__rp { font: 600 18px var(--font-display); margin-right: 4px; }
.kode { color: var(--sand); }
.hero__ket { margin: 0; font: 400 12px/1.5 var(--font-body); color: rgba(255,255,255,.65); text-wrap: pretty; }
.hero__ket b { color: var(--sand); }
.hero__btn { background: #fff; border: none; color: var(--navy); font: 700 13.5px var(--font-display); padding: 12px; border-radius: var(--r-sm); cursor: pointer; }

.bank { padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bank__label { font: 500 11.5px var(--font-body); color: var(--muted); }
.bank__rek { font: 700 15px var(--font-display); margin-top: 3px; }
.bank__an { font: 400 12.5px var(--font-body); color: var(--muted); margin-top: 3px; }
.bank__salin { border: 1px solid var(--line); background: #fff; color: var(--blue); font: 600 12px var(--font-body); padding: 8px 12px; border-radius: var(--r-sm); cursor: pointer; }
.bank__salin:hover { border-color: var(--blue); }

.langkah { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.langkah__judul { font: 700 13px var(--font-display); }
.langkah__item { display: flex; gap: 11px; align-items: flex-start; }
.langkah__item p { margin: 0; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); text-wrap: pretty; }
.langkah__no {
  width: 20px; height: 20px; border-radius: var(--r-pill); flex: none;
  background: var(--blue-soft); color: var(--blue);
  font: 700 11px var(--font-body);
  display: flex; align-items: center; justify-content: center;
}
.spacer { flex: 1; }
</style>
