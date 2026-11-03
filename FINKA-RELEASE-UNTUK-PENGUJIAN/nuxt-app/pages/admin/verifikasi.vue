<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <p v-if="apiError" class="api-error" role="alert">{{ apiError }}</p>
    <div class="card list">
      <div class="list__tabs">
        <button class="chip chip--pill" :class="tab === 'Menunggu' ? 'chip--on' : ''" @click="pilihTab('Menunggu')">Menunggu ({{ menunggu.length }})</button>
        <button class="chip chip--pill" :class="tab === 'Disetujui' ? 'chip--on' : ''" @click="pilihTab('Disetujui')">Disetujui ({{ disetujuiList.length }})</button>
        <button class="chip chip--pill" :class="tab === 'Ditolak' ? 'chip--on' : ''" @click="pilihTab('Ditolak')">Ditolak ({{ ditolakList.length }})</button>
        <button
          v-if="admin && tab === 'Menunggu' && menunggu.length"
          type="button"
          class="btn-sm btn-sm--primary bulk-verify"
          :disabled="memproses || memprosesSemua"
          @click="verifikasiSemua"
        >{{ memprosesSemua ? 'Memverifikasi…' : `Verifikasi semua (${menunggu.length})` }}</button>
      </div>
      <div class="list__scroll">
        <div v-if="memuat" class="kosong-list">Memuat permintaan transfer…</div>
        <div v-else-if="!antrean.length" class="kosong-list">{{ kosongText }}</div>
        <button
          v-for="a in antrean"
          :key="a.id"
          class="item"
          :class="a.id === pilihId ? 'item--on' : ''"
          @click="pilihItem(a.id)"
        >
          <div class="item__top">
            <div>
              <div class="item__nama">{{ a.siswa }}</div>
              <div class="item__sub">{{ a.kelas }} · oleh {{ a.ortu }}</div>
            </div>
            <span class="badge" :class="badge(status(a.id))">{{ status(a.id) }}</span>
          </div>
          <div class="item__bot">
            <b class="display num">{{ (a.dasar + a.kode) | rp }}</b>
            <span>{{ formatWaktu(a.waktu) }}</span>
          </div>
          <div v-if="status(a.id) === 'Ditolak'" class="item__alasan">Alasan: {{ alasanDari(a.id) }}</div>
        </button>
      </div>
    </div>

    <div v-if="!adaDetail" class="card detail detail--kosong">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--sand)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4" /><path d="M12 3l7.5 3v6c0 4.5-3 7.6-7.5 9-4.5-1.4-7.5-4.5-7.5-9V6z" /></svg>
      <div class="display kosong__judul">{{ kosongJudul }}</div>
      <p>{{ kosongText }}</p>
    </div>

    <div v-else class="card detail">
      <div class="detail__head">
        <div>
          <div class="detail__id">Permintaan TU-{{ pilih.id }}</div>
          <div class="detail__nama display">{{ pilih.siswa }} · {{ pilih.kelas }}</div>
          <div class="detail__sub">Diajukan {{ pilih.ortu }} · {{ formatWaktu(pilih.waktu) }}</div>
        </div>
        <span class="badge" :class="badge(statusPilih)">{{ statusPilih }}</span>
      </div>

      <div class="dua">
        <div class="hero">
          <div class="hero__eyebrow">COCOKKAN DENGAN TRANSFER YANG DITERIMA</div>
          <div class="hero__angka">
            <span class="hero__rp display">Rp</span>
            <span class="display num">{{ $num(transfer) }}</span>
          </div>
          <div class="hero__rows">
            <div><span>Nominal dasar</span><b class="num">{{ pilih.dasar | rp }}</b></div>
            <div><span>Kode unik</span><b class="num kode">{{ kodePad }}</b></div>
            <div><span>Tujuan</span><b>{{ pilih.tujuan }}</b></div>
            <div><span>Masa berlaku</span><b>Tidak kedaluwarsa</b></div>
          </div>
        </div>

        <div class="bukti">
          <div class="bukti__head">
            <span class="h display">Bukti transfer</span>
            <button v-if="buktiAsli" type="button" class="link" @click="lihatBukti">Lihat layar penuh</button>
          </div>
          <div class="bukti__ph">
            <button v-if="buktiAsli" type="button" class="bukti__lihat" @click="lihatBukti" :aria-label="'Perbesar bukti transfer ' + pilih.siswa">
              <img class="bukti__img" :src="buktiAsli.url" :alt="'Bukti transfer ' + pilih.siswa" />
              <span>Klik untuk melihat gambar</span>
            </button>
            <template v-else>
              <span>{{ memuatBukti ? 'Memuat bukti…' : 'Orang tua belum mengunggah bukti transfer.' }}</span>
            </template>
          </div>
          <div v-if="buktiAsli" class="bukti__nama">{{ buktiAsli.nama }}</div>
        </div>
      </div>

      <div class="mutasi">
        <div class="mutasi__head">Verifikasi manual</div>
        <p class="verifikasi-note">Pastikan bukti dan jumlah transfer sesuai dengan mutasi rekening sekolah sebelum menyetujui.</p>
      </div>

      <div v-if="modeTolak" class="tolak">
        <div class="tolak__judul display">Alasan penolakan wajib diisi</div>
        <div class="tolak__opsi">
          <button
            v-for="a in alasanOpsi"
            :key="a"
            class="chip"
            :class="alasan === a ? 'chip--bad' : ''"
            @click="setAlasan(a)"
          >{{ a }}</button>
        </div>
        <div class="tolak__aksi">
          <button class="btn-sm btn-sm--ghost" @click="modeTolak = false">Batal</button>
          <button class="btn-sm btn-sm--bad" :disabled="!alasan || memproses" @click="tolak">Tolak permintaan</button>
        </div>
      </div>

      <div v-if="bisaAksi" class="aksi">
        <button class="btn-sm btn-sm--danger" :disabled="memproses" @click="mulaiTolak">Tolak</button>
        <button class="btn-sm btn-sm--primary" :disabled="memproses || !buktiAsli" @click="setujui">
          {{ memproses ? 'Memproses…' : pilih.tagihan_id ? 'Setujui &amp; lunasi tagihan' : 'Setujui &amp; kredit saldo' }}
        </button>
        <span v-if="!buktiAsli" class="aksi__note">Menunggu bukti transfer sebelum dapat disetujui.</span>
      </div>
      <div v-else-if="!admin" class="kunci">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>
        <span>Akun Monitoring hanya bisa melihat. Persetujuan dilakukan oleh Admin.</span>
      </div>
      <div v-else class="hasil">
        <i :style="'background:' + (statusPilih === 'Disetujui' ? 'var(--green)' : 'var(--coral)')"></i>
        <span>{{ hasilText }}</span>
        <button v-if="statusPilih === 'Ditolak' && admin" class="btn-sm btn-sm--ghost hasil__undo" :disabled="memproses" @click="kembalikan">Terima pembayaran</button>
      </div>
    </div>

    <div v-if="toast" :key="toast.id" class="toast-verif" role="status" aria-live="polite">
      <span>{{ toast.pesan }}</span>
      <button v-if="toast.tab !== tab" type="button" class="toast-verif__aksi" @click="lihatTab(toast.tab)">Lihat tab {{ toast.tab }}</button>
      <button type="button" class="toast-verif__tutup" aria-label="Tutup" @click="toast = null">×</button>
    </div>
    <div
      v-if="konfirmasiVerifikasiTerbuka"
      class="konfirmasi-backdrop"
      @click.self="tutupKonfirmasiVerifikasi"
      @keydown.esc="tutupKonfirmasiVerifikasi"
    >
      <section class="konfirmasi-modal" role="dialog" aria-modal="true" aria-labelledby="konfirmasi-verifikasi-judul">
        <h2 id="konfirmasi-verifikasi-judul">Verifikasi semua</h2>
        <p>
          Verifikasi {{ konfirmasiDenganBukti }} permintaan dengan bukti unggahan?
          Admin bertanggung jawab memastikan bukti yang ada cocok dengan transfer.
          {{ konfirmasiTanpaBukti }} permintaan tanpa bukti akan otomatis ditolak.
        </p>
        <div class="konfirmasi-actions">
          <button type="button" class="btn-sm btn-sm--ghost" :disabled="memprosesSemua" @click="tutupKonfirmasiVerifikasi">Cancel</button>
          <button type="button" class="btn-sm btn-sm--primary" :disabled="memprosesSemua" @click="konfirmasiVerifikasiSemua">
            {{ memprosesSemua ? 'Memverifikasi…' : 'Oke' }}
          </button>
        </div>
      </section>
    </div>
    <ImageLightbox
      v-if="viewerTerbuka && buktiAsli"
      :src="buktiAsli.url"
      :alt="'Bukti transfer ' + pilih.siswa"
      :name="buktiAsli.nama"
      @close="viewerTerbuka = false"
    />
  </div>
