import { api, setToken } from '~/utils/api'

const TOKEN_KEY = 'finka_token_v2'

function storage() { return typeof window !== 'undefined' ? window.sessionStorage : null }

function bersihkanDataSesi(commit) {
  commit('ortu/reset', null, { root: true })
  commit('profil-siswa/reset', null, { root: true })
  commit('topup/reset', null, { root: true })
  commit('setSiswa', [], { root: true })
  commit('setProduk', [], { root: true })
  commit('setLimitOn', false, { root: true })
  commit('setLimit', 25000, { root: true })
  commit('setLimitPakai', 0, { root: true })
  commit('setBlokir', false, { root: true })
  commit('setInfoPembayaran', null, { root: true })
}

export const state = () => ({
  token: null,
  user: null,
  siap: false // sudah selesai cek localStorage saat load pertama?
})

export const getters = {
  sudahLogin: (s) => !!s.token,
  peran: (s) => (s.user ? s.user.role : null)
}

export const mutations = {
  setAuth(s, { token, user }) { s.token = token; s.user = user },
  setSiap(s, v) { s.siap = v }
}

export const actions = {
  async login({ commit }, { username, password }) {
    const data = await api.login(username, password)
    bersihkanDataSesi(commit)
    setToken(data.token)
    const st = storage(); if (st) st.setItem(TOKEN_KEY, data.token)
    let user = data.user
    try {
      const profile = await api.me()
      user = profile.user
    } catch (error) {
      setToken(null)
      if (st) st.removeItem(TOKEN_KEY)
      throw error
    }
    commit('setAuth', { token: data.token, user })
    return user
  },

  logout({ commit }) {
    setToken(null)
    const st = storage(); if (st) st.removeItem(TOKEN_KEY)
    commit('setAuth', { token: null, user: null })
    bersihkanDataSesi(commit)
  },

  // Dipanggil sekali saat app dimuat di browser: pulihkan sesi dari token
  // tersimpan supaya refresh halaman tidak selalu balik ke /login.
  async rehydrate({ commit }) {
    if (typeof window === 'undefined') return
    const st = storage()
    const token = st ? st.getItem(TOKEN_KEY) : null
    if (!token) { commit('setSiap', true); return }
    setToken(token)
    try {
      const { user } = await api.me()
      commit('setAuth', { token, user })
    } catch (e) {
      st.removeItem(TOKEN_KEY)
    }
    commit('setSiap', true)
  }
}
