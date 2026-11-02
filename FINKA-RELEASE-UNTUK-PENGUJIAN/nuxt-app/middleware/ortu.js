export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const store = useNuxtApp().$store
  const role = store.state.auth && store.state.auth.user ? store.state.auth.user.role : null
  if (role !== 'ortu') {
    if (role === 'admin') return navigateTo('/admin')
    if (role === 'pic') return navigateTo('/pic')
    if (role === 'siswa') return navigateTo('/siswa')
    return navigateTo('/login')
  }
})
