<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Isi Saldo" to="/ortu" />
    <div class="body">
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

      <div class="info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>
        <p>Saldo digunakan untuk jajan di kantin dan belanja koperasi. Untuk membayar SPP, gunakan menu Tagihan.</p>
      </div>

      <label class="pin-field">
        <span class="label">PIN konfirmasi Orang Tua</span>
        <input v-model="pinKonfirmasi" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="Masukkan 6 digit PIN" />
        <small>PIN digunakan untuk mengonfirmasi pengajuan. Jangan bagikan kepada siapa pun.</small>
      </label>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="spacer"></div>
      <button class="btn btn--primary" :disabled="mengirim || !aktif.id" @click="lanjut">{{ mengirim ? 'Mengirim…' : 'Lanjutkan' }}</button>
    </div>
  </div>
</template>

<script>
export default {


  data() {
    return { cepat: [50000, 100000, 250000, 1000000], mengirim: false, error: '', pinKonfirmasi: '' }
  },
  computed: {
    anak() { return this.$store.state.ortu.anak },
    aktif() {
      return this.anak.find((a) => Number(a.id) === Number(this.anakAktifId)) || this.anak[0] || {}
    },
    anakAktifId: {
      get() { return this.$store.state.ortu.anakAktifId },
      set(id) { this.$store.commit('ortu/setAnakAktif', id) }
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
    dariTagihan() { return !!this.$store.state.topup.tagihanId }
  },
  async mounted() {
    await this.$store.dispatch('ortu/muatAnak')
    if (!this.$store.state.ortu.anakAktifId && this.anak.length) this.$store.commit('ortu/setAnakAktif', this.anak[0].id)
    if (this.$route.query.nominal) this.nominal = this.$parseRp(this.$route.query.nominal)
  },
  methods: {
    async lanjut() {
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
        this.error = e.message || 'Gagal mengajukan top-up'
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

.label { font: 500 12px var(--font-body); color: var(--muted); margin-bottom: 8px; }
.input { display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--blue); border-radius: var(--r-sm); padding: 14px 16px; }
.input__rp { font: 700 19px var(--font-display); }
.input__field { flex: 1; border: none; outline: none; font: 700 24px var(--font-display); color: var(--ink); letter-spacing: -.02em; width: 100%; }
.chips { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

.info { background: var(--blue-soft); border-radius: var(--r-md); padding: 14px; display: flex; gap: 10px; }
.info p { margin: 0; font: 400 12.5px/1.5 var(--font-body); text-wrap: pretty; }
.info svg { flex: none; margin-top: 1px; }
.pin-field { display: flex; flex-direction: column; gap: 7px; }
.pin-field .label { font: 500 12px var(--font-body); color: var(--muted); }
.pin-field input { border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 13px 14px; font: 600 18px var(--font-body); letter-spacing: .25em; color: var(--ink); outline: none; }
.pin-field input:focus { border-color: var(--blue); }
.pin-field small { font: 400 11px/1.4 var(--font-body); color: var(--muted); }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.spacer { flex: 1; }
</style>
