<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Detail transaksi" :to="kembali" />
    <div class="body">
      <div v-if="memuat" class="state">Memuat detail transaksi…</div>
      <div v-else-if="error" class="state error" role="alert">{{ error }}</div>
      <template v-else-if="ledger">
        <StrukCard :struk="strukLedger" />
        <button type="button" class="unduh" :disabled="mengunduh" @click="unduh">{{ mengunduh ? 'Menyiapkan PDF…' : 'Unduh struk (PDF)' }}</button>
        <p v-if="pesanUnduh" class="error note" role="alert">{{ pesanUnduh }}</p>
      </template>
      <template v-else-if="pembayaran">
        <StrukCard :struk="strukBayar" />
        <section v-if="pembayaran.bukti_tersedia" class="card proof">
          <h2 class="display">Bukti transfer</h2>
          <p v-if="proofError" class="error" role="alert">{{ proofError }}</p>
          <button v-else-if="proof" type="button" class="proof__open" aria-label="Buka bukti transfer layar penuh" @click="viewerTerbuka = true">
            <img :src="proof" alt="Bukti transfer yang diunggah; tekan untuk memperbesar" />
            <span>Lihat gambar layar penuh</span>
          </button>
          <p v-else>Memuat bukti…</p>
        </section>
        <p v-else class="note">Bukti transfer belum tersedia.</p>
        <button type="button" class="unduh" :disabled="mengunduh" @click="unduh">{{ mengunduh ? 'Menyiapkan PDF…' : 'Unduh struk (PDF)' }}</button>
        <p v-if="pesanUnduh" class="error note" role="alert">{{ pesanUnduh }}</p>
      </template>
      <div v-else class="state">Detail transaksi tidak ditemukan.</div>
    </div>
    <ImageLightbox
      v-if="viewerTerbuka && proof"
      :src="proof"
      alt="Bukti transfer yang diunggah"
      @close="viewerTerbuka = false"
    />
  </div>
</template>

<script>
import { api } from '~/utils/api'
import { trxDariLedger } from '~/utils/adapt'
import { unduhStrukPdf, susunStruk, susunStrukPembayaran } from '~/utils/struk-pdf'

