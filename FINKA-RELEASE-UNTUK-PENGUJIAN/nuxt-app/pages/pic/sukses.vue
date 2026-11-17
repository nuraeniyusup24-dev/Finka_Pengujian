<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div class="wrap">
    <div class="stage">
      <div class="cek">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </div>
      <div class="judul display">{{ tunai ? 'Penarikan berhasil' : 'Transaksi berhasil' }}</div>
      <div class="nominal display num">{{ total | rp }}</div>
      <div v-if="tunai" class="serahkan display">Serahkan uang tunai {{ total | rp }}</div>

      <div class="rincian">
        <div><span>Siswa</span><b>{{ nama }}</b></div>
        <div v-if="tunai"><span>Metode</span><b>Tunai dari saldo</b></div>
        <div><span>Saldo sebelum</span><b class="num">{{ sebelum | rp }}</b></div>
        <div><span>Sisa saldo</span><b class="display num is-ok">{{ sisa | rp }}</b></div>
        <div><span>ID transaksi</span><b class="num">{{ idTrx }}</b></div>
      </div>

      <div class="note">
        <i></i>
        <span>Struk terkirim ke siswa dan orang tua</span>
      </div>
    </div>
    <div class="aksi">
      <p v-if="pdfError" class="pdf-error" role="alert">{{ pdfError }}</p>
      <div class="aksi__baris">
        <button type="button" class="btn btn--ghost cetak" :disabled="!!menyiapkan" @click="cetak">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M6 14h12v7H6z" /></svg>
          {{ menyiapkan === 'cetak' ? 'Menyiapkan…' : 'Cetak struk' }}
        </button>
        <button type="button" class="btn btn--ghost cetak" :disabled="!!menyiapkan" @click="unduh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          {{ menyiapkan === 'unduh' ? 'Menyiapkan…' : 'Unduh PDF' }}
        </button>
      </div>
      <button class="btn btn--primary" @click="lagi">Transaksi berikutnya</button>
    </div>
  </div>
</template>

<script>
import { buatStrukPdf, namaFileStruk, cetakStrukHtml } from '~/utils/strukPdf'

export default {

  data() {
    return { snapshot: null, idTrx: '', menyiapkan: '', pdfError: '' }
  },
  computed: {
    tunai() { return this.snapshot ? this.snapshot.tunai : false },
    total() { return this.snapshot ? this.snapshot.total : 0 },
    nama() { return this.snapshot ? this.snapshot.nama : '' },
    sisa() { return this.snapshot ? this.snapshot.sisa : 0 },
    sebelum() { return this.snapshot ? this.snapshot.sebelum : 0 }
  },
  created() {
    const result = this.$store.state.pos.transactionResult
    if (!result) return
    this.idTrx = 'TRX-' + result.ledgerId
    this.snapshot = {
      tunai: result.tunai,
      total: result.total,
      nama: result.nama + (result.kelas ? ' · ' + result.kelas : ''),
      namaSiswa: result.nama,
      kelas: result.kelas || '',
      nis: result.nis || '',
      sisa: result.saldoBaru,
      sebelum: result.saldoSebelum,
      items: result.items,
      outlet: result.outlet,
      kasir: result.kasir,
      waktu: result.waktuIso || result.waktu
    }
  },
  mounted() {
    if (!this.snapshot) this.$router.replace('/pic')
  },
  methods: {
    dataStruk() {
      const sn = this.snapshot
      return {
        idTrx: this.idTrx,
        tunai: sn.tunai,
        total: sn.total,
        namaSiswa: sn.namaSiswa,
        kelas: sn.kelas,
        nis: sn.nis,
        items: (sn.items || []).map((it) => ({
          nama: it.nama || it.label,
          qty: it.qty || 1,
          harga: it.harga
        })),
        outlet: sn.outlet,
        kasir: sn.kasir,
        waktu: sn.waktu,
        sebelum: sn.sebelum,
        sisa: sn.sisa
      }
    },
    // Dialog cetak browser langsung terbuka berisi struk 80 mm (dicetak dari iframe tersembunyi).
    // Jika browser menolak mencetak, struk diunduh sebagai PDF.
    async cetak() {
      if (!this.snapshot || this.menyiapkan) return
      this.menyiapkan = 'cetak'
      this.pdfError = ''
      try {
        const tercetak = await cetakStrukHtml(this.dataStruk())
        if (!tercetak) {
          const doc = await buatStrukPdf(this.dataStruk())
          doc.save(namaFileStruk(this.idTrx))
          this.pdfError = 'Dialog cetak tidak bisa dibuka di browser ini, jadi struk diunduh sebagai PDF.'
        }
      } catch (e) {
        this.pdfError = 'Struk gagal disiapkan. Coba lagi atau unduh PDF.'
      } finally {
        this.menyiapkan = ''
      }
    },
    async unduh() {
      if (!this.snapshot || this.menyiapkan) return
      this.menyiapkan = 'unduh'
      this.pdfError = ''
      try {
        const doc = await buatStrukPdf(this.dataStruk())
        doc.save(namaFileStruk(this.idTrx))
      } catch (e) {
        this.pdfError = 'PDF struk gagal dibuat. Coba lagi.'
      } finally {
        this.menyiapkan = ''
      }
    },
    lagi() {
      this.$store.commit('pos/reset')
      this.$router.push('/pic')
    }
  }
}
</script>

<style scoped>
.aksi { display: flex; flex-direction: column; gap: 10px; }
.aksi__baris { display: flex; gap: 10px; }
.aksi__baris .cetak { flex: 1; }
.pdf-error { margin: 0; text-align: center; font: 500 12px var(--font-body); color: var(--coral); }
.cetak:disabled { opacity: .6; cursor: wait; }
.cetak { display: flex; align-items: center; justify-content: center; gap: 9px; border: 1.5px solid var(--blue); color: var(--blue); background: #fff; }
.cetak:hover { background: var(--blue-soft); }
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; padding: 26px 22px; min-height: 0; overflow-y: auto; }
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
.cek { width: 74px; height: 74px; border-radius: var(--r-pill); background: rgba(26,128,64,.12); display: flex; align-items: center; justify-content: center; }
.judul { font: 700 21px var(--font-display); }
.nominal { font: 800 34px var(--font-display); letter-spacing: -.03em; }
.serahkan { background: var(--sand); color: var(--navy); font: 700 13px var(--font-display); padding: 10px 16px; border-radius: var(--r-pill); }

.rincian { width: 100%; background: var(--bg); border-radius: var(--r-md); padding: 18px; display: flex; flex-direction: column; gap: 11px; }
.rincian div { display: flex; justify-content: space-between; gap: 12px; }
.rincian span { font: 400 12.5px var(--font-body); color: var(--muted); }
.rincian b { font: 600 12.5px var(--font-body); }
.rincian b.is-ok { font: 700 14px var(--font-display); color: var(--green); }

.note { display: flex; align-items: center; gap: 8px; font: 400 12px var(--font-body); color: var(--muted); }
.note i { width: 6px; height: 6px; border-radius: var(--r-pill); background: var(--green); }

</style>