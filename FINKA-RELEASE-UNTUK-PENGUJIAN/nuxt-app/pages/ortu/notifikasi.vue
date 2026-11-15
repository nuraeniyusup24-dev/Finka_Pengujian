<template>
  <div class="wrap">
    <!-- Area Atas Freeze (Header + Subbar Tombol Tandai Dibaca) -->
    <div class="freeze-top">
      <header class="topbar">
        <button type="button" class="topbar__back" aria-label="Kembali" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 class="topbar__title">Notifikasi</h1>
      </header>

      <div class="subbar">
        <span class="subbar__ket">Notifikasi terbaru akun dan transaksi.</span>
        <button
          v-if="hasUnread"
          type="button"
          class="link"
          @click="markAllAsRead"
        >
          Tandai dibaca
        </button>
      </div>
    </div>

    <!-- Hanya Area Card Notifikasi Ini yang Bisa Di-Scroll -->
    <div class="body scroll-area">
      <div class="list">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="card notif-item"
          @click="openReceipt(item)"
        >
          <span
            class="dot"
            :class="item.is_read ? 'dot--read' : 'dot--unread'"
          ></span>

          <div class="notif-item__info">
            <div class="notif-item__judul">{{ item.title }}</div>
            <div class="notif-item__sub">
              {{ item.student_name }} • {{ formatRupiah(item.total_amount) }}
            </div>
            <div class="notif-item__waktu">{{ item.created_at }}</div>
          </div>

          <span class="badge" :class="getBadgeClass(item.status)">
            {{ item.status }}
          </span>
        </div>
      </div>
    </div>

    <!-- POP-UP STRUK DIGITAL -->
    <Teleport to="body">
      <div
        v-if="selectedReceipt"
        class="overlay"
        @click.self="closeReceipt"
      >
        <div class="modal">
          <div class="modal__head">
            <div class="modal__brand">
              <b>FINKA</b>
              <span>STRUK DIGITAL</span>
            </div>
            <button
              type="button"
              class="modal__close"
              aria-label="Tutup"
              @click="closeReceipt"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal__hero">
            <span class="badge" :class="getBadgeClass(selectedReceipt.status)">
              {{ selectedReceipt.status }}
            </span>
            <div class="modal__cat">{{ selectedReceipt.category }}</div>
            <div class="modal__total">{{ formatRupiah(selectedReceipt.total_amount) }}</div>
            <div class="modal__date">{{ selectedReceipt.created_at }}</div>
          </div>

          <div class="separator"></div>

          <div class="modal__rows">
            <div class="row">
              <span>Siswa</span>
              <b>{{ selectedReceipt.student_name }}</b>
            </div>
            <div class="row">
              <span>Jenis</span>
              <b>{{ selectedReceipt.category }}</b>
            </div>
            <div class="row">
              <span>ID permintaan</span>
              <b>{{ selectedReceipt.request_id }}</b>
            </div>
            <div class="row">
              <span>Status verifikasi</span>
              <b>{{ selectedReceipt.status }}</b>
            </div>
            <div class="row">
              <span>Nominal</span>
              <b>{{ formatRupiah(selectedReceipt.base_amount) }}</b>
            </div>
            <div v-if="selectedReceipt.unique_code !== null" class="row">
              <span>Kode unik</span>
              <b>{{ selectedReceipt.unique_code }}</b>
            </div>
            <div class="row">
              <span>Waktu diproses</span>
              <b>{{ selectedReceipt.processed_at }}</b>
            </div>
            <div v-if="selectedReceipt.rejection_reason" class="row">
              <span>Alasan penolakan</span>
              <b>{{ selectedReceipt.rejection_reason }}</b>
            </div>
          </div>

          <div class="separator"></div>

          <p v-if="selectedReceipt.footer_note" class="modal__note">
            {{ selectedReceipt.footer_note }}
          </p>

          <button
            type="button"
            class="btn-primary"
            @click="closeReceipt"
          >
            Tutup
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const selectedReceipt = ref(null)

const notifications = ref([
  {
    id: 1,
    title: 'Top-up saldo ditolak',
    category: 'Saldo saku',
    student_name: 'Aditya Pratama',
    request_id: 'TU-19',
    status: 'Ditolak',
    base_amount: 100000,
    unique_code: 482,
    total_amount: 100482,
    created_at: '15 Nov 2026, 20.19',
    processed_at: '2026-11-15T13:20:34.852Z',
    rejection_reason: 'Nominal tidak cocok',
    footer_note: 'Bukti transfer belum diunggah.',
    is_read: false
  },
  {
    id: 2,
    title: 'Top-up saldo diterima',
    category: 'Saldo saku',
    student_name: 'Aditya Pratama',
    request_id: 'TU-18',
    status: 'Diterima',
    base_amount: 100000,
    unique_code: 215,
    total_amount: 100215,
    created_at: '15 Nov 2026, 20.20',
    processed_at: '2026-11-15T13:20:10.114Z',
    rejection_reason: '',
    footer_note: 'Saldo telah masuk ke dompet siswa.',
    is_read: true
  },
  {
    id: 3,
    title: 'Pembayaran SPP bulanan Periode November 2026',
    category: 'SPP Bulanan',
    student_name: 'Kayla Pratama',
    request_id: 'SPP-104',
    status: 'Diterima',
    base_amount: 450000,
    unique_code: null,
    total_amount: 450000,
    created_at: '9 Nov 2026, 19.21',
    processed_at: '2026-11-09T12:21:05.000Z',
    rejection_reason: '',
    footer_note: 'Pembayaran tagihan SPP telah diverifikasi.',
    is_read: true
  },
  {
    id: 4,
    title: 'Tagihan baru: SPP bulanan Periode November 2026',
    category: 'Tagihan SPP',
    student_name: 'Aditya Pratama',
    request_id: 'INV-88',
    status: 'Tagihan',
    base_amount: 450000,
    unique_code: null,
    total_amount: 450000,
    created_at: '8 Nov 2026, 20.53',
    processed_at: '2026-11-08T13:53:00.000Z',
    rejection_reason: '',
    footer_note: 'Segera lakukan pembayaran sebelum jatuh tempo.',
    is_read: true
  },
  {
    id: 5,
    title: 'Pembayaran SPP September 2026',
    category: 'SPP Bulanan',
    student_name: 'Aditya Pratama',
    request_id: 'SPP-072',
    status: 'Diterima',
    base_amount: 450000,
    unique_code: null,
    total_amount: 450000,
    created_at: '2 Nov 2026, 18.18',
    processed_at: '2026-11-02T11:18:22.410Z',
    rejection_reason: '',
    footer_note: 'Pembayaran tagihan SPP telah diverifikasi.',
    is_read: false
  }
])

