<template>
  <div class="phone" :class="dark ? 'phone--dark' : ''">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'PhoneShell',
  props: {
    dark: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.phone {
  width: 390px;
  height: 844px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 28px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}
.phone--dark { background: var(--navy); }

@media (max-width: 480px) {
  .phone { width: 100%; height: 100vh; height: 100dvh; border: none; border-radius: 0; }
}
</style>
