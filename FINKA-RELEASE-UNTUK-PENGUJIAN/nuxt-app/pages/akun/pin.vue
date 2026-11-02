<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth']
})
</script>

<template>
  <div class="halaman">
    <div v-if="notifikasiTerbuka" class="notice-overlay">
      <section class="notice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="notice-title" aria-describedby="notice-message">
        <span class="notice__icon" aria-hidden="true">!</span>
        <h2 id="notice-title" class="notice__title display">Pemberitahuan akun baru</h2>
        <p id="notice-message" class="notice__message">
          {{ user.role === 'ortu'
            ? 'Buat PIN konfirmasi Orang Tua sebelum melanjutkan. PIN akan diminta saat mengajukan isi saldo atau pembayaran tagihan.'
            : 'Buat PIN pembayaran sebelum melanjutkan. PIN akan diminta saat bertransaksi di kantin atau koperasi.' }}
        </p>
        <button class="btn btn--primary" type="button" @click="notifikasiTerbuka = false">Lanjut buat PIN</button>
      </section>
    </div>
    <div class="kartu">
      <h1 class="judul display">Buat PIN {{ user.role === 'ortu' ? 'konfirmasi' : 'pembayaran' }}</h1>
      <p class="ket">
        {{ user.role === 'ortu'
          ? 'PIN 6 digit ini digunakan untuk mengonfirmasi pengajuan isi saldo dan pembayaran tagihan.'
          : 'PIN 6 digit ini digunakan untuk transaksi siswa di kantin dan koperasi.' }}
        Jangan bagikan PIN kepada siapa pun.
      </p>
      <form autocomplete="off" @submit.prevent="simpan">
        <label class="field"><span class="label">PIN baru</span>
          <input v-model="pin" class="input" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required />
        </label>
        <label class="field"><span class="label">Ulangi PIN</span>
          <input v-model="konfirmasi" class="input" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required />
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="btn btn--primary" type="submit" :disabled="mengirim">
          {{ mengirim ? 'Menyimpan…' : 'Buat PIN' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() { return { pin: '', konfirmasi: '', error: '', mengirim: false, notifikasiTerbuka: true } },
  computed: {
    user() { return this.$store.state.auth.user || { role: '' } }
  },
  mounted() {
    if (!['siswa', 'ortu'].includes(this.user.role) || !this.user.wajib_buat_pin) {
      this.$router.replace('/' + (this.user.role || 'login'))
    }
  },
  methods: {
    async simpan() {
      this.error = ''
      if (!/^\d{6}$/.test(this.pin)) {
        this.error = 'PIN harus terdiri dari 6 angka.'
        return
      }
      if (this.pin !== this.konfirmasi) {
        this.error = 'Konfirmasi PIN tidak sama.'
        return
      }
      this.mengirim = true
      try {
        await api.buatPinAkun(this.pin, this.konfirmasi)
        const { user } = await api.me()
        this.$store.commit('auth/setAuth', { token: this.$store.state.auth.token, user })
        this.$router.replace('/' + user.role)
      } catch (error) {
        this.error = error.message || 'PIN tidak dapat disimpan.'
      } finally {
        this.mengirim = false
      }
    }
  }
}
</script>

<style scoped>
.halaman { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 56px 20px 24px; overflow-y: auto; min-height: 0; }
.notice-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(16, 24, 40, .58); }
.notice-dialog { width: 100%; max-width: 360px; padding: 24px; border-radius: var(--r-lg); background: #fff; box-shadow: 0 16px 48px rgba(0, 0, 0, .2); text-align: center; }
.notice__icon { display: flex; width: 38px; height: 38px; margin: 0 auto 12px; align-items: center; justify-content: center; border-radius: 50%; background: var(--blue); color: #fff; font: 800 21px var(--font-body); }
.notice__title { margin: 0 0 8px; font: 800 18px var(--font-display); color: var(--ink); }
.notice__message { margin: 0 0 20px; font: 400 13px/1.55 var(--font-body); color: var(--muted); }
.kartu { width: 100%; max-width: 380px; background: #fff; border-radius: var(--r-lg); padding: 24px; }
.judul { font: 800 20px var(--font-display); margin: 0 0 8px; }
.ket { margin: 0 0 20px; font: 400 13px/1.5 var(--font-body); color: var(--muted); }
form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font: 500 12px var(--font-body); color: var(--muted); }
.input { border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; font: 500 18px var(--font-body); letter-spacing: .25em; color: var(--ink); outline: none; }
.input:focus { border-color: var(--blue); }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
</style>
