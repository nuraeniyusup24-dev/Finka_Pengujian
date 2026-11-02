import { api } from '~/utils/api'
import { trxDariLedger } from '~/utils/adapt'

export const state = () => ({
  profil: null,
  saldo: null,
  riwayat: [],
  memuat: false,
  error: ''
})

export const getters = {
  siswa: (s) => s.profil,
  transaksi: (s) => s.riwayat.map(trxDariLedger),
  hariIni: (s, g) => {
    const list = g.transaksi
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const today = parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value + '-' + parts.find((p) => p.type === 'day').value
    return list.filter((t) => t.tanggalKey === today).slice(0, 3)
  }
}

export const mutations = {
  setProfil(s, p) { s.profil = p },
  setSaldo(s, n) { s.saldo = Number(n) || 0 },
  setRiwayat(s, rows) { s.riwayat = rows || [] },
  setMemuat(s, v) { s.memuat = v },
  setError(s, v) { s.error = v },
  reset(s) { s.profil = null; s.saldo = null; s.riwayat = []; s.memuat = false; s.error = '' }
}

export const actions = {
  async muat({ commit, rootState }) {
    const user = rootState.auth.user
    if (!user || user.role !== 'siswa') return null
    commit('setMemuat', true)
    commit('setError', '')
    try {
      const [{ siswa }, { saldo }, { riwayat }] = await Promise.all([
        api.profilSiswa(user.id),
        api.saldo(user.id),
        api.riwayat(user.id)
      ])
      const userTerbaru = rootState.auth.user
      if (!userTerbaru || userTerbaru.role !== 'siswa' || Number(userTerbaru.id) !== Number(user.id)) return null
      commit('setProfil', siswa)
      commit('setSaldo', saldo)
      commit('setRiwayat', riwayat)
      return siswa
    } catch (e) {
      commit('setError', e.message || 'Data siswa gagal dimuat.')
      return null
    } finally {
      commit('setMemuat', false)
    }
  },
  async refresh({ dispatch }) { return dispatch('muat') }
}

