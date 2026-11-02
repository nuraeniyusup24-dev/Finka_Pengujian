import { createStore } from 'vuex'
import * as root from '~/store/index'
import * as auth from '~/store/auth'
import * as admin from '~/store/admin'
import * as ortu from '~/store/ortu'
import * as pic from '~/store/pos'
import * as profilSiswa from '~/store/profil-siswa'
import * as topup from '~/store/topup'

function moduleOptions(module) {
  return {
    namespaced: true,
    state: module.state,
    getters: module.getters,
    mutations: module.mutations,
    actions: module.actions
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const store = createStore({
    state: root.state,
    getters: root.getters,
    mutations: root.mutations,
    actions: root.actions,
    modules: {
      auth: moduleOptions(auth),
      admin: moduleOptions(admin),
      ortu: moduleOptions(ortu),
      pos: moduleOptions(pic),
      'profil-siswa': moduleOptions(profilSiswa),
      topup: moduleOptions(topup)
    }
  })

  nuxtApp.vueApp.use(store)
  nuxtApp.provide('store', store)
})
