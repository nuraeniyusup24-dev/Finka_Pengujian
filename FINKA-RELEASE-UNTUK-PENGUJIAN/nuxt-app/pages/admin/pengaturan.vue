<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <section class="card kolom profil-akun">
      <ProfileAvatar :initials="inisial" :size="58" />
      <div>
        <div class="h display">{{ user.nama || 'Admin' }}</div>
        <div class="aturan__ket">Foto profil akun Admin</div>
      </div>
    </section>

    <div class="card kolom">
      <div class="h display">Rekening tujuan top-up</div>
      <div v-if="rekening" class="rek">
        <div><span>Bank</span><b>{{ rekening.bank }}</b></div>
        <div><span>Nomor rekening</span><b class="num">{{ rekening.nomor }}</b></div>
        <div><span>Atas nama</span><b>{{ rekening.atas_nama }}</b></div>
      </div>
      <div v-else class="aturan__ket">{{ errorRekening || 'Memuat rekening…' }}</div>

      <div class="h display">Aturan kode unik</div>
      <div class="aturan">
        <div v-for="a in aturan" :key="a.label" class="aturan__row">
          <div>
            <div class="aturan__label">{{ a.label }}</div>
            <div class="aturan__ket">{{ a.ket }}</div>
          </div>
          <b class="display num">{{ a.nilai }}</b>
        </div>
      </div>
    </div>

    <div class="keamanan-sesi">
      <div class="card kolom keamanan-akun">
        <div class="h display">Keamanan akun</div>
        <div class="aturan__ket">Perbarui password akun yang sedang digunakan.</div>
        <nuxt-link to="/akun/pemulihan" class="btn-sm">Reset password via OTP</nuxt-link>
      </div>

      <div class="card kolom keluar-akun">
        <div class="h display">Sesi akun</div>
        <div class="aturan__ket">Keluar dari akun yang sedang digunakan di perangkat ini.</div>
        <button type="button" class="btn-sm btn-sm--keluar" @click="logout">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <path d="M16 17l5-5-5-5"/>
            <path d="M21 12H9"/>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return {
      errorRekening: '',
      aturan: [
        { label: 'Panjang kode unik', ket: 'Ditambahkan ke nominal dasar', nilai: '3 digit' },
        { label: 'Masa berlaku', ket: 'Lewat batas, kode kembali ke pool', nilai: '24 jam' },
        { label: 'Ambang saldo menipis', ket: 'Pemicu notifikasi ke orang tua', nilai: 'Rp 20.000' }
      ]
    }
  },
  computed: {
    user() { return this.$store.state.auth.user || {} },
    inisial() { return (this.user.nama || 'Admin').trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() },
    rekening() {
      const info = this.$store.state.infoPembayaran
      return info && info.rekening
    }
  },
  async mounted() {
    try {
      await this.$store.dispatch('muatInfoPembayaran')
    } catch (error) {
      this.errorRekening = error.message || 'Informasi rekening tidak dapat dimuat.'
    }
  },
  methods: {
    async logout() {
      await this.$store.dispatch('auth/logout')
      this.$router.replace('/login')
    }
  }
}
</script>

<style scoped>
.page { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: stretch; align-content: start; }
.kolom { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
.h { font: 700 14px var(--font-display); }
.btn-sm { border: none; background: var(--blue); color: #fff; font: 600 12.5px var(--font-body); padding: 9px 15px; border-radius: var(--r-sm); cursor: pointer; }
.page > .kolom:first-child { grid-column: 1 / -1; }
.profil-akun { grid-column: 1 / -1; flex-direction: row; align-items: center; }
.keamanan-akun, .keluar-akun { align-items: flex-start; }
.keamanan-sesi { grid-column: 2; display: flex; flex-direction: column; align-self: start; gap: 8px; }
.keamanan-akun .btn-sm { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; text-decoration: none; }
.btn-sm--keluar { border: 1px solid rgba(223, 74, 55, .25); background: #fff; color: var(--coral); }
.keluar-akun .btn-sm { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; }
.btn-sm--keluar:hover { border-color: var(--coral); background: #fff8f7; }

.rek { border: 1px solid var(--line); border-radius: var(--r-md); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.rek div, .aturan__row { display: flex; justify-content: space-between; }
.rek span { font: 400 12.5px var(--font-body); color: var(--muted); }
.rek b { font: 600 12.5px var(--font-body); }

.aturan { display: flex; flex-direction: column; gap: 12px; }
.aturan__row { align-items: center; border: 1px solid var(--line); border-radius: var(--r-sm); padding: 13px 16px; }
.aturan__label { font: 600 12.5px var(--font-body); }
.aturan__ket { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 2px; }
.aturan__row b { font: 700 13px var(--font-display); color: var(--blue); }


@media (max-width: 760px) {
  .page { grid-template-columns: minmax(0, 1fr); }
  .page > .kolom:first-child { grid-column: auto; }
  .keamanan-sesi { grid-column: auto; }
  .kolom { padding: 18px; }
}

@media (max-width: 420px) {
  .keamanan-akun .btn-sm, .keluar-akun .btn-sm { width: 100%; }
  .aturan__row { gap: 12px; padding: 12px; }
  .aturan__row b { text-align: right; }
}
</style>
