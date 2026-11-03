<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Kontrol Orang Tua" to="/ortu" />
    <div class="body">
      <div class="card anak">
        <div class="av">{{ aktif.inisial }}</div>
        <div class="anak__id">
          <div class="anak__nama">{{ aktif.nama }}</div>
          <div class="anak__sub">{{ aktif.kelas }} · NIS {{ aktif.nis }}</div>
        </div>
        <button class="link" :disabled="memuat || menyimpan" @click="ganti">Ganti</button>
      </div>

      <div class="card blok">
        <div class="blok__head">
          <div>
            <div class="blok__judul display">Limit belanja harian</div>
            <div class="blok__ket">Reset otomatis pukul 00.00 WIB</div>
          </div>
          <ToggleSwitch :value="limitOn" :disabled="memuat || menyimpan" @input="setLimitOn" />
        </div>
        <div v-if="limitOn" class="limit">
          <div class="limit__nilai display num">{{ limit | rp }}<span> / hari</span></div>
          <div class="chips">
            <button
              v-for="n in limitOpsi"
              :key="n"
              class="chip num"
              :class="n === limit ? 'chip--on' : ''"
              @click="setLimit(n)"
            >{{ $num(n) }}</button>
          </div>
          <div>
            <div class="bar"><i :style="'width:' + pakaiPct + '%'"></i></div>
            <div class="bar__ket">
              <span>Terpakai hari ini {{ pakai | rp }}</span>
              <b>sisa {{ sisa | rp }}</b>
            </div>
          </div>
        </div>
      </div>

      <div class="card blok" :class="blokir ? 'blok--danger' : ''">
        <div class="blok__head">
          <div>
            <div class="blok__judul display">Blokir kartu &amp; QR</div>
            <div class="blok__ket">{{ blokir ? 'Kartu dan QR nonaktif' : 'Gunakan bila kartu hilang. Berlaku seketika.' }}</div>
          </div>
          <ToggleSwitch :value="blokir" danger :disabled="memuat || menyimpan" @input="setBlokir" />
        </div>
        <div v-if="blokir" class="warn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="1.9"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
          <p>Kartu diblokir. Semua transaksi kantin dan koperasi ditolak sampai Anda membuka blokir.</p>
        </div>
      </div>

      <div class="card blok">
        <div class="blok__head">
          <div>
            <div class="blok__judul display">Lupa PIN belanja anak?</div>
            <div class="blok__ket">Atur ulang setelah OTP diverifikasi. Alur ini tidak memerlukan PIN lama.</div>
          </div>
        </div>
        <p v-if="reset.methodsError" class="galat">{{ reset.methodsError }}</p>
        <template v-else-if="reset.step === 'method'">
          <div v-if="reset.methods" class="method-status">
            <div>Email: {{ statusMetode(reset.methods.email) }}</div>
            <div>WhatsApp: {{ statusMetode(reset.methods.whatsapp) }}</div>
          </div>
          <label class="reset-field">Metode verifikasi
            <select v-model="reset.channel" class="reset-input" :disabled="reset.loading">
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <div v-if="metodeResetDipilih && !metodeResetDipilih.available" class="warn"><p>Metode ini belum dapat digunakan: {{ statusMetode(metodeResetDipilih) }}. Tidak ada OTP yang dikirim dan PIN tidak berubah.</p></div>
          <button class="reset-button" :disabled="reset.loading || !metodeResetDipilih || !metodeResetDipilih.available" @click="mintaOtp">{{ reset.loading ? 'Meminta OTP…' : 'Minta OTP' }}</button>
        </template>
        <template v-else-if="reset.step === 'otp'">
          <p class="blok__ket">Masukkan kode OTP yang dikirim ke kontak terverifikasi. Kode berlaku 5 menit dan maksimal 5 percobaan.</p>
          <label class="reset-field">Kode OTP
            <input v-model="reset.otp" class="reset-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" />
          </label>
          <button class="reset-button" :disabled="reset.loading || !/^\d{6}$/.test(reset.otp)" @click="verifikasiOtp">{{ reset.loading ? 'Memverifikasi…' : 'Verifikasi OTP' }}</button>
          <button class="link" :disabled="reset.loading" @click="kembaliKeMetode">Ganti metode / batalkan</button>
        </template>
        <template v-else-if="reset.step === 'pin'">
          <p class="blok__ket">Buat PIN pembayaran baru 6 digit. PIN lama yang terlupakan tidak diperlukan.</p>
          <label class="reset-field">PIN baru
            <input v-model="reset.pin" class="reset-input" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" />
          </label>
          <label class="reset-field">Konfirmasi PIN baru
            <input v-model="reset.confirmation" class="reset-input" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" />
          </label>
          <button class="reset-button" :disabled="reset.loading || !/^\d{6}$/.test(reset.pin) || reset.pin !== reset.confirmation" @click="selesaikanReset">{{ reset.loading ? 'Menyimpan…' : 'Atur ulang PIN' }}</button>
        </template>
        <div v-else-if="reset.step === 'done'" class="berhasil">PIN pembayaran berhasil diatur ulang. PIN lama tidak berlaku lagi.</div>
        <p v-if="reset.error" class="galat" role="alert">{{ reset.error }}</p>
        <div v-if="reset.step === 'done'" class="reset-actions"><button class="link" @click="resetPinState">Selesai</button></div>
        <div v-if="reset.step !== 'done'" class="reset-actions"><button class="link" :disabled="reset.loading" @click="resetPinState">Batal</button></div>
        <div class="separator"></div>
        <div class="blok__judul display">Ganti PIN yang masih diketahui</div>
        <div class="blok__ket">Jika masih mengetahui PIN saat ini, Siswa dapat menggantinya dari menu PIN pembayaran di akunnya. Jangan bagikan PIN kepada siapa pun.</div>
      </div>

      <p v-if="error" class="galat">{{ error }}</p>
    </div>
    <OrtuTabBar />
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() {
    return {
      limitOpsi: [15000, 25000, 35000, 50000], error: '', memuat: true, menyimpan: false,
      reset: { step: 'method', channel: 'email', methods: null, methodsError: '', loading: false, error: '', challengeId: '', otp: '', resetToken: '', pin: '', confirmation: '' }
    }
  },
  computed: {
    aktif() { return this.$store.state.ortu.anak.find((a) => Number(a.id) === Number(this.$store.state.ortu.anakAktifId)) || this.$store.state.ortu.anak[0] || {} },
    limitOn() { return this.$store.state.limitOn },
    limit() { return this.$store.state.limit },
    blokir() { return this.$store.state.blokir },
    pakai() { return this.$store.state.limitPakai },
    sisa() { return this.$store.getters.limitSisa },
    pakaiPct() { return Math.min(100, Math.round((this.pakai / this.limit) * 100)) },
    metodeResetDipilih() { return this.reset.methods && this.reset.methods[this.reset.channel] }
  },
  async mounted() {
    try { await this.$store.dispatch('ortu/muatAnak'); await this.muat() } catch (e) { this.error = e.message || 'Gagal memuat daftar anak'; this.memuat = false }
  },
  watch: {
    'aktif.id'(id, sebelumnya) { if (sebelumnya && id !== sebelumnya) { this.resetPinState(); this.muat() } }
  },
  methods: {
    ganti() {
      if (this.memuat || this.menyimpan) return
      const anak = this.$store.state.ortu.anak
      if (!anak.length) return
      const ix = anak.findIndex((a) => Number(a.id) === Number(this.$store.state.ortu.anakAktifId))
      this.$store.commit('ortu/setAnakAktif', anak[(ix + 1) % anak.length].id)
    },
    async muat() {
      if (!this.aktif.id) { this.memuat = false; return }
      this.error = ''
      this.memuat = true
      try {
        await this.$store.dispatch('muatKontrol', this.aktif.id)
        await this.muatMetodeReset()
      } catch (e) { this.error = e.message || 'Gagal memuat kontrol' } finally { this.memuat = false }
    },
    async muatMetodeReset() {
      this.reset.methodsError = ''
      try { const result = await api.metodeResetPin(this.aktif.id); this.reset.methods = result.methods || {} }
      catch (e) {
        this.reset.methods = null
        this.reset.methodsError = e.status === 404 ? (e.message || 'Anak tidak ditemukan di akun ini.') : 'Status pemulihan PIN belum tersedia di server. Migrasi PIN-recovery dan provider perlu disiapkan Admin.'
      }
    },
    statusMetode(method) {
      if (!method) return 'status belum tersedia'
      const missing = []
      if (!method.contactConfigured) missing.push('kontak belum disimpan')
      if (!method.contactVerified) missing.push('kontak belum terverifikasi')
      if (!method.providerAvailable) missing.push('provider OTP belum dikonfigurasi')
      return missing.length ? missing.join(', ') : 'siap digunakan'
    },
    resetPinState() { this.reset = { step: 'method', channel: 'email', methods: this.reset.methods, methodsError: this.reset.methodsError, loading: false, error: '', challengeId: '', otp: '', resetToken: '', pin: '', confirmation: '' } },
    kembaliKeMetode() { this.resetPinState() },
    async mintaOtp() {
      if (!this.aktif.id || !this.metodeResetDipilih || !this.metodeResetDipilih.available || this.reset.loading) return
      this.reset.loading = true; this.reset.error = ''
      try {
        const result = await api.mintaOtpResetPin(this.aktif.id, this.reset.channel)
        this.reset.challengeId = result.challengeId; this.reset.step = 'otp'
      } catch (e) { this.reset.error = e.message || 'OTP belum dapat diminta.' }
      finally { this.reset.loading = false }
    },
    async verifikasiOtp() {
      if (this.reset.loading) return
      this.reset.loading = true; this.reset.error = ''
      try {
        const result = await api.verifikasiOtpResetPin(this.aktif.id, this.reset.challengeId, this.reset.otp)
        this.reset.resetToken = result.resetToken; this.reset.otp = ''; this.reset.step = 'pin'
      } catch (e) { this.reset.error = e.message || 'OTP tidak valid atau kedaluwarsa.' }
      finally { this.reset.loading = false }
    },
    async selesaikanReset() {
      if (this.reset.loading || this.reset.pin !== this.reset.confirmation) return
      this.reset.loading = true; this.reset.error = ''
      try {
        await api.selesaikanResetPin(this.aktif.id, this.reset.challengeId, this.reset.resetToken, this.reset.pin, this.reset.confirmation)
        this.reset.pin = ''; this.reset.confirmation = ''; this.reset.resetToken = ''; this.reset.step = 'done'
      } catch (e) { this.reset.error = e.message || 'PIN belum berhasil diubah.' }
      finally { this.reset.loading = false }
    },
    // Setiap perubahan langsung disimpan ke server (berlaku seketika di kasir).
    async simpan(payload) {
      if (!this.aktif.id || this.menyimpan || this.memuat) return
      this.error = ''; this.menyimpan = true
      try { await this.$store.dispatch('simpanKontrol', { siswaId: this.aktif.id, payload }) } catch (e) { this.error = e.message || 'Gagal menyimpan' } finally { this.menyimpan = false }
    },
    setLimitOn(v) { return this.simpan({ limit_aktif: !!v }) },
    setLimit(n) { return this.simpan({ limit: n, limit_aktif: true }) },
    setBlokir(v) { return this.simpan({ kartu_diblokir: !!v }) }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }

