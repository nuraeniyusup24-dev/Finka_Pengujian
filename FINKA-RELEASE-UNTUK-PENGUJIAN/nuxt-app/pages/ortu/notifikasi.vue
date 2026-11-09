<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader class="notif__screen-header" title="Notifikasi" to="/ortu" />
    <div class="body">
      <p class="catatan">Notifikasi terbaru akun dan transaksi.</p>
      <div v-if="error" class="kosong error" role="alert">{{ error }} <button type="button" @click="muat">Coba lagi</button></div>
      <div v-else-if="memuat" class="kosong">Memuat notifikasi…</div>
      <div v-else-if="!semuaNotifikasi.length" class="kosong">Tidak ada tagihan mendesak atau status pembayaran baru.</div>
      <template v-else>
      <article v-for="n in semuaNotifikasi" :key="String(n.tipe) + ':' + String(n.id) + ':' + String(n.siswa_id || n.anakId || '')" class="card notif" :class="n.prioritas === 1 || n.status === 'ditolak' ? 'notif--penting' : ''">
        <button v-if="bisaBukaStruk(n)" type="button" class="notif__summary notif__summary--button" @click="bukaStruk(n)">
          <span class="notif__dot" aria-hidden="true"></span>
          <span class="notif__content">
            <span class="notif__head">
              <span class="notif__judul display">{{ n.judul }}</span>
              <time class="notif__waktu">{{ n.waktu | waktu }}</time>
            </span>
            <span class="notif__preview">{{ n.isi }}</span>
            <span class="notif__lebih">Ketuk untuk melihat struk digital</span>
          </span>
        </button>
        <details v-else class="notif__details">
          <summary class="notif__summary">
            <span class="notif__dot" aria-hidden="true"></span>
            <span class="notif__content">
              <span class="notif__head">
                <span class="notif__judul display">{{ n.judul }}</span>
                <time class="notif__waktu">{{ n.waktu | waktu }}</time>
              </span>
              <span class="notif__preview">{{ n.isi }}</span>
              <span class="notif__lebih">Lihat pesan lengkap</span>
            </span>
          </summary>
          <p class="notif__lengkap">{{ n.isi }}</p>
          <div class="notif__actions">
            <nuxt-link v-if="n.tagihan_id" :to="'/ortu/tagihan/' + n.tagihan_id" class="notif__link">Lihat tagihan</nuxt-link>
          </div>
        </details>
      </article>
      </template>
    </div>
    <OrtuTabBar />
    <DigitalReceiptModal
      :receipt="struk"
      :loading="memuatStruk"
      :error="errorStruk"
      :proof="buktiTransfer"
      :proof-error="errorBukti"
      @close="tutupStruk"
    />
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() {
    return {
      memuat: true, error: '', timer: null, sedangMuat: false,
      struk: null, memuatStruk: false, errorStruk: '', buktiTransfer: '', errorBukti: ''
    }
  },
  async mounted() {
    await this.muat()
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.muat()
    }, 30000)
    document.addEventListener('visibilitychange', this.saatTerlihat)
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
    document.removeEventListener('visibilitychange', this.saatTerlihat)
  },
  computed: {
    semuaNotifikasi() { return this.$store.getters['ortu/semuaNotifikasi'] },
  },
  methods: {
    saatTerlihat() { if (document.visibilityState === 'visible') this.muat() },
    bisaBukaStruk(n) { return String(n.tipe || '').startsWith('pembayaran_') },
    tutupStruk() {
      this.struk = null
      this.memuatStruk = false
      this.errorStruk = ''
      this.buktiTransfer = ''
      this.errorBukti = ''
    },
    async bukaStruk(n) {
      this.struk = null
      this.memuatStruk = true
      this.errorStruk = ''
      this.buktiTransfer = ''
      this.errorBukti = ''
      try {
        if (String(n.id).startsWith('ledger-')) {
          const ledgerId = Number(String(n.id).slice(7))
          const siswaId = Number(n.siswa_id)
          if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0 || !Number.isSafeInteger(siswaId) || siswaId <= 0) {
            throw new Error('Referensi pembayaran tidak valid.')
          }
          const { riwayat } = await api.riwayat(siswaId)
          const row = (riwayat || []).find((item) => Number(item.id) === ledgerId)
          if (!row) throw new Error('Detail pembayaran tidak ditemukan.')
          this.struk = {
            title: n.judul,
            amount: Math.abs(Number(row.nominal)),
            date: row.created_at,
            status: 'Sudah diproses',
            tone: 'ok',
            proofMessage: 'Pembayaran dilakukan dari saldo FINKA; tidak ada bukti transfer terpisah.',
            details: [
              { label: 'Siswa', value: n.isi.split(':')[0] },
              { label: 'Keterangan', value: row.keterangan || 'Pembayaran tagihan' },
              { label: 'ID transaksi', value: 'TRX-' + row.id },
              { label: 'Status verifikasi', value: 'Pembayaran sudah diproses' },
              ...(row.oleh_nama ? [{ label: 'Diproses oleh', value: row.oleh_nama }] : [])
            ]
          }
          return
        }

        const id = Number(n.id)
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Referensi pembayaran tidak valid.')
        const { topup } = await api.statusTopup(id)
        if (!topup) throw new Error('Detail pembayaran tidak ditemukan.')
        const status = topup.status === 'disetujui'
          ? 'Terverifikasi'
          : topup.status === 'ditolak'
            ? 'Ditolak'
            : 'Menunggu verifikasi'
        const details = [
          { label: 'Siswa', value: topup.siswa },
          { label: 'Jenis', value: topup.tujuan || 'Pembayaran' },
          { label: 'ID permintaan', value: 'TU-' + topup.id },
          { label: 'Status verifikasi', value: status },
          { label: 'Nominal', value: this.$rp(topup.nominal) }
        ]
        if (topup.kode_unik) details.push({ label: 'Kode unik', value: topup.kode_unik })
        if (topup.diproses_at) details.push({ label: 'Waktu diproses', value: String(topup.diproses_at) })
        if (topup.alasan_tolak) details.push({ label: 'Alasan penolakan', value: topup.alasan_tolak })
        this.struk = {
          title: topup.tujuan || 'Pembayaran',
          amount: topup.total_transfer || Number(topup.nominal) + Number(topup.kode_unik || 0),
          date: topup.waktu,
          status,
          tone: topup.status === 'disetujui' ? 'ok' : topup.status === 'ditolak' ? 'bad' : 'wait',
          proofAvailable: topup.bukti_tersedia,
          proofMessage: 'Bukti transfer belum diunggah.',
          details
        }
        if (topup.bukti_tersedia) {
          try {
            const proof = await api.buktiTopup(id)
            this.buktiTransfer = proof.data_url
          } catch (error) {
            this.errorBukti = error.message || 'Bukti transfer tidak dapat dimuat.'
          }
        }
      } catch (error) {
        this.errorStruk = error.message || 'Struk digital gagal dimuat.'
      } finally {
        this.memuatStruk = false
      }
    },
    async muat() {
      if (this.sedangMuat) return
      this.sedangMuat = true
      this.error = ''
      try {
        await this.$store.dispatch('ortu/muatAnak')
        const anak = this.$store.state.ortu.anak
        await Promise.all(anak.map((a) => this.$store.dispatch('ortu/muatTagihan', a.id)))
        await this.$store.dispatch('ortu/muatPembayaran')
      } catch (e) {
        this.error = e.message || 'Notifikasi gagal dimuat.'
      } finally {
        this.sedangMuat = false
        this.memuat = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-height: 0; }
.notif__screen-header { padding: 8px 16px 10px; gap: 10px; }
.body { flex: 1; overflow-y: auto; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 5px; }
.kosong { margin: 14px 0; padding: 18px 14px; text-align: center; color: var(--muted); font: 500 12px/1.45 var(--font-body); }
.catatan { margin: 0 2px 3px; color: var(--muted); font: 400 10px/1.4 var(--font-body); }
.error { color: var(--coral); }
.error button { border: 0; background: transparent; color: var(--blue); font: 700 12px var(--font-body); cursor: pointer; }
.notif { min-height: 0; padding: 0; overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: none; }
.notif--penting { background: #fcfdff; }
.notif__details { margin:0; }
.notif__summary { width:100%; box-sizing:border-box; list-style: none; display: grid; grid-template-columns: 6px minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px 10px; cursor: pointer; text-align:left; }
.notif__summary--button { border:0; background:transparent; color:inherit; font:inherit; }
.notif__summary::-webkit-details-marker { display: none; }
.notif__dot { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: #aab3c0; }
.notif--penting .notif__dot { background: var(--blue); }
.notif__content { display: block; min-width: 0; }
.notif__head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 3px 8px; }
.notif__judul { min-width: 0; color: var(--ink); font: 700 12px/1.35 var(--font-display); overflow-wrap: anywhere; }
.notif__waktu { color: var(--muted); font: 400 10px/1.4 var(--font-body); text-align: right; white-space: nowrap; }
.notif__preview { display: -webkit-box; margin-top: 3px; overflow: hidden; color: var(--muted); font: 400 11px/1.4 var(--font-body); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.notif__lebih { display: inline-block; margin-top: 3px; color: var(--muted); font: 500 10px/1.3 var(--font-body); text-decoration: underline; text-decoration-color: #cbd2dc; text-underline-offset: 2px; }
.notif__details[open] .notif__preview, .notif__details[open] .notif__lebih { display: none; }
.notif__lengkap { margin: 0; padding: 8px 11px 10px 26px; border-top: 1px solid var(--bg); color: var(--muted); font: 400 11px/1.45 var(--font-body); overflow-wrap: anywhere; }
.notif__actions { padding: 0 11px 9px 26px; }
.notif__link { color: var(--blue); font: 600 11px var(--font-body); text-decoration: none; }
.notif__link:hover { text-decoration: underline; }
.notif__summary:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
@media (max-width: 360px) {
  .body { padding: 10px 11px 14px; gap: 6px; }
  .notif__summary { padding: 9px 10px; gap: 8px; }
  .notif__head { grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .notif__waktu { text-align: left; }
  .notif__lengkap { padding-left: 24px; }
}
</style>
