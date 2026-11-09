<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'siswa']
})
</script>

<template>
  <div class="wrap">
    <ScreenHeader title="Struk Digital" to="/siswa/riwayat" dark />
    <div v-if="$store.state['profil-siswa'].memuat" class="state">Memuat detail transaksi…</div>
    <div v-else-if="$store.state['profil-siswa'].error" class="state error" role="alert">{{ $store.state['profil-siswa'].error }} <button type="button" @click="muat">Coba lagi</button></div>
    <div v-else-if="!trx" class="state">Detail transaksi tidak ditemukan.</div>
    <div v-else-if="trx" class="sheet">
      <div class="brand"><FinkaMark :width="20" :height="22" color="var(--blue)" /><span class="display">FINKA</span><i>STRUK DIGITAL</i></div>
      <div class="head">
        <div class="cek">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div class="status">{{ row.tipe === 'topup' ? 'TOP-UP SUDAH DIVERIFIKASI' : 'TRANSAKSI BERHASIL' }}</div>
        <div class="judul display">{{ trx.judul }}</div>
        <div class="nominal display num">{{ Math.abs(trx.nominal) | rp }}</div>
        <div class="waktu">{{ trx.hari }} · {{ jam }} WIB</div>
      </div>

      <div class="putus"></div>
      <div class="meta">
        <div v-if="row.keterangan"><span>Keterangan</span><b>{{ row.keterangan }}</b></div>
        <div v-if="row.oleh_nama"><span>Diproses oleh</span><b>{{ row.oleh_nama }}</b></div>
        <div v-if="row.sisa !== null && row.sisa !== undefined"><span>Saldo sebelum</span><b class="num">{{ sebelum | rp }}</b></div>
        <div v-if="row.sisa !== null && row.sisa !== undefined"><span>Saldo sesudah</span><b class="num">{{ row.sisa | rp }}</b></div>
      </div>

      <div class="putus"></div>
      <div class="meta meta--reference">
        <div><span>ID transaksi</span><b class="num">{{ idTrx }}</b></div>
        <div><span>Metode</span><b>Pembayaran Finka</b></div>
      </div>
      <section v-if="row.tipe === 'topup' && row.ref_tabel === 'topup_request'" class="bukti">
        <div class="bukti__judul display">Bukti transfer</div>
        <p v-if="proofError" class="bukti__error" role="alert">{{ proofError }}</p>
        <button v-else-if="proof" type="button" class="bukti__open" @click="viewerTerbuka = true">
          <img :src="proof" alt="Bukti transfer top-up" />
          <span>Lihat bukti transfer</span>
        </button>
        <p v-else class="bukti__hint">Memuat bukti transfer…</p>
      </section>
      <button class="cetak" @click="cetak">Cetak / simpan sebagai PDF</button>
    </div>
    <ImageLightbox
      v-if="viewerTerbuka && proof"
      :src="proof"
      alt="Bukti transfer top-up"
      @close="viewerTerbuka = false"
    />
  </div>
</template>

<script>
import { api } from '~/utils/api'

export default {


  data() { return { proof: '', proofError: '', viewerTerbuka: false } },
  computed: {
    row() { return this.$store.state['profil-siswa'].riwayat.find((x) => Number(x.id) === Number(this.$route.params.id)) || null },
    trx() {
      if (!this.row) return null
      const w = this.$store.getters['profil-siswa/transaksi'].find((x) => Number(x.id) === Number(this.row.id))
      return w ? Object.assign({}, w, { hari: w.tanggalLabel }) : null
    },
    jam() { return this.trx ? this.trx.meta.split(' · ')[0] : '' },
    sebelum() { return this.trx ? this.trx.sisa - this.trx.nominal : 0 },
    idTrx() { return this.trx ? 'TRX-' + this.trx.id : '' }
  },
  methods: {
    cetak() { window.print() },
    muat() { return this.$store.dispatch('profil-siswa/muat') }
  },
  async mounted() {
    await this.$store.dispatch('profil-siswa/muat')
    if (this.row && this.row.tipe === 'topup' && this.row.ref_tabel === 'topup_request') {
      try {
        const result = await api.buktiTopup(this.row.ref_id)
        this.proof = result.data_url
      } catch (error) {
        this.proofError = error.message || 'Bukti transfer tidak dapat dimuat.'
      }
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
.sheet { flex: 1; width: min(100%, 440px); align-self: center; box-sizing: border-box; background: #fff; border-radius: 24px 24px 0 0; padding: 24px 22px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 8px 32px rgba(10,13,59,.08); }
.state { padding:32px 20px; text-align:center; color:var(--muted); font:500 13px/1.5 var(--font-body); }
.error { color:var(--coral); }
.state button { border:0; background:transparent; color:var(--blue); font-weight:700; cursor:pointer; }
.brand { display:flex; align-items:center; gap:8px; color:var(--navy); font:700 15px var(--font-display); letter-spacing:.04em; }
.brand i { margin-left:auto; color:var(--muted); font:600 9px var(--font-body); letter-spacing:.12em; font-style:normal; }
.head { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cek { width: 48px; height: 48px; border-radius: var(--r-pill); background: rgba(26,128,64,.12); display: flex; align-items: center; justify-content: center; }
.status { color:var(--green); font:700 10px var(--font-body); letter-spacing:.12em; }
.judul { font: 700 16px var(--font-display); }
.nominal { font: 800 32px var(--font-display); letter-spacing: -.03em; }
.waktu { font: 400 12px var(--font-body); color: var(--muted); }
.putus { border-top: 1px dashed var(--line); margin:0 -4px; }
.meta { display: flex; flex-direction: column; gap: 9px; }
.meta div { display: flex; justify-content: space-between; align-items:flex-start; gap:14px; }
.meta span { font: 400 12.5px var(--font-body); color: var(--muted); }
.meta b { font: 600 12.5px var(--font-body); text-align:right; overflow-wrap:anywhere; }
.meta--reference { background:var(--bg); border-radius:var(--r-sm); padding:12px; }
.bukti { display:flex; flex-direction:column; gap:8px; }
.bukti__judul { font-size:13px; }
.bukti__open { display:flex; flex-direction:column; align-items:center; gap:7px; padding:10px; border:0; border-radius:var(--r-sm); background:var(--bg); color:var(--blue); cursor:zoom-in; font:500 11px var(--font-body); }
.bukti__open img { max-width:100%; max-height:260px; object-fit:contain; }
.bukti__hint,.bukti__error { margin:0; color:var(--muted); font:400 11px/1.5 var(--font-body); text-align:center; }
.bukti__error { color:var(--coral); }
.cetak { margin-top: auto; border: 1px solid var(--line); background: #fff; color:var(--blue); border-radius: var(--r-pill); padding: 13px; font: 700 13px var(--font-body); cursor: pointer; }
.cetak:hover { background:var(--blue-soft); border-color:var(--blue); }
@media print {
  :global(body), .wrap { background:#fff !important; }
  .cetak, :global(.phone-header) { display: none !important; }
  .sheet { width:100%; min-height:0; border-radius:0; padding:12mm; box-shadow:none; }
}
</style>
