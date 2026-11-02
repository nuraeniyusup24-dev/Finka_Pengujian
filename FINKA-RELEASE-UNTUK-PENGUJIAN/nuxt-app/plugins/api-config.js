/**
 * Mengisi alamat API dari publicRuntimeConfig ke klien API (server & browser).
 */
import { setBaseUrl } from '~/utils/api'

export default defineNuxtPlugin(() => {
  setBaseUrl(useRuntimeConfig().public.apiBaseUrl)
})
