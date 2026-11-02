export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const store = useNuxtApp().$store
  const role = store.state.auth && store.state.auth.user ? store.state.auth.user.role : null
  if (role !== 'siswa') return navigateTo(role === 'admin' ? '/admin' : role === 'pic' ? '/pic' : role === 'ortu' ? '/ortu' : '/login')
})
