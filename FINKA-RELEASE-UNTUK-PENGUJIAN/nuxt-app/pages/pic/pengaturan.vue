<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Pengaturan akun" to="/pic" />
    <div class="body">
      <section class="card profil">
        <ProfileAvatar :initials="inisial" />
        <div class="profil__data">
          <h2>{{ user.nama || 'Akun PIC' }}</h2>
          <p>{{ user.username || 'Username belum tersedia' }} · PIC</p>
        </div>
      </section>

      <section class="card detail">
        <div class="detail__head">
          <h2>Informasi kontak</h2>
          <button v-if="!editKontak" type="button" class="edit" @click="mulaiEdit">Ubah</button>
        </div>
        <template v-if="editKontak">
          <label class="field">Email
            <input v-model.trim="form.email" type="email" maxlength="254" placeholder="nama@email.com" autocomplete="email" />
          </label>
          <label class="field">Nomor telepon / WhatsApp
            <input v-model.trim="form.no_hp" type="tel" inputmode="tel" maxlength="20" placeholder="0812 3456 7890" autocomplete="tel" />
          </label>
          <p class="hint">Perubahan kontak perlu diverifikasi oleh Admin sebelum digunakan untuk pemulihan akun.</p>
          <p v-if="kontakError" class="feedback feedback--error" role="alert">{{ kontakError }}</p>
          <p v-if="kontakSukses" class="feedback feedback--success" role="status">{{ kontakSukses }}</p>
          <div class="kontak-actions">
            <button type="button" class="batal" :disabled="menyimpanKontak" @click="batalEdit">Batal</button>
            <button type="button" class="simpan" :disabled="menyimpanKontak" @click="simpanKontak">{{ menyimpanKontak ? 'Menyimpan…' : 'Simpan kontak' }}</button>
          </div>
        </template>
        <template v-else>
          <div class="detail__row"><span>Email</span><b>{{ user.email || 'Belum ditambahkan' }}</b></div>
          <div class="detail__row"><span>Nomor telepon</span><b>{{ user.no_hp || 'Belum ditambahkan' }}</b></div>
        </template>
      </section>

      <nuxt-link to="/akun/pemulihan" class="action card">
        <span><b>Lupa password?</b><small>Atur ulang password akun melalui OTP</small></span>
        <span class="action__arrow">›</span>
      </nuxt-link>

      <button type="button" class="keluar" @click="logout">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
        Keluar dari akun
      </button>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() {
    return {
      editKontak: false,
      form: { email: '', no_hp: '' },
      menyimpanKontak: false,
      kontakError: '',
      kontakSukses: ''
    }
  },
  computed: {
    user() { return this.$store.state.auth.user || {} },
    inisial() { return (this.user.nama || 'PIC').trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() }
  },
  methods: {
    mulaiEdit() {
      this.form = { email: this.user.email || '', no_hp: this.user.no_hp || '' }
      this.kontakError = ''
      this.kontakSukses = ''
      this.editKontak = true
    },
    batalEdit() {
      if (this.menyimpanKontak) return
      this.editKontak = false
      this.kontakError = ''
      this.kontakSukses = ''
    },
    async simpanKontak() {
      this.kontakError = ''
      this.kontakSukses = ''
      const nomor = this.form.no_hp.replace(/[\s()-]/g, '')
      const nomorLokal = nomor.startsWith('+628') ? '08' + nomor.slice(3) : nomor
      const email = this.form.email.trim().toLowerCase()
      if (nomorLokal && !/^08\d{8,11}$/.test(nomorLokal)) {
        this.kontakError = 'Nomor WhatsApp harus 10–13 digit dengan awalan 08 atau +62.'
        return
      }
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) {
        this.kontakError = 'Format email tidak valid.'
        return
      }
      this.menyimpanKontak = true
      try {
        const result = await api.simpanKontakAkun({ email, no_hp: nomorLokal })
        const profile = await api.me()
        this.$store.commit('auth/setAuth', { token: this.$store.state.auth.token, user: profile.user })
        this.form = { email: profile.user.email || '', no_hp: profile.user.no_hp || '' }
        this.editKontak = false
        this.kontakSukses = result.pesan || 'Informasi kontak berhasil disimpan.'
      } catch (error) {
        this.kontakError = error.message || 'Gagal menyimpan informasi kontak.'
      } finally {
        this.menyimpanKontak = false
      }
    },
    async logout() {
      await this.$store.dispatch('auth/logout')
      this.$router.replace('/login')
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; background: var(--bg); }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.profil { display: flex; align-items: center; gap: 12px; padding: 16px; }
.profil__data { min-width: 0; }
.profil h2, .detail h2 { margin: 0; color: var(--ink); font: 700 14px var(--font-display); }
.profil p { margin: 4px 0 0; color: var(--muted); font: 400 12px/1.5 var(--font-body); overflow-wrap: anywhere; }
.detail { padding: 16px; display: flex; flex-direction: column; gap: 13px; }
.detail__head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.edit { padding:4px 0; border:0; background:transparent; color:var(--blue); font:600 12px var(--font-body); cursor:pointer; }
.field { display:flex; flex-direction:column; gap:6px; color:var(--muted); font:500 12px var(--font-body); }
.field input { width:100%; min-width:0; box-sizing:border-box; padding:11px 12px; border:1px solid var(--line); border-radius:var(--r-sm); color:var(--ink); font:400 13px var(--font-body); outline:none; }
.field input:focus { border-color:var(--blue); }
.hint { margin:0; color:var(--muted); font:400 11px/1.5 var(--font-body); }
.feedback { margin:0; font:500 12px/1.5 var(--font-body); }
.feedback--error { color:var(--coral); }
.feedback--success { color:var(--green); }
.kontak-actions { display:flex; justify-content:flex-end; gap:8px; }
.kontak-actions button { min-height:38px; padding:0 13px; border-radius:var(--r-sm); font:600 12px var(--font-body); cursor:pointer; }
.batal { border:1px solid var(--line); background:#fff; color:var(--ink); }
.simpan { border:1px solid var(--blue); background:var(--blue); color:#fff; }
.kontak-actions button:disabled { opacity:.6; cursor:wait; }
.detail__row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; font: 400 12px var(--font-body); }
.detail__row span { flex: none; color: var(--muted); }
.detail__row b { min-width: 0; color: var(--ink); text-align: right; overflow-wrap: anywhere; font-weight: 600; }
.action { display: flex; align-items: center; gap: 12px; padding: 14px; color: inherit; }
.action:hover { color: inherit; border-color: var(--blue); }
.action b, .action small { display: block; }
.action b { color: var(--ink); font: 700 13px var(--font-display); }
.action small { margin-top: 3px; color: var(--muted); font: 400 11.5px var(--font-body); }
.action__arrow { margin-left: auto; color: var(--muted); font-size: 24px; }
.keluar { min-height: 46px; display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 4px; border: 1px solid rgba(223,74,55,.25); border-radius: var(--r-sm); background: #fff; color: var(--coral); font: 700 13px var(--font-body); cursor: pointer; }
.keluar:hover { border-color: var(--coral); background: #fff5f4; }
</style>
