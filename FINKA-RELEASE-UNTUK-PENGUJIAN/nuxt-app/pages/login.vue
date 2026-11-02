<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <div class="body">
      <div class="logo">
        <svg width="26" height="28" viewBox="0 0 40 44" fill="var(--blue)"><rect x="13" y="0" width="27" height="14" rx="6" /><rect x="0" y="10" width="14" height="14" rx="6" /><rect x="9" y="15" width="24" height="14" rx="6" /><rect x="4" y="30" width="14" height="14" rx="6" /></svg>
        <span class="display">Finka</span>
      </div>
      <div class="judul display">Masuk</div>
      <p class="ket">{{ ketPeran }}</p>
      <p v-if="$route.query.reset === 'berhasil'" class="success">Password berhasil diatur ulang. Silakan masuk dengan password baru.</p>

      <form @submit.prevent="submit">
        <div class="field">
          <div class="label">Nama lengkap, username, atau NIS</div>
          <input v-model="username" class="input" autocomplete="username" placeholder="Masukkan nama lengkap atau username/NIS" />
        </div>
        <div class="field">
          <div class="label">Password</div>
          <input v-model="password" type="password" class="input" autocomplete="current-password" placeholder="••••••••" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <nuxt-link to="/akun/pemulihan" class="lupa">Lupa password?</nuxt-link>

        <button class="btn btn--primary" type="submit" :disabled="loading">
          {{ loading ? 'Memeriksa…' : 'Masuk' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return {
      username: '',
      password: '',
      error: '',
      loading: false
    }
  },
  computed: {
    ketPeran() {
      const r = this.$route.query.role
      if (r === 'ortu') return 'Masuk sebagai orang tua/wali untuk kelola dompet anak.'
      if (r === 'admin') return 'Masuk sebagai admin yayasan.'
      return 'Masuk dengan nama lengkap, username, atau NIS dan password akun Finka Anda.'
    }
  },
  methods: {
    tujuanSetelahLogin(role, next) {
      const aman = next && next.startsWith('/') && !next.startsWith('//')
      if (aman) {
        if (role === 'admin' && next.startsWith('/admin')) return next
        if (role === 'ortu' && next.startsWith('/ortu')) return next
        if (role === 'pic' && next.startsWith('/pic')) return next
        if (role === 'siswa' && next.startsWith('/siswa')) return next
      }
      if (role === 'ortu') return '/ortu'
      if (role === 'admin') return '/admin'
      if (role === 'pic') return '/pic'
      if (role === 'siswa') return '/siswa'
      return '/'
    },
    async submit() {
      this.error = ''
      if (!this.username || !this.password) {
        this.error = 'Username dan password wajib diisi'
        return
      }
      this.loading = true
      try {
        const user = await this.$store.dispatch('auth/login', { username: this.username, password: this.password })
        const next = typeof this.$route.query.next === 'string' ? this.$route.query.next : ''
        if (user.wajib_ganti_password) { this.$router.push('/akun/password'); return }
        if (user.wajib_buat_pin) { this.$router.push('/akun/pin'); return }
        const tujuan = this.tujuanSetelahLogin(user.role, next)
        this.$router.push(tujuan)
      } catch (e) {
        this.error = e.message || 'Gagal masuk'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 32px 24px; display: flex; flex-direction: column; gap: 4px; }
.logo { display: flex; align-items: center; gap: 10px; font: 800 18px var(--font-display); color: var(--ink); margin-bottom: 20px; }
.judul { font: 800 22px var(--font-display); }
.ket { margin: 6px 0 24px; font: 400 13px/1.5 var(--font-body); color: var(--muted); text-wrap: pretty; }

form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font: 500 12px var(--font-body); color: var(--muted); }
.input {
  border: 1.5px solid var(--line); border-radius: var(--r-sm); padding: 13px 14px;
  font: 500 14px var(--font-body); color: var(--ink); outline: none;
}
.input:focus { border-color: var(--blue); }
.error { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.success { margin: 0 0 8px; font: 500 12.5px/1.5 var(--font-body); color: var(--green); }
.lupa { align-self: flex-end; margin-top: -8px; font: 600 12px var(--font-body); color: var(--blue); }
</style>
