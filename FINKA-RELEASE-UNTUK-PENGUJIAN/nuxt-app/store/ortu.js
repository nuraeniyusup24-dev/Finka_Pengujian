/**
 * Vuex module untuk akun Orang Tua.
 * State di sini dipakai bersama oleh dashboard, tagihan, riwayat,
 * isi saldo, dan notifikasi.
 */
import { api } from '~/utils/api'

function inisialDari(nama) {
  return (nama || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// Kunci unik satu notifikasi. Dipakai untuk menandai "sudah dibaca" di lencana lonceng
// dan di halaman Notifikasi. Perubahan status (mis. menunggu -> diterima) menghasilkan
// tipe baru sehingga notifikasinya muncul lagi sebagai belum dibaca.
export function kunciNotifikasi(n) {
  const ref = n.id != null ? n.id : (n.tagihanId != null ? n.tagihanId : '')
  const siswa = n.siswa_id != null ? n.siswa_id : (n.anakId != null ? n.anakId : '')
  return [n.tipe || '', ref, siswa].join(':')
}

// Status baca disimpan per akun di browser agar tetap ada setelah halaman dimuat ulang.
const KUNCI_DIBACA = 'finka_notif_dibaca_v1_'
const MAKS_DIBACA = 500

function bacaDibaca(pemilikId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return []
    const raw = window.localStorage.getItem(KUNCI_DIBACA + pemilikId)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.map(String) : []
  } catch (e) { return [] }
}

function simpanDibaca(pemilikId, list) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(KUNCI_DIBACA + pemilikId, JSON.stringify(list.slice(-MAKS_DIBACA)))
  } catch (e) { /* penyimpanan penuh/diblokir: status baca hanya berlaku selama sesi */ }
}

export const state = () => ({
  anak: [], // [{ id, nama, kelas, nis, saldo }]
  anakAktifId: null,
  tagihan: {}, // siswaId -> [tagihan...]
  riwayat: {}, // siswaId -> [ledger...]
  memuatAnak: false,
  riwayatPembayaran: [],
  notifikasiStatus: [],
  dibaca: [], // kunci notifikasi yang sudah dibaca
  dibacaPemilikId: null // id akun pemilik daftar 'dibaca' di atas
})

export const getters = {
  aktif: (s) => s.anak.find((a) => a.id === s.anakAktifId) || s.anak[0] || null,
  tagihanAktif: (s, g) => (g.aktif ? s.tagihan[g.aktif.id] || [] : []),
  tagihanSemua: (s) => {
    const out = []
    Object.keys(s.tagihan).forEach((siswaId) => {
      const anak = s.anak.find((a) => String(a.id) === String(siswaId))
      ;(s.tagihan[siswaId] || []).forEach((t) => out.push(Object.assign({ anakNama: anak ? anak.nama : '' }, t)))
    })
    return out
  },
  belumBayarSemua: (s, g) => g.tagihanSemua.filter((t) => t.status === 'belum_bayar').length,
  notifikasi: (s, g) => {
    const out = []
    const AMBANG_MENIPIS = 20000
    const sekarang = new Date()
    const batas = new Date(sekarang)
    batas.setDate(batas.getDate() + 7)

    s.anak.forEach((anak) => {
      if (Number(anak.saldo) < AMBANG_MENIPIS) {
        out.push({
          tipe: 'saldo',
          judul: 'Saldo anak menipis',
          isi: `${anak.nama} memiliki saldo ${Number(anak.saldo || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}. Pertimbangkan isi saldo sebelum digunakan di kantin.`,
          waktu: 'Sekarang',
          baru: true,
          prioritas: 1,
          anakId: anak.id
        })
      }
    })

    const tagihanSudahDiberitahu = new Set(s.notifikasiStatus.map((n) => String(n.tagihan_id || '')).filter(Boolean))
    g.tagihanSemua.filter((t) => t.status === 'belum_bayar' && !tagihanSudahDiberitahu.has(String(t.id))).forEach((t) => {
      const jatuhTempo = t.jatuh_tempo ? new Date(`${t.jatuh_tempo}T23:59:59`) : null
      let judul = 'Tagihan belum dibayar'
      let isi = `${t.anakNama}: ${t.nama} sebesar ${Number(t.nominal || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}.`
      let prioritas = 3

      if (jatuhTempo && jatuhTempo < sekarang) {
        judul = 'Tagihan sudah jatuh tempo'
        isi += ` Jatuh tempo ${t.jatuh_tempo}.`
        prioritas = 1
      } else if (jatuhTempo && jatuhTempo <= batas) {
        judul = 'Tagihan segera jatuh tempo'
        isi += ` Jatuh tempo ${t.jatuh_tempo}.`
        prioritas = 2
      } else if (t.jatuh_tempo) {
        isi += ` Jatuh tempo ${t.jatuh_tempo}.`
      }

      out.push({ tipe: 'tagihan', judul, isi, waktu: t.jatuh_tempo ? `Jatuh tempo ${t.jatuh_tempo}` : 'Belum dibayar', baru: true, prioritas, anakId: t.siswa_id, tagihanId: t.id })
    })

    return out.sort((a, b) => a.prioritas - b.prioritas)
  },
  jumlahNotifikasi: (s, g) => g.notifikasi.length + s.notifikasiStatus.length,
  semuaNotifikasi: (s, g) => s.notifikasiStatus.concat(g.notifikasi),
  // Angka pada lencana lonceng: hanya notifikasi yang belum dibaca
  jumlahBelumDibaca: (s, g) => g.semuaNotifikasi.filter((n) => !s.dibaca.includes(kunciNotifikasi(n))).length,
  sudahDibaca: (s) => (n) => s.dibaca.includes(kunciNotifikasi(n)),
  riwayatAktif: (s, g) => (g.aktif ? s.riwayat[g.aktif.id] || [] : [])
}

