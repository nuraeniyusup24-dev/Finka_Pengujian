<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div class="kiri">
      <button
        v-for="(o, i) in outlets"
        :key="o.nama"
        class="card outlet"
        :class="outlet === i ? 'is-on' : ''"
        @click="setOutlet(i)"
      >
        <div class="outlet__top">
          <div>
            <div class="outlet__nama display">{{ o.nama }}</div>
            <div class="outlet__jam">{{ o.jam }} · PIC {{ o.pic }}</div>
          </div>
        </div>
        <div class="outlet__stat">
          <div><span>Transaksi</span><b class="display num">{{ o.trx }}</b></div>
          <div><span>Omzet hari ini</span><b class="display num">{{ o.omzet | rp }}</b></div>
        </div>
      </button>
    </div>

    <div class="card tabel">
      <div class="tabel__head">
        <div>
          <div class="h display">{{ outlets[outlet].nama }}</div>
          <div class="sub">Katalog produk dan paket</div>
        </div>
        <button v-if="admin" type="button" class="btn-sm" @click="bukaTambah">Tambah produk</button>
      </div>
      <div class="baris baris--head baris--aksi">
        <div>NAMA</div><div>KATEGORI</div><div>HARGA JUAL</div><div>STOK</div><div>STATUS</div>
        <div class="kanan">AKSI</div>
      </div>
      <div v-if="!produk.length" class="kosong">
        <b>Belum ada produk di katalog ini.</b>
        <span v-if="admin">Klik “Tambah produk” untuk mulai mengisi katalog.</span>
      </div>
      <div v-for="p in produk" :key="p.id" class="baris baris--aksi">
        <div class="nama">
          <span><b>{{ p.nama }}</b><i>{{ p.ket }}</i></span>
        </div>
        <div class="muted" data-label="Kategori">{{ p.kategori }}</div>
        <div class="num tebal harga" data-label="Harga jual">{{ p.harga | rp }}</div>
        <div class="num tebal stok" data-label="Stok" :style="'color:' + stokWarna(p.stok)">{{ p.stok === 0 ? 'Habis' : p.stok }}</div>
        <div class="status" data-label="Status"><span class="badge" :class="p.stok === 0 ? 'badge--off' : 'badge--ok'">{{ p.stok === 0 ? 'Nonaktif' : 'Aktif' }}</span></div>
        <div class="aksi">
          <button type="button" class="ikon" :disabled="!admin" :aria-label="'Ubah ' + p.nama" title="Ubah" @click="bukaUbah(p)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
          </button>
          <button type="button" class="ikon ikon--bahaya" :disabled="!admin" :aria-label="'Hapus ' + p.nama" title="Hapus" @click="hapus = p">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><path d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          </button>
        </div>
      </div>
    </div>

    <FormProdukModal
      v-if="formOn"
      :key="edit ? edit.id : 'baru'"
      :produk="edit"
      :outlet-nama="outlets[outlet].nama"
      :outlet-id="produkOutletId"
      :contoh-kategori="produkOutletId === 1 ? 'ATK' : 'Minuman'"
      @tutup="tutupForm"
      @berhasil="produkTersimpan"
    />
    <div v-if="hapus" class="konfirmasi-backdrop" @click.self="hapus = null" @keyup.esc="hapus = null">
      <section class="konfirmasi" role="dialog" aria-modal="true" aria-labelledby="konfirmasi-judul">
        <div class="konfirmasi__ikon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><path d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" /><path d="M10 11v6M14 11v6" /></svg>
        </div>
        <h2 id="konfirmasi-judul">Yakin mau hapus menu ini?</h2>
        <p><b>{{ hapus.nama }}</b> akan dihapus dari katalog {{ outlets[outlet].nama }} dan tidak muncul lagi di kasir. Tindakan ini tidak bisa dibatalkan.</p>
        <div class="konfirmasi__aksi">
          <button type="button" class="konfirmasi__batal" @click="hapus = null">Batal</button>
          <button type="button" class="konfirmasi__hapus" @click="hapusProduk">Oke, hapus</button>
        </div>
      </section>
    </div>
    <ToastNotif v-if="toast" :key="toast.id" :pesan="toast.pesan" @tutup="toast = null" />
  </div>
