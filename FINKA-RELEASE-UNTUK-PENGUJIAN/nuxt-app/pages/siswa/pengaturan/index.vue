<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Pengaturan akun" to="/siswa" />
    <div class="body">
      <section class="card profil">
        <ProfileAvatar :initials="inisial" />
        <div class="profil__data">
          <h2>{{ user.nama || 'Akun Siswa' }}</h2>
          <p>{{ user.username || 'Username belum tersedia' }} · Siswa</p>
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
          <p class="hint">{{ user.kontak_orang_tua ? 'Kontak yang tampil saat ini berasal dari orang tua/wali. Kontak yang ditambahkan di sini menjadi kontak siswa dan perlu diverifikasi Admin.' : 'Kontak baru perlu diverifikasi Admin sebelum digunakan untuk pemulihan akun.' }}</p>
          <p v-if="kontakError" class="feedback feedback--error" role="alert">{{ kontakError }}</p>
          <div class="kontak-actions">
            <button type="button" class="batal" :disabled="menyimpanKontak" @click="batalEdit">Batal</button>
            <button type="button" class="simpan" :disabled="menyimpanKontak" @click="simpanKontak">{{ menyimpanKontak ? 'Menyimpan…' : 'Simpan kontak' }}</button>
          </div>
        </template>
        <template v-else>
          <p class="keterangan">{{ user.kontak_orang_tua ? 'Kontak orang tua/wali yang terhubung' : 'Kontak akun' }}</p>
          <div class="detail__row"><span>Email</span><b>{{ user.email || 'Belum ditambahkan' }}</b></div>
          <div class="detail__row"><span>Nomor telepon</span><b>{{ user.no_hp || 'Belum ditambahkan' }}</b></div>
        </template>
        <p v-if="kontakSukses" class="feedback feedback--success" role="status">{{ kontakSukses }}</p>
      </section>

      <nuxt-link to="/akun/pemulihan" class="action card">
        <span><b>Lupa password?</b><small>Reset password melalui OTP ke kontak terverifikasi</small></span>
        <span class="action__arrow">›</span>
      </nuxt-link>

      <nuxt-link to="/siswa/pin" class="action card">
        <span><b>PIN pembayaran</b><small>PIN siswa untuk transaksi di kantin. Jika lupa, minta orang tua/wali meresetnya dengan OTP.</small></span>
        <span class="action__arrow">›</span>
      </nuxt-link>

      <section class="card blok" :class="{ 'blok--danger': kartu.diblokir }" aria-labelledby="blok-judul">
        <div class="blok__head">
          <div class="blok__teks">
            <b id="blok-judul">Blokir kartu &amp; QR</b>
            <small>{{ keteranganBlokir }}</small>
          </div>
          <ToggleSwitch
            :value="kartu.diblokir"
            danger
            aria-label="Blokir kartu dan QR"
            :disabled="kartu.memuat || kartu.menyimpan || kartuTerkunci"
            @input="ubahBlokir"
          />
        </div>
        <div v-if="kartu.diblokir" class="blok__warn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
          <p>Kartu diblokir. Semua transaksi kantin dan koperasi ditolak{{ kartuTerkunci ? ' sampai orang tua/wali membuka blokir.' : ' sampai kamu mengaktifkannya kembali.' }}</p>
        </div>
        <p v-if="kartu.error" class="feedback feedback--error" role="alert">{{ kartu.error }}</p>
        <p v-else-if="kartu.pesan" class="feedback feedback--success" role="status">{{ kartu.pesan }}</p>
      </section>

      <button type="button" class="keluar" @click="logout">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
        Keluar dari akun
      </button>
    </div>

    <!-- Pop-up konfirmasi blokir / aktifkan kembali kartu (pengganti dialog bawaan browser) -->
    <ConfirmModal
      :open="konfirmasi.buka"
      :title="teksKonfirmasi.judul"
      :message="teksKonfirmasi.pesan"
      :confirm-label="teksKonfirmasi.tombol"
      :tone="teksKonfirmasi.tone"
      :loading="kartu.menyimpan"
      @confirm="jalankanBlokir"
      @cancel="batalKonfirmasi"
    />
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
      kontakSukses: '',
      // Status kartu: oleh = 'siswa' (boleh diaktifkan kembali sendiri) atau 'ortu' (hanya orang tua yang bisa membuka)
      kartu: { memuat: true, menyimpan: false, diblokir: false, oleh: null, error: '', pesan: '' },
      // Pop-up konfirmasi: aktif = true berarti mau memblokir, false berarti mau mengaktifkan kembali
      konfirmasi: { buka: false, aktif: false }
    }
  },
  computed: {
    user() { return this.$store.state.auth.user || {} },
    inisial() { return (this.user.nama || 'S').trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() },
    kartuTerkunci() { return this.kartu.diblokir && this.kartu.oleh !== 'siswa' },
    keteranganBlokir() {
      if (this.kartu.memuat) return 'Memuat status kartu…'
      if (!this.kartu.diblokir) return 'Gunakan bila kartu hilang. Berlaku seketika.'
      if (this.kartuTerkunci) return 'Diblokir oleh orang tua/wali. Hanya mereka yang dapat membukanya.'
      return 'Kartu dan QR nonaktif. Geser untuk mengaktifkan kembali bila kartu sudah ketemu.'
    },
    teksKonfirmasi() {
      return this.konfirmasi.aktif
        ? {
            judul: 'Blokir kartu ini?',
            pesan: 'QR tidak dapat dipakai untuk transaksi di kantin dan koperasi sampai kamu mengaktifkannya kembali di Pengaturan akun.',
            tombol: 'Ya, blokir kartu',
            tone: 'danger'
          }
        : {
            judul: 'Aktifkan kembali kartu?',
            pesan: 'Pastikan kartu yang hilang sudah ketemu. Setelah aktif, QR bisa dipakai lagi untuk transaksi.',
            tombol: 'Ya, aktifkan',
            tone: 'primary'
          }
    }
  },
  async mounted() {
    await this.muatKartu()
  },
  methods: {
    terapkanKartu(data) {
      this.kartu.diblokir = Boolean(data && data.kartu_diblokir)
      this.kartu.oleh = this.kartu.diblokir ? (data.kartu_diblokir_oleh || 'ortu') : null
    },
    async muatKartu() {
      this.kartu.memuat = true
      this.kartu.error = ''
      try {
        this.terapkanKartu(await api.kontrolSaya(this.$store.state.auth.token))
      } catch (error) {
        this.kartu.error = error.message || 'Status kartu gagal dimuat.'
      } finally {
        this.kartu.memuat = false
      }
    },
    // Toggle digeser/diketuk: tampilkan pop-up konfirmasi dulu. Status baru berubah setelah dikonfirmasi,
    // jadi kalau dibatalkan tombol tetap di posisi semula.
    ubahBlokir(aktif) {
      if (this.kartu.memuat || this.kartu.menyimpan) return
      this.konfirmasi = { buka: true, aktif: Boolean(aktif) }
    },
    batalKonfirmasi() {
      if (this.kartu.menyimpan) return
      this.konfirmasi.buka = false
    },
    async jalankanBlokir() {
      if (this.kartu.memuat || this.kartu.menyimpan) return
      const aktif = this.konfirmasi.aktif
      this.kartu.menyimpan = true
      this.kartu.error = ''
      this.kartu.pesan = ''
      try {
        const token = this.$store.state.auth.token
        const hasil = aktif ? await api.blokirKartuSaya(token) : await api.bukaBlokirKartuSaya(token)
        this.terapkanKartu(hasil)
        this.kartu.pesan = hasil.pesan || (aktif ? 'Kartu berhasil diblokir.' : 'Kartu aktif kembali.')
      } catch (error) {
        this.kartu.error = error.message || 'Status kartu gagal diubah.'
        // Samakan dengan kondisi sebenarnya di server (mis. ternyata sudah diblokir orang tua)
        try { this.terapkanKartu(await api.kontrolSaya(this.$store.state.auth.token)) } catch (e) { /* biarkan pesan error di atas */ }
      } finally {
        this.kartu.menyimpan = false
        this.konfirmasi.buka = false
      }
    },
    mulaiEdit() {
      this.form = { email: this.user.email_akun || '', no_hp: this.user.no_hp_akun || '' }
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
.wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; background: var(--bg); }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.profil { display: flex; align-items: center; gap: 12px; padding: 16px; }
.profil__data { min-width: 0; }
.profil h2, .detail h2 { margin: 0; color: var(--ink); font: 700 14px var(--font-display); }
.profil p, .keterangan { margin: 4px 0 0; color: var(--muted); font: 400 12px/1.5 var(--font-body); }
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
.action small { margin-top: 3px; color: var(--muted); font: 400 11.5px/1.45 var(--font-body); }
.action__arrow { margin-left: auto; color: var(--muted); font-size: 24px; }
.blok { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.blok--danger { border-color: var(--coral); }
.blok__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.blok__teks { min-width: 0; }
.blok__teks b, .blok__teks small { display: block; }
.blok__teks b { color: var(--ink); font: 700 13px var(--font-display); }
.blok__teks small { margin-top: 3px; color: var(--muted); font: 400 11.5px/1.45 var(--font-body); text-wrap: pretty; }
.blok__warn { background: rgba(223,74,55,.08); border-radius: var(--r-sm); padding: 12px; display: flex; gap: 10px; align-items: flex-start; }
.blok__warn svg { flex: none; margin-top: 1px; }
.blok__warn p { margin: 0; font: 400 12px/1.5 var(--font-body); color: var(--coral); text-wrap: pretty; }
.keluar { min-height: 46px; display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 4px; border: 1px solid rgba(223,74,55,.25); border-radius: var(--r-sm); background: #fff; color: var(--coral); font: 700 13px var(--font-body); cursor: pointer; }
</style>
