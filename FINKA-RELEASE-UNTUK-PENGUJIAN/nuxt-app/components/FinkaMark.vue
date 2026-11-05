<script setup>
defineProps({
  width: { type: [Number, String], default: 26 },
  height: { type: [Number, String], default: 28 },
  color: { type: String, default: 'currentColor' }
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    viewBox="0 0 40 44"
    :style="{ color }"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="13" y="0" width="27" height="14" rx="6" />
    <rect x="0" y="10" width="14" height="14" rx="6" />
    <rect x="9" y="15" width="24" height="14" rx="6" />
    <rect x="4" y="30" width="14" height="14" rx="6" />
  </svg>
</template>
