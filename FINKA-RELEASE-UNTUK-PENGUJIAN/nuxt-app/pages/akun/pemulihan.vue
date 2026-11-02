<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <div class="kartu">
      <h1 class="judul display">Reset password</h1>
      <p class="ket">Reset password untuk semua role menggunakan OTP ke email atau WhatsApp terverifikasi yang terhubung ke akun. Siswa dapat menggunakan kontak Orang Tua/Wali. Jika kontak belum terverifikasi atau OTP gagal dikirim, hubungi Admin.</p>

      <form v-if="tahap === 'minta'" @submit.prevent="mintaOtp">
        <label class="field">
          <span class="label">Username</span>
          <input v-model.trim="username" class="input" autocomplete="username" required maxlength="100" />
        </label>
        <label class="field">
          <span class="label">Kirim kode melalui</span>
          <select v-model="channel" class="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn--primary" type="submit" :disabled="loading">{{ loading ? 'Meminta OTP…' : 'Kirim OTP' }}</button>
      </form>

      <form v-else-if="tahap === 'verifikasi'" @submit.prevent="verifikasiOtp">
        <p class="info">Jika username cocok dan memiliki kontak {{ channel === 'email' ? 'email' : 'WhatsApp' }} terverifikasi, kode akan dikirim. Kode berlaku 5 menit.</p>
        <label class="field">
          <span class="label">Kode OTP</span>
          <input v-model.trim="otp" class="input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn--primary" type="submit" :disabled="loading">{{ loading ? 'Memeriksa…' : 'Verifikasi OTP' }}</button>
        <button class="btn btn--secondary" type="button" :disabled="loading" @click="tahap = 'minta'; error = ''">Kembali</button>
      </form>

      <form v-else @submit.prevent="simpanPassword">
        <p class="info">OTP berhasil diverifikasi. Buat password baru minimal 8 karakter.</p>
        <label class="field">
          <span class="label">Password baru</span>
          <input v-model="password" class="input" type="password" autocomplete="new-password" minlength="8" maxlength="72" required />
        </label>
        <label class="field">
          <span class="label">Ulangi password baru</span>
          <input v-model="konfirmasi" class="input" type="password" autocomplete="new-password" minlength="8" maxlength="72" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn--primary" type="submit" :disabled="loading">{{ loading ? 'Menyimpan…' : 'Simpan password baru' }}</button>
      </form>

      <nuxt-link to="/login" class="kembali">Kembali ke halaman masuk</nuxt-link>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {

  data() {
    return {
      username: '',
      channel: 'whatsapp',
      otp: '',
      password: '',
      konfirmasi: '',
      challengeId: '',
      resetToken: '',
      tahap: 'minta',
      loading: false,
      error: ''
    }
  },
  methods: {
    async mintaOtp() {
      this.error = ''
      this.loading = true
      try {
        const result = await api.mintaResetPassword(this.username, this.channel)
        this.challengeId = result.challengeId
        this.tahap = 'verifikasi'
      } catch (error) {
        this.error = error.message || 'Gagal meminta OTP.'
      } finally {
        this.loading = false
      }
    },
    async verifikasiOtp() {
      this.error = ''
      this.loading = true
      try {
        const result = await api.verifikasiResetPassword(this.challengeId, this.otp)
        this.resetToken = result.resetToken
        this.tahap = 'password'
      } catch (error) {
        this.error = error.message || 'OTP tidak valid.'
      } finally {
        this.loading = false
      }
    },
    async simpanPassword() {
      this.error = ''
      if (this.password.length < 8 || this.password.length > 72) {
        this.error = 'Password harus 8–72 karakter.'
        return
      }
      if (this.password !== this.konfirmasi) {
        this.error = 'Konfirmasi password tidak sama.'
        return
      }
      this.loading = true
      try {
        await api.selesaikanResetPassword(this.challengeId, this.resetToken, this.password, this.konfirmasi)
        await this.$router.replace('/login?reset=berhasil')
      } catch (error) {
        this.error = error.message || 'Gagal menyimpan password baru.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 32px 20px 24px; overflow-y: auto; }
.kartu { width: 100%; max-width: 440px; background: #fff; border: 1px solid var(--line); border-radius: var(--r-lg); padding: 24px; }
.judul { font: 800 20px var(--font-display); margin: 0 0 8px; }
.ket, .info { margin: 0 0 18px; font: 400 13px/1.5 var(--font-body); color: var(--muted); }
.info { padding: 11px 12px; border-radius: var(--r-sm); background: var(--blue-soft); color: var(--ink); }
form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font: 500 12px var(--font-body); color: var(--muted); }
.input { width: 100%; min-width: 0; border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; background: #fff; font: 500 14px var(--font-body); color: var(--ink); }
.error { margin: 0; font: 500 12.5px/1.5 var(--font-body); color: var(--coral); }
.btn { min-height: 44px; border: 0; border-radius: var(--r-sm); cursor: pointer; font: 700 13px var(--font-body); }
.btn--primary { background: var(--blue); color: #fff; }
.btn--secondary { background: #fff; border: 1px solid var(--line); color: var(--ink); }
.btn:disabled { opacity: .65; cursor: wait; }
.kembali { display: block; margin-top: 18px; text-align: center; font: 600 13px var(--font-body); color: var(--blue); }
@media (max-width: 420px) { .wrap { padding: 20px 14px; } .kartu { padding: 20px 16px; } }
</style>