export default {


  data() { return { memuat: true, error: '', proofError: '', ledger: null, struk: null, mengunduh: false, pesanUnduh: '', pembayaran: null, proof: '', viewerTerbuka: false, refreshTimer: null, sedangRefresh: false } },
  computed: {
    kembali() {
      return this.$route.query.jenis === 'ledger'
        ? '/ortu/riwayat?anak=' + encodeURIComponent(this.$route.query.anak || '')
        : '/ortu/riwayat'
    },
    dataLedger() {
      const l = this.ledger
      if (!l) return null
      return this.struk || {
        id: l.id, nomor: 'TRX-' + l.id, tipe: l.tipe, nominal: Number(l.nominal), masuk: Number(l.nominal) > 0,
        keterangan: l.keterangan, items: [], waktu: l.created_at, oleh: l.oleh_nama, outlet: null,
        status: 'berhasil', alasan_batal: null,
        saldo_sebelum: Number(l.sisa) - Number(l.nominal), saldo_sesudah: Number(l.sisa),
        siswa: { nama: this.anakNama, kelas: '', nis: '' }
      }
    },
    strukLedger() { return susunStruk(this.dataLedger, this.$rp, this.$waktu) },
    strukBayar() { return susunStrukPembayaran(this.pembayaran, this.$rp, this.$waktu) },
    trx() { return this.ledger ? trxDariLedger(this.ledger) : null },
    jam() { return this.trx ? this.trx.meta.split(' · ')[0] : '' },
    anakNama() {
      const anak = this.$store.state.ortu.anak.find((a) => Number(a.id) === Number(this.ledger && this.ledger.siswaId))
      return anak ? anak.nama : 'Siswa'
    }
  },
  async mounted() {
    await this.muat()
    if (this.pembayaran) {
      this.refreshTimer = window.setInterval(() => {
        if (!document.hidden) this.refreshPembayaran()
      }, 5000)
      document.addEventListener('visibilitychange', this.saatVisibilitasBerubah)
    }
  },
  beforeDestroy() {
    window.clearInterval(this.refreshTimer)
    document.removeEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  methods: {
    async unduh() {
      this.pesanUnduh = ''; this.mengunduh = true
      try { await unduhStrukPdf(this.ledger ? this.strukLedger : this.strukBayar) }
      catch (e) { this.pesanUnduh = 'Gagal membuat PDF. Coba lagi.' }
      finally { this.mengunduh = false }
    },
    saatVisibilitasBerubah() {
      if (!document.hidden) this.refreshPembayaran()
    },
    async refreshPembayaran() {
      if (this.sedangRefresh || !this.pembayaran) return
      this.sedangRefresh = true
      try {
        const response = await api.statusTopup(this.pembayaran.id)
        const next = response.topup
        const buktiBerubah = next.bukti_tersedia && (
          !this.pembayaran.bukti_tersedia ||
          next.bukti_diunggah_at !== this.pembayaran.bukti_diunggah_at
        )
        this.pembayaran = next
        if (!next.bukti_tersedia) {
          this.proof = ''
          this.proofError = ''
        } else if (buktiBerubah || !this.proof) {
          try {
            const bukti = await api.buktiTopup(next.id)
            this.proof = bukti.data_url
            this.proofError = ''
          } catch (error) {
            this.proofError = error.message || 'Bukti transfer tidak dapat dimuat.'
          }
        }
      } catch (error) {
        this.proofError = error.message || 'Status pembayaran tidak dapat diperbarui.'
      } finally {
        this.sedangRefresh = false
      }
    },
    async muat() {
      this.memuat = true; this.error = ''; this.proofError = ''
      try {
        if (this.$route.query.jenis === 'ledger') {
          const siswaId = Number(this.$route.query.anak)
          const trxId = Number(this.$route.query.id)
          if (!Number.isSafeInteger(siswaId) || siswaId <= 0 || !Number.isSafeInteger(trxId) || trxId <= 0) throw new Error('Referensi transaksi tidak valid.')
          await this.$store.dispatch('ortu/muatAnak')
          const anak = this.$store.state.ortu.anak.find((a) => Number(a.id) === siswaId)
          if (!anak) throw new Error('Transaksi tidak ditemukan atau bukan milik anak pada akun ini.')
          await this.$store.dispatch('ortu/muatRiwayat', siswaId)
          const row = (this.$store.state.ortu.riwayat[siswaId] || []).find((r) => Number(r.id) === trxId)
          if (!row) throw new Error('Transaksi tidak ditemukan.')
          this.ledger = Object.assign({}, row, { siswaId })
          try { this.struk = (await api.strukSiswa(siswaId, trxId)).struk } catch (e) { this.struk = null }
        } else if (this.$route.query.jenis === 'pembayaran') {
          const id = Number(this.$route.query.id)
          if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Referensi pembayaran tidak valid.')
          const hasil = await api.statusTopup(id)
          this.pembayaran = hasil.topup
          if (!this.pembayaran) throw new Error('Detail pembayaran tidak ditemukan.')
          if (this.pembayaran.bukti_tersedia) {
            try {
              const bukti = await api.buktiTopup(id)
              this.proof = bukti.data_url
            } catch (e) { this.proofError = e.message || 'Bukti transfer tidak dapat dimuat.' }
          }
        } else {
          throw new Error('Jenis transaksi tidak valid.')
        }
      } catch (e) { this.error = e.message || 'Detail transaksi gagal dimuat.' }
      finally { this.memuat = false }
    }
  }
}
</script>

<style scoped>
.wrap { flex:1; display:flex; flex-direction:column; min-height:0; background:var(--bg); }
.body { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:14px; }
.state { padding:32px 18px; text-align:center; color:var(--muted); font:500 13px/1.5 var(--font-body); }
.error { color:var(--coral); }
.hero { padding:22px; display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--muted); font:400 12px var(--font-body); }
.label { color:var(--ink); font:700 14px var(--font-display); }
.nominal { color:var(--ink); font-size:28px; }
.detail { padding:16px; display:flex; flex-direction:column; gap:12px; }
.detail div { display:flex; justify-content:space-between; gap:16px; font:400 12.5px/1.45 var(--font-body); }
.detail span { flex:none; color:var(--muted); }
.detail b { text-align:right; font-weight:600; overflow-wrap:anywhere; }
.proof { padding:16px; }
.proof h2 { margin:0 0 12px; font-size:15px; }
.proof__open { display:flex; width:100%; flex-direction:column; align-items:center; gap:8px; padding:10px; border:0; border-radius:var(--r-sm); background:var(--bg); color:var(--blue); cursor:zoom-in; font:500 12px var(--font-body); }
.proof__open img { display:block; max-width:100%; max-height:480px; margin:auto; object-fit:contain; }
.proof p,.note { color:var(--muted); font:400 12px/1.5 var(--font-body); }
.note { margin:0; text-align:center; }
.unduh { border:0; border-radius:var(--r-md); background:var(--blue); color:#fff; padding:14px; font:700 14px var(--font-body); cursor:pointer; }
.unduh:disabled { opacity:.6; cursor:wait; }
.rincian-judul { display:block !important; }
</style>
