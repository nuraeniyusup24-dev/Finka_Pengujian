<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Detail Tagihan" to="/ortu/tagihan" />
    <div v-if="!bill" class="body"><div class="muat">Memuat…</div></div>
    <div v-else class="body">
      <div class="head">
        <div class="periode">{{ bill.anakNama }}</div>
        <div class="nama display">{{ bill.nama }}</div>
        <div class="nominal display num">{{ bill.nominal | rp }}</div>
      </div>

      <div class="card rincian">
        <div><span>Siswa</span><b>{{ bill.anakNama }}</b></div>
        <div><span>Jatuh tempo</span><b class="due">{{ tanggalIndo(bill.jatuh_tempo) }}</b></div>
        <div><span>Status</span><b>{{ bill.status === 'lunas' ? 'Lunas' : 'Belum Bayar' }}</b></div>
      </div>

      <div class="cara">
        <div class="cara__judul display">Cara bayar</div>
        <p>Transfer ke rekening yayasan dengan nominal berkode unik, lalu unggah bukti. Tagihan menjadi lunas setelah admin memverifikasi — tidak memotong saldo saku.</p>
      </div>

      <div class="spacer"></div>
      <button v-if="bill.status !== 'lunas' && !pembayaranPending" class="btn btn--primary" @click="bayar">Bayar tagihan ini</button>
      <div v-else-if="pembayaranPending" class="pending-note">Pembayaran tagihan ini sedang menunggu verifikasi admin.</div>
      <div v-else class="lunas-note">Tagihan ini sudah lunas.</div>
      <button v-if="bill.status === 'lunas'" class="btn btn--invoice" :disabled="mengunduhInvoice" @click="unduhInvoice">
        {{ mengunduhInvoice ? 'Menyiapkan invoice…' : 'Unduh invoice pembayaran (PDF)' }}
      </button>
      <p v-if="invoiceError" class="invoice-error" role="alert">{{ invoiceError }}</p>
    </div>
  </div>
</template>

<script>
import { tanggalIndo } from '~/utils/adapt'

export default {

  data() {
    return {
      mengunduhInvoice: false,
      invoiceError: ''
    }
  },

  computed: {
    bill() {
      return this.$store.getters['ortu/tagihanSemua'].find((t) => String(t.id) === this.$route.params.id)
    },
    pembayaranPending() {
      return this.$store.state.ortu.riwayatPembayaran.some(
        (r) => Number(r.tagihan_id) === Number(this.$route.params.id) && r.status === 'menunggu'
      )
    },
    pembayaranTerverifikasi() {
      return this.$store.state.ortu.riwayatPembayaran.find(
        (r) => Number(r.tagihan_id) === Number(this.$route.params.id) && r.status === 'disetujui'
      ) || null
    }
  },
  async mounted() {
    await this.$store.dispatch('ortu/muatAnak')
    const anak = this.$store.state.ortu.anak
    await Promise.all(anak.map((a) => this.$store.dispatch('ortu/muatTagihan', a.id)))
    await this.$store.dispatch('ortu/muatPembayaran')
  },
  methods: {
    tanggalIndo,
    bayar() {
      this.$store.commit('topup/reset')
      this.$store.commit('ortu/setAnakAktif', this.bill.siswa_id)
      this.$store.commit('topup/setNominal', this.bill.nominal)
      this.$store.commit('topup/setTagihan', this.bill.id)
      this.$router.push('/ortu/isi-saldo')
    },
    async unduhInvoice() {
      if (!this.bill || this.bill.status !== 'lunas' || this.mengunduhInvoice) return
      this.mengunduhInvoice = true
      this.invoiceError = ''
      try {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({ unit: 'mm', format: 'a4' })
        const payment = this.pembayaranTerverifikasi
        const invoiceNumber = `INV-SPP-${String(this.bill.id).padStart(6, '0')}`
        const paidAt = payment?.diproses_at || payment?.waktu
        const paidDate = paidAt
          ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(paidAt))
          : 'Terverifikasi oleh Admin'

        doc.setFillColor(36, 49, 196)
        doc.roundedRect(15, 15, 180, 39, 4, 4, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.text('FINKA', 24, 29)
        doc.setFontSize(10)
        doc.text('INVOICE PEMBAYARAN', 24, 39)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceNumber, 186, 31, { align: 'right' })

        doc.setTextColor(27, 35, 57)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('Pembayaran terverifikasi', 20, 72)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(101, 111, 130)
        doc.text('Invoice ini diterbitkan setelah pembayaran dikonfirmasi oleh admin.', 20, 80)

        const details = [
          ['Nama tagihan', this.bill.nama],
          ['Nama siswa', this.bill.anakNama || '-'],
          ['Nominal dibayar', this.$rp(this.bill.nominal)],
          ['Jatuh tempo', tanggalIndo(this.bill.jatuh_tempo)],
          ['Tanggal verifikasi', paidDate],
          ['Status', 'LUNAS']
        ]
        let y = 101
        for (const [label, value] of details) {
          doc.setDrawColor(229, 232, 240)
          doc.line(20, y - 6, 190, y - 6)
          doc.setTextColor(101, 111, 130)
          doc.text(label, 20, y)
          doc.setTextColor(27, 35, 57)
          doc.setFont('helvetica', 'bold')
          doc.text(String(value || '-'), 190, y, { align: 'right', maxWidth: 105 })
          doc.setFont('helvetica', 'normal')
          y += 14
        }
        doc.setDrawColor(229, 232, 240)
        doc.line(20, y - 6, 190, y - 6)
        doc.setTextColor(101, 111, 130)
        doc.setFontSize(9)
        doc.text('Simpan invoice ini sebagai bukti pembayaran yang telah diverifikasi.', 20, y + 8)
        doc.save(`${invoiceNumber}.pdf`)
      } catch (error) {
        this.invoiceError = error.message || 'Invoice tidak dapat dibuat. Silakan coba kembali.'
      } finally {
        this.mengunduhInvoice = false
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.muat { padding: 40px 20px; text-align: center; font: 500 13px var(--font-body); color: var(--muted); }
.head { display: flex; flex-direction: column; gap: 6px; }
.periode { font: 600 12px var(--font-body); color: var(--muted); }
.nama { font: 700 19px var(--font-display); }
.nominal { font: 800 32px var(--font-display); letter-spacing: -.02em; margin-top: 6px; }

.rincian { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.rincian div { display: flex; justify-content: space-between; }
.rincian span { font: 400 12.5px var(--font-body); color: var(--muted); }
.rincian b { font: 600 12.5px var(--font-body); }
.due { color: var(--coral); }

.cara { background: var(--blue-soft); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.cara__judul { font: 700 12.5px var(--font-display); }
.cara p { margin: 0; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); text-wrap: pretty; }
.spacer { flex: 1; }
.pending-note { text-align: center; font: 500 13px var(--font-body); color: var(--sand-ink); padding: 13px; background: rgba(192,169,127,.12); border-radius: var(--r-sm); }
.lunas-note { text-align: center; font: 500 13px var(--font-body); color: var(--green); padding: 13px; background: rgba(26,128,64,.08); border-radius: var(--r-sm); }
.btn--invoice { border: 1px solid var(--blue); background: #fff; color: var(--blue); font-weight: 700; }
.btn--invoice:disabled { opacity: .6; cursor: wait; }
.invoice-error { margin: 0; color: var(--coral); text-align: center; font: 500 12px/1.5 var(--font-body); }
</style>