</template>

<script>
export default {

  data() {
    return {
      tab: 'Menunggu',
      viewerTerbuka: false,
      modeTolak: false,
      memuat: true,
      memuatBukti: false,
      memproses: false,
      memprosesSemua: false,
      konfirmasiVerifikasiTerbuka: false,
      konfirmasiIds: [],
      konfirmasiDenganBukti: 0,
      konfirmasiTanpaBukti: 0,
      apiError: '',
      toast: null,
      refreshTimer: null,
      sedangRefresh: false,
      proofLoadingId: null,
      alasanOpsi: ['Nominal tidak cocok', 'Bukti tidak terbaca', 'Transfer tidak ditemukan', 'Duplikat permintaan']
    }
  },
  computed: {
    admin() { return this.$store.getters['admin/admin'] },
    antrean() {
      if (this.tab === 'Disetujui') return this.disetujuiList
      if (this.tab === 'Ditolak') return this.ditolakList
      return this.menunggu
    },
    pilihId() { return this.$store.state.admin.pilihId },
    // Detail hanya tampil bila item terpilih memang ada di tab aktif (mencegah detail "nyangkut" di tab kosong)
    adaDetail() { return this.antrean.some((a) => a.id === this.pilihId) },
    kosongJudul() {
      return this.tab === 'Ditolak' ? 'Belum ada permintaan ditolak' : this.tab === 'Disetujui' ? 'Belum ada permintaan disetujui' : 'Semua permintaan sudah diproses'
    },
    kosongText() {
      return this.tab === 'Ditolak'
        ? 'Permintaan yang Anda tolak akan muncul di sini beserta alasannya.'
        : this.tab === 'Disetujui'
          ? 'Permintaan yang Anda setujui akan muncul di sini.'
          : 'Tidak ada permintaan top-up yang menunggu verifikasi.'
    },
    pilih() { return this.$store.getters['admin/pilih'] },
    buktiAsli() { return this.pilih ? this.$store.state.admin.buktiUnggahan[this.pilih.id] || null : null },
    menunggu() { return this.$store.getters['admin/menunggu'] },
    disetujuiList() { return this.$store.getters['admin/disetujui'] },
    ditolakList() { return this.$store.getters['admin/ditolak'] },
    alasan() { return this.$store.state.admin.alasan },
    alasanPilih() { return this.alasanDari(this.pilih.id) },
    waktuPilih() { return this.$store.state.admin.waktuHasil[this.pilih.id] || '' },
    statusPilih() { return this.status(this.pilih.id) },
    bisaAksi() { return this.admin && this.statusPilih === 'Menunggu Verifikasi' },
    transfer() { return this.pilih.dasar + this.pilih.kode },
    kodePad() { return String(this.pilih.kode).padStart(3, '0') },
    hasilText() {
      return this.statusPilih === 'Disetujui'
        ? (this.pilih.tagihan_id
          ? 'Tagihan ' + this.pilih.siswa + ' telah dilunasi.'
          : 'Saldo ' + this.pilih.siswa + ' bertambah ' + this.$rp(this.transfer))
        : 'Ditolak' + (this.waktuPilih ? ' ' + this.waktuPilih : '') + ' — alasan: ' + (this.alasanPilih || '-') + '. Notifikasi terkirim ke orang tua.'
    },
    mutasi() { return [] }
  },
  async mounted() {
    await this.refreshAntrean(true)
    this.refreshTimer = window.setInterval(() => {
      if (!document.hidden) this.refreshAntrean(false)
    }, 5000)
    document.addEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  watch: {
    pilihId(id) {
      this.viewerTerbuka = false
      if (id) this.muatBukti(id)
    },
    toast(v) {
      clearTimeout(this._toastTimer)
      if (v) this._toastTimer = setTimeout(() => { this.toast = null }, 6000)
    }
  },
  beforeDestroy() {
    clearTimeout(this._toastTimer)
    window.clearInterval(this.refreshTimer)
    document.removeEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  methods: {
    async refreshAntrean(inisialisasi) {
      if (this.sedangRefresh) return
      this.sedangRefresh = true
      try {
        const idSebelumnya = this.pilihId
        await this.$store.dispatch('admin/muatAntreanTopup')
        this.apiError = ''
        const terpilih = this.$store.state.admin.antrean.find((item) => item.id === idSebelumnya)
        if (!terpilih && inisialisasi) {
          const first = this.$store.getters['admin/menunggu'][0] || this.$store.state.admin.antrean[0]
          if (first) this.$store.commit('admin/setPilih', first.id)
        } else if (!terpilih && idSebelumnya) {
          const first = this.$store.getters['admin/menunggu'][0] || this.$store.state.admin.antrean[0]
          this.$store.commit('admin/setPilih', first ? first.id : null)
        } else if (terpilih && terpilih.bukti_tersedia) {
          const cached = this.$store.state.admin.buktiUnggahan[terpilih.id]
          if (!cached || cached.diunggah_at !== terpilih.bukti_diunggah_at) await this.muatBukti(terpilih.id)
        }
      } catch (error) {
        this.apiError = error.message || 'Permintaan top-up tidak dapat diperbarui.'
      } finally {
        this.memuat = false
        this.sedangRefresh = false
      }
    },
    saatVisibilitasBerubah() {
      if (!document.hidden) this.refreshAntrean(false)
    },
    lihatBukti() {
      if (this.buktiAsli) this.viewerTerbuka = true
    },
    status(id) { return this.$store.getters['admin/status'](id) },
    badge(s) {
      if (s === 'Disetujui') return 'badge--ok'
      if (s === 'Ditolak') return 'badge--bad'
      return 'badge--warn'
    },
    pilihItem(id) { this.$store.commit('admin/setPilih', id); this.modeTolak = false },
    pilihTab(t) {
      this.tab = t
      this.modeTolak = false
      const list = t === 'Disetujui' ? this.disetujuiList : t === 'Ditolak' ? this.ditolakList : this.menunggu
      this.$store.commit('admin/setPilih', list.length ? list[0].id : null)
    },
    setAlasan(a) { this.$store.commit('admin/setAlasan', a) },
    mulaiTolak() { this.$store.commit('admin/setAlasan', ''); this.modeTolak = true },
    alasanDari(id) { return this.$store.state.admin.alasanTolak[id] || '' },
    waktuSekarang() {
      const d = new Date()
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ', ' + this.$jam(d)
    },
    formatWaktu(waktu) {
      if (!waktu) return 'Waktu tidak tersedia'
      const tanggal = new Date(waktu)
      if (Number.isNaN(tanggal.getTime())) return 'Waktu tidak tersedia'
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      }).format(tanggal)
    },
    // Setelah sebuah permintaan diproses ia pindah tab; pilih item berikutnya di tab yang sama
    pilihBerikutnya(idSelesai) {
      const next = this.antrean.find((a) => a.id !== idSelesai)
      if (next) this.$store.commit('admin/setPilih', next.id)
    },
    tutupKonfirmasiVerifikasi() {
      if (this.memprosesSemua) return
      this.konfirmasiVerifikasiTerbuka = false
      this.konfirmasiIds = []
    },
    async muatBukti(id) {
      if (this.proofLoadingId === id) return
      this.proofLoadingId = id
      this.memuatBukti = true
      this.apiError = ''
      try {
        await this.$store.dispatch('admin/muatBuktiTopup', id)
      } catch (error) {
        this.apiError = error.message || 'Bukti transfer tidak dapat dimuat.'
      } finally {
        if (this.proofLoadingId === id) {
          this.proofLoadingId = null
          this.memuatBukti = false
        }
      }
    },
    async tolak() {
      if (!this.alasan) return
      const id = this.pilih.id
      const alasan = this.alasan
      this.memproses = true
      this.apiError = ''
      try {
        await this.$store.dispatch('admin/tolakPermintaan', { id, alasan, waktu: this.waktuSekarang() })
        this.modeTolak = false
        this.pilihBerikutnya(id)
        this.tampilToast('Permintaan TU-' + id + ' ditolak.', 'Ditolak')
      } catch (error) {
        this.apiError = error.message || 'Permintaan tidak dapat ditolak.'
      } finally {
        this.memproses = false
      }
    },
    async setujui() {
      const id = this.pilih.id
      this.memproses = true
      this.apiError = ''
      try {
        const result = await this.$store.dispatch('admin/setujuiPermintaan', { id, waktu: this.waktuSekarang() })
        this.modeTolak = false
        this.pilihBerikutnya(id)
        this.tampilToast(result.tagihan_id
          ? 'Permintaan TU-' + id + ' disetujui dan tagihan dilunasi.'
          : 'Permintaan TU-' + id + ' disetujui dan saldo berhasil diproses.', 'Disetujui')
      } catch (error) {
        this.apiError = error.message || 'Permintaan tidak dapat disetujui.'
      } finally {
        this.memproses = false
      }
    },
    async verifikasiSemua() {
      if (!this.menunggu.length || this.memprosesSemua) return
      this.konfirmasiIds = this.menunggu.map((item) => item.id)
      this.konfirmasiTanpaBukti = this.menunggu.filter((item) => !item.bukti_tersedia).length
      this.konfirmasiDenganBukti = this.konfirmasiIds.length - this.konfirmasiTanpaBukti
      this.konfirmasiVerifikasiTerbuka = true
    },

    async konfirmasiVerifikasiSemua() {
      if (!this.konfirmasiIds.length || this.memprosesSemua) return
      const ids = [...this.konfirmasiIds]
      this.memprosesSemua = true
      this.apiError = ''
      try {
        const result = await this.$store.dispatch('admin/verifikasiSemuaTopup', ids)
        await this.refreshAntrean(false)
        this.tampilToast(
          `${result.disetujui} disetujui · ${result.ditolak} ditolak${result.gagal ? ` · ${result.gagal} gagal` : ''}.`,
          result.ditolak && !result.disetujui ? 'Ditolak' : 'Disetujui'
        )
        if (result.gagal) {
          this.apiError = result.hasil
            .filter((item) => item.status === 'gagal')
            .map((item) => `TU-${item.id}: ${item.error}`)
            .join(' ')
        }
      } catch (error) {
        this.apiError = error.message || 'Verifikasi massal tidak dapat diproses.'
      } finally {
        this.memprosesSemua = false
        this.konfirmasiVerifikasiTerbuka = false
        this.konfirmasiIds = []
      }
    },
    async kembalikan() {
      const id = this.pilih.id
      this.memproses = true
      this.apiError = ''
      try {
        await this.$store.dispatch('admin/terimaKembaliTopup', { id, waktu: this.waktuSekarang() })
        this.pilihBerikutnya(id)
        this.tampilToast('Pembayaran TU-' + id + ' diterima dan diproses.', 'Disetujui')
      } catch (error) {
        this.apiError = error.message || 'Pembayaran tidak dapat diterima kembali.'
      } finally {
        this.memproses = false
      }
    },
    // Toast dengan tautan untuk melompat ke tab hasil keputusan
    tampilToast(pesan, tabTujuan) {
      this.toast = { id: Date.now(), pesan, tab: tabTujuan }
    },
    lihatTab(t) { this.toast = null; this.pilihTab(t) }
  }
}
</script>

