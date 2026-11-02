import Vue from 'vue'

// State reaktif bersama untuk waktu "sekarang".
// Semua komponen yang memakai this.$clock.now lewat computed
// akan otomatis re-render saat nilainya berubah — tanpa perlu refresh halaman.
const clockState = Vue.observable({ now: new Date() })

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    setInterval(() => {
      clockState.now = new Date()
    }, 30000) // update tiap 30 detik, cukup untuk tanggal & jam berjalan realtime
  }
  nuxtApp.provide('clock', clockState)
})
