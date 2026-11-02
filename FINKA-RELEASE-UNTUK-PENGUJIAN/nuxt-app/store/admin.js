import { api } from '~/utils/api'

// Format nomor HP dummy: 0812-2407-0118
const formatHp = (d) => d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3')

// Akun orang tua awal diambil dari kolom `ortu` pada data siswa, supaya daftar orang tua
// selalu konsisten dengan daftar siswa. Nomor HP-nya dummy (diturunkan dari NIS anak pertama).
const seedOrtu = (siswa) =>
  siswa.reduce((a, u) => {
    if (a.some((o) => o.nama === u.ortu)) return a
    return a.concat([{ nama: u.ortu, hubungan: '', hp: formatHp('0812' + u.nis.slice(-8)), email: '', status: 'Aktif' }])
  }, [])

export const state = () => {
  const s = {
    peran: 'admin',
    pilihId: null,
    hasil: {},
    alasanTolak: {}, // id permintaan → alasan penolakan (disimpan per permintaan)
    waktuHasil: {}, // id permintaan → waktu keputusan admin, mis. '9 Okt, 14.47'
    buktiUnggahan: {}, // id permintaan → { url, nama, ukuran } dari unggahan orang tua
    alasan: '',
    outlet: 0,
    // Baseline top-up yang sudah disetujui sebelumnya (di luar antrean yang sedang tampil),
    // supaya angka di Laporan & Rekonsiliasi tidak mulai dari nol dan tetap bertambah
    // secara realtime setiap kali admin menyetujui permintaan baru di Verifikasi Top-up.
    topupHistoris: { total: 6120000, jumlah: 41 },
    antrean: [],
    kelas: [
      { kelas: '7A', n: 32, siswa: 'Zahra Alifia', nis: '24070118', ortu: 'Maya Kartika', lunas: 91, tunggakan: 1350000 },
      { kelas: '7B', n: 31, siswa: 'Aditya Pratama', nis: '24071023', ortu: 'Sari Wulandari', lunas: 84, tunggakan: 2250000 },
      { kelas: '8A', n: 30, siswa: 'Rafi Ramadhan', nis: '24080411', ortu: 'Budi Santoso', lunas: 63, tunggakan: 4950000 },
      { kelas: '8C', n: 29, siswa: 'Farel Mahendra', nis: '24081907', ortu: 'Agus Priyanto', lunas: 48, tunggakan: 6750000 },
      { kelas: '9A', n: 28, siswa: 'Nabila Azzahra', nis: '24090233', ortu: 'Dewi Anggraini', lunas: 96, tunggakan: 450000 },
      { kelas: '9C', n: 30, siswa: 'Bagas Setiawan', nis: '24093140', ortu: 'Rina Kusuma', lunas: 41, tunggakan: 7650000 }
    ],
    totalSiswaSekolah: 1284,
    jenisTagihan: [
      { label: 'SPP bulanan', ket: 'Terbit otomatis tiap bulan', default: 450000, periode: 'Periode September 2026' },
      { label: 'Uang kegiatan', ket: 'Sekali per semester', default: 150000, periode: 'Semester 1 2026/2027' },
      { label: 'Seragam & buku', ket: 'Sesuai paket kelas', default: 385000, periode: 'Tahun ajaran 2026/2027' },
      { label: 'Tagihan lain', ket: 'Nominal bebas', default: 100000, periode: '2 September 2026' }
    ],
    tempoOpsi: [
      { label: '7 hari', ket: '9 Sep 2026', tanggal: '9 September 2026' },
      { label: '10 September', ket: 'standar SPP', tanggal: '10 September 2026' },
      { label: 'Akhir bulan', ket: '30 Sep 2026', tanggal: '30 September 2026' }
    ],
    draft: {
      jenis: 0,
      target: 0,
      kelasPilih: ['8A'],
      nominal: 450000,
      tempo: 1,
      kirimNotif: true,
      dendaOn: true,
      cicilan: false,
      terbit: false
    },
    // Data untuk halaman Daftar Akun (read-only, ditambahkan tanpa mengubah data lain)
    akunSiswa: [
      { nama: 'Zahra Alifia', kelas: '7A', nis: '24070118', ortu: 'Maya Kartika', status: 'Aktif' },
      { nama: 'Putri Anggita', kelas: '7A', nis: '24070142', ortu: 'Nur Hasanah', status: 'Aktif' },
      { nama: 'Bima Nugraha', kelas: '7A', nis: '24070165', ortu: 'Eko Wibowo', status: 'Aktif' },
      { nama: 'Salsabila Fitri', kelas: '7A', nis: '24070189', ortu: 'Yuni Astuti', status: 'Nonaktif' },
      { nama: 'Aditya Pratama', kelas: '7B', nis: '24071023', ortu: 'Sari Wulandari', status: 'Aktif' },
      { nama: 'Naufal Hakim', kelas: '7B', nis: '24071047', ortu: 'Dedi Hermawan', status: 'Aktif' },
      { nama: 'Citra Melati', kelas: '7B', nis: '24071066', ortu: 'Indah Permata', status: 'Aktif' },
      { nama: 'Rafi Ramadhan', kelas: '8A', nis: '24080411', ortu: 'Budi Santoso', status: 'Aktif' },
      { nama: 'Aisyah Ramadhani', kelas: '8A', nis: '24080433', ortu: 'Hendra Gunawan', status: 'Aktif' },
      { nama: 'Fajar Setiadi', kelas: '8A', nis: '24080458', ortu: 'Lestari Ningsih', status: 'Nonaktif' },
      { nama: 'Farel Mahendra', kelas: '8C', nis: '24081907', ortu: 'Agus Priyanto', status: 'Aktif' },
      { nama: 'Dinda Ayu Lestari', kelas: '8C', nis: '24081922', ortu: 'Wahyu Utomo', status: 'Aktif' },
      { nama: 'Galih Prasetyo', kelas: '8C', nis: '24081944', ortu: 'Ratna Sari', status: 'Aktif' },
      { nama: 'Nabila Azzahra', kelas: '9A', nis: '24090233', ortu: 'Dewi Anggraini', status: 'Aktif' },
      { nama: 'Kevin Alamsyah', kelas: '9A', nis: '24090251', ortu: 'Joko Susilo', status: 'Aktif' },
      { nama: 'Sekar Ayuningtyas', kelas: '9A', nis: '24090277', ortu: 'Rudi Haryanto', status: 'Nonaktif' },
      { nama: 'Bagas Setiawan', kelas: '9C', nis: '24093140', ortu: 'Rina Kusuma', status: 'Aktif' },
      { nama: 'Wulan Oktaviani', kelas: '9C', nis: '24093158', ortu: 'Anwar Sanusi', status: 'Aktif' },
      { nama: 'Reza Firmansyah', kelas: '9C', nis: '24093179', ortu: 'Siti Marlina', status: 'Aktif' }
    ],
    akunKantin: [
      { nama: 'Bu Ratna', outlet: 'Kantin Utama', peran: 'PIC Outlet', status: 'Aktif' },
      { nama: 'Bu Lilis', outlet: 'Kantin Blok B', peran: 'PIC Outlet', status: 'Nonaktif' },
      { nama: 'Pak Yusuf', outlet: 'Koperasi Sekolah', peran: 'PIC Outlet', status: 'Aktif' }
    ],
    akunAdmin: [
      { nama: 'Hendra Wijaya', peran: 'Admin Yayasan', status: 'Aktif' },
      { nama: 'Rina Kusuma', peran: 'Monitoring · read-only', status: 'Nonaktif' }
    ]
  }
  s.akunOrtu = seedOrtu(s.akunSiswa)
  return s
}

