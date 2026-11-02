<template>
  <div class="overlay" @click.self="!loading && $emit('tutup')">
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" @submit.prevent="simpan">
      <header class="modal__header">
        <div>
          <h2 id="modal-title">Tambah akun</h2>
          <p>Pilih jenis akun, lalu isi datanya.</p>
        </div>
        <button class="close" type="button" aria-label="Tutup" :disabled="loading" @click="$emit('tutup')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div class="modal__body">
        <div class="types" role="group" aria-label="Jenis akun">
          <button
            v-for="option in jenisOpsi"
            :key="option.value"
            class="type"
            :class="{ 'type--selected': jenis === option.value }"
            type="button"
            :aria-pressed="jenis === option.value ? 'true' : 'false'"
            @click="jenis = option.value"
          >
            <svg v-if="option.value === 'ortu'" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V19" />
            </svg>
            <svg v-else-if="option.value === 'siswa'" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3.7 3 8.3 3 12 0v-5M22 9v6" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 9h18l-1.5-5h-15L3 9Z" /><path d="M4 9v10h16V9M4 19h16M8 9v3a2 2 0 0 0 4 0V9m0 0v3a2 2 0 0 0 4 0V9" />
            </svg>
            <span class="type__title">{{ option.label }}</span>
            <span class="type__description">{{ option.description }}</span>
          </button>
        </div>

        <label class="field">
          <span>Nama lengkap</span>
          <input v-model.trim="nama" required maxlength="100" placeholder="mis. Sari Wulandari" autocomplete="name" />
        </label>

        <template v-if="jenis === 'ortu'">
          <div class="fields-row">
            <label class="field">
              <span>Hubungan</span>
              <select v-model="hubungan">
                <option value="ibu">Ibu</option>
                <option value="ayah">Ayah</option>
                <option value="wali">Wali</option>
              </select>
            </label>
            <label class="field">
              <span>Nomor HP</span>
              <input v-model.trim="noHp" type="tel" inputmode="tel" maxlength="20" placeholder="0812 3456 7890" autocomplete="tel" />
            </label>
          </div>
          <label class="field">
            <span>Email <i>opsional</i></span>
            <input v-model.trim="email" type="email" maxlength="254" placeholder="nama@email.com" autocomplete="email" />
          </label>
          <p class="hint">Notifikasi tagihan juga dapat dikirim ke email ini.</p>
          <label class="field">
            <span>Username</span>
            <input v-model.trim="username" required maxlength="60" placeholder="Masukkan username" autocomplete="username" />
          </label>
        </template>

        <template v-if="jenis === 'siswa'">
          <div class="fields-row">
            <label class="field">
              <span>NIS / username</span>
              <input v-model.trim="nis" required maxlength="30" placeholder="Masukkan NIS siswa" autocomplete="username" />
            </label>
            <label class="field">
              <span>Kelas</span>
              <input v-model.trim="kelas" placeholder="Contoh: 7A" required maxlength="10" />
            </label>
          </div>
          <label class="field">
            <span>Nama orang tua / wali</span>
            <select v-model="ortuId" required :disabled="memuatOrtu || akunOrtu.length === 0">
              <option disabled value="">{{ memuatOrtu ? 'Memuat akun orang tua…' : 'Pilih akun orang tua / wali' }}</option>
              <option v-for="ortu in akunOrtu" :key="ortu.id" :value="String(ortu.id)">{{ ortu.nama }} ({{ ortu.username }})</option>
            </select>
          </label>
          <p v-if="!memuatOrtu && !akunOrtu.length && !error" class="error">Belum ada akun orang tua terdaftar. Buat akun orang tua terlebih dahulu.</p>
        </template>

        <template v-if="jenis === 'pic'">
          <div class="fields-row">
            <label class="field">
              <span>Username</span>
              <input v-model.trim="username" required maxlength="60" placeholder="Masukkan username" autocomplete="username" />
            </label>
            <label class="field">
              <span>Outlet</span>
              <input v-model.trim="outlet" required maxlength="80" placeholder="Contoh: Kantin Gedung A" />
            </label>
          </div>
          <div class="fields-row">
            <label class="field">
              <span>Nomor HP</span>
              <input v-model.trim="noHp" type="tel" inputmode="tel" maxlength="20" placeholder="0812 3456 7890" autocomplete="tel" />
            </label>
            <label class="field">
              <span>Email <i>opsional</i></span>
              <input v-model.trim="email" type="email" maxlength="254" placeholder="nama@email.com" autocomplete="email" />
            </label>
          </div>
        </template>

        <label class="field">
          <span>Password awal</span>
          <input v-model="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter" />
        </label>
        <p v-if="jenis === 'siswa'" class="hint">Siswa wajib mengganti password ini saat login pertama, lalu membuat PIN pembayaran baru.</p>
        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <footer class="modal__footer">
        <button class="cancel" type="button" :disabled="loading" @click="$emit('tutup')">Batal</button>
        <button class="primary" type="submit" :disabled="loading">{{ loading ? 'Menyimpan…' : 'Daftarkan akun' }}</button>
      </footer>
    </form>
  </div>