</template>

<script>
export default {

  data() {
    return {
      formOn: false,
      edit: null, // produk yang sedang diubah (null = mode tambah)
      hapus: null, // produk yang menunggu konfirmasi hapus
      toast: null,
      outlets: [
        { nama: 'Kantin Utama', jam: '07.00–14.00', pic: 'Bu Ratna', trx: 214, omzet: 1840000 },
        { nama: 'Kantin Blok B', jam: '09.00–13.30', pic: 'Bu Lilis', trx: 97, omzet: 760000 },
        { nama: 'Koperasi Sekolah', jam: '07.00–15.00', pic: 'Pak Yusuf', trx: 36, omzet: 385000 }
      ]
    }
  },
  computed: {
    admin() { return this.$store.getters['admin/admin'] },
    outlet() { return this.$store.state.admin.outlet },
    produkOutletId() { return this.outlet === 2 ? 1 : 0 },
    produk() { return this.$store.getters.produkOutlet(this.produkOutletId) },
  },
  methods: {
    setOutlet(i) { this.$store.commit('admin/setOutlet', i) },
    stokWarna(s) { return s === 0 ? 'var(--coral)' : s < 20 ? 'var(--sand-ink)' : 'var(--ink)' },
    bukaTambah() {
      this.edit = null
      this.formOn = true
    },
    bukaUbah(p) {
      this.edit = p
      this.formOn = true
    },
    tutupForm() {
      this.formOn = false
      this.edit = null
    },
    produkTersimpan({ nama, mode }) {
      const outlet = this.outlets[this.outlet].nama
      const pesan = mode === 'ubah' ? nama + ' diperbarui.' : nama + ' ditambahkan ke ' + outlet + '.'
      this.toast = { id: Date.now(), pesan }
    },
    hapusProduk() {
      const { id, nama } = this.hapus
      this.$store.dispatch('hapusProduk', id)
      this.hapus = null
      this.toast = { id: Date.now(), pesan: nama + ' dihapus dari ' + this.outlets[this.outlet].nama + '.' }
    }
  }
}
</script>

