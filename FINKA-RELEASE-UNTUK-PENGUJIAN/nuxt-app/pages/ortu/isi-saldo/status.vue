<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Status Top-up" to="/ortu" />
    <div class="body">
      <div class="card status" :class="selesai ? 'status--ok' : ditolak ? 'status--bad' : ''">
        <div class="status__ik">
          <svg v-if="selesai" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <svg v-else-if="ditolak" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sand-ink)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </div>
        <div class="status__judul display">{{ selesai ? (untukTagihan ? 'Tagihan lunas' : 'Saldo bertambah') : ditolak ? 'Permintaan ditolak' : 'Menunggu verifikasi admin' }}</div>
        <p class="status__pesan">{{ pesan }}</p>
        <div class="status__nominal display num" :class="selesai ? 'is-ok' : ditolak ? 'is-bad' : ''">{{ transfer | rp }}</div>
      </div>

      <div class="card lini">
        <div class="lini__judul display">Lini masa</div>
        <div v-for="(t, i) in timeline" :key="i" class="lini__item">
          <div class="lini__rail">
            <span class="dot" :style="'background:' + t.dot"></span>
            <span class="line" :style="'background:' + t.line"></span>
          </div>
          <div>
            <div class="lini__t" :style="'color:' + t.fg">{{ t.judul }}</div>
            <div class="lini__w">{{ t.waktu ? formatWaktu(t.waktu) : t.keterangan }}</div>
          </div>
        </div>
      </div>

      <div class="card rincian">
        <div><span>Untuk</span><b>{{ aktif.nama }}</b></div>
        <div><span>Kode unik</span><b class="num">{{ kodeStr }}</b></div>
        <div><span>ID permintaan</span><b class="num">TU-{{ $store.state.topup.id }}</b></div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div class="spacer"></div>
      <button v-if="!selesai && !ditolak" class="btn btn--ghost" :disabled="memeriksa" @click="periksa">
        {{ memeriksa ? 'Memeriksa…' : 'Periksa status' }}
      </button>
      <nuxt-link
        v-else-if="selesai && untukTagihan && tagihanId"
        :to="'/ortu/tagihan/' + tagihanId"
        class="btn btn--primary"
      >Lihat tagihan yang sudah dibayar</nuxt-link>
      <nuxt-link v-else-if="selesai || ditolak" to="/ortu" class="btn btn--primary">Kembali ke beranda</nuxt-link>
    </div>
  </div>
</template>

