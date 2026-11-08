import { nomorInvoice } from '~/utils/invoiceNo'
import { api } from '~/utils/api'

export const state = () => ({
  siswa: [
    { id: 0, nama: 'Aditya Pratama', inisial: 'AP', kelas: '7B', nis: '24071023', saldo: 245000 },
    { id: 1, nama: 'Kayla Pratama', inisial: 'KP', kelas: '4A', nis: '24040518', saldo: 11500 }
  ],
  ambangMenipis: 20000,
  limitOn: true,
  limit: 25000,
  limitPakai: 17000,
  blokir: false,
  infoPembayaran: null,
  trx: [
    { id: 't1', hari: 'Hari ini, 2 Sep', judul: 'Kantin Utama', meta: '09.12 · Paket A, air mineral', nominal: -19000, anak: 0, sisa: 245000, outlet: 'Kantin Utama', kasir: 'Bu Ratna', items: [{ nama: 'Paket A — nasi + ayam + teh', harga: 15000 }, { nama: 'Air mineral 600 ml', harga: 4000 }] },
    { id: 't2', hari: 'Hari ini, 2 Sep', judul: 'Koperasi Sekolah', meta: '07.48 · Buku tulis ×2', nominal: -10000, anak: 1, sisa: 11500, outlet: 'Koperasi Sekolah', kasir: 'Pak Yusuf', items: [{ nama: 'Buku tulis 38 lbr ×2', harga: 10000 }] },
    { id: 't3', hari: 'Kemarin, 1 Sep', judul: 'Top-up disetujui', meta: '16.20 · kode unik 083', nominal: 264000, anak: 0, sisa: 264000, outlet: 'Transfer BCA', kasir: 'Admin Yayasan', items: [{ nama: 'Top-up saldo', harga: 264000 }] },
    { id: 't4', hari: 'Kemarin, 1 Sep', judul: 'Kantin Utama', meta: '09.30 · Mie ayam, susu kotak', nominal: -20000, anak: 0, sisa: 225000, outlet: 'Kantin Utama', kasir: 'Bu Ratna', items: [{ nama: 'Mie ayam', harga: 13000 }, { nama: 'Susu kotak 250 ml', harga: 7000 }] },
    { id: 't5', hari: 'Kemarin, 1 Sep', judul: 'Kantin Utama', meta: '09.44 · Paket B', nominal: -12000, anak: 1, sisa: 21500, outlet: 'Kantin Utama', kasir: 'Bu Ratna', items: [{ nama: 'Paket B — nasi + telur + teh', harga: 12000 }] }
  ],
  tagihan: [
    { id: 1, nama: 'SPP September 2026', jenis: 'SPP bulanan', anak: 'Aditya Pratama', periode: 'September 2026', nominal: 450000, status: 'Belum Bayar', tempo: 'Jatuh tempo 10 Sep', terbit: '1 September 2026', jatuhTempo: '10 September 2026', dibayar: null },
    { id: 2, nama: 'Uang Kegiatan Semester 1', jenis: 'Uang kegiatan', anak: 'Aditya Pratama', periode: 'Semester 1 2026/27', nominal: 150000, status: 'Menunggu Verifikasi', tempo: 'Diajukan 1 Sep', terbit: '1 September 2026', jatuhTempo: '10 September 2026', dibayar: null },
    { id: 3, nama: 'SPP September 2026', jenis: 'SPP bulanan', anak: 'Kayla Pratama', periode: 'September 2026', nominal: 400000, status: 'Lunas', tempo: 'Dibayar 28 Agu', terbit: '1 September 2026', jatuhTempo: '10 September 2026', dibayar: '28 Agustus 2026' },
    { id: 4, nama: 'SPP Agustus 2026', jenis: 'SPP bulanan', anak: 'Aditya Pratama', periode: 'Agustus 2026', nominal: 450000, status: 'Lunas', tempo: 'Dibayar 5 Agu', terbit: '1 Agustus 2026', jatuhTempo: '10 Agustus 2026', dibayar: '5 Agustus 2026' }
  ],
  produk: [
    { id: 'p1', outlet: 0, nama: 'Paket A', ket: 'Nasi + ayam + teh', harga: 15000, tile: 'A', kategori: 'Paket', stok: 60 },
    { id: 'p2', outlet: 0, nama: 'Paket B', ket: 'Nasi + telur + teh', harga: 12000, tile: 'B', kategori: 'Paket', stok: 45 },
    { id: 'p3', outlet: 0, nama: 'Mie ayam', ket: 'Porsi standar', harga: 13000, tile: 'M', kategori: 'Makanan', stok: 30 },
    { id: 'p4', outlet: 0, nama: 'Air mineral', ket: '600 ml', harga: 4000, tile: 'A', kategori: 'Minuman', stok: 112 },
    { id: 'p5', outlet: 0, nama: 'Roti isi cokelat', ket: 'Snack', harga: 6000, tile: 'R', kategori: 'Snack', stok: 14 },
    { id: 'p6', outlet: 0, nama: 'Susu kotak', ket: '250 ml', harga: 7000, tile: 'S', kategori: 'Minuman', stok: 0 },
    { id: 'k1', outlet: 1, nama: 'Buku tulis 38 lbr', ket: 'SKU KOP-001', harga: 5000, tile: 'B', kategori: 'ATK', stok: 124 },
    { id: 'k2', outlet: 1, nama: 'Pulpen hitam', ket: 'SKU KOP-014', harga: 3500, tile: 'P', kategori: 'ATK', stok: 61 },
    { id: 'k3', outlet: 1, nama: 'Dasi seragam', ket: 'SKU KOP-032', harga: 25000, tile: 'D', kategori: 'Seragam', stok: 18 },
    { id: 'k4', outlet: 1, nama: 'Buku paket IPA 7', ket: 'SKU KOP-055', harga: 85000, tile: 'I', kategori: 'Buku', stok: 9 }
  ]
})