.anak { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.av {
  width: 36px; height: 36px; border-radius: var(--r-pill); flex: none;
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center; font: 700 13px var(--font-display);
}
.anak__id { flex: 1; }
.anak__nama { font: 600 14px var(--font-body); }
.anak__sub { font: 400 12px var(--font-body); color: var(--muted); }
.link { border: none; background: none; color: var(--blue); font: 600 12px var(--font-body); cursor: pointer; padding: 0; }

.blok { padding: 18px; display: flex; flex-direction: column; gap: 16px; }
.blok--danger { border-color: var(--coral); }
.blok__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.blok__judul { font: 700 14px var(--font-display); }
.blok__ket { font: 400 12px/1.45 var(--font-body); color: var(--muted); margin-top: 3px; max-width: 230px; text-wrap: pretty; }

.limit { display: flex; flex-direction: column; gap: 14px; }
.limit__nilai { font: 800 28px var(--font-display); letter-spacing: -.02em; }
.limit__nilai span { font: 500 13px var(--font-body); color: var(--muted); }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.bar { height: 7px; border-radius: var(--r-pill); background: var(--bg); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--blue); border-radius: var(--r-pill); }
.bar__ket { display: flex; justify-content: space-between; margin-top: 7px; font: 400 11.5px var(--font-body); color: var(--muted); }
.bar__ket b { color: var(--blue); font-weight: 600; }

