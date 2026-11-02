<template>
  <div class="head" :class="dark ? 'head--dark' : ''">
    <nuxt-link v-if="to" :to="to" class="back" aria-label="Kembali">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg>
    </nuxt-link>
    <div class="title display">{{ title }}</div>
    <slot />
  </div>
</template>

<script>
export default {
  name: 'ScreenHeader',
  props: {
    title: { type: String, required: true },
    to: { type: [String, Object], default: null },
    dark: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px 16px;
  border-bottom: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  flex: none;
}
.head--dark {
  background: transparent;
  border-bottom: none;
  color: #fff;
  padding: 14px 22px 20px;
}
.back { display: flex; align-items: center; justify-content: center; color: inherit; flex: none; }
.title { font: 700 16px var(--font-display); color: inherit; flex: 1; }
</style>