export const mutations = {
  setAnak(s, list) {
    s.anak = list.map((a) => Object.assign({ inisial: inisialDari(a.nama) }, a))
    if (!s.anak.some((a) => Number(a.id) === Number(s.anakAktifId))) s.anakAktifId = s.anak.length ? s.anak[0].id : null
  },
  setAnakAktif(s, id) { s.anakAktifId = id },
  setTagihan(s, { siswaId, list }) { s.tagihan = Object.assign({}, s.tagihan, { [siswaId]: list }) },
  setRiwayat(s, { siswaId, list }) { s.riwayat = Object.assign({}, s.riwayat, { [siswaId]: list }) },
  setSaldo(s, { siswaId, saldo }) {
    const a = s.anak.find((x) => x.id === siswaId)
    if (a) a.saldo = saldo
  },
  setKontrolAnak(s, { siswaId, control }) {
    const anak = s.anak.find((x) => Number(x.id) === Number(siswaId))
    if (anak) Object.assign(anak, control)
  },
  setMemuatAnak(s, v) { s.memuatAnak = v },
  setRiwayatPembayaran(s, list) { s.riwayatPembayaran = list },
  setNotifikasiStatus(s, list) { s.notifikasiStatus = list },
  setDibaca(s, { pemilikId, list }) { s.dibacaPemilikId = pemilikId; s.dibaca = list },
  tambahDibaca(s, keys) { s.dibaca = s.dibaca.concat(keys) },
  reset(s) {
    s.anak = []; s.anakAktifId = null; s.tagihan = {}; s.riwayat = {}
    s.memuatAnak = false; s.riwayatPembayaran = []; s.notifikasiStatus = []
    s.dibaca = []; s.dibacaPemilikId = null
  }
}

export const actions = {
  // Muat daftar notifikasi yang sudah dibaca milik akun yang sedang login (sekali per akun)
  muatDibaca({ commit, state, rootState }) {
    const user = rootState.auth.user
    if (!user || user.role !== 'ortu') return
    if (state.dibacaPemilikId === user.id) return
    commit('setDibaca', { pemilikId: user.id, list: bacaDibaca(user.id) })
  },
  // Tandai satu atau beberapa notifikasi (objek notifikasi) sebagai sudah dibaca
  async tandaiDibaca({ commit, dispatch, state, rootState }, daftar) {
    const user = rootState.auth.user
    if (!user || user.role !== 'ortu') return
    await dispatch('muatDibaca')
    const keys = (daftar || []).map(kunciNotifikasi).filter((k, i, arr) => !state.dibaca.includes(k) && arr.indexOf(k) === i)
    if (!keys.length) return
    commit('tambahDibaca', keys)
    simpanDibaca(user.id, state.dibaca)
  },
  async muatAnak({ commit, dispatch, rootState }) {
    const pemilikId = rootState.auth.user && rootState.auth.user.id
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu') return []
    await dispatch('muatDibaca')
    commit('setMemuatAnak', true)
    try {
      const { anak } = await api.anakAnak()
      const userTerbaru = rootState.auth.user
      if (!userTerbaru || userTerbaru.role !== 'ortu' || Number(userTerbaru.id) !== Number(pemilikId)) return []
      commit('setAnak', anak)
      return anak
    } finally {
      commit('setMemuatAnak', false)
    }
  },
  async muatTagihan({ commit, rootState }, siswaId) {
    const pemilikId = rootState.auth.user && rootState.auth.user.id
    const { tagihan } = await api.tagihan(siswaId)
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu' || Number(rootState.auth.user.id) !== Number(pemilikId)) return []
    commit('setTagihan', { siswaId, list: tagihan })
    return tagihan
  },
  async muatRiwayat({ commit, rootState }, siswaId) {
    const pemilikId = rootState.auth.user && rootState.auth.user.id
    const { riwayat } = await api.riwayat(siswaId)
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu' || Number(rootState.auth.user.id) !== Number(pemilikId)) return []
    commit('setRiwayat', { siswaId, list: riwayat })
    return riwayat
  },
  async muatPembayaran({ commit, dispatch, rootState }) {
    const pemilikId = rootState.auth.user && rootState.auth.user.id
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu') return null
    await dispatch('muatDibaca')
    const { riwayat } = await api.riwayatPembayaran()
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu' || Number(rootState.auth.user.id) !== Number(pemilikId)) return null
    commit('setRiwayatPembayaran', riwayat || [])
    const { notifikasi } = await api.notifikasiOrtu()
    if (!rootState.auth.user || rootState.auth.user.role !== 'ortu' || Number(rootState.auth.user.id) !== Number(pemilikId)) return null
    commit('setNotifikasiStatus', notifikasi || [])
  },
  async refreshSaldo({ commit }, siswaId) {
    const { saldo } = await api.saldo(siswaId)
    commit('setSaldo', { siswaId, saldo })
  }
}