<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="halaman">
    <div class="kartu">
      <h1 class="judul display">Ganti PIN pembayaran</h1>
      <p class="ket">PIN 6 angka ini khusus untuk akun siswa dan digunakan saat membayar di kantin. Jangan beri tahu siapa pun atau gunakan angka kembar/berurutan.</p>
      <form autocomplete="off" @submit.prevent="kirim">
        <label class="field"><span class="label">PIN lama</span>
          <input v-model="lama" type="password" inputmode="numeric" maxlength="6" pattern="\d{6}" class="input" autocomplete="off" required />
        </label>
        <label class="field"><span class="label">PIN baru (6 angka)</span>
          <input v-model="baru" type="password" inputmode="numeric" maxlength="6" pattern="\d{6}" class="input" autocomplete="off" required />
        </label>
        <label class="field"><span class="label">Ulangi PIN baru</span>
          <input v-model="ulang" type="password" inputmode="numeric" maxlength="6" pattern="\d{6}" class="input" autocomplete="off" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="sukses" class="sukses">{{ sukses }}</p>
        <button class="btn btn--primary" type="submit" :disabled="mengirim">{{ mengirim ? 'Menyimpan…' : 'Simpan PIN' }}</button>
        <nuxt-link to="/siswa" class="kembali">Kembali</nuxt-link>
      </form>
      <p class="lupa">Jika lupa PIN, minta orang tua/wali membuka menu Kontrol dan mereset PIN dengan OTP ke email atau WhatsApp terverifikasi.</p>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() { return { lama: '', baru: '', ulang: '', error: '', sukses: '', mengirim: false } },
  methods: {
    async kirim() {
      this.error = ''; this.sukses = ''
      if (!/^\d{6}$/.test(this.baru)) { this.error = 'PIN baru harus 6 angka'; return }
      if (this.baru !== this.ulang) { this.error = 'Konfirmasi PIN tidak sama'; return }
      this.mengirim = true
      try {
        await api.gantiPin(this.lama, this.baru)
        this.sukses = 'PIN berhasil diganti. Pakai PIN baru di kasir.'
        this.lama = ''; this.baru = ''; this.ulang = ''
      } catch (e) {
        this.error = e.message || 'Gagal mengganti PIN'
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
.input { border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; font: 600 18px var(--font-body); letter-spacing: .3em; color: var(--ink); outline: none; }
.input:focus { border-color: var(--blue); }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.sukses { margin: 0; font: 500 12.5px var(--font-body); color: var(--green); }
.kembali { text-align: center; font: 600 13px var(--font-body); color: var(--blue); text-decoration: none; }
.lupa { margin: 16px 0 0; font: 400 12px/1.5 var(--font-body); color: var(--muted); text-align: center; }
</style>