<style scoped>
.page { display: grid; grid-template-columns: minmax(250px, 330px) minmax(0, 1fr); gap: 16px; align-items: start; }
.kiri {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(58vh, 520px);
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 2px 5px 2px 0;
}
.kiri::-webkit-scrollbar { width: 7px; }
.kiri::-webkit-scrollbar-track { background: transparent; }
.kiri::-webkit-scrollbar-thumb { border-radius: 8px; background: #cbd0dc; }
.kiri::-webkit-scrollbar-thumb:hover { background: #aeb5c6; }
.outlet { width: 100%; min-width: 0; }
.outlet { padding: 16px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 12px; background: #fff; }
.outlet.is-on { border-color: var(--blue); }
.outlet__top { display: flex; align-items: flex-start; justify-content: space-between; }
.outlet__nama { font: 700 14px var(--font-display); }
.outlet__jam { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 3px; }
.outlet__stat { display: flex; gap: 20px; }
.outlet__stat span { display: block; font: 400 11px var(--font-body); color: var(--muted); }
.outlet__stat b { display: block; font: 700 14px var(--font-display); margin-top: 2px; }

.tabel { min-width: 0; overflow: hidden; }
.tabel__head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.h { font: 700 14px var(--font-display); }
.sub { font: 400 12px var(--font-body); color: var(--muted); margin-top: 3px; }
.btn-sm { border: none; background: var(--blue); color: #fff; font: 600 12.5px var(--font-body); padding: 9px 15px; border-radius: var(--r-sm); cursor: pointer; }

.baris { display: grid; grid-template-columns: minmax(130px, 2fr) minmax(65px, 1fr) minmax(76px, 1fr) minmax(42px, .6fr) minmax(72px, .9fr); padding: 14px 20px; border-top: 1px solid var(--bg); align-items: center; gap: 8px; }
.baris--aksi { grid-template-columns: minmax(130px, 2fr) minmax(65px, 1fr) minmax(76px, 1fr) minmax(42px, .6fr) minmax(72px, .9fr) minmax(112px, 1.1fr); }
.baris > div { min-width: 0; }
.baris--head { padding: 11px 20px; background: var(--bg); border-top: none; font: 600 10.5px var(--font-body); color: var(--muted); letter-spacing: .02em; gap: 8px; }
.nama { display: flex; align-items: center; gap: 11px; }
.nama > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.nama b { display: block; font: 600 13px var(--font-body); }
.nama i { display: block; font: 400 11px var(--font-body); color: var(--muted); font-style: normal; margin-top: 1px; }
.muted { font: 400 12.5px var(--font-body); color: var(--muted); }
.tebal { font: 600 13px var(--font-body); }
.harga { white-space: nowrap; }
.status { white-space: nowrap; }
.baris--head > div:nth-child(n+3) { text-align: center; }
.baris:not(.baris--head) > div:nth-child(n+3):not(.aksi) { text-align: center; }
.kanan { text-align: center; }
.aksi { display: flex; justify-content: center; gap: 6px; }
.ikon {
  width: 34px; height: 34px; padding: 0; border: 1px solid var(--line); background: #fff; color: var(--ink);
  border-radius: var(--r-sm); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.ikon:hover { background: var(--bg); border-color: var(--blue); color: var(--blue); }
.ikon--bahaya { color: var(--coral); }
.ikon--bahaya:hover { background: rgba(223, 74, 55, .1); border-color: var(--coral); color: var(--coral); }
.ikon:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
.ikon:disabled { opacity: .45; cursor: not-allowed; }
.ikon:disabled:hover { background: #fff; border-color: var(--line); color: var(--ink); }
.konfirmasi-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(10, 13, 59, .48); }
.konfirmasi { width: min(100%, 420px); padding: 24px; border-radius: var(--r-md); background: #fff; box-shadow: 0 18px 55px rgba(10, 13, 59, .24); }
.konfirmasi__ikon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(223, 74, 55, .1); color: var(--coral); }
.konfirmasi h2 { margin: 16px 0 8px; color: var(--ink); font: 700 17px var(--font-display); }
.konfirmasi p { margin: 0; color: var(--muted); font: 400 13px/1.6 var(--font-body); }
.konfirmasi p b { color: var(--ink); }
.konfirmasi__aksi { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.konfirmasi__aksi button { min-height: 40px; padding: 0 16px; border-radius: var(--r-sm); cursor: pointer; font: 600 13px var(--font-body); }
.konfirmasi__batal { border: 1px solid var(--line); background: #fff; color: var(--ink); }
.konfirmasi__batal:hover { background: var(--bg); }
.konfirmasi__hapus { border: 1px solid var(--coral); background: var(--coral); color: #fff; }
.konfirmasi__hapus:hover { filter: brightness(.92); }
.kosong { padding: 36px 20px; text-align: center; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--bg); }
.kosong b { font: 600 13px var(--font-body); }
.kosong span { font: 400 12px var(--font-body); color: var(--muted); }

@media (max-width: 1300px) {
  .page { grid-template-columns: minmax(0, 1fr); }
  .kiri {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    align-content: start;
    max-height: min(48vh, 420px);
  }
}

@media (max-width: 600px) {
  .kiri { max-height: min(42vh, 320px); }
}

@media (max-width: 760px) {
  .tabel__head { padding: 14px 16px; }
  .baris--head { display: none; }
  .baris,
  .baris--aksi {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    padding: 14px 16px;
    gap: 14px 12px;
  }
  .baris:not(.baris--head) > .nama { grid-column: 1 / -1; }
  .baris:not(.baris--head) > div:not(.nama):not(.aksi) { text-align: left; }
  .baris:not(.baris--head) > div:not(.nama):not(.aksi)::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font: 500 10px var(--font-body);
    text-transform: uppercase;
    letter-spacing: .03em;
  }
  .baris:not(.baris--head) > .aksi {
    grid-column: 1 / -1;
    justify-content: flex-start;
    padding-top: 8px;
    border-top: 1px solid var(--bg);
  }
  .ikon { width: 36px; height: 36px; }
  .baris--aksi .kanan { display: none; }
}
</style>