const hasUnread = computed(() => notifications.value.some((n) => !n.is_read))

const goBack = () => {
  router.push('/ortu')
}

const openReceipt = (item) => {
  item.is_read = true
  selectedReceipt.value = item
}

const closeReceipt = () => {
  selectedReceipt.value = null
}

const markAllAsRead = () => {
  notifications.value.forEach((n) => {
    n.is_read = true
  })
}

const formatRupiah = (val) => {
  if (val === null || val === undefined) return 'Rp 0'
  return 'Rp ' + Number(val).toLocaleString('id-ID')
}

const getBadgeClass = (status) => {
  const s = (status || '').toLowerCase()
  if (s === 'diterima' || s === 'lunas') return 'badge--green'
  if (s === 'ditolak') return 'badge--coral'
  return 'badge--blue'
}
</script>

<style scoped>
/* Kunci kontainer utama agar tidak ikut scroll */
.wrap {
  flex: 1;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  min-height: 0;
  overflow: hidden;
}

/* Bagian atas (Header + Tombol Tandai Dibaca) terkunci/freeze */
.freeze-top {
  flex: none;
  background: var(--bg);
  z-index: 10;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: #fff;
  border-bottom: 1px solid var(--line);
}

.topbar__back {
  border: none;
  background: none;
  padding: 4px;
  margin-left: -4px;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.topbar__title {
  margin: 0;
  font: 700 17px var(--font-display);
  color: var(--ink);
}

.subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px 10px;
  background: var(--bg);
}

.subbar__ket {
  font: 400 12px/1.45 var(--font-body);
  color: var(--muted);
}

.link {
  border: none;
  background: none;
  color: var(--blue);
  font: 600 12px var(--font-body);
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}

/* Hanya list card di dalam .scroll-area yang bergerak saat di-scroll */
.scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 18px 24px;
  -webkit-overflow-scrolling: touch;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notif-item:hover {
  background: var(--bg);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--r-pill);
  margin-top: 5px;
  flex: none;
}

.dot--unread {
  background: var(--blue);
}

.dot--read {
  background: var(--line);
}

.notif-item__info {
  flex: 1;
  min-width: 0;
}

.notif-item__judul {
  font: 700 13.5px/1.35 var(--font-display);
  color: var(--ink);
  margin-bottom: 3px;
}

.notif-item__sub {
  font: 400 12px var(--font-body);
  color: var(--muted);
  margin-bottom: 4px;
}

.notif-item__waktu {
  font: 400 11px var(--font-body);
  color: var(--muted);
}

.badge {
  flex: none;
  align-self: center;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font: 600 11.5px var(--font-body);
}

.badge--green {
  background: rgba(22, 163, 74, 0.12);
  color: var(--green);
}

.badge--coral {
  background: rgba(223, 74, 55, 0.12);
  color: var(--coral);
}

.badge--blue {
  background: var(--blue-soft);
  color: var(--blue);
}

/* Pop-Up Struk Digital */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.modal {
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 24px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal__brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.modal__brand b {
  font: 800 15px var(--font-display);
  color: var(--ink);
}

.modal__brand span {
  font: 600 10px var(--font-body);
  color: var(--muted);
  letter-spacing: 0.08em;
}

.modal__close {
  width: 30px;
  height: 30px;
  border-radius: var(--r-pill);
  border: 0;
  background: var(--bg);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal__hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.modal__cat {
  font: 700 14px var(--font-display);
  color: var(--ink);
  margin-top: 6px;
}

.modal__total {
  font: 800 28px var(--font-display);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.modal__date {
  font: 400 12px var(--font-body);
  color: var(--muted);
}

.separator {
  height: 1px;
  background: var(--line);
}

.modal__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font: 400 12.5px var(--font-body);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.row span {
  color: var(--muted);
  flex: none;
}

.row b {
  color: var(--ink);
  font-weight: 700;
  text-align: right;
  word-break: break-word;
}

.modal__note {
  margin: 0;
  text-align: center;
  font: 400 12px/1.45 var(--font-body);
  color: var(--muted);
}

.btn-primary {
  width: 100%;
  border: 0;
  border-radius: var(--r-pill);
  background: var(--blue);
  color: #fff;
  padding: 12px 16px;
  font: 600 13.5px var(--font-body);
  cursor: pointer;
}
</style>