<script>
export default {


  data() {
    return { memeriksa: false, _timer: null, error: '' }
  },
  computed: {
    selesai() { return this.$store.state.topup.status === 'disetujui' },
    ditolak() { return this.$store.state.topup.status === 'ditolak' },
    untukTagihan() { return !!this.$store.state.topup.tagihanId },
    tagihanId() { return this.$store.state.topup.tagihanId },
    transfer() { return this.$store.getters['topup/transfer'] },
    kodeStr() { return this.$store.getters['topup/kodeStr'] },
    aktif() {
      return this.$store.state.ortu.anak.find((a) => Number(a.id) === Number(this.$store.state.topup.anakAktifId)) || {}
    },
    pesan() {
      if (this.selesai && this.untukTagihan) return 'Pembayaran tagihan untuk ' + this.aktif.nama + ' sudah dikonfirmasi admin.'
      if (this.selesai) return 'Top-up disetujui admin yayasan. Saldo ' + this.aktif.nama + ' sudah bisa dipakai di kantin dan koperasi.'
      if (this.ditolak) return 'Permintaan ditolak admin. ' + (this.$store.state.topup.alasan || 'Coba ajukan ulang dengan bukti yang jelas.')
      return 'Admin akan mencocokkan transfer Anda dengan mutasi bank. Tekan "Periksa status" untuk lihat perkembangan terbaru.'
    },
    timeline() {
      const hijau = 'var(--green)'
      const merah = 'var(--coral)'
      const warnaAkhir = this.selesai ? hijau : this.ditolak ? merah : 'var(--sand)'
      return [
        {
          judul: 'Permintaan dibuat',
          waktu: this.$store.state.topup.waktuDiajukan,
          keterangan: 'Permintaan tercatat',
          dot: hijau,
          line: this.$store.state.topup.buktiTersedia ? hijau : 'var(--line)',
          fg: 'var(--ink)'
        },
        {
          judul: 'Bukti transfer diunggah',
          waktu: this.$store.state.topup.buktiDiunggahAt,
          keterangan: this.$store.state.topup.buktiTersedia ? 'Bukti diterima' : 'Menunggu unggahan bukti',
          dot: this.$store.state.topup.buktiTersedia ? hijau : 'var(--line)',
          line: (this.selesai || this.ditolak) ? warnaAkhir : 'var(--line)',
          fg: this.$store.state.topup.buktiTersedia ? 'var(--ink)' : 'var(--muted)'
        },
        {
          judul: this.selesai ? 'Disetujui admin' : this.ditolak ? 'Ditolak admin' : 'Menunggu verifikasi',
          waktu: this.$store.state.topup.waktuDiproses,
          keterangan: this.selesai || this.ditolak ? 'Sudah diproses' : 'Menunggu admin memeriksa',
          dot: warnaAkhir,
          line: 'transparent',
          fg: (this.selesai || this.ditolak) ? 'var(--ink)' : 'var(--muted)'
        }
      ]
    }
  },
  async mounted() {
    this.error = ''
    const id = Number(this.$route.query.id || this.$store.state.topup.id)
    if (id) this.$store.commit('topup/setId', id)
    await this.periksa(id)
    // poll ringan tiap 4 detik selama masih menunggu, berhenti sendiri kalau sudah diproses
    this._timer = setInterval(() => {
      if (this.$store.state.topup.status === 'menunggu') this.periksa()
      else clearInterval(this._timer)
    }, 4000)
  },
  beforeDestroy() {
    if (this._timer) clearInterval(this._timer)
  },
  methods: {
    formatWaktu(waktu) {
      const tanggal = new Date(waktu)
      if (Number.isNaN(tanggal.getTime())) return 'Waktu tidak tersedia'
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      }).format(tanggal)
    },
    async periksa(id) {
      this.memeriksa = true
      this.error = ''
      try {
        const topup = await this.$store.dispatch('topup/refreshStatus', id)
        if (topup && topup.status === 'disetujui') {
          await this.$store.dispatch('ortu/muatAnak')
          await this.$store.dispatch('ortu/muatRiwayat', topup.siswa_id)
          if (topup.tagihan_id) {
            await this.$store.dispatch('ortu/muatTagihan', topup.siswa_id)
            await this.$store.dispatch('ortu/muatPembayaran')
          }
        }
      } catch (e) {
        this.error = e.message || 'Status pembayaran belum dapat diperiksa.'
      } finally {
        this.memeriksa = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 16px; }

.status { padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.status--ok { border-color: var(--green); }
.status--bad { border-color: var(--coral); }
.status__ik {
  width: 56px; height: 56px; border-radius: var(--r-pill);
  background: rgba(192,169,127,.22);
  display: flex; align-items: center; justify-content: center;
}
.status--ok .status__ik { background: rgba(26,128,64,.12); }
.status--bad .status__ik { background: rgba(223,74,55,.1); }
.status__judul { font: 700 17px var(--font-display); text-align: center; }
.status__pesan { margin: 0; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); text-align: center; max-width: 270px; text-wrap: pretty; }
.status__nominal { font: 800 26px var(--font-display); letter-spacing: -.02em; }
.status__nominal.is-ok { color: var(--green); }
.status__nominal.is-bad { color: var(--coral); text-decoration: line-through; text-decoration-color: rgba(223,74,55,.4); }

.lini { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.lini__judul { font: 700 13px var(--font-display); }
.lini__item { display: flex; gap: 12px; align-items: flex-start; }
.lini__rail { width: 18px; display: flex; flex-direction: column; align-items: center; flex: none; }
.dot { width: 10px; height: 10px; border-radius: var(--r-pill); margin-top: 3px; }
.line { width: 2px; height: 22px; }
.lini__t { font: 600 13px var(--font-body); }
.lini__w { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 1px; }

.rincian { padding: 16px; display: flex; flex-direction: column; gap: 9px; }
.rincian div { display: flex; justify-content: space-between; }
.rincian span { font: 400 12.5px var(--font-body); color: var(--muted); }
.rincian b { font: 600 12.5px var(--font-body); }

.error { margin: 0; color: var(--coral); font: 500 12px var(--font-body); text-align: center; }
.spacer { flex: 1; }
</style>
