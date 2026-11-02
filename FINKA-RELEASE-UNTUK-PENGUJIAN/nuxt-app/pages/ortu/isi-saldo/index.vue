<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader :title="langkahPin ? 'Konfirmasi PIN' : (dariTagihan ? 'Bayar Tagihan' : 'Isi Saldo')" to="/ortu" />
    <div v-if="!langkahPin" class="body">
      <div class="anak">
        <div class="av">{{ aktif.inisial }}</div>
        <div class="anak__id">
          <div class="anak__nama">{{ aktif.nama }}</div>
          <div class="anak__saldo">Saldo {{ aktif.saldo | rp }}</div>
        </div>
        <select
          v-if="!dariTagihan && anak.length > 1"
          v-model.number="anakAktifId"
          class="anak__pilih"
          aria-label="Pilih anak penerima saldo"
        >
          <option v-for="a in anak" :key="a.id" :value="Number(a.id)">{{ a.nama }}</option>
        </select>
      </div>

      <div>
        <div class="label">{{ dariTagihan ? 'Nominal tagihan (tidak bisa diubah)' : 'Nominal isi saldo' }}</div>
        <div class="input">
          <span class="input__rp display">Rp</span>
          <input v-model="tampil" :disabled="dariTagihan" inputmode="numeric" class="input__field display num" />
        </div>
        <div v-if="!dariTagihan" class="chips">
          <button
            v-for="n in cepat"
            :key="n"
            class="chip num"
            :class="n === nominal ? 'chip--on' : ''"
            @click="nominal = n"
          >{{ n | num }}</button>
        </div>
      </div>

      <div v-if="!dariTagihan" class="info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>
        <p>Saldo digunakan untuk jajan di kantin dan belanja koperasi. Untuk membayar SPP, gunakan menu Tagihan.</p>
      </div>

      <div class="card rekening">
        <div>
          <div class="rekening__label">Rekening tujuan transfer</div>
          <template v-if="rekening">
            <div class="rekening__nomor display num">{{ rekening.bank }} · {{ rekening.nomor }}</div>
            <div class="rekening__nama">a.n. {{ rekening.atas_nama }}</div>
          </template>
          <div v-else class="rekening__nama">{{ infoError || 'Memuat rekening…' }}</div>
        </div>
        <button v-if="rekening" type="button" class="rekening__salin" @click="salinRekening">
          {{ rekeningTersalin ? 'Tersalin ✓' : 'Salin' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="spacer"></div>
      <button class="btn btn--primary" :disabled="!aktif.id || !rekening || memuatRekening" @click="kePin">Lanjutkan</button>
    </div>
    <div v-else class="pin-step">
      <div class="pin-panel">
        <div class="pin-panel__title">Masukkan PIN Orang Tua</div>
        <div class="pin-dots" role="status" :aria-label="`${pinKonfirmasi.length} dari 6 digit PIN`">
          <span v-for="digit in 6" :key="digit" class="pin-dot" :class="{ 'pin-dot--filled': pinKonfirmasi.length >= digit }"></span>
        </div>
        <p v-if="error" class="pin-error" role="alert">{{ error }}</p>
        <NumPad :keys="keypad" @key="tekanPin" @hapus="hapusPin" />
        <small>PIN digunakan untuk mengonfirmasi pengajuan. Jangan bagikan kepada siapa pun.</small>
      </div>
      <button class="btn btn--primary pin-submit" :disabled="mengirim || pinKonfirmasi.length !== 6" @click="ajukan">
        {{ mengirim ? 'Memeriksa PIN…' : 'Konfirmasi PIN' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {


  data() {
    return {
      cepat: [50000, 100000, 250000, 1000000],
      keypad: [1, 5, 2, 7, 4, 8, 0, 6, 3, 9],
      mengirim: false,
      memuatRekening: true,
      rekeningTersalin: false,
      langkahPin: false,
      error: '',
      infoError: '',
      pinKonfirmasi: ''
    }
  },
  computed: {
    anak() { return this.$store.state.ortu.anak },
    aktif() {
      return this.anak.find((a) => Number(a.id) === Number(this.anakAktifId)) || this.anak[0] || {}
    },
    anakAktifId: {
      get() { return this.$store.state.ortu.anakAktifId },
      set(id) {
        this.$store.commit('ortu/setAnakAktif', id)
        this.$store.commit('topup/setAnak', id)
      }
    },
    nominal: {
      get() { return this.$store.state.topup.nominal },
      set(v) { this.$store.commit('topup/setNominal', v) }
    },
    tampil: {
      get() { return this.$num(this.nominal) },
      set(v) { this.nominal = this.$parseRp(v) }
    },
    // kalau datang dari "Bayar tagihan ini", nominal & anak sudah dikunci
    dariTagihan() { return !!this.$store.state.topup.tagihanId },
    rekening() {
      const info = this.$store.state.infoPembayaran
      return info && info.rekening
    }
  },
  async mounted() {
    try {
      await Promise.all([
        this.$store.dispatch('ortu/muatAnak'),
        this.$store.dispatch('muatInfoPembayaran')
      ])
      if (!this.$store.state.ortu.anakAktifId && this.anak.length) {
        this.$store.commit('ortu/setAnakAktif', this.anak[0].id)
        this.$store.commit('topup/setAnak', this.anak[0].id)
      }
      if (this.$route.query.nominal) this.nominal = this.$parseRp(this.$route.query.nominal)
      if (!this.rekening || !this.rekening.bank || !this.rekening.nomor || !this.rekening.atas_nama) {
        this.infoError = 'Rekening tujuan belum dikonfigurasi. Hubungi admin sekolah.'
      }
    } catch (error) {
      this.infoError = error.message || 'Informasi rekening tidak dapat dimuat.'
    } finally {
      this.memuatRekening = false
    }
  },
  methods: {
    kePin() {
      this.error = ''
      if (!Number.isInteger(Number(this.nominal)) || Number(this.nominal) <= 0) {
        this.error = 'Masukkan nominal isi saldo yang valid.'
        return
      }
      if (!this.aktif.id) {
        this.error = 'Pilih anak yang akan menerima saldo.'
        return
      }
      if (!this.rekening) {
        this.error = this.infoError || 'Informasi rekening tujuan belum tersedia.'
        return
      }
      this.$store.commit('topup/setAnak', this.aktif.id)
      this.langkahPin = true
    },
    kembaliKeNominal() {
      if (this.mengirim) return
      this.pinKonfirmasi = ''
      this.error = ''
      this.langkahPin = false
    },
    tekanPin(digit) {
      if (this.mengirim || this.pinKonfirmasi.length >= 6) return
      this.pinKonfirmasi += String(digit)
      this.error = ''
    },
    hapusPin() {
      if (this.mengirim) return
      this.pinKonfirmasi = this.pinKonfirmasi.slice(0, -1)
      this.error = ''
    },
    async salinRekening() {
      const nomor = String(this.rekening?.nomor || '').replace(/\s+/g, '')
      if (!nomor) return
      try {
        await navigator.clipboard.writeText(nomor)
      } catch {
        const area = document.createElement('textarea')
        area.value = nomor
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const berhasil = document.execCommand('copy')
        document.body.removeChild(area)
        if (!berhasil) {
          this.error = 'Nomor rekening tidak dapat disalin. Silakan salin secara manual.'
          return
        }
      }
      this.rekeningTersalin = true
      window.setTimeout(() => { this.rekeningTersalin = false }, 1600)
    },
    async ajukan() {
      this.error = ''
      if (!/^\d{6}$/.test(this.pinKonfirmasi)) {
        this.error = 'Masukkan PIN konfirmasi 6 digit.'
        return
      }
      this.mengirim = true
      try {
        const topup = await this.$store.dispatch('topup/ajukan', this.pinKonfirmasi)
        this.$router.push('/ortu/isi-saldo/instruksi?id=' + topup.id)
      } catch (e) {
        this.error = e.message || 'Gagal mengajukan top-up.'
      } finally {
        this.mengirim = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.pin-step { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 18px; background: var(--navy); color: #fff; }
.pin-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 16px; }
.pin-panel__title { text-align: center; font: 600 14px var(--font-body); }
.pin-dots { display: flex; justify-content: center; gap: 12px; padding: 12px 0; }
.pin-dot { width: 14px; height: 14px; border: 1px solid rgba(255,255,255,.45); border-radius: 50%; }
.pin-dot--filled { background: #fff; border-color: #fff; }
.pin-error { margin: 0; color: #ffb4a9; text-align: center; font: 500 12px/1.45 var(--font-body); }
.pin-panel small { color: rgba(255,255,255,.6); text-align: center; font: 400 10.5px/1.4 var(--font-body); }
.pin-submit { flex: none; background: #fff; color: var(--navy); }

.anak { display: flex; align-items: center; gap: 12px; background: var(--bg); border-radius: var(--r-md); padding: 12px 14px; }
.av {
  width: 36px; height: 36px; border-radius: var(--r-pill); flex: none;
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
  font: 700 13px var(--font-display);
}
.anak__id { flex: 1; }
.anak__nama { font: 600 14px var(--font-body); }
.anak__saldo { font: 400 12px var(--font-body); color: var(--muted); }
.anak__pilih { max-width: 42%; border: 1px solid var(--line); border-radius: var(--r-sm); background: #fff; padding: 8px; color: var(--blue); font: 600 12px var(--font-body); }
.rekening { padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rekening__label { color: var(--muted); font: 400 11.5px var(--font-body); }
.rekening__nomor { margin-top: 3px; color: var(--ink); font: 700 14px var(--font-display); }
.rekening__nama { margin-top: 3px; color: var(--muted); font: 400 12px var(--font-body); }
.rekening__salin { flex: none; border: 1px solid var(--line); border-radius: var(--r-sm); background: #fff; color: var(--blue); padding: 8px 11px; font: 600 11px var(--font-body); cursor: pointer; }
.rekening__salin:hover { border-color: var(--blue); }

.label { font: 500 12px var(--font-body); color: var(--muted); margin-bottom: 8px; }
.input { display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--blue); border-radius: var(--r-sm); padding: 14px 16px; }
.input__rp { font: 700 19px var(--font-display); }
.input__field { flex: 1; border: none; outline: none; font: 700 24px var(--font-display); color: var(--ink); letter-spacing: -.02em; width: 100%; }
.chips { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

.info { background: var(--blue-soft); border-radius: var(--r-md); padding: 14px; display: flex; gap: 10px; }
.info p { margin: 0; font: 400 12.5px/1.5 var(--font-body); text-wrap: pretty; }
.info svg { flex: none; margin-top: 1px; }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.spacer { flex: 1; }
</style>