export const getters = {
  siswaById: (s) => (id) => s.siswa[Number(id)] || s.siswa[0],
  trxById: (s) => (id) => s.trx.find((t) => t.id === id) || null,
  tagihanById: (s) => (id) => s.tagihan.find((b) => b.id === Number(id)) || s.tagihan[0],
  trxAnak: (s) => (anak) => (anak === null ? s.trx : s.trx.filter((t) => t.anak === anak)),
  limitSisa: (s) => Math.max(0, s.limit - s.limitPakai),
  produkOutlet: (s) => (o) => s.produk.filter((p) => p.outlet === o)
}

export const mutations = {
  kreditSaldo(s, { anak, nominal }) {
    s.siswa[anak].saldo += nominal
  },
  // Menambahkan transaksi baru ke urutan paling atas (terbaru) — dipakai saat PIC
  // menyelesaikan transaksi kasir (belanja/tunai) lewat scan QR siswa, supaya langsung
  // muncul di Riwayat siswa maupun Riwayat PIC.
  tambahTrx(s, trx) {
    s.trx = [trx].concat(s.trx)
  },
  debitSaldo(s, { anak, nominal }) {
    s.siswa[anak].saldo = Math.max(0, s.siswa[anak].saldo - nominal)
  },
  setLimitOn(s, v) { s.limitOn = v },
  setLimit(s, v) { s.limit = v },
  setLimitPakai(s, v) { s.limitPakai = Number(v) || 0 },
  setBlokir(s, v) { s.blokir = v },
  setInfoPembayaran(s, info) { s.infoPembayaran = info },
  setProduk(s, produk) { s.produk = Array.isArray(produk) ? produk : [] },
  // Ubah status tagihan; `patch` (opsional) ikut menimpa field lain (tempo, dibayar, invoiceNo, ...)
  setStatusTagihan(s, { id, status, ...patch }) {
    s.tagihan = s.tagihan.map((x) => (x.id === Number(id) ? Object.assign({}, x, patch, { status }) : x))
  },
  tambahProduk(s, p) {
    s.produk = s.produk.concat([p])
  },
  ubahProduk(s, { id, ...patch }) {
    s.produk = s.produk.map((p) => (p.id === id ? Object.assign({}, p, patch) : p))
  },
  hapusProduk(s, id) {
    s.produk = s.produk.filter((p) => p.id !== id)
  }
}

