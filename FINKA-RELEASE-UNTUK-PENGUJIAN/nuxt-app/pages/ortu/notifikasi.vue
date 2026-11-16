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
          @click="tandaiSemua"
        >
          Tandai dibaca
        </button>
      </div>
    </div>

    <!-- Hanya Area Card Notifikasi Ini yang Bisa Di-Scroll -->
    <div class="body scroll-area">
      <div v-if="error" class="kosong kosong--error" role="alert">
        {{ error }} <button type="button" class="link" @click="muat">Coba lagi</button>
      </div>
      <div v-else-if="memuat && !notifications.length" class="kosong">Memuat notifikasi…</div>
      <div v-else-if="!notifications.length" class="kosong">
        Belum ada notifikasi. Informasi tagihan dan status pembayaran akan muncul di sini.
      </div>
      <div v-else class="list">
        <div
          v-for="item in notifications"
          :key="item.key"
          class="card notif-item"
          role="button"
          tabindex="0"
          @click="bukaItem(item)"
          @keydown.enter="bukaItem(item)"
        >
          <span
            class="dot"
            :class="item.dibaca ? 'dot--read' : 'dot--unread'"
          ></span>

          <div class="notif-item__info">
            <div class="notif-item__judul">{{ item.judul }}</div>
            <div class="notif-item__sub">{{ item.isi }}</div>
            <div class="notif-item__waktu">{{ item.waktu }}</div>
          </div>

          <span v-if="item.badge" class="badge" :class="item.badgeClass">
            {{ item.badge }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom navigation bar, sama seperti halaman Beranda -->
    <OrtuTabBar />

    <!-- POP-UP STRUK DIGITAL -->
    <Teleport to="body">
      <div
        v-if="selectedReceipt || memuatStruk || errorStruk"
        class="overlay"
        @click.self="tutupStruk"
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
              @click="tutupStruk"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div v-if="memuatStruk" class="modal__state">Memuat struk digital…</div>
          <div v-else-if="errorStruk" class="modal__state modal__state--error" role="alert">{{ errorStruk }}</div>

          <template v-else-if="selectedReceipt">
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
              <div v-if="selectedReceipt.unique_code" class="row">
                <span>Kode unik</span>
                <b>{{ selectedReceipt.unique_code }}</b>
              </div>
              <div v-if="selectedReceipt.processed_at" class="row">
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
          </template>

          <button
            type="button"
            class="btn-primary"
            @click="tutupStruk"
          >
            Tutup
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
// Layout ponsel + proteksi login/peran, sama seperti halaman ortu lain (Beranda, Riwayat, Kontrol)
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>

<script>
import { api } from '~/utils/api'
import { kunciNotifikasi } from '~/store/ortu'

export default {
  name: 'OrtuNotifikasi',
  data() {
    return {
      memuat: true,
      error: '',
      sedangMuat: false,
      timer: null,
      selectedReceipt: null,
      memuatStruk: false,
      errorStruk: ''
    }
  },
  computed: {
    // Sumber data SAMA dengan lencana lonceng di Beranda (store ortu).
    notifications() {
      const sudahDibaca = this.$store.getters['ortu/sudahDibaca']
      return this.$store.getters['ortu/semuaNotifikasi'].map((n) => {
        const b = this.infoBadge(n)
        return {
          raw: n,
          key: kunciNotifikasi(n),
          judul: n.judul,
          isi: n.isi,
          waktu: this.tampilWaktu(n.waktu),
          dibaca: sudahDibaca(n),
          badge: b.label,
          badgeClass: b.kelas
        }
      })
    },
    hasUnread() {
      return this.$store.getters['ortu/jumlahBelumDibaca'] > 0
    }
  },
  async mounted() {
    await this.muat()
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.muat()
    }, 30000)
    document.addEventListener('visibilitychange', this.saatTerlihat)
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer)
    document.removeEventListener('visibilitychange', this.saatTerlihat)
  },
  methods: {
    goBack() {
      this.$router.push('/ortu')
    },
    saatTerlihat() {
      if (document.visibilityState === 'visible') this.muat()
    },
    async muat() {
      if (this.sedangMuat) return
      this.sedangMuat = true
      this.error = ''
      try {
        await this.$store.dispatch('ortu/muatAnak')
        const anak = this.$store.state.ortu.anak
        await Promise.all(anak.map((a) => this.$store.dispatch('ortu/muatTagihan', a.id)))
        await this.$store.dispatch('ortu/muatPembayaran')
      } catch (e) {
        this.error = e.message || 'Notifikasi gagal dimuat.'
      } finally {
        this.sedangMuat = false
        this.memuat = false
      }
    },
    // Waktu dari server berformat tanggal -> WIB; teks lain ("Sekarang", "Jatuh tempo ...") apa adanya
    tampilWaktu(w) {
      if (!w) return ''
      const s = String(w)
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? this.$waktu(s) : s
    },
    infoBadge(n) {
      const t = String(n.tipe || '')
      if (t === 'pembayaran_ditolak') return { label: 'Ditolak', kelas: 'badge--coral' }
      if (t.startsWith('pembayaran_diterima')) return { label: 'Diterima', kelas: 'badge--green' }
      if (t === 'pembayaran_menunggu') return { label: 'Menunggu', kelas: 'badge--blue' }
      if (t === 'saldo') return { label: 'Saldo', kelas: 'badge--coral' }
      if (t.startsWith('tagihan')) return { label: 'Tagihan', kelas: 'badge--blue' }
      return { label: '', kelas: '' }
    },
    // Tandai semua notifikasi sebagai dibaca -> lencana lonceng di Beranda ikut hilang
    tandaiSemua() {
      this.$store.dispatch('ortu/tandaiDibaca', this.$store.getters['ortu/semuaNotifikasi'])
    },
    bukaItem(item) {
      const n = item.raw
      this.$store.dispatch('ortu/tandaiDibaca', [n])
      if (String(n.tipe || '').startsWith('pembayaran_')) {
        this.bukaStruk(n)
        return
      }
      const tagihanId = n.tagihan_id || n.tagihanId
      if (tagihanId) this.$router.push('/ortu/tagihan/' + tagihanId)
      else if (n.tipe === 'saldo') this.$router.push('/ortu/isi-saldo')
    },
    tutupStruk() {
      this.selectedReceipt = null
      this.memuatStruk = false
      this.errorStruk = ''
    },
    async bukaStruk(n) {
      this.selectedReceipt = null
      this.errorStruk = ''
      this.memuatStruk = true
      try {
        // Pembayaran tagihan langsung dari saldo anak
        if (String(n.id).startsWith('ledger-')) {
          const ledgerId = Number(String(n.id).slice(7))
          const siswaId = Number(n.siswa_id)
          if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0 || !Number.isSafeInteger(siswaId) || siswaId <= 0) {
            throw new Error('Referensi pembayaran tidak valid.')
          }
          const { riwayat } = await api.riwayat(siswaId)
          const row = (riwayat || []).find((item) => Number(item.id) === ledgerId)
          if (!row) throw new Error('Detail pembayaran tidak ditemukan.')
          const jumlah = Math.abs(Number(row.nominal))
          this.selectedReceipt = {
            status: 'Diterima',
            category: row.keterangan || 'Pembayaran tagihan',
            student_name: String(n.isi || '').split(':')[0],
            request_id: 'TRX-' + row.id,
            base_amount: jumlah,
            unique_code: null,
            total_amount: jumlah,
            created_at: this.tampilWaktu(row.created_at),
            processed_at: this.tampilWaktu(row.created_at),
            rejection_reason: '',
            footer_note: 'Pembayaran dilakukan dari saldo FINKA; tidak ada bukti transfer terpisah.'
          }
          return
        }

        // Top-up / pembayaran lewat transfer
        const id = Number(n.id)
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Referensi pembayaran tidak valid.')
        const { topup } = await api.statusTopup(id)
        if (!topup) throw new Error('Detail pembayaran tidak ditemukan.')
        const status = topup.status === 'disetujui'
          ? 'Diterima'
          : topup.status === 'ditolak'
            ? 'Ditolak'
            : 'Menunggu verifikasi'
        const kode = Number(topup.kode_unik) || 0
        this.selectedReceipt = {
          status,
          category: topup.tujuan || 'Pembayaran',
          student_name: topup.siswa,
          request_id: 'TU-' + topup.id,
          base_amount: Number(topup.nominal),
          unique_code: kode || null,
          total_amount: topup.total_transfer || Number(topup.nominal) + kode,
          created_at: this.tampilWaktu(topup.waktu),
          processed_at: topup.diproses_at ? this.tampilWaktu(topup.diproses_at) : '',
          rejection_reason: topup.alasan_tolak || '',
          footer_note: topup.bukti_tersedia ? '' : 'Bukti transfer belum diunggah.'
        }
      } catch (e) {
        this.errorStruk = e.message || 'Struk digital gagal dimuat.'
      } finally {
        this.memuatStruk = false
      }
    },
    formatRupiah(val) {
      if (val === null || val === undefined) return 'Rp 0'
      return 'Rp ' + Math.round(Number(val) || 0).toLocaleString('id-ID')
    },
    getBadgeClass(status) {
      const s = (status || '').toLowerCase()
      if (s === 'diterima' || s === 'lunas') return 'badge--green'
      if (s === 'ditolak') return 'badge--coral'
      return 'badge--blue'
    }
  }
}
</script>

<style scoped>
/* Kunci kontainer utama agar tidak ikut scroll */
.wrap {
  flex: 1;
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

.kosong {
  margin: 14px 0;
  padding: 18px 14px;
  text-align: center;
  color: var(--muted);
  font: 500 12px/1.45 var(--font-body);
}

.kosong--error {
  color: var(--coral);
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
  font: 400 12px/1.4 var(--font-body);
  color: var(--muted);
  margin-bottom: 4px;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

.modal__state {
  padding: 18px 4px;
  text-align: center;
  font: 500 12.5px/1.45 var(--font-body);
  color: var(--muted);
}

.modal__state--error {
  color: var(--coral);
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