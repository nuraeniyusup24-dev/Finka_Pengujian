// Nama outlet & kasir per index, dipakai untuk mencatat transaksi ke Riwayat (siswa & PIC).
export const OUTLET_INFO = [
  { nama: 'Kantin Utama', kasir: 'Kasir', sesi: 'Kantin Utama' },
  { nama: 'Kantin Blok B', kasir: 'Kasir', sesi: 'Kantin Blok B' },
  { nama: 'Koperasi Sekolah', kasir: 'Kasir', sesi: 'Koperasi Sekolah' }
]

export const OUTLET_KEYS = ['kantin_utama', 'kantin_b', 'koperasi']

export const state = () => ({
  outlet: 0,
  mode: 'belanja',
  cart: {},
  tunai: 0,
  scanId: null,
  scanStudent: null,
  qrToken: null,
  transactionResult: null,
  pin: '',
  pinGagal: 0,
  keypad: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
})

export const getters = {
  totalBelanja: (s, g, root) =>
    Object.keys(s.cart).reduce((a, id) => {
      const p = root.produk.find((x) => String(x.id) === String(id))
      return a + (p ? p.harga * s.cart[id] : 0)
    }, 0),
  total: (s, g) => (s.mode === 'tunai' ? s.tunai : g.totalBelanja),
  jumlahItem: (s) => Object.keys(s.cart).reduce((a, k) => a + s.cart[k], 0),
  items: (s, g, root) =>
    s.mode === 'tunai'
      ? [{ label: 'Ambil tunai di kasir', harga: s.tunai }]
      : Object.keys(s.cart)
          .map((id) => ({ p: root.produk.find((x) => String(x.id) === String(id)), n: s.cart[id] }))
          .filter((x) => x.p)
          .map((x) => ({ label: x.p.nama + ' ×' + x.n, harga: x.p.harga * x.n })),
  siswaScan: (s) => s.scanStudent,
  cukup: (s, g) => (g.siswaScan ? g.siswaScan.saldo >= g.total : false)
}

export const mutations = {
  setOutlet(s, i) { s.outlet = Number(i) },
  setMode(s, m) { s.mode = m },
  tambah(s, id) { s.cart = Object.assign({}, s.cart, { [id]: (s.cart[id] || 0) + 1 }) },
  kosongkan(s) { s.cart = {} },
  // Kurangi qty 1 produk (dipakai tombol "−" di kasir saat salah tambah menu). Hilang dari
  // keranjang begitu qty mencapai 0.
  kurang(s, id) {
    if (!(id in s.cart)) return
    const c = Object.assign({}, s.cart)
    if (c[id] <= 1) delete c[id]
    else c[id] -= 1
    s.cart = c
  },
  setQty(s, { id, qty }) { s.cart = Object.assign({}, s.cart, { [id]: qty }) },
  hapusItem(s, id) {
    if (!(id in s.cart)) return
    const c = Object.assign({}, s.cart)
    delete c[id]
    s.cart = c
  },
  setTunai(s, n) { s.tunai = Math.max(0, Math.min(Number(n) || 0, 9999999)) },
  setScan(s, i) {
    s.scanId = i === null ? null : Number(i)
    if (i === null) { s.scanStudent = null; s.qrToken = null; s.transactionResult = null }
  },
  setScannedStudent(s, { student, token }) {
    s.scanId = Number(student.id)
    s.scanStudent = student
    s.qrToken = token
    s.transactionResult = null
  },
  setTransactionResult(s, result) { s.transactionResult = result },
  setPin(s, v) { s.pin = v },
  gagalPin(s) { s.pinGagal += 1 },
  acakKeypad(s) {
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    s.keypad = a
  },
  reset(s) {
    s.cart = {}
    s.mode = 'belanja'
    s.tunai = 0
    s.scanId = null
    s.scanStudent = null
    s.qrToken = null
    s.transactionResult = null
    s.pin = ''
    s.pinGagal = 0
  }
}