export const getters = {
  admin: (s) => s.peran === 'admin',
  status: (s) => (id) => {
    if (s.hasil[id]) return s.hasil[id]
    const item = s.antrean.find((x) => Number(x.id) === Number(id))
    return item && item.status === 'disetujui'
      ? 'Disetujui'
      : item && item.status === 'ditolak'
        ? 'Ditolak'
        : 'Menunggu Verifikasi'
  },
  menunggu: (s, g) => s.antrean.filter((a) => g.status(a.id) === 'Menunggu Verifikasi'),
  disetujui: (s, g) => s.antrean.filter((a) => g.status(a.id) === 'Disetujui'),
  ditolak: (s, g) => s.antrean.filter((a) => g.status(a.id) === 'Ditolak'),
  // Total & jumlah top-up disetujui secara realtime: baseline historis + yang baru
  // disetujui admin di halaman Verifikasi Top-up. Dipakai langsung oleh Laporan & Rekonsiliasi.
  totalDisetujui: (s, g) => s.topupHistoris.total + g.disetujui.filter((x) => !x.tagihan_id).reduce((a, x) => a + (x.dasar + x.kode), 0),
  jumlahDisetujui: (s, g) => s.topupHistoris.jumlah + g.disetujui.filter((x) => !x.tagihan_id).length,
  pilih: (s) => s.antrean.find((a) => a.id === s.pilihId) || s.antrean[0],
  kelasTerpilih: (s) => s.kelas.filter((k) => s.draft.kelasPilih.indexOf(k.kelas) >= 0),
  jumlahPenerima: (s, g) => {
    if (s.draft.target === 2) return s.totalSiswaSekolah
    if (s.draft.target === 1) {
      const angkatan = g.kelasTerpilih.map((k) => k.kelas[0])
      return s.kelas.filter((k) => angkatan.indexOf(k.kelas[0]) >= 0).reduce((a, k) => a + k.n, 0)
    }
    return g.kelasTerpilih.reduce((a, k) => a + k.n, 0)
  },
  contohPenerima: (s, g) => (s.draft.target === 2 ? s.kelas[0] : g.kelasTerpilih[0] || s.kelas[0]),
  totalTerbit: (s, g) => s.draft.nominal * g.jumlahPenerima,
  // Daftar nama kelas unik (dari data akun siswa) untuk halaman Daftar Akun
  daftarKelasAkun: (s) =>
    s.akunSiswa
      .reduce((a, u) => (a.indexOf(u.kelas) >= 0 ? a : a.concat([u.kelas])), [])
      .sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
  // Akun siswa terkelompok per kelas
  akunSiswaPerKelas: (s, g) => g.daftarKelasAkun.map((k) => ({ kelas: k, siswa: s.akunSiswa.filter((u) => u.kelas === k) })),
  akunSiswaKelas: (s) => (k) => s.akunSiswa.filter((u) => u.kelas === k),
  // Anak (akun siswa) yang terhubung ke seorang orang tua, dicocokkan lewat nama
  anakOrtu: (s) => (nama) => s.akunSiswa.filter((u) => u.ortu === nama)
}

