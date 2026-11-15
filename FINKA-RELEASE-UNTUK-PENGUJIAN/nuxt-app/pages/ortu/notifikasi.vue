<template>
  <div class="notification-page">
    <!-- Header Sticky -->
    <header class="page-header">
      <button type="button" class="back-btn" aria-label="Kembali" @click="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 class="page-title">Notifikasi</h1>
    </header>

    <!-- Konten Utama -->
    <main class="page-content">
      <div class="section-header">
        <p class="section-subtitle">Notifikasi terbaru akun dan transaksi.</p>
        <button
          v-if="hasUnread"
          type="button"
          class="mark-all-btn"
          @click="markAllAsRead"
        >
          Tandai semua dibaca
        </button>
      </div>

      <!-- State Loading -->
      <div v-if="isLoading" class="state-box">
        <p>Memuat notifikasi...</p>
      </div>

      <!-- State Kosong -->
      <div v-else-if="notifications.length === 0" class="state-box">
        <p class="empty-title">Belum ada notifikasi</p>
        <p class="empty-desc">Semua informasi transaksi dan tagihan akan muncul di sini.</p>
      </div>

      <!-- Daftar Notifikasi (Gaya Card Rapi & Fleksibel seperti Riwayat Transaksi) -->
      <div v-else class="notification-list-card">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'is-unread': !item.is_read }"
          @click="handleNotificationClick(item)"
        >
          <!-- Kolom Kiri: Titik Indikator Read/Unread -->
          <div class="dot-column">
            <span
              class="status-dot"
              :class="item.is_read ? 'dot-read' : 'dot-unread'"
            ></span>
          </div>

          <!-- Kolom Tengah: Judul, Nama Anak/Keterangan, & Waktu -->
          <div class="content-column">
            <h3 class="notif-title">{{ item.title }}</h3>
            <p v-if="item.subtitle || item.student_name" class="notif-subtitle">
              {{ item.subtitle || item.student_name }}
            </p>
            <span class="notif-time">{{ formatTanggal(item.created_at) }}</span>
          </div>

          <!-- Kolom Kanan: Badge Status (Opsional jika tipe transaksi) -->
          <div v-if="item.status_label" class="badge-column">
            <span class="status-badge" :class="getBadgeStyle(item.status_type)">
              {{ item.status_label }}
            </span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoading = ref(false)

// Data notifikasi (Sesuaikan mapping field ini dengan response API backend Finka jika sudah terhubung)
const notifications = ref([
  {
    id: 1,
    title: 'Top-up saldo ditolak',
    subtitle: 'Aditya Pratama • Rp 100.000',
    created_at: '15 Nov 2026, 20.20',
    is_read: false,
    status_label: 'Ditolak',
    status_type: 'danger',
    target_route: '/orangtua/riwayat'
  },
  {
    id: 2,
    title: 'Top-up saldo diterima',
    subtitle: 'Aditya Pratama • Rp 100.000',
    created_at: '15 Nov 2026, 20.20',
    is_read: true,
    status_label: 'Diterima',
    status_type: 'success',
    target_route: '/orangtua/riwayat'
  },
  {
    id: 3,
    title: 'Pembayaran SPP bulanan Periode November 2026',
    subtitle: 'Kayla Pratama • Rp 450.000',
    created_at: '9 Nov 2026, 19.21',
    is_read: true,
    status_label: 'Diterima',
    status_type: 'success',
    target_route: '/orangtua/riwayat'
  },
  {
    id: 4,
    title: 'Tagihan baru: SPP bulanan Periode November 2026',
    subtitle: 'Kayla Pratama • Rp 450.000',
    created_at: '8 Nov 2026, 20.53',
    is_read: true,
    status_label: 'Tagihan',
    status_type: 'info',
    target_route: '/orangtua/tagihan'
  },
  {
    id: 5,
    title: 'Pembayaran SPP September 2026',
    subtitle: 'Aditya Pratama • Rp 450.000',
    created_at: '2 Nov 2026, 18.18',
    is_read: false,
    status_label: 'Diterima',
    status_type: 'success',
    target_route: '/orangtua/riwayat'
  }
])

const hasUnread = computed(() => {
  return notifications.value.some((item) => !item.is_read)
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/orangtua/beranda')
  }
}

const handleNotificationClick = (item) => {
  // Tandai sudah dibaca saat diklik
  item.is_read = true

  // Arahkan ke halaman detail terkait jika ada
  if (item.target_route) {
    router.push(item.target_route)
  }
}

const markAllAsRead = () => {
  notifications.value.forEach((item) => {
    item.is_read = true
  })
}

const getBadgeStyle = (type) => {
  switch (type) {
    case 'success':
      return 'badge-success'
    case 'danger':
      return 'badge-danger'
    case 'info':
    default:
      return 'badge-info'
  }
}

const formatTanggal = (dateStr) => {
  if (!dateStr) return ''
  return dateStr
}

onMounted(async () => {
  // Jika sudah ada integrasi API/store Pinia/composable Finka, panggil fetch data di sini:
  // isLoading.value = true
  // try { ... } finally { isLoading.value = false }
})
</script>

<style scoped>
/* Reset dasar agar tidak terpengaruh global CSS lama */
.notification-page {
  min-height: 100vh;
  background-color: #f6f7fb;
  padding-bottom: 90px; /* Jarak aman di atas bottom navigation bar */
  color: #0f172a;
}

/* Header */
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #eceef5;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 4px;
  margin-left: -4px;
  color: #0f172a;
  cursor: pointer;
  border-radius: 8px;
}

.back-btn:hover {
  background-color: #f1f5f9;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

/* Main Content */
.page-content {
  padding: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 2px;
}

.section-subtitle {
  font-size: 13px;
  color: #475569;
  margin: 0;
}

.mark-all-btn {
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: #1d4ed8;
  cursor: pointer;
  padding: 2px 4px;
  white-space: nowrap;
}

.mark-all-btn:hover {
  text-decoration: underline;
}

/* Card Container Menyatu seperti halaman Riwayat Transaksi */
.notification-list-card {
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #ebedf5;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

/* Item Notifikasi: Tinggi dinamis agar tidak pernah terpotong */
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 16px;
  background-color: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background-color 0.15s ease;
  height: auto !important;
  min-height: 68px;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background-color: #f8fafc;
}

/* Highlight lembut untuk notifikasi baru (unread) */
.notification-item.is-unread {
  background-color: #f5f8ff;
}

/* Kolom Titik Status */
.dot-column {
  padding-top: 6px;
  flex-shrink: 0;
}

.status-dot {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dot-unread {
  background-color: #1d4ed8;
}

.dot-read {
  background-color: #cbd5e1;
}

/* Kolom Teks Utama */
.content-column {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px 0;
  line-height: 1.4;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
}

.notif-subtitle {
  font-size: 12.5px;
  color: #64748b;
  margin: 0 0 6px 0;
  line-height: 1.35;
}

.notif-time {
  display: block;
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.2;
}

/* Kolom Badge Status Kanan */
.badge-column {
  flex-shrink: 0;
  align-self: center;
  margin-left: 4px;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.2;
}

.badge-success {
  background-color: #ecfdf5;
  color: #15803d;
}

.badge-danger {
  background-color: #fef2f2;
  color: #dc2626;
}

.badge-info {
  background-color: #eff6ff;
  color: #1d4ed8;
}

/* Empty & Loading State */
.state-box {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 36px 20px;
  text-align: center;
  border: 1px solid #ebedf5;
  color: #64748b;
  font-size: 13.5px;
}

.empty-title {
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.empty-desc {
  margin: 0;
  font-size: 12.5px;
}
</style>