<style scoped>
.kosong-list { padding: 28px 20px; text-align: center; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); }
.api-error { margin: 0; color: var(--coral); font: 500 12px/1.5 var(--font-body); }
.verifikasi-note { margin: 0; padding: 12px 14px; font: 400 12px/1.5 var(--font-body); color: var(--muted); }
.item__alasan { font: 500 11.5px var(--font-body); color: var(--coral); background: rgba(223,74,55,.07); border-radius: var(--r-sm); padding: 6px 9px; }
.detail--kosong { align-items: center; justify-content: center; text-align: center; gap: 10px; }
.detail--kosong p { margin: 0; max-width: 320px; font: 400 12.5px/1.5 var(--font-body); color: var(--muted); }
.kosong__judul { font: 700 16px var(--font-display); }
.hasil__undo { margin-left: auto; padding: 8px 14px; font: 600 12.5px var(--font-body); }
.aksi__note { width: 100%; color: var(--muted); font: 400 11.5px/1.4 var(--font-body); }
.toast-verif {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 1100;
  display: flex; align-items: center; gap: 12px; background: var(--navy); color: #fff;
  padding: 12px 12px 12px 16px; border-radius: var(--r-md); box-shadow: 0 12px 32px rgba(10,13,59,.3);
  font: 500 13px var(--font-body); max-width: calc(100vw - 32px);
}
.toast-verif__aksi { border: none; background: transparent; color: #fff; font: 700 13px var(--font-body); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; white-space: nowrap; }
.toast-verif__tutup { border: none; background: transparent; color: rgba(255,255,255,.7); font-size: 18px; line-height: 1; cursor: pointer; width: 26px; height: 26px; }

.page { display: grid; grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 16px; align-items: start; }

.list { overflow: hidden; }
.list__tabs { padding: 14px 16px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px; }
.bulk-verify { margin-left: auto; padding: 9px 13px; font-size: 12px; }
.bulk-verify:disabled { opacity: .6; cursor: wait; }
.konfirmasi-backdrop { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 18px; background: rgba(10, 13, 59, .52); }
.konfirmasi-modal { width: min(460px, 100%); padding: 24px; border: 1px solid var(--line); border-radius: var(--r-lg); background: #fff; box-shadow: 0 24px 70px #0003; }
.konfirmasi-modal h2 { margin: 0; font: 700 18px var(--font-display); color: var(--ink); }
.konfirmasi-modal p { margin: 12px 0 22px; color: var(--muted); font: 400 13px/1.6 var(--font-body); }
.konfirmasi-actions { display: flex; justify-content: flex-end; gap: 10px; }
.konfirmasi-actions .btn-sm:disabled { opacity: .6; cursor: wait; }
.list__scroll { max-height: 760px; overflow-y: auto; }
.item {
  width: 100%; text-align: left; border: none; border-bottom: 1px solid var(--bg);
  border-left: 3px solid transparent; background: #fff;
  padding: 15px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 9px;
}
.item--on { background: var(--blue-soft); border-left-color: var(--blue); }
.item__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-width: 0; }
.item__nama { font: 600 13.5px var(--font-body); }
.item__sub { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 2px; }
.item__bot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; }
.item__bot b { font: 700 15px var(--font-display); }
.item__bot span { font: 400 11px var(--font-body); color: var(--muted); }