.warn { background: rgba(223,74,55,.08); border-radius: var(--r-sm); padding: 12px; display: flex; gap: 10px; align-items: flex-start; }
.warn svg { flex: none; margin-top: 1px; }
.warn p { margin: 0; font: 400 12px/1.5 var(--font-body); color: var(--coral); text-wrap: pretty; }
.reset-field { display:flex; flex-direction:column; gap:6px; font:500 12px var(--font-body); color:var(--muted); }
.reset-input { width:100%; border:1px solid var(--line); border-radius:var(--r-sm); background:#fff; padding:10px 12px; font:500 14px var(--font-body); color:var(--ink); }
.reset-button { align-self:flex-start; border:0; border-radius:var(--r-sm); background:var(--blue); color:#fff; padding:10px 14px; font:600 12.5px var(--font-body); cursor:pointer; }
.reset-button:disabled { opacity:.5; cursor:not-allowed; }
.reset-actions { display:flex; justify-content:flex-end; }
.separator { height:1px; background:var(--line); margin:2px 0; }
.method-status { display:grid; gap:4px; color:var(--muted); font:400 11.5px/1.45 var(--font-body); }

.galat { margin: 0; font: 500 12.5px var(--font-body); color: var(--coral); }
.berhasil { margin:0; color:var(--green); font:500 12.5px/1.45 var(--font-body); }
</style>
