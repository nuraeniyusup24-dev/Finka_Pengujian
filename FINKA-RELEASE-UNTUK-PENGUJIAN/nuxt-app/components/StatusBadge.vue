<template>
  <span class="status-badge" :class="kelasStatus">
    {{ teks }}
  </span>
</template>

<script>
/**
 * Badge status yang dipakai bersama di halaman Admin dan Orang Tua.
 *
 * Status database tetap memakai bahasa teknis:
 * - menunggu
 * - disetujui
 * - ditolak
 *
 * Komponen ini hanya mengubah tampilan, bukan data di backend.
 */
export default {
  name: 'StatusBadge',

  props: {
    status: {
      type: String,
      default: 'menunggu'
    }
  },

  computed: {
    teks() {
      const label = {
        menunggu: 'Menunggu',
        disetujui: 'Diterima',
        ditolak: 'Ditolak'
      }

      return label[this.status] || this.status
    },

    kelasStatus() {
      const kelas = {
        menunggu: 'status-badge--menunggu',
        disetujui: 'status-badge--diterima',
        ditolak: 'status-badge--ditolak'
      }

      return kelas[this.status] || 'status-badge--netral'
    }
  }
}
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font: 600 11px var(--font-body);
  white-space: nowrap;
}

.status-badge--menunggu {
  background: rgba(192, 169, 127, 0.2);
  color: var(--sand-ink);
}

.status-badge--diterima {
  background: rgba(26, 128, 64, 0.1);
  color: var(--green);
}

.status-badge--ditolak {
  background: rgba(223, 74, 55, 0.1);
  color: var(--coral);
}

.status-badge--netral {
  background: var(--bg);
  color: var(--muted);
}
</style>

