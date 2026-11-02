<template>
  <div class="overlay" @click.self="$emit('tutup')">
    <form class="modal" @submit.prevent="simpan">
      <h2>{{ produk ? 'Ubah produk' : 'Tambah produk' }} {{ outletNama }}</h2>
      <label>Nama produk<input v-model.trim="form.nama" required maxlength="80" /></label>
      <label>Keterangan<input v-model.trim="form.ket" maxlength="120" /></label>
      <label>Kategori<input v-model.trim="form.kategori" :placeholder="contohKategori" required maxlength="40" /></label>
      <div class="row"><label>Harga (Rp)<input v-model.number="form.harga" type="number" min="1" required /></label><label>Stok<input v-model.number="form.stok" type="number" min="0" required /></label></div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions"><button type="button" @click="$emit('tutup')">Batal</button><button class="primary" type="submit">{{ produk ? 'Simpan perubahan' : 'Tambah produk' }}</button></div>
    </form>
  </div>
</template>
<script>
import { api } from '~/utils/api'
export default {
  props: { produk: { type: Object, default: null }, outletNama: { type: String, required: true }, outletId: { type: Number, required: true }, contohKategori: { type: String, default: 'Umum' } },
  data() { return { error: '', previousDocumentOverflow: '', previousBodyOverflow: '', form: { nama: this.produk ? this.produk.nama : '', ket: this.produk ? this.produk.ket : '', kategori: this.produk ? this.produk.kategori : '', harga: this.produk ? this.produk.harga : null, stok: this.produk ? this.produk.stok : 0 } } },
  mounted() {
    this.previousDocumentOverflow = document.documentElement.style.overflow
    this.previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  },
  beforeDestroy() {
    document.documentElement.style.overflow = this.previousDocumentOverflow
    document.body.style.overflow = this.previousBodyOverflow
  },
  methods: {
    async simpan() {
      if (!this.form.nama || !this.form.kategori || !Number.isFinite(Number(this.form.harga)) || Number(this.form.harga) <= 0 || Number(this.form.stok) < 0) { this.error = 'Lengkapi data produk dengan harga dan stok yang valid.'; return }
      const data = { ...this.form, harga: Number(this.form.harga), stok: Number(this.form.stok), tile: this.form.nama.slice(0, 1).toUpperCase() }
      try {
        const outletKey = this.outletId === 1 ? 'koperasi' : 'kantin_utama'
        if (this.produk && Number.isInteger(Number(this.produk.id))) {
          await api.ubahProduk(this.produk.id, data.nama, data.harga)
          this.$store.commit('ubahProduk', { id: this.produk.id, ...data })
        } else if (this.produk) this.$store.commit('ubahProduk', { id: this.produk.id, ...data })
        else {
          const result = await api.tambahProduk(data.nama, data.harga, outletKey)
          this.$store.commit('tambahProduk', { id: result.produk.id, outlet: this.outletId, ...data })
        }
        this.$emit('berhasil', { nama: data.nama, mode: this.produk ? 'ubah' : 'tambah' })
        this.$emit('tutup')
      } catch (e) { this.error = e.message || 'Gagal menyimpan produk.' }
    }
  }
}
</script>
<style scoped>
.overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; overflow-y: auto; overscroll-behavior: contain; padding: 18px; background: #10182888; }
.modal { width: min(100%, 460px); max-height: 90vh; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 14px; padding: 24px; background: #fff; border-radius: 14px; box-shadow: 0 18px 60px #0003; }
h2 { margin: 0; font: 700 18px var(--font-display); } label { display: flex; flex-direction: column; gap: 6px; font: 600 12px var(--font-body); color: var(--muted); }
input { width: 100%; min-width: 0; padding: 11px 12px; border: 1px solid var(--line); border-radius: var(--r-sm); font: 14px var(--font-body); color: var(--ink); }
.row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.row label { min-width: 0; }.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 4px; }
button { padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: #fff; cursor: pointer; font: 600 13px var(--font-body); }.primary { border-color: var(--blue); background: var(--blue); color: #fff; }.error { margin: 0; color: var(--coral); font: 12px var(--font-body); }
@media (max-width: 420px) { .row { grid-template-columns: 1fr; } }
</style>
