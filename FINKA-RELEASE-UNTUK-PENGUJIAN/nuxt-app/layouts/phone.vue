<template>
  <div class="stage">
    <PhoneShell :dark="dark">
      <div v-if="showLogout" class="phone-logout-wrap">
        <nuxt-link v-if="$route.path !== '/akun/password'" to="/akun/password" class="phone-logout phone-logout--pw">Password</nuxt-link>
        <button class="phone-logout" type="button" @click="logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <path d="M16 17l5-5-5-5"/>
            <path d="M21 12H9"/>
          </svg>
          <span>Keluar</span>
        </button>
      </div>
      <slot />
    </PhoneShell>
  </div>
</template>

<script>
export default {
  computed: {
    dark() {
      const p = this.$route.path
      return p.indexOf('/siswa') === 0
    },
    showLogout() {
      const p = this.$route.path
      const role = this.$store.state.auth.user && this.$store.state.auth.user.role
      if (role === 'siswa' || role === 'ortu' || role === 'pic' || role === 'kantin' ||
        p.indexOf('/siswa') === 0 || p.indexOf('/ortu') === 0 || p.indexOf('/pic') === 0) return false
      return p !== '/login' && this.$store.getters['auth/sudahLogin']
    }
  },
  methods: {
    async logout() {
      await this.$store.dispatch('auth/logout')
      this.$router.replace('/login')
    }
  }
}
</script>

<style scoped>
.phone-logout-wrap {
  position: absolute;
  top: 9px;
  right: 14px;
  z-index: 20;
  display: flex;
  gap: 6px;
}
.phone-logout--pw { text-decoration: none; }
.phone-logout {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid rgba(0,0,0,.1); background: rgba(255,255,255,.92);
  color: var(--ink); border-radius: 999px; padding: 5px 8px;
  cursor: pointer; font: 700 10px var(--font-body);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.phone-logout:hover { color: var(--coral); border-color: var(--coral); }
.phone--dark .phone-logout { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.2); }
.phone--dark .phone-logout:hover { color: #fff; border-color: rgba(255,255,255,.5); }
.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
@media (max-width: 480px) {
  .stage { min-height: 100vh; min-height: 100dvh; padding: 0; display: block; }
}
</style>
