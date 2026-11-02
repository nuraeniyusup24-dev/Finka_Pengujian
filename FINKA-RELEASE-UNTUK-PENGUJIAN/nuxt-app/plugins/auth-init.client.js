export default defineNuxtPlugin(async (nuxtApp) => {
  await nuxtApp.$store.dispatch('auth/rehydrate')
})