export const mutations = {
  setPeran(s, v) { s.peran = v; s.alasan = '' },
  setPilih(s, id) { s.pilihId = id; s.alasan = '' },
  setAlasan(s, v) { s.alasan = v },
  setHasil(s, { id, status, alasan, waktu }) {
    s.hasil = Object.assign({}, s.hasil, { [id]: status })
    s.alasanTolak = Object.assign({}, s.alasanTolak, { [id]: status === 'Ditolak' ? alasan || '' : '' })
    s.waktuHasil = Object.assign({}, s.waktuHasil, { [id]: waktu || '' })
  },
  // Mengembalikan permintaan yang sudah diputuskan ke antrean "Menunggu"
  resetHasil(s, id) {
    const { [id]: _h, ...hasil } = s.hasil
    const { [id]: _a, ...alasanTolak } = s.alasanTolak
    const { [id]: _w, ...waktuHasil } = s.waktuHasil
    s.hasil = hasil
    s.alasanTolak = alasanTolak
    s.waktuHasil = waktuHasil
  },
  setBuktiUnggahan(s, { id, bukti }) {
    s.buktiUnggahan = Object.assign({}, s.buktiUnggahan, {
      [id]: bukti ? Object.assign({}, bukti, { diunggah_at: bukti.diunggah_at || null }) : null
    })
  },
  clearBukti(s, id) {
    const { [id]: _b, ...buktiUnggahan } = s.buktiUnggahan
    s.buktiUnggahan = buktiUnggahan
  },
  setAntreanTopup(s, rows) {
    s.antrean = rows.map((row) => ({
      id: Number(row.id),
      siswa_id: Number(row.siswa_id),
      siswa: row.siswa || '',
      kelas: row.kelas || '-',
      ortu: row.ortu || '',
      dasar: Number(row.nominal || row.dasar || 0),
      kode: Number(row.kode_unik || row.kode || 0),
      waktu: row.waktu || '',
      cocok: false,
      status: row.status,
      alasan_tolak: row.alasan_tolak || '',
      tagihan_id: row.tagihan_id || null,
      tujuan: row.tujuan || 'Saldo saku',
      bukti_tersedia: Boolean(row.bukti_tersedia),
      bukti_diunggah_at: row.bukti_diunggah_at || null
    }))
    const status = {}
    const reasons = {}
    s.antrean.forEach((row) => {
      if (row.status === 'disetujui') status[row.id] = 'Disetujui'
      if (row.status === 'ditolak') {
        status[row.id] = 'Ditolak'
        reasons[row.id] = row.alasan_tolak
      }
    })
    s.hasil = status
    s.alasanTolak = reasons
  },
  // Perbarui data permintaan di antrean sesuai transfer yang diajukan orang tua
  sinkronPermintaan(s, { id, ...patch }) {
    s.antrean = s.antrean.map((a) => (a.id === id ? Object.assign({}, a, patch) : a))
  },
  setOutlet(s, i) { s.outlet = Number(i) },
  // Pendaftaran akun dari modal "Tambah akun"
  tambahAkunOrtu(s, akun) { s.akunOrtu = s.akunOrtu.concat([akun]) },
  tambahAkunSiswa(s, akun) { s.akunSiswa = s.akunSiswa.concat([akun]) },
  tambahAkunKantin(s, akun) { s.akunKantin = s.akunKantin.concat([akun]) },
  patchDraft(s, patch) { s.draft = Object.assign({}, s.draft, patch, { terbit: patch.terbit === true }) },
  terbitkan(s) { s.draft = Object.assign({}, s.draft, { terbit: true }) },
  toggleKelas(s, kelas) {
    const cur = s.draft.kelasPilih.slice()
    const ix = cur.indexOf(kelas)
    if (ix >= 0) cur.splice(ix, 1)
    else cur.push(kelas)
    s.draft = Object.assign({}, s.draft, { kelasPilih: cur, terbit: false })
  }
}

export const actions = {
  async muatAntreanTopup({ commit }) {
    const { topup } = await api.antreanTopup()
    commit('setAntreanTopup', topup || [])
    return topup || []
  },
  async muatBuktiTopup({ commit }, id) {
    try {
      const { bukti } = await api.buktiTopup(id)
      commit('setBuktiUnggahan', { id, bukti })
      return bukti
    } catch (error) {
      if (error.status === 404) {
        commit('clearBukti', id)
        return null
      }
      throw error
    }
  },
  async tolakPermintaan({ commit }, { id, alasan, waktu }) {
    await api.tolakTopup(id, alasan)
    commit('setHasil', { id, status: 'Ditolak', alasan, waktu })
  },
  async setujuiPermintaan({ commit }, { id, waktu }) {
    const result = await api.approveTopup(id)
    commit('setHasil', { id, status: 'Disetujui', waktu })
    return result
  },
  async verifikasiSemuaTopup(_, ids) {
    return api.verifikasiSemuaTopup(ids)
  },
  async terimaKembaliTopup({ commit }, { id, waktu }) {
    const result = await api.terimaKembaliTopup(id)
    commit('setHasil', { id, status: 'Disetujui', waktu })
    return result
  }
}