</template>

<script>
import { api } from '~/utils/api'
export default {
  data() {
    return {
      jenis: 'ortu',
      jenisOpsi: [
        { value: 'ortu', label: 'Orang tua', description: 'Buat PIN saat masuk pertama untuk konfirmasi pembayaran' },
        { value: 'siswa', label: 'Siswa', description: 'Buat PIN saat masuk pertama untuk belanja' },
        { value: 'pic', label: 'PIC', description: 'Kasir kantin atau koperasi' }
      ],
      nama: '',
      username: '',
      password: '',
      noHp: '',
      email: '',
      hubungan: 'ibu',
      nis: '',
      kelas: '',
      ortuId: '',
      akunOrtu: [],
      memuatOrtu: false,
      outlet: '',
      loading: false,
      error: '',
      previousDocumentOverflow: '',
      previousBodyOverflow: ''
    }
  },
  mounted() {
    this.previousDocumentOverflow = document.documentElement.style.overflow
    this.previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    this.muatAkunOrtu()
  },
  beforeDestroy() {
    document.documentElement.style.overflow = this.previousDocumentOverflow
    document.body.style.overflow = this.previousBodyOverflow
  },
  methods: {
    async muatAkunOrtu() {
      this.memuatOrtu = true
      try {
        const users = await api.adminUsers()
        this.akunOrtu = users.filter((user) => user.role === 'ortu' && Number(user.active) === 1)
      } catch (e) {
        this.error = e.message || 'Gagal memuat daftar akun orang tua.'
      } finally {
        this.memuatOrtu = false
      }
    },
    async simpan() {
      this.error = ''
      if (this.password.length < 8) { this.error = 'Password minimal 8 karakter.'; return }
      if (this.jenis === 'siswa' && !this.ortuId) { this.error = 'Pilih akun orang tua/wali untuk dihubungkan.'; return }
      const nomor = this.noHp.replace(/[\s()-]/g, '')
      const nomorLokal = nomor.startsWith('+628') ? '08' + nomor.slice(3) : nomor
      if (nomorLokal && !/^08\d{8,11}$/.test(nomorLokal)) { this.error = 'Nomor WhatsApp harus 10–13 digit dan diawali 08 atau +62.'; return }
      const emailBersih = this.email.trim().toLowerCase()
      if (emailBersih && (emailBersih.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBersih))) { this.error = 'Format email tidak valid.'; return }
      this.loading = true
      try {
        const payload = { username: this.jenis === 'siswa' ? this.nis.trim() : this.username.trim(), password: this.password, nama: this.nama.trim(), role: this.jenis === 'pic' ? 'pic' : this.jenis, kelas: this.kelas.trim() || undefined, nis: this.nis.trim() || undefined, ortu_id: this.jenis === 'siswa' ? Number(this.ortuId) : undefined, outlet: this.jenis === 'pic' ? this.outlet.trim() : undefined, hubungan: this.jenis === 'ortu' ? this.hubungan : undefined, no_hp: nomorLokal || undefined, email: emailBersih || undefined }
        const result = await api.buatAkun(payload)
        const akun = { jenis: this.jenis, nama: this.nama, kelas: this.kelas, nis: this.nis, outlet: this.outlet }
        this.$emit('berhasil', { ...akun, akun: result.user })
        this.$emit('tutup')
      } catch (e) { this.error = e.message || 'Gagal membuat akun.' }
      finally { this.loading = false }
    }
  }
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; overflow-y: auto; overscroll-behavior: contain; padding: 16px; background: rgba(16, 24, 40, .48); }
.modal { width: min(100%, 700px); max-height: min(90vh, 760px); display: flex; flex-direction: column; overflow: hidden; background: #fff; border-radius: 18px; box-shadow: 0 18px 60px #0003; }
.modal__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 26px 32px 20px; border-bottom: 1px solid var(--line); flex: none; }
.modal__header h2 { margin: 0; color: var(--ink); font: 700 20px var(--font-display); }
.modal__header p { margin: 4px 0 0; color: var(--muted); font: 400 14px var(--font-body); }
.close { display: grid; place-items: center; width: 32px; height: 32px; margin: -5px -8px 0 0; padding: 5px; border: 0; border-radius: 8px; background: transparent; color: #7b8490; cursor: pointer; }
.close:hover { background: var(--bg); }
.close svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.modal__body { display: flex; flex-direction: column; gap: 18px; overflow-y: auto; overscroll-behavior: contain; padding: 6px 32px 22px; }
.types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.type { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; min-height: 138px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: #fff; color: var(--ink); text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
.type:hover { border-color: #aab1e8; }
.type--selected { border: 1.5px solid #5362d0; background: var(--blue-soft); box-shadow: 0 0 0 1px rgba(30, 46, 187, .08); }
.type svg { width: 24px; height: 24px; margin-bottom: 14px; fill: none; stroke: #858e98; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.type--selected svg { stroke: var(--blue); }
.type__title { margin-bottom: 3px; font: 700 16px var(--font-display); }
.type__description { color: var(--muted); font: 400 13px/1.4 var(--font-body); }
.field { display: flex; flex-direction: column; gap: 7px; min-width: 0; color: var(--ink); font: 600 14px var(--font-body); }
.field input, .field select { width: 100%; min-width: 0; min-height: 50px; padding: 0 15px; border: 1px solid var(--line); border-radius: 12px; outline: none; background: #fff; color: var(--ink); font: 400 15px var(--font-body); transition: border-color .15s ease, box-shadow .15s ease; }
.field input::placeholder { color: #a4aab4; }
.field input:focus, .field select:focus { border-color: #6875d8; box-shadow: 0 0 0 3px rgba(30, 46, 187, .12); }
.field input:disabled, .field select:disabled { background: var(--bg); cursor: not-allowed; }
.field i { color: var(--muted); font-size: 13px; font-style: normal; font-weight: 400; }
.fields-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.hint { margin: -10px 0 0; color: var(--muted); font: 400 12px/1.5 var(--font-body); }
.error { margin: 0; color: var(--coral); font: 400 12px/1.5 var(--font-body); }
.modal__footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 32px 18px; border-top: 1px solid var(--line); background: #fff; flex: none; }
.cancel, .primary { min-height: 48px; padding: 0 20px; border: 1px solid var(--line); border-radius: 12px; background: #fff; color: var(--ink); cursor: pointer; font: 600 15px var(--font-display); }
.primary { min-width: 180px; border-color: var(--blue); background: var(--blue); color: #fff; }
.primary:hover { background: var(--blue-dark); }
.cancel:disabled, .primary:disabled, .close:disabled { cursor: not-allowed; opacity: .65; }

@media (max-width: 600px) {
  .overlay { padding: 10px; }
  .modal { max-height: 94vh; border-radius: 16px; }
  .modal__header { padding: 20px 18px 16px; }
  .modal__header h2 { font-size: 18px; }
  .modal__body { gap: 15px; padding: 4px 18px 18px; }
  .types { gap: 8px; }
  .type { min-height: 122px; padding: 11px; border-radius: 12px; }
  .type svg { width: 21px; height: 21px; margin-bottom: 9px; }
  .type__title { font-size: 14px; }
  .type__description { font-size: 11px; }
  .field { font-size: 13px; }
  .field input, .field select { min-height: 46px; padding: 0 12px; font-size: 14px; }
  .fields-row { gap: 10px; }
  .modal__footer { padding: 12px 18px 14px; gap: 8px; }
  .cancel, .primary { min-height: 44px; padding: 0 14px; font-size: 13px; }
  .primary { min-width: 150px; }
}

@media (max-width: 380px) {
  .types { grid-template-columns: 1fr; }
  .type { min-height: 0; display: grid; grid-template-columns: 28px 1fr; column-gap: 9px; padding: 10px 12px; }
  .type svg { grid-row: span 2; margin: 2px 0 0; }
  .type__title { margin: 0; }
  .type__description { grid-column: 2; }
  .fields-row { grid-template-columns: 1fr; }
}
</style>
