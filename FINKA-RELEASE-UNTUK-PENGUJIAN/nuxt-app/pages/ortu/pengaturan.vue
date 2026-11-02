<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Pengaturan" to="/ortu" />
    <div class="body">
      <div class="identitas card">
        <ProfileAvatar :initials="inisial" />
        <div><b>{{ nama }}</b><span>Akun Orang Tua</span></div>
      </div>
      <div class="kontak card">
        <div class="kontak__head">
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
          <p class="hint">Kontak baru perlu diverifikasi Admin sebelum digunakan untuk pemulihan akun.</p>
          <p v-if="kontakError" class="feedback feedback--error" role="alert">{{ kontakError }}</p>
          <div class="kontak-actions">
            <button type="button" class="batal" :disabled="menyimpanKontak" @click="batalEdit">Batal</button>
            <button type="button" class="simpan" :disabled="menyimpanKontak" @click="simpanKontak">{{ menyimpanKontak ? 'Menyimpan…' : 'Simpan kontak' }}</button>
          </div>
        </template>
        <template v-else>
          <div class="detail__row"><span>Email</span><b>{{ user.email || 'Belum ditambahkan' }}</b></div>
          <div class="detail__row"><span>Nomor telepon</span><b>{{ user.no_hp || 'Belum ditambahkan' }}</b></div>
        </template>
        <p v-if="kontakSukses" class="feedback feedback--success" role="status">{{ kontakSukses }}</p>
      </div>
      <nuxt-link to="/ortu/profil" class="pilihan card">
        <span><b>Profil pribadi</b><small>Nama dan informasi kontak</small></span><span class="panah">›</span>
      </nuxt-link>
      <nuxt-link to="/ortu/kontrol" class="pilihan card">
        <span><b>Reset PIN pembayaran anak</b><small>Reset PIN siswa dengan OTP ke email atau WhatsApp terverifikasi</small></span><span class="panah">›</span>
      </nuxt-link>
      <nuxt-link to="/akun/pemulihan" class="pilihan card">
        <span><b>Lupa password?</b><small>Atur ulang password akun melalui OTP</small></span><span class="panah">›</span>
      </nuxt-link>
      <button class="keluar" type="button" @click="logout">Keluar dari akun</button>
    </div>
    <OrtuTabBar />
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
    nama() { return this.user.nama || 'Orang Tua' },
    inisial() { return this.nama.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() }
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
.wrap { flex:1; display:flex; flex-direction:column; min-height:0; background:var(--bg); }
.body { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; }
.identitas { display:flex; align-items:center; gap:12px; padding:16px; margin-bottom:8px; }
.identitas b,.pilihan b { display:block; font:700 13px var(--font-display); color:var(--ink); }
.identitas span,.pilihan small { display:block; margin-top:3px; color:var(--muted); font:400 11.5px var(--font-body); }
.kontak { display:flex; flex-direction:column; gap:12px; padding:16px; }
.kontak__head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.kontak h2 { margin:0; color:var(--ink); font:700 13px var(--font-display); }
.edit { padding:4px 0; border:0; background:transparent; color:var(--blue); font:600 12px var(--font-body); cursor:pointer; }
.detail__row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; font:400 12px var(--font-body); }
.detail__row span { flex:none; color:var(--muted); }
.detail__row b { min-width:0; color:var(--ink); text-align:right; overflow-wrap:anywhere; font-weight:600; }
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
.pilihan { display:flex; align-items:center; gap:12px; padding:14px; color:inherit; }
.pilihan:hover { color:inherit; border-color:var(--blue); }
.panah { margin-left:auto; color:var(--muted); font-size:24px; }
.catatan { margin:4px 2px; color:var(--muted); font:400 11.5px/1.5 var(--font-body); }
.keluar { margin-top:8px; min-height:46px; border:1px solid rgba(223,74,55,.25); border-radius:var(--r-sm); background:#fff; color:var(--coral); font:700 13px var(--font-body); cursor:pointer; }
.keluar:hover { background:#fff5f4; }
</style>