.detail { min-width: 0; padding: 24px; display: flex; flex-direction: column; gap: 22px; }
.detail__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.detail__head > div { min-width: 0; }
.detail__id { font: 400 12px var(--font-body); color: var(--muted); }
.detail__nama { font: 700 19px var(--font-display); margin-top: 4px; overflow-wrap: anywhere; }
.detail__sub { font: 400 12.5px/1.45 var(--font-body); color: var(--muted); margin-top: 3px; overflow-wrap: anywhere; }

.dua { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(240px, .8fr); gap: 16px; align-items: start; }
.hero { background: var(--navy); border-radius: var(--r-md); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.hero__eyebrow { font: 500 11px/1.4 var(--font-body); color: var(--sand); letter-spacing: .08em; }
.hero__angka { display: flex; align-items: baseline; flex-wrap: wrap; gap: 3px; color: #fff; font: 800 clamp(24px, 2.3vw, 30px) var(--font-display); letter-spacing: -.03em; }
.hero__rp { font: 600 16px var(--font-display); margin-right: 3px; }
.kode { color: var(--sand); }
.hero__rows { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
.hero__rows div { display: flex; justify-content: space-between; gap: 10px; }
.hero__rows span { font: 400 12px var(--font-body); color: rgba(255,255,255,.55); }
.hero__rows b { font: 600 12px var(--font-body); color: #fff; text-align: right; overflow-wrap: anywhere; }

.bukti { min-width: 0; border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.bukti__head { display: flex; align-items: center; justify-content: space-between; }
.h { font: 700 12.5px var(--font-display); }
.link { padding: 0; border: 0; background: transparent; font: 500 11.5px var(--font-body); color: var(--blue); cursor: pointer; }
.bukti__ph {
  width: min(100%, 220px); aspect-ratio: 1; align-self: center; box-sizing: border-box;
  padding: 12px; background: var(--bg); border-radius: var(--r-sm);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px;
  font: 400 11px/1.4 var(--font-body); color: var(--muted); text-align: center;
}
.bukti__lihat { width: 100%; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 0; border: 0; background: transparent; color: var(--blue); cursor: zoom-in; font: 500 11px var(--font-body); }
.bukti__img { display: block; width: 100%; height: 150px; object-fit: contain; border-radius: var(--r-sm); }
.bukti__nama { font: 400 11px var(--font-body); color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mutasi { border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.mutasi__head { padding: 12px 16px; background: var(--bg); font: 700 12.5px var(--font-display); }
.mutasi__row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-top: 1px solid var(--bg); }
.mutasi__row.is-match:first-of-type { background: rgba(26,128,64,.05); }
.mutasi__dot { width: 22px; height: 22px; border-radius: var(--r-pill); display: flex; align-items: center; justify-content: center; flex: none; }
.mutasi__dot.ok { background: rgba(26,128,64,.12); }
.mutasi__dot.bad { background: rgba(223,74,55,.1); }
.mutasi__body { flex: 1; }
.mutasi__body b { display: block; font: 600 12.5px var(--font-body); }
.mutasi__body i { display: block; font: 400 11px var(--font-body); color: var(--muted); font-style: normal; margin-top: 1px; }
.mutasi__status { font: 500 11.5px var(--font-body); }

.tolak { border: 1px solid var(--coral); background: rgba(223,74,55,.05); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.tolak__judul { font: 700 13px var(--font-display); color: var(--coral); }
.tolak__opsi { display: flex; gap: 8px; flex-wrap: wrap; }
.chip--bad { border-color: var(--coral); background: rgba(223,74,55,.1); color: var(--coral); }
.tolak__aksi { display: flex; gap: 10px; }

.spacer { flex: 1; }
.aksi { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--line); padding-top: 18px; }

.btn-sm { border: none; border-radius: var(--r-sm); font: 700 13.5px var(--font-display); padding: 12px 20px; cursor: pointer; }
.btn-sm--primary { background: var(--blue); color: #fff; padding: 12px 26px; }
.btn-sm--primary:hover { background: var(--blue-dark); }
.btn-sm--danger { background: #fff; border: 1px solid var(--coral); color: var(--coral); font-weight: 600; }
.btn-sm--ghost { background: #fff; border: 1px solid var(--line); color: var(--muted); font: 600 13px var(--font-body); padding: 11px 18px; }
.btn-sm--bad { background: var(--coral); color: #fff; padding: 11px 20px; }
.btn-sm--bad:disabled { background: var(--disabled); cursor: not-allowed; }

.kunci, .hasil { border-top: 1px solid var(--line); padding-top: 18px; display: flex; align-items: center; gap: 10px; font: 400 12.5px var(--font-body); color: var(--muted); }
.hasil { color: var(--ink); font-weight: 500; }
.hasil i { width: 8px; height: 8px; border-radius: var(--r-pill); }

@media (max-width: 1250px) {
  .page { grid-template-columns: minmax(0, 1fr); }
  .list__scroll { max-height: 360px; }
}

@media (max-width: 760px) {
  .page { gap: 12px; }
  .dua { grid-template-columns: minmax(0, 1fr); }
  .aksi { justify-content: stretch; }
  .aksi .btn-sm { flex: 1 1 130px; }
  .aksi__note { flex-basis: 100%; }
  .hasil { align-items: flex-start; flex-wrap: wrap; }
  .hasil__undo { margin-left: 0; }
}

@media (max-width: 480px) {
  .detail { padding: 16px; gap: 16px; }
  .detail__head { flex-direction: column; }
  .hero { padding: 16px; }
  .list__tabs { padding: 12px; gap: 6px; }
  .item { padding: 13px 12px; }
}
</style>