export const actions = {
  async muatKontrol({ commit, rootState }, siswaId) {
    const user = rootState.auth.user
    if (!user || user.role !== 'ortu') throw new Error('Hanya Orang Tua yang dapat mengakses kontrol siswa.')
    const control = await api.kontrolAnak(siswaId)
    if (!rootState.auth.user || Number(rootState.auth.user.id) !== Number(user.id)) return null
    commit('setLimitOn', Boolean(control.limit_aktif))
    commit('setLimit', Number(control.limit) || 25000)
    commit('setLimitPakai', control.terpakai_hari_ini)
    commit('setBlokir', Boolean(control.kartu_diblokir))
    commit('ortu/setKontrolAnak', { siswaId, control })
    return control
  },
  async simpanKontrol({ commit, rootState }, { siswaId, payload }) {
    const user = rootState.auth.user
    if (!user || user.role !== 'ortu') throw new Error('Hanya Orang Tua yang dapat mengubah kontrol siswa.')
    const control = await api.simpanKontrol(siswaId, payload)
    if (!rootState.auth.user || Number(rootState.auth.user.id) !== Number(user.id)) return null
    commit('setLimitOn', Boolean(control.limit_aktif))
    commit('setLimit', Number(control.limit) || 25000)
    commit('setLimitPakai', control.terpakai_hari_ini)
    commit('setBlokir', Boolean(control.kartu_diblokir))
    commit('ortu/setKontrolAnak', { siswaId, control })
    return control
  },
  async muatInfoPembayaran({ commit }) {
    const info = await api.infoPembayaran()
    if (!info || !info.rekening) throw new Error('Informasi rekening pembayaran tidak tersedia.')
    commit('setInfoPembayaran', info)
    return info
  },
  async simpanInfoPembayaran({ commit }, rekening) {
    const info = await api.simpanInfoPembayaran(rekening)
    if (!info || !info.rekening) throw new Error('Informasi rekening pembayaran tidak berhasil disimpan.')
    commit('setInfoPembayaran', info)
    return info
  },
  // Dipanggil saat admin memverifikasi pembayaran tagihan: tagihan jadi Lunas dan
  // invoice lunas terbit otomatis (nomor + tanggal), lalu orang tua diberi notifikasi.
  lunasiTagihan({ state, commit }, { id, waktu }) {
    const b = state.tagihan.find((x) => x.id === Number(id))
    if (!b) return
    const d = new Date()
    const penuh = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const pendek = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    const invoiceNo = nomorInvoice(b)
    commit('setStatusTagihan', { id, status: 'Lunas', tempo: 'Dibayar ' + pendek, dibayar: penuh, invoiceNo, invoiceTerbit: waktu || pendek })
    commit('topup/tambahNotifikasi', {
      judul: 'Invoice ' + b.nama + ' tersedia',
      isi: 'Pembayaran ' + b.anak + ' sebesar Rp ' + b.nominal.toLocaleString('id-ID') + ' sudah diverifikasi admin. Invoice ' + invoiceNo + ' siap diunduh di menu Tagihan.',
      waktu: (waktu || '').split(', ').pop() || 'Baru saja',
      baru: true
    })
  },
  // Hapus produk dari katalog sekaligus dari keranjang kasir (pos.cart) yang masih memuatnya
  hapusProduk({ commit }, id) {
    commit('hapusProduk', id)
    commit('pos/hapusItem', id)
  }
}
