<script setup>
import { ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()

// Dynamic imports untuk mencegah error SSR di Nuxt 3
let html2canvas = null
let jsPDF = null

onMounted(async () => {
  if (process.client) {
    const html2canvasModule = await import('html2canvas')
    const jsPDFModule = await import('jspdf')
    html2canvas = html2canvasModule.default || html2canvasModule
    jsPDF = jsPDFModule.jsPDF || jsPDFModule.default
  }
})

const strukRef = ref(null)
const isExporting = ref(false)

// Fungsi Cetak Struk / Simpan PDF
const cetakStruk = async () => {
  if (!strukRef.value) {
    alert('Elemen struk tidak ditemukan!')
    return
  }

  isExporting.value = true

  try {
    // Jika module belum loaded, load secara dynamic
    if (!html2canvas || !jsPDF) {
      const hModule = await import('html2canvas')
      const jModule = await import('jspdf')
      html2canvas = hModule.default || hModule
      jsPDF = jModule.jsPDF || jModule.default
    }

    const canvas = await html2canvas(strukRef.value, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const imgWidth = 190
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
    pdf.save(`Struk_FINKA_${route.params.id || 'Digital'}.pdf`)
  } catch (err) {
    console.error('Gagal mengeksport PDF:', err)
    alert('Gagal mengunduh PDF. Pastikan dependensi jspdf & html2canvas sudah terinstall.')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="struk-wrapper">
    <!-- Header Navy (Sesuai Referensi Gambar) -->
    <header class="header-nav">
      <button class="btn-back" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1 class="header-title">Struk Digital</h1>
    </header>

    <!-- Content Body -->
    <div class="content-body">
      <!-- Area Kartu Struk yang Akan Dicetak -->
      <div ref="strukRef" class="struk-card">
        <!-- Header Struk -->
        <div class="struk-header">
          <div class="brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="12" r="4" fill="#0F172A"/>
              <circle cx="14" cy="6" r="3" fill="#0284C7"/>
              <circle cx="14" cy="18" r="3" fill="#0284C7"/>
            </svg>
            <span class="brand-text">FINKA</span>
          </div>
          <span class="struk-type">STRUK DIGITAL</span>
        </div>

        <!-- Indicator Checkmark -->
        <div class="status-box">
          <div class="check-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="status-text">TOP-UP SUDAH DIVERIFIKASI</div>
          <h2 class="title-text">Top-up saldo</h2>
          <div class="amount-text">
            {{ $rp ? $rp(100755) : 'Rp 100.755' }}
          </div>
          <div class="date-text">9 Nov 2026 · 19.23 WIB</div>
        </div>

        <div class="divider"></div>

        <!-- Information List -->
        <div class="info-list">
          <div class="info-item">
            <span>Keterangan</span>
            <strong class="text-right">Top-up disetujui admin termasuk kode unik</strong>
          </div>
          <div class="info-item">
            <span>Diproses oleh</span>
            <strong>Admin Yayasan</strong>
          </div>
          <div class="info-item">
            <span>Saldo sebelum</span>
            <strong>{{ $rp ? $rp(378645) : 'Rp 378.645' }}</strong>
          </div>
          <div class="info-item">
            <span>Saldo sesudah</span>
            <strong>{{ $rp ? $rp(479400) : 'Rp 479.400' }}</strong>
          </div>
        </div>

        <!-- Transaction Meta -->
        <div class="meta-box">
          <div class="meta-item">
            <span>ID transaksi</span>
            <strong>TRX-17</strong>
          </div>
          <div class="meta-item">
            <span>Metode</span>
            <strong>Pembayaran Finka</strong>
          </div>
        </div>

        <!-- Bukti Transfer Image -->
        <div class="bukti-box">
          <div class="bukti-label">Bukti transfer</div>
          <div class="image-wrapper">
            <img src="/img/bukti-sample.jpeg" alt="Bukti Transfer" @error="(e) => e.target.style.display='none'" />
          </div>
        </div>
      </div>

      <!-- Action Button Cetak / Simpan PDF -->
      <div class="action-wrapper">
        <button class="btn-cetak" :disabled="isExporting" @click="cetakStruk">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>{{ isExporting ? 'Memuat PDF...' : 'Simpan PDF / Cetak Struk' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.struk-wrapper {
  min-height: 100vh;
  background-color: #0B132B;
  display: flex;
  flex-direction: column;
}

.header-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 16px;
  background-color: #0B132B;
  color: #FFFFFF;
}

.btn-back {
  position: absolute;
  left: 14px;
  background: none;
  border: none;
  color: #FFFFFF;
  cursor: pointer;
  padding: 4px;
}

.header-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.content-body {
  flex: 1;
  background-color: #F1F5F9;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.struk-card {
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.struk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-text {
  font-weight: 800;
  font-size: 1.1rem;
  color: #0F172A;
}

.struk-type {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 0.5px;
}

.status-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.check-icon {
  width: 44px;
  height: 44px;
  background-color: #DCFCE7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.status-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #15803D;
  margin-bottom: 6px;
}

.title-text {
  font-size: 1rem;
  color: #334155;
  margin: 0 0 6px 0;
  font-weight: 600;
}

.amount-text {
  font-size: 2rem;
  font-weight: 800;
  color: #0F172A;
}

.date-text {
  font-size: 0.8rem;
  color: #64748B;
  margin-top: 4px;
}

.divider {
  border-top: 1px dashed #E2E8F0;
  margin: 18px 0;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.86rem;
  color: #475569;
}

.info-item strong {
  color: #0F172A;
}

.text-right {
  text-align: right;
  max-width: 60%;
}

.meta-box {
  background-color: #F8FAFC;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  color: #64748B;
}

.meta-item strong {
  color: #0F172A;
}

.bukti-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bukti-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.image-wrapper {
  background-color: #E2E8F0;
  border-radius: 12px;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  display: block;
}

.action-wrapper {
  width: 100%;
  max-width: 420px;
  margin-top: 16px;
}

.btn-cetak {
  width: 100%;
  padding: 14px;
  background-color: #0284C7;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
}

.btn-cetak:hover {
  background-color: #0369A1;
}
</style>