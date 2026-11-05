<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <div class="body">
      <div class="logo">
        <FinkaMark :width="26" :height="28" color="var(--blue)" />
        <span class="display">FINKA</span>
      </div>
      <div class="judul display">Masuk</div>
      <p class="ket">Masuk dengan username dan password akun Finka Anda untuk diarahkan sesuai peran (Admin, Orang Tua, Siswa, atau Kantin).</p>

      <form @submit.prevent="submit">
        <div class="field">
          <div class="label">Username</div>
          <input v-model="username" class="input" autocomplete="username" placeholder="contoh: ortu.sari" />
        </div>
        <div class="field">
          <div class="label">Password</div>
          <input v-model="password" type="password" class="input" autocomplete="current-password" placeholder="••••••••" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

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
  methods: {
    async submit() {
      this.error = ''
      if (!this.username || !this.password) {
        this.error = 'Username dan password wajib diisi'
        return
      }
      this.loading = true
      try {
        const user = await this.$store.dispatch('auth/login', { username: this.username, password: this.password })

        // Pengalihan otomatis berdasarkan role dari database
        if (user.role === 'admin') this.$router.push('/admin')
        else if (user.role === 'ortu') this.$router.push('/ortu')
        else if (user.role === 'siswa') this.$router.push('/siswa')
        else if (user.role === 'pic' || user.role === 'kantin') this.$router.push('/pic')
        else this.$router.push('/')
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
.logo { display: flex; align-items: center; gap: 10px; font: 800 18px var(--font-display); letter-spacing: .04em; color: var(--ink); margin-bottom: 20px; }
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
</style>
