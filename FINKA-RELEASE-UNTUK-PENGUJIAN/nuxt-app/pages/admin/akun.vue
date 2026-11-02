<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div v-if="loadingUsers" class="load-state">Memuat data akun dari server...</div>
    <div v-else-if="userError" class="load-error" role="alert">
      <span>{{ userError }}</span>
      <button type="button" @click="muatPengguna">Coba lagi</button>
    </div>
    <div class="tabs">
      <button class="tab" :class="tab === 'siswa' ? 'tab--on' : ''" @click="tab = 'siswa'">
        Akun Siswa <span class="tab__n">{{ akunSiswa.length }}</span>
      </button>
      <button class="tab" :class="tab === 'ortu' ? 'tab--on' : ''" @click="tab = 'ortu'">
        Akun Orang Tua <span class="tab__n">{{ akunOrtu.length }}</span>
      </button>
      <button class="tab" :class="tab === 'kantin' ? 'tab--on' : ''" @click="tab = 'kantin'">
        Akun Kantin <span class="tab__n">{{ akunKantin.length }}</span>
      </button>
      <button class="tab" :class="tab === 'admin' ? 'tab--on' : ''" @click="tab = 'admin'">
        Daftar Admin <span class="tab__n">{{ akunAdmin.length }}</span>
      </button>
      <div v-if="admin" class="tabs__actions">
        <button type="button" class="btn-sm btn-sm--secondary" @click="bukaImportExcel">Upload Excel</button>
        <button type="button" class="btn-sm" @click="formOn = true">Tambah akun</button>
      </div>
    </div>

    <!-- Akun siswa per kelas -->
    <div v-if="tab === 'siswa'" class="isi">
      <div v-if="!loadingUsers && !akunSiswa.length" class="empty-state">Belum ada akun siswa di backend.</div>
      <div class="kelasBar">
        <button
          v-for="k in daftarKelasAkun"
          :key="k"
          class="chip"
          :class="kelasAktif === k ? 'chip--on' : ''"
          @click="kelasAktif = k"
        >
          {{ k }} <i>{{ akunSiswaKelas(k).length }}</i>
        </button>
      </div>

      <div class="card tabel">
        <div class="tabel__head">
          <div>
            <div class="h display">Kelas {{ kelasAktif || 'Belum ditentukan' }}</div>
            <div class="sub">{{ akunSiswaKelas(kelasAktif).length }} akun siswa terdaftar</div>
          </div>
        </div>
        <div class="baris baris--head">
          <div>NAMA</div><div>NIS</div><div>ORANG TUA</div><div>STATUS</div>
        </div>
        <div v-for="u in akunSiswaKelas(kelasAktif)" :key="u.id || u.nis" class="baris">
          <div class="nama">
            <span class="av">{{ inisial(u.nama) }}</span>
            <span><b>{{ u.nama }}</b><i>Kelas {{ u.kelas }}{{ profil(u) }}</i></span>
          </div>
          <div class="muted num">{{ u.nis || '—' }}</div>
          <div class="muted">{{ u.ortu || 'Belum terhubung' }}</div>
          <div><span class="badge" :class="u.status === 'Aktif' ? 'badge--ok' : 'badge--off'">{{ u.status }}</span></div>
        </div>
        <div v-if="!loadingUsers && !akunSiswaKelas(kelasAktif).length" class="empty-state">Belum ada siswa di kelas ini.</div>
      </div>
    </div>

    <!-- Akun orang tua -->
    <div v-if="tab === 'ortu'" class="isi">
      <div v-if="!loadingUsers && !akunOrtu.length" class="empty-state">Belum ada akun orang tua di backend.</div>
      <div class="card tabel">
        <div class="tabel__head">
          <div>
            <div class="h display">Akun orang tua</div>
            <div class="sub">Wali murid yang mengisi saldo dan membayar tagihan</div>
          </div>
        </div>
        <div class="baris baris--head baris--ortu">
          <div>NAMA</div><div>NOMOR HP</div><div>ANAK</div><div>STATUS</div>
        </div>
        <div v-for="u in akunOrtu" :key="u.id" class="baris baris--ortu">
          <div class="nama">
            <span class="av">{{ inisial(u.nama) }}</span>
            <span><b>{{ u.nama }}</b><i v-if="u.hubungan">{{ u.hubungan }}{{ profil(u) }}</i></span>
          </div>
          <div class="muted num">{{ u.hp || '—' }}</div>
          <div class="muted">{{ namaAnak(u) }}</div>
          <div><span class="badge" :class="u.status === 'Aktif' ? 'badge--ok' : 'badge--off'">{{ u.status }}</span></div>
        </div>
      </div>
    </div>

    <!-- Akun kantin -->
    <div v-if="tab === 'kantin'" class="isi">
      <div v-if="!loadingUsers && !akunKantin.length" class="empty-state">Belum ada akun PIC di backend.</div>
      <div class="card tabel">
        <div class="tabel__head">
          <div>
            <div class="h display">Akun kantin &amp; koperasi</div>
            <div class="sub">Akun PIC yang mengelola setiap outlet</div>
          </div>
        </div>
        <div class="baris baris--head baris--3">
          <div>NAMA</div><div>OUTLET</div><div>STATUS</div>
        </div>
        <div v-for="u in akunKantin" :key="u.id" class="baris baris--3">
          <div class="nama">
            <span class="av">{{ inisial(u.nama) }}</span>
            <span><b>{{ u.nama }}</b><i>{{ u.peran }}{{ profil(u) }}</i></span>
          </div>
          <div class="muted">{{ outletNama(u.outlet) }}</div>
          <div><span class="badge" :class="u.status === 'Aktif' ? 'badge--ok' : 'badge--off'">{{ u.status }}</span></div>
        </div>
      </div>
    </div>

    <!-- Daftar admin -->
    <div v-if="tab === 'admin'" class="isi">
      <div v-if="!loadingUsers && !akunAdmin.length" class="empty-state">Belum ada akun admin di backend.</div>
      <div class="card tabel">
        <div class="tabel__head">
          <div>
            <div class="h display">Daftar admin</div>
            <div class="sub">Akun dengan akses ke panel Admin Yayasan</div>
          </div>
        </div>
        <div class="baris baris--head baris--3">
          <div>NAMA</div><div>PERAN</div><div>STATUS</div>
        </div>
        <div v-for="u in akunAdmin" :key="u.id" class="baris baris--3">
          <div class="nama">
            <span class="av">{{ inisial(u.nama) }}</span>
            <span><b>{{ u.nama }}</b></span>
          </div>
          <div class="muted">{{ u.peran }}</div>
          <div><span class="badge" :class="u.status === 'Aktif' ? 'badge--ok' : 'badge--off'">{{ u.status }}</span></div>
        </div>
      </div>
    </div>

    <div v-if="importExcel.buka" class="impor-backdrop" @click.self="tutupImportExcel">
      <section class="impor-modal" role="dialog" aria-modal="true" aria-labelledby="impor-title">
        <div class="impor-head">
          <div>
            <h2 id="impor-title">Daftarkan siswa dari Excel</h2>
            <p>Upload .xlsx berisi data siswa dan orang tua/wali.</p>
          </div>
          <button type="button" class="impor-close" aria-label="Tutup" :disabled="importExcel.loading" @click="tutupImportExcel">×</button>
        </div>
        <div v-if="!importExcel.hasil" class="impor-body">
          <button type="button" class="impor-template" @click="unduhTemplatExcel">Unduh templat Excel</button>
          <label class="impor-file">
            <span>Pilih workbook (.xlsx)</span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="importExcel.loading" @change="pilihFileExcel" />
          </label>
          <p class="impor-note">Kolom wajib: nama_siswa, nis, kelas, nama_ortu. username_ortu opsional; isi untuk menghubungkan akun orang tua yang sudah ada. Maksimal 300 siswa dan 3 MB per file.</p>
          <p class="impor-note">Password awal dibuat otomatis dan hanya ditampilkan pada file kredensial. Siswa dan orang tua membuat PIN sendiri saat pertama kali masuk.</p>
          <p v-if="importExcel.namaFile" class="impor-filename">{{ importExcel.namaFile }}</p>
          <p v-if="importExcel.error" class="impor-error" role="alert">{{ importExcel.error }}</p>
          <div v-if="importExcel.pratinjau" class="impor-preview">
            <div class="impor-summary">
              <b>{{ importExcel.pratinjau.valid }} baris siap</b>
              <span v-if="importExcel.pratinjau.jumlah_error">{{ importExcel.pratinjau.jumlah_error }} baris perlu diperbaiki</span>
            </div>
            <div class="impor-table-wrap">
              <table class="impor-table">
                <thead><tr><th>Baris</th><th>Siswa</th><th>NIS / kelas</th><th>Orang tua</th><th>Hasil</th></tr></thead>
                <tbody>
                  <tr v-for="row in importExcel.pratinjau.baris.slice(0, 40)" :key="row.no">
                    <td>{{ row.no }}</td>
                    <td>{{ row.nama_siswa }}</td>
                    <td>{{ row.nis }} · {{ row.kelas }}</td>
                    <td>{{ row.nama_ortu }}</td>
                    <td :class="row.error ? 'impor-error' : 'impor-ok'">{{ row.error || 'Siap' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="importExcel.pratinjau.baris.length > 40" class="impor-note">Menampilkan 40 dari {{ importExcel.pratinjau.baris.length }} baris.</p>
          </div>
        </div>
        <div v-else class="impor-body">
          <p class="impor-ok">{{ importExcel.hasil.jumlah }} akun siswa berhasil dibuat dan terhubung ke akun orang tua.</p>
          <p class="impor-note">Simpan file kredensial dengan aman. Password tidak dapat dilihat kembali setelah modal ini ditutup.</p>
        </div>
        <footer class="impor-actions">
          <button v-if="!importExcel.hasil" type="button" class="impor-cancel" :disabled="importExcel.loading" @click="tutupImportExcel">Batal</button>
          <button v-if="importExcel.hasil" type="button" class="impor-primary" @click="unduhKredensialExcel">Unduh kredensial (CSV)</button>
          <button
            v-else
            type="button"
            class="impor-primary"
            :disabled="importExcel.loading || !importExcel.pratinjau || importExcel.pratinjau.jumlah_error > 0"
            @click="simpanImportExcel"
          >{{ importExcel.loading ? 'Memproses…' : 'Daftarkan semua akun' }}</button>
          <button v-if="importExcel.hasil" type="button" class="impor-cancel" @click="tutupImportExcel">Selesai</button>
        </footer>
      </section>
    </div>
    <FormAkunModal v-if="formOn" @tutup="formOn = false" @berhasil="akunBaru" />
    <div v-if="toast" class="toast" role="status">
      <span>{{ toast.pesan }}</span>
      <button type="button" aria-label="Tutup notifikasi" @click="tutupToast">×</button>
    </div>
  </div>
</template>

<script>
import { api } from '~/utils/api'
import { petakanImpor, TEMPLAT_IMPOR, toCsv } from '~/utils/csv'
import { createXlsxWorkbook, readFirstXlsxSheet } from '~/utils/xlsx'
export default {

  data() {
    return {
      tab: 'siswa',
      kelasAktif: null,
      formOn: false,
      toast: null,
      users: [],
      loadingUsers: true,
      requestInProgress: false,
      userError: '',
      importExcel: { buka: false, namaFile: '', baris: [], pratinjau: null, hasil: null, loading: false, error: '' },
      refreshTimer: null,
      toastTimer: null
    }
  },
  computed: {
    akunSiswa() {
      return this.users.filter((user) => user.role === 'siswa').map((user) => ({
        ...user,
        kelas: user.kelas || 'Belum ditentukan',
        ortu: user.ortu_nama || '',
        status: Number(user.active) === 1 ? 'Aktif' : 'Nonaktif'
      }))
    },
    akunOrtu() {
      return this.users.filter((user) => user.role === 'ortu').map((user) => ({
        ...user,
        hp: user.no_hp || '',
        hubungan: user.hubungan ? user.hubungan.charAt(0).toUpperCase() + user.hubungan.slice(1) : '',
        status: Number(user.active) === 1 ? 'Aktif' : 'Nonaktif'
      }))
    },
    akunKantin() {
      return this.users.filter((user) => user.role === 'pic').map((user) => ({
        ...user,
        peran: 'PIC Outlet',
        status: Number(user.active) === 1 ? 'Aktif' : 'Nonaktif'
      }))
    },
    admin() { return this.$store.getters['admin/admin'] },
    akunAdmin() {
      return this.users.filter((user) => user.role === 'admin').map((user) => ({
        ...user,
        peran: 'Admin Yayasan',
        status: Number(user.active) === 1 ? 'Aktif' : 'Nonaktif'
      }))
    },
    daftarKelasAkun() {
      return Array.from(new Set(this.akunSiswa.map((user) => user.kelas).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))
    }
  },
  created() {
    // Dibuka dari notifikasi "Lihat di Daftar Akun": /admin/akun?tab=siswa&kelas=7A
    const { tab, kelas } = this.$route.query
    if (['siswa', 'ortu', 'kantin', 'admin'].indexOf(tab) >= 0) this.tab = tab
    this.kelasAktif = kelas || null
  },
  mounted() {
    this.muatPengguna()
    this.refreshTimer = window.setInterval(() => {
      if (!document.hidden) this.muatPengguna()
    }, 15000)
    document.addEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  beforeDestroy() {
    window.clearInterval(this.refreshTimer)
    window.clearTimeout(this.toastTimer)
    document.removeEventListener('visibilitychange', this.saatVisibilitasBerubah)
  },
  methods: {
    saatVisibilitasBerubah() {
      if (!document.hidden) this.muatPengguna()
    },
    async muatPengguna() {
      if (this.requestInProgress) return
      this.requestInProgress = true
      this.loadingUsers = true
      this.userError = ''
      try {
        const users = await api.adminUsers()
        if (!Array.isArray(users)) throw new Error('Format data pengguna dari server tidak valid.')
        this.users = users
        if (!this.daftarKelasAkun.includes(this.kelasAktif)) this.kelasAktif = this.daftarKelasAkun[0] || null
      } catch (error) {
        this.userError = error.message || 'Gagal memuat data pengguna.'
      } finally {
        this.loadingUsers = false
        this.requestInProgress = false
      }
    },
    akunSiswaKelas(k) { return this.akunSiswa.filter((user) => user.kelas === k) },
    bukaImportExcel() {
      this.importExcel = { buka: true, namaFile: '', baris: [], pratinjau: null, hasil: null, loading: false, error: '' }
    },
    tutupImportExcel() {
      if (this.importExcel.loading) return
      this.importExcel.buka = false
      this.importExcel.hasil = null
    },
    unduhTemplatExcel() {
      const workbook = createXlsxWorkbook(TEMPLAT_IMPOR.slice(0, 1))
      const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'templat-impor-akun-siswa.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
    async pilihFileExcel(event) {
      const file = event.target.files && event.target.files[0]
      this.importExcel.error = ''
      this.importExcel.pratinjau = null
      this.importExcel.baris = []
      if (!file) return
      this.importExcel.namaFile = file.name
      if (!/\.xlsx$/i.test(file.name)) {
        this.importExcel.error = 'Pilih file Excel berformat .xlsx.'
        return
      }
      if (file.size > 3 * 1024 * 1024) {
        this.importExcel.error = 'Ukuran file maksimal 3 MB.'
        return
      }

      this.importExcel.loading = true
      try {
        const workbook = readFirstXlsxSheet(await file.arrayBuffer())
        const parsed = petakanImpor(workbook)
        if (parsed.galat) throw new Error(parsed.galat)
        if (parsed.baris.length > 300) throw new Error(`File berisi ${parsed.baris.length} siswa; maksimal 300 per unggahan.`)
        this.importExcel.baris = parsed.baris
        this.importExcel.pratinjau = await api.imporSiswa(parsed.baris, false)
      } catch (error) {
        this.importExcel.error = error.message || 'File Excel tidak dapat diproses.'
      } finally {
        this.importExcel.loading = false
      }
    },
    async simpanImportExcel() {
      if (!this.importExcel.pratinjau || this.importExcel.pratinjau.jumlah_error) return
      if (!window.confirm(`Daftarkan ${this.importExcel.pratinjau.valid} akun siswa dan akun orang tua terkait?`)) return
      this.importExcel.loading = true
      this.importExcel.error = ''
      try {
        this.importExcel.hasil = await api.imporSiswa(this.importExcel.baris, true)
        await this.muatPengguna()
      } catch (error) {
        this.importExcel.error = error.message || 'Impor akun tidak dapat disimpan.'
      } finally {
        this.importExcel.loading = false
      }
    },
    unduhKredensialExcel() {
      if (!this.importExcel.hasil) return
      const rows = [['nama_siswa', 'kelas', 'nis', 'username_siswa', 'password_siswa', 'nama_ortu', 'username_ortu', 'password_ortu']]
      for (const account of this.importExcel.hasil.akun) {
        rows.push([
          account.nama_siswa,
          account.kelas,
          account.nis,
          account.username_siswa,
          account.password_siswa,
          account.nama_ortu,
          account.username_ortu,
          account.password_ortu
        ])
      }
      const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'kredensial-akun-siswa-RAHASIA.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
    outletNama(key) {
      return ({ kantin_utama: 'Kantin Utama', kantin_b: 'Kantin Blok B', koperasi: 'Koperasi Sekolah' })[key] || key || 'Belum ditentukan'
    },
    // " · Perempuan · 12 Mei 2012" — kosong untuk data awal yang belum punya jenis kelamin / tanggal lahir
    profil(u) {
      const out = []
      if (u.jk) out.push(u.jk === 'L' ? 'Laki-laki' : 'Perempuan')
      if (u.lahir) {
        const [y, m, d] = u.lahir.split('-').map(Number)
        out.push(new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }))
      }
      return out.length ? ' · ' + out.join(' · ') : ''
    },
    inisial(n) { return String(n || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() },
    namaAnak(ortu) {
      const anak = Array.isArray(ortu.anak) ? ortu.anak : []
      return anak.length ? anak.map((user) => user.nama).join(', ') : 'Belum ada anak terdaftar'
    },
    // Setelah mendaftar, langsung tampilkan daftar tempat akun baru berada
    akunBaru({ jenis, nama, kelas, outlet }) {
      const JENIS = { ortu: 'orang tua', siswa: 'siswa', pic: 'PIC' }
      if (jenis === 'siswa') { this.tab = 'siswa'; this.kelasAktif = kelas }
      else if (jenis === 'ortu') this.tab = 'ortu'
      else this.tab = 'kantin'
      const detail = jenis === 'siswa' && kelas ? ' · kelas ' + kelas : (jenis === 'pic' && outlet ? ' · ' + outlet : '')
      this.toast = { pesan: 'Akun ' + JENIS[jenis] + ' ' + nama + detail + ' berhasil tersimpan di backend.' }
      window.clearTimeout(this.toastTimer)
      this.toastTimer = window.setTimeout(this.tutupToast, 5000)
      this.muatPengguna()
    },
    tutupToast() {
      this.toast = null
      window.clearTimeout(this.toastTimer)
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.load-state, .load-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: #fff; color: var(--muted); font: 400 13px/1.5 var(--font-body); }
.load-error { border-color: rgba(223, 74, 55, .24); background: rgba(223, 74, 55, .06); color: var(--coral); }
.load-error button { flex: none; border: 0; border-radius: var(--r-sm); padding: 8px 12px; background: var(--blue); color: #fff; cursor: pointer; font: 600 12px var(--font-body); }
.empty-state { padding: 18px; border: 1px dashed var(--line); border-radius: var(--r-sm); background: #fff; color: var(--muted); font: 400 13px var(--font-body); text-align: center; }
.toast { position: fixed; right: 24px; bottom: 24px; z-index: 120; display: flex; align-items: center; gap: 14px; max-width: min(440px, calc(100vw - 32px)); padding: 14px 16px; border: 1px solid rgba(26, 128, 64, .2); border-radius: var(--r-md); background: #fff; color: var(--green); box-shadow: 0 12px 36px #0002; font: 600 13px/1.5 var(--font-body); }
.toast button { flex: none; border: 0; background: transparent; color: inherit; font-size: 20px; cursor: pointer; }

.tabs { display: flex; gap: 8px; }
.tab {
  border: 1px solid var(--line); background: #fff; color: var(--muted);
  font: 600 12.5px var(--font-body); padding: 10px 16px; border-radius: var(--r-sm);
  cursor: pointer; display: flex; align-items: center; gap: 8px;
}
.tab--on, .tab--on:hover { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.tab__n {
  background: var(--bg); color: var(--muted); font: 700 10.5px var(--font-body);
  min-width: 18px; height: 18px; border-radius: var(--r-pill);
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
}
.tab--on .tab__n { background: var(--blue); color: #fff; }
.tabs { align-items: center; flex-wrap: wrap; }
.btn-sm { margin-left: auto; border: none; background: var(--blue); color: #fff; font: 600 12.5px var(--font-body); padding: 10px 16px; border-radius: var(--r-sm); cursor: pointer; }
.btn-sm:hover { background: var(--blue-dark); }
.tabs__actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.tabs__actions .btn-sm { margin-left: 0; }

.isi { display: flex; flex-direction: column; gap: 14px; }

.kelasBar { display: flex; gap: 8px; flex-wrap: wrap; }
.kelasBar .chip i { font-style: normal; opacity: .65; margin-left: 4px; }

.tabel { overflow: hidden; }
.tabel__head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.h { font: 700 14px var(--font-display); }
.sub { font: 400 12px var(--font-body); color: var(--muted); margin-top: 3px; }

.baris { display: grid; grid-template-columns: 2fr 1fr 1.4fr .8fr; padding: 13px 20px; border-top: 1px solid var(--bg); align-items: center; }
.baris--3 { grid-template-columns: 2fr 1.4fr .8fr; }
.baris--ortu { grid-template-columns: 1.6fr 1.1fr 1.8fr .7fr; }
.baris--head { padding: 11px 20px; background: var(--bg); border-top: none; font: 600 11.5px var(--font-body); color: var(--muted); letter-spacing: .03em; }
.nama { display: flex; align-items: center; gap: 11px; }
.av { width: 30px; height: 30px; border-radius: var(--r-pill); background: var(--blue-soft); color: var(--blue); display: flex; align-items: center; justify-content: center; font: 700 11.5px var(--font-display); flex: none; }
.nama b { display: block; font: 600 13px var(--font-body); }
.nama i { display: block; font: 400 11px var(--font-body); color: var(--muted); font-style: normal; margin-top: 1px; }
.muted { font: 400 12.5px var(--font-body); color: var(--muted); }

.impor-backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 18px; background: rgba(10, 13, 59, .52); }
.impor-modal { width: min(760px, 100%); max-height: min(88vh, 900px); overflow: auto; border-radius: var(--r-lg, 18px); background: #fff; box-shadow: 0 24px 70px #0003; }
.impor-head { display: flex; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid var(--line); }
.impor-head h2 { margin: 0; font: 700 18px var(--font-display); color: var(--ink); }
.impor-head p, .impor-note { margin: 4px 0 0; color: var(--muted); font: 400 12px/1.5 var(--font-body); }
.impor-close { width: 34px; height: 34px; border: 0; border-radius: var(--r-pill); background: var(--bg); color: var(--ink); font-size: 22px; cursor: pointer; }
.impor-body { display: flex; flex-direction: column; gap: 12px; padding: 20px 22px; }
.impor-template, .impor-file { width: fit-content; border: 1px solid var(--line); border-radius: var(--r-sm); padding: 9px 13px; background: #fff; color: var(--blue); font: 600 12px var(--font-body); cursor: pointer; }
.impor-file { display: flex; align-items: center; gap: 10px; color: var(--ink); }
.impor-file input { max-width: 260px; font: 400 11px var(--font-body); }
.impor-filename { margin: 0; color: var(--muted); font: 500 12px var(--font-body); }
.impor-preview { border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; }
.impor-summary { display: flex; justify-content: space-between; gap: 12px; padding: 12px; background: var(--bg); font: 500 12px var(--font-body); }
.impor-summary span, .impor-error { color: var(--coral); }
.impor-table-wrap { max-height: 270px; overflow: auto; }
.impor-table { width: 100%; border-collapse: collapse; font: 400 11px/1.4 var(--font-body); }
.impor-table th, .impor-table td { padding: 8px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
.impor-table th { position: sticky; top: 0; background: #fff; color: var(--muted); }
.impor-error { margin: 0; font: 500 12px/1.5 var(--font-body); }
.impor-ok { margin: 0; color: var(--green); font: 600 13px/1.5 var(--font-body); }
.impor-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--line); }
.impor-cancel, .impor-primary { border-radius: var(--r-sm); padding: 10px 14px; font: 600 12px var(--font-body); cursor: pointer; }
.impor-cancel { border: 1px solid var(--line); background: #fff; color: var(--ink); }
.impor-primary { border: 0; background: var(--blue); color: #fff; }
.impor-primary:disabled { opacity: .5; cursor: not-allowed; }

@media (max-width: 560px) {
  .impor-head, .impor-body { padding-left: 16px; padding-right: 16px; }
  .impor-file { align-items: flex-start; flex-direction: column; }
  .impor-file input { max-width: 100%; }
  .impor-actions { padding: 12px 16px; }
}

</style>
