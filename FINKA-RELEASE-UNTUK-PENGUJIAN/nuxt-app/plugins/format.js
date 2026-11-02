import Vue from 'vue'

export const num = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID')
export const rp = (n) => 'Rp ' + num(n)
export const parseRp = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 0

// "2 September 2026"
export const tanggal = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// "09.52"
export const jam = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')
}

export const waktu = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta'
  }).format(date)
}

export const sapaan = (d = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta'
  }).format(d))
  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export default defineNuxtPlugin((nuxtApp) => {
  Vue.filter('rp', rp)
  Vue.filter('num', num)
  Vue.filter('tanggal', tanggal)
  Vue.filter('jam', jam)
  Vue.filter('waktu', waktu)
  nuxtApp.vueApp.mixin({
    methods: { $rp: rp, $num: num, $parseRp: parseRp, $tanggal: tanggal, $jam: jam, $waktu: waktu, $sapaan: sapaan }
  })
  nuxtApp.provide('format', { rp, num, parseRp, tanggal, jam, waktu, sapaan })
})
