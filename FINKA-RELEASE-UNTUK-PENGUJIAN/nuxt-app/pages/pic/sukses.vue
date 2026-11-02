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
      <button type="button" class="btn btn--ghost cetak" @click="cetak">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M6 14h12v7H6z" /></svg>
        Cetak struk
      </button>
      <button class="btn btn--primary" @click="lagi">Transaksi berikutnya</button>
    </div>

    <!-- Struk thermal 58 mm: hanya tampil saat dicetak -->
    <div v-if="snapshot" class="print-struk">
      <header class="struk-brand">
        <div class="struk-logo">FINKA</div>
        <div class="struk-tagline">PEMBAYARAN SEKOLAH DIGITAL</div>
        <div>{{ snapshot.outlet }}</div>
        <div>Kasir: {{ snapshot.kasir }}</div>
      </header>
      <div class="struk-separator"></div>
      <div class="struk-meta"><span>No. transaksi</span><b>{{ idTrx }}</b></div>
      <div class="struk-meta"><span>Waktu</span><b>{{ snapshot.waktu }}</b></div>
      <div class="struk-meta"><span>Siswa</span><b>{{ snapshot.nama }}</b></div>
      <div class="struk-separator"></div>
      <div class="struk-section-title">{{ tunai ? 'PENARIKAN TUNAI' : 'RINCIAN BELANJA' }}</div>
      <div v-for="(it, i) in snapshot.items" :key="i" class="struk-item">
        <span>{{ it.label }}</span>
        <b>{{ it.harga | rp }}</b>
      </div>
      <div class="struk-separator"></div>
      <div class="struk-total"><span>TOTAL</span><b>{{ total | rp }}</b></div>
      <div v-if="tunai" class="struk-meta"><span>Tunai diserahkan</span><b>{{ total | rp }}</b></div>
      <div class="struk-meta"><span>Saldo sebelum</span><b>{{ sebelum | rp }}</b></div>
      <div class="struk-meta"><span>Sisa saldo</span><b>{{ sisa | rp }}</b></div>
      <div class="struk-separator"></div>
      <footer class="struk-footer">
        <b>TRANSAKSI BERHASIL</b>
        <div>Terima kasih telah menggunakan Finka.</div>
        <div>Simpan struk ini sebagai bukti transaksi.</div>
      </footer>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return { snapshot: null, idTrx: '' }
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
      sisa: result.saldoBaru,
      sebelum: result.saldoSebelum,
      items: result.items,
      outlet: result.outlet,
      kasir: result.kasir,
      waktu: result.waktu
    }
  },
  mounted() {
    if (!this.snapshot) this.$router.replace('/pic')
  },
  methods: {
    cetak() { window.print() },
    lagi() {
      this.$store.commit('pos/reset')
      this.$router.push('/pic')
    }
  }
}
</script>

<style scoped>
.aksi { display: flex; flex-direction: column; gap: 10px; }
.cetak { display: flex; align-items: center; justify-content: center; gap: 9px; border: 1.5px solid var(--blue); color: var(--blue); background: #fff; }
.cetak:hover { background: var(--blue-soft); }
.print-struk { display: none; }
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

.struk-brand, .struk-footer { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; }
.struk-logo { font: 800 25px/1 var(--font-display); letter-spacing: .12em; }
.struk-tagline { margin: 3px 0 7px; font: 700 8px var(--font-body); letter-spacing: .12em; }
.struk-separator { border-top: 1px dashed #555; margin: 10px 0; }
.struk-meta, .struk-total { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 4px 0; }
.struk-meta b { max-width: 62%; text-align: right; overflow-wrap: anywhere; }
.struk-section-title { margin: 6px 0; font-weight: 700; }
.struk-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 5px 0; }
.struk-item span { max-width: 68%; overflow-wrap: anywhere; }
.struk-item b { text-align: right; white-space: nowrap; }
.struk-total { margin: 8px 0; font-weight: 800; font-size: 13px; }
.struk-footer { margin-top: 9px; line-height: 1.45; }

@media print {
  @page { size: 80mm 140mm; margin: 0; }
  :global(html), :global(body), :global(#__nuxt), :global(#__layout) {
    width: 80mm !important;
    min-width: 80mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }
  :global(body *) { visibility: hidden !important; }
  .print-struk, .print-struk * { visibility: visible !important; }
  .wrap { display: block !important; position: static; width: 80mm; min-height: 0; padding: 0; overflow: visible; background: #fff; }
  .stage, .aksi { display: none !important; }
  .print-struk {
    display: block !important;
    position: static;
    width: 80mm;
    box-sizing: border-box;
    padding: 6mm;
    background: #fff;
    color: #111;
    font: 10.5px/1.45 Arial, sans-serif;
  }
}
</style>
