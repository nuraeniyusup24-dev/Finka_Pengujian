<template>
  <div class="empty-state" role="status">
    <div v-if="ikon" class="empty-state__icon" aria-hidden="true">{{ ikon }}</div>
    <strong v-if="judul" class="empty-state__title">{{ judul }}</strong>
    <p v-if="pesan" class="empty-state__message">{{ pesan }}</p>
    <slot />
  </div>
</template>

<script>
/**
 * Tampilan standar ketika daftar data masih kosong.
 * Gunakan komponen ini agar halaman tidak memiliki markup kosong yang berbeda-beda.
 */
export default {
  name: 'EmptyState',

  props: {
    ikon: {
      type: String,
      default: ''
    },
    judul: {
      type: String,
      default: ''
    },
    pesan: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 18px;
  text-align: center;
  color: var(--muted);
}

.empty-state__icon {
  font-size: 24px;
  line-height: 1;
  margin-bottom: 4px;
}

.empty-state__title {
  color: var(--ink);
  font: 700 13px var(--font-display);
}

.empty-state__message {
  max-width: 360px;
  margin: 0;
  font: 400 12px/1.5 var(--font-body);
}
</style>

