<template>
  <nav class="tabbar">
    <nuxt-link v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="isActive(t) ? 'tab--on' : ''">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path v-for="(d, i) in t.paths" :key="i" :d="d" />
      </svg>
      <span>{{ t.label }}</span>
    </nuxt-link>
  </nav>
</template>

<script>
export default {
  name: 'OrtuTabBar',
  data() {
    return {
      tabs: [
        { label: 'Beranda', to: '/ortu', paths: ['M3 10.5L12 3l9 7.5', 'M5 9.5V21h14V9.5'] },
        { label: 'Tagihan', to: '/ortu/tagihan', paths: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'] },
        { label: 'Riwayat', to: '/ortu/riwayat', paths: ['M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8', 'M3 4v4h4', 'M12 7v5l3 2'] },
        { label: 'Kontrol', to: '/ortu/kontrol', paths: ['M12 3l7.5 3v6c0 4.5-3 7.6-7.5 9-4.5-1.4-7.5-4.5-7.5-9V6z', 'M9.5 12l1.8 1.8L15 10'] },
        { label: 'Notifikasi', to: '/ortu/notifikasi', paths: ['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 01-3.4 0'] }
      ]
    }
  },
  methods: {
    isActive(t) {
      return t.to === '/ortu' ? this.$route.path === '/ortu' : this.$route.path.indexOf(t.to) === 0
    }
  }
}
</script>

<style scoped>
.tabbar {
  display: flex;
  background: #fff;
  border-top: 1px solid var(--line);
  padding: 10px 8px 22px;
  flex: none;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
  color: var(--muted);
  font: 600 10.5px var(--font-body);
}
.tab:hover { color: var(--muted); }
.tab--on, .tab--on:hover { color: var(--blue); }
</style>

