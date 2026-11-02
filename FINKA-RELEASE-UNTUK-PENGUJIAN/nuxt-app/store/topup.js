import { api } from '~/utils/api'

export const state = () => ({
  anakAktifId: null,
  nominal: 100000,
  kode: 0,
  id: null,
  status: 'idle',
  tagihanId: null,
  alasan: '',
  buktiInfo: null,
  waktuDiajukan: null,
  waktuDiproses: null,
  buktiTersedia: false,
  buktiDiunggahAt: null
})

export const getters = {
  transfer: (s) => Number(s.nominal || 0) + Number(s.kode || 0),
  kodeStr: (s) => String(s.kode || 0).padStart(3, '0')
}

export const mutations = {
  setAnak(s, id) { s.anakAktifId = id === null ? null : Number(id) },
  setNominal(s, nominal) { s.nominal = Number(nominal) || 0 },
  setTagihan(s, id) { s.tagihanId = id === null ? null : Number(id) },
  setId(s, id) { s.id = id === null ? null : Number(id) },
  setStatus(s, status) { s.status = status || 'idle' },
  setAlasan(s, alasan) { s.alasan = alasan || '' },
  setBukti(s, bukti) { s.buktiInfo = bukti || null },
  setPermintaan(s, topup) {
    s.id = Number(topup.id)
    s.anakAktifId = Number(topup.siswa_id)
    s.nominal = Number(topup.nominal)
    s.kode = Number(topup.kode_unik)
    s.tagihanId = topup.tagihan_id ? Number(topup.tagihan_id) : null
    s.status = topup.status
    s.alasan = topup.alasan_tolak || ''
    s.waktuDiajukan = topup.waktu || null
    s.waktuDiproses = topup.diproses_at || null
    s.buktiTersedia = Boolean(topup.bukti_tersedia)
    s.buktiDiunggahAt = topup.bukti_diunggah_at || null
  },
  reset(s) {
    s.id = null
    s.kode = 0
    s.status = 'idle'
    s.alasan = ''
    s.buktiInfo = null
    s.waktuDiajukan = null
    s.waktuDiproses = null
    s.buktiTersedia = false
    s.buktiDiunggahAt = null
  }
}

export const actions = {
  async ajukan({ state, commit, rootState }, pin) {
    const anakId = state.anakAktifId || rootState.ortu.anakAktifId
    if (!anakId) throw new Error('Pilih anak yang akan menerima saldo.')
    if (!Number.isInteger(Number(state.nominal)) || Number(state.nominal) <= 0) {
      throw new Error('Nominal isi saldo tidak valid.')
    }
    const response = await api.ajukanTopup(anakId, state.nominal, state.tagihanId, pin)
    const topup = response.topup || response
    commit('setPermintaan', topup)
    return topup
  },
  async refreshStatus({ state, commit }, id) {
    const requestId = Number(id || state.id)
    if (!Number.isInteger(requestId) || requestId <= 0) throw new Error('ID permintaan top-up tidak valid.')
    const { topup } = await api.statusTopup(requestId)
    commit('setPermintaan', topup)
    return topup
  },
  mulaiTopup({ commit }, nominal) {
    commit('reset')
    commit('setTagihan', null)
    if (nominal) commit('setNominal', nominal)
  },
  mulaiBayarTagihan({ commit }, { id, nominal, siswaId }) {
    commit('reset')
    commit('setTagihan', id)
    commit('setAnak', siswaId)
    commit('setNominal', nominal)
  }
}
