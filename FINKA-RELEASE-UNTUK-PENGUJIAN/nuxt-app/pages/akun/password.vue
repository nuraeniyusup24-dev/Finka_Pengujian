<script setup>
definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <div class="halaman">
    <div class="kartu">
      <h1 class="judul display">Ganti password</h1>
      <p v-if="wajib" class="peringatan">Password Anda masih sementara. Buat password baru sendiri sebelum melanjutkan.</p>
      <p class="ket">Gunakan minimal 8 karakter. Setelah diganti, gunakan password baru saat login berikutnya.</p>
      <form autocomplete="off" @submit.prevent="kirim">
        <label class="field"><span class="label">Password lama</span>
          <input v-model="lama" type="password" class="input" autocomplete="current-password" required />
        </label>
        <label class="field"><span class="label">Password baru</span>
          <input v-model="baru" type="password" class="input" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="field"><span class="label">Ulangi password baru</span>
          <input v-model="ulang" type="password" class="input" autocomplete="new-password" minlength="8" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="sukses" class="sukses">{{ sukses }}</p>
        <button class="btn btn--primary" type="submit" :disabled="mengirim">{{ mengirim ? 'Menyimpan…' : 'Simpan password' }}</button>
        <nuxt-link v-if="!wajib" :to="beranda" class="kembali">Kembali</nuxt-link>
      </form>
      <p v-if="!wajib" class="pemulihan">Tidak ingat password lama? <nuxt-link to="/akun/pemulihan">Reset menggunakan OTP email atau WhatsApp.</nuxt-link></p>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {
  // Admin memakai layout lebar; peran lain memakai bingkai ponsel.
  layout(ctx) {
    const u = ctx.store.state.auth.user
    return u && u.role === 'admin' ? 'admin' : 'phone'
  },

  data() { return { lama: '', baru: '', ulang: '', error: '', sukses: '', mengirim: false } },
  computed: {
    wajib() { const u = this.$store.state.auth.user; return !!(u && u.wajib_ganti_password) },
    beranda() {
      const u = this.$store.state.auth.user
      return u ? '/' + u.role : '/login'
    }
  },
  methods: {
    async kirim() {
      this.error = ''; this.sukses = ''
      if (this.baru.length < 8) { this.error = 'Password baru minimal 8 karakter'; return }
      if (this.baru !== this.ulang) { this.error = 'Konfirmasi password tidak sama'; return }
      this.mengirim = true
      try {
        await api.gantiPassword(this.lama, this.baru)
        this.sukses = 'Password berhasil diganti.'
        this.lama = ''; this.baru = ''; this.ulang = ''
        const u = this.$store.state.auth.user
        if (u && u.wajib_ganti_password) {
          this.$store.commit('auth/setAuth', { token: this.$store.state.auth.token, user: { ...u, wajib_ganti_password: false } })
          setTimeout(() => this.$router.push('/' + u.role), 900)
        }
      } catch (e) {
        this.error = e.message || 'Gagal mengganti password'
      } finally {
        this.mengirim = false
      }
    }
  }
}
</script>

<style scoped>
.halaman { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 56px 20px 24px; overflow-y: auto; min-height: 0; }
.kartu { width: 100%; max-width: 380px; background: #fff; border-radius: var(--r-lg); padding: 24px; }
.judul { font: 800 20px var(--font-display); margin: 0 0 6px; }
.ket { margin: 0 0 20px; font: 400 13px/1.5 var(--font-body); color: var(--muted); }
form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font: 500 12px var(--font-body); color: var(--muted); }
.input { border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; font: 500 14px var(--font-body); color: var(--ink); outline: none; }
.input:focus { border-color: var(--blue); }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.peringatan { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--r-sm); background: #fff8e1; color: #6a4b00; font: 600 12.5px/1.45 var(--font-body); }
.sukses { margin: 0; font: 500 12.5px var(--font-body); color: var(--green); }
.kembali { text-align: center; font: 600 13px var(--font-body); color: var(--blue); text-decoration: none; }
.pemulihan { margin:16px 0 0; color:var(--muted); font:400 12px/1.5 var(--font-body); text-align:center; }
.pemulihan a { color:var(--blue); font-weight:600; }
</style>
