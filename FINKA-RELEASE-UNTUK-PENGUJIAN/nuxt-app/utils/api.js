/**
 * API client frontend.
 *
 * Semua request ke backend sebaiknya melewati file ini. Dengan begitu format
 * URL, header JWT, parsing response, dan penanganan error tidak tersebar
 * di banyak halaman Vue.
 */
// Klien API murni (tanpa dependensi Vue/Nuxt) supaya bisa dipakai baik di
// dalam komponen/store Nuxt maupun langsung dari skrip Node untuk testing.
//
// Di Nuxt 2, process.env TIDAK ikut masuk ke bundle browser. Alamat API yang
// sebenarnya diisi lewat plugins/api-config.js dari publicRuntimeConfig
// (variabel lingkungan API_BASE_URL dibaca saat `nuxt start`). Nilai di bawah
// hanya fallback untuk skrip Node (mis. integration-test) dan development.
const DEFAULT_BASE_URL = (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) || 'http://localhost:3001/api'
export let BASE_URL = DEFAULT_BASE_URL
export function setBaseUrl(url) { if (url) BASE_URL = String(url).replace(/\/+$/, '') }

let _token = null
export function setToken(t) { _token = t }
export function getToken() { return _token }

async function request(method, path, body, tokenOverride) {
  const headers = { 'Content-Type': 'application/json' }
  const token = tokenOverride === undefined ? _token : tokenOverride
  if (token) headers.Authorization = 'Bearer ' + token

  let res
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch (e) {
    const err = new Error('Tidak bisa menghubungi server. Pastikan backend jalan di ' + BASE_URL)
    err.status = 0
    throw err
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Terjadi kesalahan (' + res.status + ')')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),
  buatPinAkun: (pin, konfirmasiPin) => request('POST', '/auth/me/pin', { pin, konfirmasi_pin: konfirmasiPin }),
  simpanKontakAkun: (payload) => request('PUT', '/auth/me/contact', payload),
  uploadAvatar: (dataUrl, mime, ukuran) => request('POST', '/auth/me/avatar', { data_url: dataUrl, mime, ukuran }),

  anakAnak: () => request('GET', '/ortu/anak-anak'),
  profilOrtu: () => request('GET', '/ortu/profil'),
  simpanProfilOrtu: (payload) => request('PUT', '/ortu/profil', payload),
  riwayatPembayaran: () => request('GET', '/ortu/riwayat-pembayaran'),
  notifikasiOrtu: () => request('GET', '/ortu/notifikasi'),
  profilSiswa: (siswaId) => request('GET', '/siswa/' + siswaId),
  saldo: (siswaId) => request('GET', '/siswa/' + siswaId + '/saldo'),
  riwayat: (siswaId) => request('GET', '/siswa/' + siswaId + '/riwayat'),
  daftarSiswa: () => request('GET', '/siswa'),
  produk: () => request('GET', '/pos/produk'),
  qrSiswa: (token) => request('GET', '/pos/qr', undefined, token),
  resolveQr: (token) => request('POST', '/pos/qr/resolve', { token }),
  tambahProduk: (nama, harga, outlet) => request('POST', '/pos/produk', { nama, harga, outlet }),
  ubahProduk: (id, nama, harga) => request('PUT', '/pos/produk/' + id, { nama, harga }),
  hapusProduk: (id) => request('DELETE', '/pos/produk/' + id),
  transaksi: (siswaId, pin, items, qrToken) => request('POST', '/pos/transaksi', { siswa_id: siswaId, pin, items, qr_token: qrToken }),
  tarikTunai: (siswaId, pin, nominal, qrToken) => request('POST', '/pos/tarik-tunai', { siswa_id: siswaId, pin, nominal, qr_token: qrToken }),

  kontrolSaya: (token) => request('GET', '/siswa/saya/kontrol', undefined, token),
  blokirKartuSaya: (token) => request('POST', '/siswa/saya/kartu/blokir', undefined, token),
  gantiPassword: (lama, baru) => request('POST', '/auth/ganti-password', { password_lama: lama, password_baru: baru }),
  mintaResetPassword: (username, channel) => request('POST', '/auth/password-reset/request', { username, channel }),
  verifikasiResetPassword: (challengeId, otp) => request('POST', '/auth/password-reset/verify', { challenge_id: challengeId, otp }),
  selesaikanResetPassword: (challengeId, resetToken, passwordBaru, konfirmasiPassword) => request('POST', '/auth/password-reset/complete', {
    challenge_id: challengeId, reset_token: resetToken, password_baru: passwordBaru, konfirmasi_password: konfirmasiPassword
  }),
  kas: () => request('GET', '/pos/kas'),
  setKas: (kasAwal) => request('PUT', '/pos/kas', { kas_awal: kasAwal }),
  infoPembayaran: () => request('GET', '/config/pembayaran'),
  kontrolAnak: (siswaId) => request('GET', '/ortu/anak/' + siswaId + '/kontrol'),
  simpanKontrol: (siswaId, payload) => request('PUT', '/ortu/anak/' + siswaId + '/kontrol', payload),
  metodeResetPin: (siswaId) => request('GET', '/ortu/anak/' + siswaId + '/pin-reset/options'),
  mintaOtpResetPin: (siswaId, channel) => request('POST', '/ortu/anak/' + siswaId + '/pin-reset/request', { channel }),
  verifikasiOtpResetPin: (siswaId, challengeId, otp) => request('POST', '/ortu/anak/' + siswaId + '/pin-reset/verify', { challenge_id: challengeId, otp }),
  selesaikanResetPin: (siswaId, challengeId, resetToken, pinBaru, konfirmasiPin) => request('POST', '/ortu/anak/' + siswaId + '/pin-reset/complete', { challenge_id: challengeId, reset_token: resetToken, pin_baru: pinBaru, konfirmasi_pin: konfirmasiPin }),

  tagihan: (siswaId) => request('GET', '/tagihan?siswa_id=' + siswaId),

  ajukanTopup: (siswaId, nominal, tagihanId, pin) =>
    request('POST', '/topup', { siswa_id: siswaId, nominal, tagihan_id: tagihanId || undefined, pin }),
  statusTopup: (id) => request('GET', '/topup/' + id),
  buktiTopup: (id) => request('GET', '/topup/' + id + '/proof'),
  uploadBuktiTopup: (id, dataUrl, nama, mime, ukuran) =>
    request('POST', '/topup/' + id + '/proof', { data_url: dataUrl, nama, mime, ukuran }),
  antreanTopup: (status) => request('GET', '/topup' + (status ? '?status=' + status : '')),
  approveTopup: (id) => request('POST', '/topup/' + id + '/approve'),
  verifikasiSemuaTopup: (ids) => request('POST', '/topup/batch/verify', { ids }),
  tolakTopup: (id, alasan) => request('POST', '/topup/' + id + '/tolak', { alasan }),
  terimaKembaliTopup: (id) => request('POST', '/topup/' + id + '/terima-kembali'),
  dashboard: (tanggal) => request('GET', '/admin/dashboard' + (tanggal ? '?tanggal=' + encodeURIComponent(tanggal) : '')),
  laporan: (tanggal) => request('GET', '/admin/laporan' + (tanggal ? '?tanggal=' + encodeURIComponent(tanggal) : '')),
  notifikasiAdmin: () => request('GET', '/admin/notifikasi'),
  adminUsers: () => request('GET', '/admin/users'),
  buatAkun: (payload) => request('POST', '/admin/users', payload),
  imporSiswa: (baris, simpan) => request('POST', '/admin/impor-siswa', { baris, simpan }),
  tagihanRingkasan: (bulan) => request('GET', '/admin/tagihan-ringkasan' + (bulan ? '?bulan=' + encodeURIComponent(bulan) : '')),
  buatTagihan: (payload) => request('POST', '/admin/tagihan/bulk', payload),
  gantiPin: (pinLama, pinBaru) => request('POST', '/siswa/saya/ganti-pin', { pin_lama: pinLama, pin_baru: pinBaru }),
  riwayatKasir: () => request('GET', '/pos/riwayat-hari-ini'),
  batalTransaksi: (id, alasan) => request('POST', '/pos/transaksi/' + id + '/batal', { alasan }),
  statusTutupKas: () => request('GET', '/pos/tutup-kas'),
  tutupKas: (kasFisik) => request('POST', '/pos/tutup-kas', { kas_fisik: kasFisik }),
  tutupKasAdmin: (tanggal) => request('GET', '/admin/tutup-kas' + (tanggal ? '?tanggal=' + tanggal : '')),
  ubahTagihan: (id, payload) => request('PUT', '/admin/tagihan/' + id, payload),
  naikKelas: (pemetaan, simpan) => request('POST', '/admin/kelas/naik', { pemetaan, simpan }),
  arsipKelas: (kelas, simpan, akuiSaldo) => request('POST', '/admin/kelas/arsip', { kelas, simpan, akui_saldo: akuiSaldo }),
  unduh: async (path, namaBerkas) => {
    const res = await fetch(BASE_URL + path, { headers: { Authorization: 'Bearer ' + _token } })
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Gagal mengunduh (' + res.status + ')') }
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a'); a.href = url; a.download = namaBerkas; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  },
  daftarTagihan: (q) => request('GET', '/admin/tagihan' + (q ? '?' + new URLSearchParams(q).toString() : '')),
  batalTagihan: (id, alasan) => request('POST', '/admin/tagihan/' + id + '/batal', { alasan })
}
