export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const store = useNuxtApp().$store
  const cekDanRedirect = () => {
    if (!store.state.auth.token) {
      return navigateTo('/login?next=' + encodeURIComponent(to.fullPath))
    }
    const u = store.state.auth.user
    if (u && u.wajib_ganti_password && to.path !== '/akun/password') return navigateTo('/akun/password')
    if (u && u.wajib_buat_pin && to.path !== '/akun/pin') return navigateTo('/akun/pin')
  }

  if (!store.state.auth.siap) {
    await new Promise((resolve) => {
      const stop = store.watch(
        (state) => state.auth.siap,
        (siap) => {
          if (siap) {
            stop()
            resolve()
          }
        }
      )
    })
  }

  return cekDanRedirect()
})
