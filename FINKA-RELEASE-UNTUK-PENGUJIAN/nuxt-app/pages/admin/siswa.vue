<script setup>
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})
</script>

<template>
  <div class="admin-page">
    <div class="top-bar">
      <div>
        <h1 class="display">Manajemen Akun & Siswa</h1>
        <p class="ket">Kelola akun internal, orang tua, dan siswa dalam tampilan yang terpisah agar lebih mudah dibaca.</p>
      </div>
      <div class="top-actions">
        <button class="btn btn--primary" @click="bukaTambahPasangan">+ Tambah Siswa + Orang Tua</button>
        <button class="btn" @click="bukaImpor">Impor dari CSV</button>
        <button class="btn" @click="bukaKelas">Kenaikan kelas</button>
        <button class="btn" @click="bukaMassal">Reset password massal</button>
        <button class="btn" @click="bukaTambah">+ Tambah Akun</button>
      </div>
    </div>
    <div v-if="usersError" class="users-error" role="alert">
      <span>{{ usersError }}</span>
      <button type="button" @click="fetchUsers">Coba lagi</button>
    </div>

    <div class="account-tabs">
      <button :class="['account-tab', { active: activeTab === 'internal' }]" @click="activeTab = 'internal'">
        Admin & PIC <span>{{ internalUsers.length }}</span>
      </button>
      <button :class="['account-tab', { active: activeTab === 'ortu' }]" @click="activeTab = 'ortu'">
        Orang Tua <span>{{ daftarOrtu.length }}</span>
      </button>
      <button :class="['account-tab', { active: activeTab === 'siswa' }]" @click="activeTab = 'siswa'">
        Siswa <span>{{ daftarSiswa.length }}</span>
      </button>
    </div>

    <!-- Admin + PIC disatukan -->
    <section v-if="activeTab === 'internal'" class="account-section">
      <div class="section-head">
        <div>
          <h2>Admin Yayasan & PIC Kantin</h2>
          <p>Akun pengelola sistem dan petugas outlet berada dalam satu daftar.</p>
        </div>
        <span class="section-count">{{ internalUsers.length }} akun</span>
      </div>
      <div class="card-table">
        <table>
          <thead><tr><th>Nama</th><th>Username</th><th>Kontak</th><th>Peran</th><th>Outlet</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-if="loadingList"><td colspan="7" class="empty-cell">Memuat data pengguna...</td></tr>
            <tr v-else-if="!paginatedInternal.length"><td colspan="7" class="empty-cell">Belum ada akun admin/PIC.</td></tr>
            <tr v-for="u in paginatedInternal" :key="u.id">
              <td class="name-cell">{{ u.nama }}</td>
              <td>{{ u.username }}</td>
              <td class="kontak-cell"><span v-if="u.no_hp || u.email"><span v-if="u.no_hp">{{ u.no_hp }}</span><small v-if="u.email">{{ u.email }}</small></span><span v-else class="rel-muted">—</span></td>
              <td><span class="badge" :class="u.role">{{ u.role === 'admin' ? 'ADMIN YAYASAN' : 'PIC' }}</span></td>
              <td>{{ u.role === 'pic' ? outletNama(u.outlet) : 'Semua sistem' }}</td>
              <td><span class="rel-chip ok" v-if="Number(u.active) === 1">Aktif</span><span class="rel-chip warn" v-else>Nonaktif</span></td>
              <td class="aksi-cell"><button class="btn-sm btn-sm--link" @click="bukaKelola(u)">Kelola</button><button class="btn-sm btn-sm--link" @click="resetSandi(u)">Reset Password</button><button class="btn-sm btn-sm--status" @click="ubahStatus(u)">{{ Number(u.active) === 1 ? 'Nonaktifkan' : 'Aktifkan' }}</button><button class="btn-sm" @click="hapusUser(u.id)">Hapus</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination :page="internalPage" :total="internalUsers.length" :per-page="perPage" @change="internalPage = $event" />
    </section>

    <!-- Orang tua -->
    <section v-if="activeTab === 'ortu'" class="account-section">
      <div class="section-head">
        <div><h2>Akun Orang Tua / Wali</h2><p>Daftar akun wali dan anak yang terhubung.</p></div>
        <span class="section-count">{{ daftarOrtu.length }} akun</span>
      </div>
      <div class="card-table">
        <table>
          <thead><tr><th>Nama Orang Tua</th><th>Username</th><th>Kontak</th><th>Anak Terhubung</th><th>Jumlah Anak</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-if="loadingList"><td colspan="7" class="empty-cell">Memuat data orang tua...</td></tr>
            <tr v-else-if="!paginatedOrtu.length"><td colspan="7" class="empty-cell">Belum ada akun orang tua.</td></tr>
            <tr v-for="u in paginatedOrtu" :key="u.id">
              <td class="name-cell">{{ u.nama }}<small v-if="u.hubungan" class="hub">{{ u.hubungan }}</small></td><td>{{ u.username }}</td>
              <td class="kontak-cell"><span v-if="u.no_hp || u.email"><span v-if="u.no_hp">{{ u.no_hp }}</span><small v-if="u.email">{{ u.email }}</small></span><span v-else class="rel-warn-text">Belum ada</span></td>
              <td><div class="rel-info" v-if="u.anak && u.anak.length"><span class="rel-chip ok" v-for="a in u.anak" :key="a.id">{{ a.nama }}</span></div><span class="rel-chip warn" v-else>Belum terhubung</span></td>
              <td>{{ u.anak ? u.anak.length : 0 }}</td>
              <td><span class="rel-chip ok" v-if="Number(u.active) === 1">Aktif</span><span class="rel-chip warn" v-else>Nonaktif</span></td>
              <td class="aksi-cell"><button class="btn-sm btn-sm--link" @click="bukaKelola(u)">Kelola</button><button class="btn-sm btn-sm--link" @click="resetSandi(u)">Reset Password</button><button class="btn-sm btn-sm--status" @click="ubahStatus(u)">{{ Number(u.active) === 1 ? 'Nonaktifkan' : 'Aktifkan' }}</button><button class="btn-sm" @click="hapusUser(u.id)">Hapus</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination :page="ortuPage" :total="daftarOrtu.length" :per-page="perPage" @change="ortuPage = $event" />
    </section>

    <!-- Siswa -->
    <section v-if="activeTab === 'siswa'" class="account-section">
      <div class="section-head">
        <div><h2>Data Siswa</h2><p>Data login siswa, NIS, kelas, dan hubungan orang tua.</p></div>
        <span class="section-count">{{ daftarSiswa.length }} siswa</span>
      </div>
      <div class="card-table">
        <table>
          <thead><tr><th>Nama Siswa</th><th>NIS</th><th>Kelas</th><th>Orang Tua / Wali</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-if="loadingList"><td colspan="6" class="empty-cell">Memuat data siswa...</td></tr>
            <tr v-else-if="!paginatedSiswa.length"><td colspan="6" class="empty-cell">Belum ada data siswa.</td></tr>
            <tr v-for="u in paginatedSiswa" :key="u.id">
              <td class="name-cell">{{ u.nama }}</td><td>{{ u.nis || '—' }}</td><td>{{ u.kelas || '—' }}</td>
              <td><span class="rel-chip ok" v-if="u.ortu_nama">{{ u.ortu_nama }}</span><span class="rel-chip warn" v-else>Belum terhubung</span></td>
              <td><span class="rel-chip ok" v-if="Number(u.active) === 1">Aktif</span><span class="rel-chip warn" v-else>Nonaktif</span></td>
              <td class="aksi-cell"><button class="btn-sm btn-sm--link" @click="bukaKelola(u)">Kelola</button><button class="btn-sm btn-sm--link" @click="resetSandi(u)">Reset Password</button><button class="btn-sm btn-sm--link" @click="bukaKoreksi(u)">Koreksi Saldo</button><button class="btn-sm btn-sm--status" @click="ubahStatus(u)">{{ Number(u.active) === 1 ? 'Nonaktifkan' : 'Aktifkan' }}</button><button class="btn-sm" @click="hapusUser(u.id)">Hapus</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination :page="siswaPage" :total="daftarSiswa.length" :per-page="perPage" @change="siswaPage = $event" />
    </section>

    <!-- Modal Reset Password Massal -->
    <div v-if="massal.buka" class="modal-overlay" @click.self="massal.buka = false">
      <div class="modal-card modal-card--small">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Reset password massal</h2>
        <p class="ket" style="margin-bottom: 14px;">Semua akun aktif pada peran yang dipilih diset ke password awal <strong>123456</strong>. Pengguna wajib menggantinya saat login berikutnya. Akun admin tidak ikut.</p>
        <div v-if="massal.hasil" class="success-box">
          <p class="success">{{ massal.hasil }}</p>
          <div class="modal-actions"><button type="button" class="btn btn--primary" @click="massal.buka = false">Selesai</button></div>
        </div>
        <form v-else class="form" @submit.prevent="jalankanMassal">
          <div class="field"><label>Peran</label>
            <select v-model="massal.role" class="input"><option value="siswa">Siswa</option><option value="ortu">Orang tua</option><option value="pic">PIC kasir</option></select>
          </div>
          <div v-if="massal.role === 'siswa'" class="field"><label>Kelas <span class="optional">kosongkan untuk semua kelas</span></label><input v-model="massal.kelas" class="input" placeholder="mis. 7A" /></div>
          <div class="field"><label>Ketik <strong>RESET</strong> untuk konfirmasi</label><input v-model="massal.konfirmasi" class="input" autocomplete="off" /></div>
          <p v-if="massal.error" class="error">{{ massal.error }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" style="background: var(--line);" @click="massal.buka = false">Batal</button>
            <button type="submit" class="btn btn--primary" :disabled="massal.loading || massal.konfirmasi !== 'RESET'">{{ massal.loading ? 'Memproses…' : 'Reset sekarang' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Kenaikan Kelas & Arsip -->
    <div v-if="kls.buka" class="modal-overlay" @click.self="kls.buka = false">
      <div class="modal-card" style="max-width: 640px;">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Kenaikan kelas &amp; arsip lulusan</h2>
        <div class="kls-tabs">
          <button type="button" :class="['account-tab', { active: kls.mode === 'naik' }]" @click="kls.mode = 'naik'">Naik kelas</button>
          <button type="button" :class="['account-tab', { active: kls.mode === 'arsip' }]" @click="kls.mode = 'arsip'">Arsip lulusan</button>
        </div>

        <template v-if="kls.mode === 'naik'">
          <p class="ket">Isi pasangan kelas lama → kelas baru. Semua dijalankan serentak, jadi 7A→8A dan 8A→9A tidak saling menimpa. Lakukan setelah lulusan diarsipkan.</p>
          <div v-for="(p, i) in kls.pemetaan" :key="i" class="kls-baris">
            <input v-model="p.dari" class="input" placeholder="Dari (7A)" /> <span>→</span> <input v-model="p.ke" class="input" placeholder="Ke (8A)" />
            <button type="button" class="btn-sm" @click="kls.pemetaan.splice(i, 1)" :disabled="kls.pemetaan.length === 1">×</button>
          </div>
          <button type="button" class="btn-sm btn-sm--link" @click="kls.pemetaan.push({ dari: '', ke: '' })">+ Tambah pasangan</button>
          <p v-if="kls.error" class="error">{{ kls.error }}</p>
          <p v-if="kls.naikHasil" class="ket">Akan memindahkan <b>{{ kls.naikHasil.total_siswa }}</b> siswa<span v-if="kls.naikHasil.kelas_kosong && kls.naikHasil.kelas_kosong.length"> (kelas tanpa siswa: {{ kls.naikHasil.kelas_kosong.join(', ') }})</span>: <span v-for="h in kls.naikHasil.pemetaan" :key="h.dari">{{ h.dari }}→{{ h.ke }} ({{ h.siswa }}) </span></p>
          <p v-if="kls.sukses" class="success">{{ kls.sukses }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" style="background: var(--line);" @click="kls.buka = false">Tutup</button>
            <button type="button" class="btn" :disabled="kls.loading" @click="periksaNaik">Periksa</button>
            <button type="button" class="btn btn--primary" :disabled="kls.loading || !kls.naikHasil || !kls.naikHasil.total_siswa" @click="terapkanNaik">Terapkan</button>
          </div>
        </template>

        <template v-else>
          <p class="ket">Menonaktifkan semua siswa di satu kelas (riwayat tetap utuh). Akun orang tua yang semua anaknya nonaktif ikut dinonaktifkan. Kelas lulusan sebaiknya diarsipkan <b>sebelum</b> kelas lain naik.</p>
          <div class="kls-baris"><input v-model="kls.arsipKelas" class="input" placeholder="Kelas yang lulus (mis. 9A)" /><button type="button" class="btn" :disabled="kls.loading || !kls.arsipKelas" @click="periksaArsip">Periksa</button></div>
          <p v-if="kls.error" class="error">{{ kls.error }}</p>
          <div v-if="kls.arsipHasil" class="success-box">
            <p class="pin-note">Kelas <b>{{ kls.arsipHasil.kelas }}</b>: {{ kls.arsipHasil.jumlah_siswa }} siswa · {{ kls.arsipHasil.akun_ortu_ikut_nonaktif }} akun orang tua ikut nonaktif · {{ kls.arsipHasil.tagihan_belum_dibayar }} tagihan belum dibayar<br>
              <span v-if="kls.arsipHasil.siswa_bersaldo">Ada <b>{{ kls.arsipHasil.siswa_bersaldo }}</b> siswa dengan saldo, total Rp {{ kls.arsipHasil.total_saldo.toLocaleString('id-ID') }}. Kembalikan lewat Koreksi Saldo lebih dulu bila perlu.</span><span v-else>Tidak ada saldo tersisa.</span></p>
            <label v-if="kls.arsipHasil.siswa_bersaldo" class="anak-item"><input type="checkbox" v-model="kls.akuiSaldo" /> <span>Saldo tersisa tetap tercatat dan sudah saya urus</span></label>
          </div>
          <p v-if="kls.sukses" class="success">{{ kls.sukses }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" style="background: var(--line);" @click="kls.buka = false">Tutup</button>
            <button type="button" class="btn btn--primary" :disabled="kls.loading || !kls.arsipHasil || (kls.arsipHasil.siswa_bersaldo && !kls.akuiSaldo)" @click="terapkanArsip">Arsipkan kelas</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal Impor CSV -->
    <div v-if="impor.buka" class="modal-overlay" @click.self="tutupImpor">
      <div class="modal-card" style="max-width: 760px;">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Impor siswa + orang tua dari CSV</h2>

        <template v-if="impor.tahap !== 'selesai'">
          <p class="ket" style="margin-bottom: 10px;">Satu baris = satu siswa. Kolom wajib: <b>nama_siswa, nis, kelas, password_siswa, nama_ortu, password_ortu</b>. Kedua password minimal 8 karakter. Kakak-adik dalam satu akun wali harus memakai password_ortu yang sama. Jika <b>username_ortu</b> diisi dengan akun wali yang sudah ada, password_ortu boleh kosong dan password lama tidak diubah. Password awal menjadi sementara; santri wajib menggantinya saat login pertama lalu membuat PIN. Maksimal 300 baris. Simpan sebagai <i>CSV</i>, format NIS sebagai Teks, dan jaga kerahasiaan file.</p>
          <div class="impor-aksi">
            <button type="button" class="btn-sm btn-sm--link" @click="unduhTemplat">Unduh templat</button>
            <input type="file" accept=".csv,text/csv,.txt" class="input" @change="pilihFileImpor" />
          </div>
          <p v-if="impor.error" class="error">{{ impor.error }}</p>
          <p v-if="impor.loading" class="ket">Memproses…</p>

          <div v-if="impor.pratinjau">
            <p class="impor-ringkas">
              <b>{{ impor.namaFile }}</b> · {{ impor.pratinjau.baris.length }} baris ·
              <span class="rel-chip ok">{{ impor.pratinjau.valid }} valid</span>
              <span v-if="impor.pratinjau.jumlah_error" class="rel-chip warn">{{ impor.pratinjau.jumlah_error }} salah</span>
            </p>
            <div class="card-table" style="max-height: 260px; overflow: auto;">
              <table>
                <thead><tr><th>Baris</th><th>Siswa</th><th>NIS</th><th>Kelas</th><th>Orang tua</th><th>Catatan</th></tr></thead>
                <tbody>
                  <tr v-for="b in barisTampil" :key="b.no">
                    <td>{{ b.no }}</td><td>{{ b.nama_siswa }}</td><td>{{ b.nis }}</td><td>{{ b.kelas }}</td><td>{{ b.nama_ortu }} <span class="rel-muted">({{ b.username_ortu }})</span></td>
                    <td><span v-if="b.error" class="error-text">{{ b.error }}</span><span v-else class="rel-muted">Siap</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="impor.pratinjau.jumlah_error" class="ket" style="margin-top: 6px;">Menampilkan baris yang salah lebih dulu. Perbaiki file lalu pilih ulang; tidak ada data yang tersimpan sebelum semua baris benar.</p>
          </div>

          <div class="modal-actions" style="margin-top: 14px;">
            <button type="button" class="btn" style="background: var(--line);" @click="tutupImpor">Batal</button>
            <button type="button" class="btn btn--primary" :disabled="impor.loading || !impor.pratinjau || impor.pratinjau.jumlah_error > 0" @click="jalankanImpor">Impor {{ impor.pratinjau ? impor.pratinjau.valid : 0 }} siswa</button>
          </div>
        </template>

        <template v-else>
          <div class="success-box">
            <p class="pin-note">Berhasil: <b>{{ impor.hasil.jumlah }}</b> akun siswa didaftarkan.<br>
              <span>Password sementara sudah diatur dari file. Siswa login memakai nama atau NIS dan password masing-masing, lalu wajib mengganti password saat login pertama dan membuat PIN baru.</span><br>
              <span>File unduhan hanya berisi kredensial akun orang tua yang baru dibuat. Bagikan per keluarga, jangan dikirim ke grup, dan hapus setelah dibagikan.</span></p>
          </div>
          <div class="modal-actions" style="margin-top: 14px;">
            <button type="button" class="btn btn--primary" @click="unduhKredensial">Unduh kredensial orang tua (CSV)</button>
            <button type="button" class="btn" style="background: var(--line);" @click="tutupImpor">Selesai</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal hasil Reset Password -->
    <div v-if="resetSandiState.buka" class="modal-overlay" @click.self="resetSandiState.buka = false">
      <div class="modal-card">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Password sementara {{ resetSandiState.nama }}</h2>
        <p v-if="resetSandiState.error" class="error">{{ resetSandiState.error }}</p>
        <p v-else-if="!resetSandiState.sandi" class="ket">Memproses…</p>
        <div v-else class="success-box">
          <p class="pin-note">Username: <strong style="letter-spacing:0">{{ resetSandiState.username }}</strong><br>Password sementara: <strong>{{ resetSandiState.sandi }}</strong><br><span>Sampaikan langsung ke pemilik akun, lalu minta dia menggantinya lewat menu Password. Ditampilkan sekali saja. Password lama sudah tidak berlaku (sesi yang sedang login tetap berjalan sampai habis masa berlakunya).</span></p>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn--primary" @click="resetSandiState.buka = false">Selesai</button></div>
      </div>
    </div>

    <!-- Modal Koreksi Saldo -->
    <div v-if="koreksi.buka" class="modal-overlay" @click.self="koreksi.buka = false">
      <div class="modal-card">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Koreksi saldo {{ koreksi.nama }}</h2>
        <p class="ket" style="margin-bottom: 14px;">Tercatat permanen di riwayat transaksi dan catatan internal. Gunakan hanya untuk memperbaiki kesalahan (salah top-up, salah scan).</p>
        <form class="form" @submit.prevent="kirimKoreksi">
          <div class="field"><label>Jenis</label>
            <select v-model="koreksi.arah" class="input"><option value="tambah">Tambah saldo (+)</option><option value="kurang">Kurangi saldo (−)</option></select>
          </div>
          <div class="field"><label>Nominal (Rp)</label><input v-model.number="koreksi.nominal" type="number" min="1" max="5000000" step="1" class="input" required placeholder="10000" /></div>
          <div class="field"><label>Alasan (wajib)</label><input v-model="koreksi.alasan" class="input" required minlength="5" maxlength="200" placeholder="Contoh: salah scan kantin 4 Okt" /></div>
          <p v-if="koreksi.error" class="error">{{ koreksi.error }}</p>
          <p v-if="koreksi.success" class="success">{{ koreksi.success }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" style="background: var(--line);" @click="koreksi.buka = false">Tutup</button>
            <button type="submit" class="btn btn--primary" :disabled="koreksi.loading || !!koreksi.success">{{ koreksi.loading ? 'Menyimpan…' : 'Simpan koreksi' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Tambah Siswa + Orang Tua sekaligus -->
    <div v-if="bukaPasangan" class="modal-overlay" @click.self="bukaPasangan = false">
      <div class="modal-card">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Tambah Siswa + Orang Tua</h2>
        <p class="ket" style="margin-bottom: 16px;">Satu kali simpan akan membuat dua akun, menghubungkannya, dan menyimpan semuanya ke database.</p>
        <form @submit.prevent="submitPasangan" class="form" autocomplete="off">
          <div class="subsection">
            <p class="subhead">Data Siswa</p>
            <div class="field"><label>Nama Lengkap Siswa</label><input v-model="pasangan.siswa_nama" class="input" required placeholder="Contoh: Budi Santoso" /></div>
            <div class="field-row">
              <div class="field"><label>NIS</label><input v-model="pasangan.nis" class="input" required placeholder="Contoh: 24070125" /></div>
              <div class="field"><label>Kelas</label><input v-model="pasangan.kelas" class="input" required placeholder="Contoh: 7A" /></div>
            </div>
            <div class="field"><label>Username Login Siswa</label><input :value="pasangan.nis" class="input" readonly /><p class="hint">Username siswa otomatis menggunakan NIS. Jadi siswa login menggunakan NIS + password.</p></div>
            <div class="field"><label>Password Login Siswa</label><input v-model="pasangan.siswa_password" type="password" class="input" required autocomplete="new-password" /></div>
          </div>
          <div class="subsection">
            <p class="subhead">Data Orang Tua / Wali</p>
            <div class="field"><label>Nama Orang Tua / Wali</label><input v-model="pasangan.ortu_nama" class="input" required placeholder="Contoh: Andi Santoso" /></div>
            <div class="field-row">
              <div class="field"><label>Hubungan</label><select v-model="pasangan.ortu_hubungan" class="input"><option value="ibu">Ibu</option><option value="ayah">Ayah</option><option value="wali">Wali</option></select></div>
              <div class="field"><label>Nomor HP</label><input v-model="pasangan.ortu_no_hp" type="tel" class="input" placeholder="0812 3456 7890" required /></div>
            </div>
            <div class="field"><label>Email <span class="optional">opsional</span></label><input v-model="pasangan.ortu_email" type="email" class="input" placeholder="nama@email.com" /></div>
            <div class="field"><label>Username Login Orang Tua</label><input v-model="pasangan.ortu_username" class="input" required placeholder="Contoh: ortu.andi" /></div>
            <div class="field"><label>Password Login Orang Tua</label><input v-model="pasangan.ortu_password" type="password" class="input" required autocomplete="new-password" /></div>
          </div>
          <p v-if="pasangan.error" class="error">{{ pasangan.error }}</p>
          <div v-if="pasangan.success" class="success-box">
            <p class="success">{{ pasangan.success }}</p>
            <p class="pin-note">Siswa dan Orang Tua akan membuat PIN masing-masing saat pertama kali masuk.</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" @click="bukaPasangan = false" style="background: var(--line);">Batal</button>
            <button type="submit" class="btn btn--primary" :disabled="pasangan.loading">{{ pasangan.loading ? 'Menyimpan...' : 'Buat 2 Akun & Hubungkan' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Tambah Akun -->
    <div v-if="bukaModal" class="modal-overlay" @click.self="tutupTambah">
      <div class="modal-card modal-card--akun">
        <div class="akun-head">
          <div>
            <h2 class="display" style="font-size: 18px; margin: 0;">Tambah akun</h2>
            <p class="ket" style="margin: 2px 0 0;">Pilih jenis akun, lalu isi datanya.</p>
          </div>
          <button type="button" class="akun-x" aria-label="Tutup" @click="tutupTambah">×</button>
        </div>

        <div v-if="hasilAkun" class="akun-body">
          <p class="success">Akun "{{ hasilAkun.nama }}" berhasil dibuat.</p>
          <div class="pin-note">
            <div>Username: <strong>{{ hasilAkun.username }}</strong></div>
            <div v-if="hasilAkun.password">Password awal: <strong>{{ hasilAkun.password }}</strong></div>
            <div v-for="a in hasilAkun.anak" :key="a.nis" class="hasil-anak">Anak: <strong>{{ a.nama }}</strong> ({{ a.kelas }}) · username <strong>{{ a.username }}</strong> · password <strong>{{ a.password }}</strong></div>
            <span>Catat password sekarang, hanya ditampilkan sekali. Siswa dan Orang Tua membuat PIN sendiri saat pertama kali masuk.</span>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" style="background: var(--line);" @click="bukaTambah">Tambah lagi</button>
            <button type="button" class="btn btn--primary" @click="tutupTambah">Selesai</button>
          </div>
        </div>

        <form v-else @submit.prevent="submitUser" class="akun-body" autocomplete="off">
          <div class="jenis-grid">
            <button v-for="j in jenisAkun" :key="j.role" type="button" class="jenis-kartu" :class="{ aktif: form.role === j.role }" @click="pilihJenis(j.role)">
              <span class="jenis-judul">{{ j.label }}</span>
              <span class="jenis-ket">{{ j.ket }}</span>
            </button>
          </div>

          <div class="field">
            <label>Nama lengkap</label>
            <input v-model="form.nama" type="text" class="input" :placeholder="form.role === 'siswa' ? 'mis. Budi Santoso' : 'mis. Sari Wulandari'" required maxlength="80" autocomplete="nope" />
          </div>

          <div class="field-row">
            <div v-if="form.role === 'ortu'" class="field">
              <label>Hubungan</label>
              <select v-model="form.hubungan" class="input">
                <option value="ibu">Ibu</option>
                <option value="ayah">Ayah</option>
                <option value="wali">Wali</option>
              </select>
            </div>
            <div v-if="form.role !== 'siswa'" class="field">
              <label>Nomor HP <span v-if="form.role !== 'ortu'" class="optional">opsional</span></label>
              <input v-model="form.no_hp" type="tel" inputmode="tel" class="input" placeholder="0812 3456 7890" :required="form.role === 'ortu'" autocomplete="nope" />
            </div>
          </div>

          <div v-if="form.role !== 'siswa'" class="field">
            <label>Email <span class="optional">opsional</span></label>
            <input v-model="form.email" type="email" class="input" placeholder="nama@email.com" autocomplete="nope" />
            <p class="hint">Disimpan sebagai kontak. Pengiriman notifikasi lewat email belum aktif.</p>
          </div>

          <div v-if="form.role === 'pic'" class="field">
            <label>Tempat tugas</label>
            <input v-model.trim="form.outlet" class="input" required maxlength="80" placeholder="Contoh: Kantin Gedung A" />
            <p class="hint">Akun ini tidak dapat membuka menu Admin.</p>
          </div>

          <template v-if="form.role === 'siswa'">
            <div class="field-row">
              <div class="field"><label>Kelas</label><input v-model="form.kelas" type="text" class="input" placeholder="mis. 7B" required autocomplete="nope" /></div>
              <div class="field"><label>NIS</label><input v-model="form.nis" type="text" class="input" placeholder="mis. 24071023" required autocomplete="nope" /></div>
            </div>
            <div class="field">
              <label>Nama orang tua / wali</label>
              <select v-model="form.ortu_id" class="input" required>
                <option disabled value="">Pilih akun orang tua / wali</option>
                <option v-for="o in daftarOrtu" :key="o.id" :value="o.id">{{ o.nama }} ({{ o.username }})</option>
              </select>
              <p class="hint">Siswa akan langsung terhubung ke akun orang tua yang dipilih. Username siswa memakai NIS.</p>
            </div>
          </template>

          <div v-if="form.role === 'ortu'" class="field">
            <label>Daftarkan anak sekaligus <span class="optional">opsional</span></label>
            <div v-for="(a, i) in form.anak_baru" :key="i" class="anak-baru">
              <input v-model="a.nama" class="input" placeholder="Nama anak" maxlength="80" autocomplete="nope" />
              <input v-model="a.nis" class="input" placeholder="NIS" autocomplete="nope" />
              <input v-model="a.kelas" class="input" placeholder="Kelas" maxlength="20" autocomplete="nope" />
              <button type="button" class="akun-x" aria-label="Hapus anak" @click="form.anak_baru.splice(i, 1)">×</button>
            </div>
            <button type="button" class="btn-sm btn-sm--link" :disabled="form.anak_baru.length >= 10" @click="form.anak_baru.push({ nama: '', nis: '', kelas: '' })">+ Tambah anak</button>
          </div>

          <div v-if="form.role === 'ortu'" class="field">
            <label>Hubungkan ke anak <span class="optional">opsional</span></label>
            <div class="anak-list" v-if="daftarSiswa.length">
              <label class="anak-item" v-for="s in daftarSiswa" :key="s.id">
                <input type="checkbox" :value="s.id" v-model="form.anak_ids" />
                <span>
                  {{ s.nama }}
                  <span class="rel-muted" v-if="s.kelas || s.nis"> — {{ [s.kelas, s.nis].filter(Boolean).join(' · ') }}</span>
                  <span class="rel-muted rel-warn-text" v-if="s.ortu_id"> (saat ini wali: {{ s.ortu_nama }})</span>
                </span>
              </label>
            </div>
            <p class="hint" v-else>Belum ada akun siswa. Bisa dihubungkan belakangan lewat "Kelola".</p>
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <div class="akun-foot">
            <button type="button" class="btn" @click="tutupTambah" style="background: #fff; border: 1px solid var(--line);">Batal</button>
            <button type="submit" class="btn btn--primary" :disabled="loading">{{ loading ? 'Menyimpan...' : 'Daftarkan akun' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Edit Admin/PIC -->
    <div v-if="editInternal.buka && editInternal.user" class="modal-overlay" @click.self="editInternal.buka = false">
      <div class="modal-card modal-card--small">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Kelola Akun {{ editInternal.user.role === 'admin' ? 'Admin Yayasan' : 'PIC' }}</h2>
        <p class="ket" style="margin-bottom: 16px;">Lihat dan ubah data login akun. Role tidak diubah dari menu ini.</p>
        <form @submit.prevent="simpanEditInternal" class="form" autocomplete="off">
          <div class="field"><label>Nama</label><input v-model="editInternal.nama" class="input" required /></div>
          <div class="field"><label>Username</label><input v-model="editInternal.username" class="input" required autocomplete="off" /></div>
          <div v-if="editInternal.user.role === 'pic'" class="field">
            <label>Outlet</label>
            <input v-model.trim="editInternal.outlet" class="input" required maxlength="80" placeholder="Nama outlet" />
          </div>
          <div class="field">
            <label>Password Baru <span class="optional">(kosongkan jika tidak diubah)</span></label>
            <input v-model="editInternal.password" type="password" class="input" autocomplete="new-password" minlength="6" placeholder="Minimal 6 karakter" />
          </div>
          <div class="field-row">
            <div class="field"><label>Nomor HP <span class="optional">opsional</span></label><input v-model="editInternal.no_hp" type="tel" class="input" placeholder="0812 3456 7890" /></div>
            <div class="field"><label>Email <span class="optional">opsional</span></label><input v-model="editInternal.email" type="email" class="input" placeholder="nama@email.com" /></div>
          </div>
          <div class="verify-actions">
            <button type="button" class="btn-sm btn-sm--link" :disabled="editInternal.loading || !editInternal.no_hp" @click="verifikasiKontak('whatsapp', editInternal)">Verifikasi WhatsApp</button>
            <button type="button" class="btn-sm btn-sm--link" :disabled="editInternal.loading || !editInternal.email" @click="verifikasiKontak('email', editInternal)">Verifikasi email</button>
            <span class="hint">Verifikasi hanya setelah kontak dikonfirmasi langsung kepada pemilik akun.</span>
          </div>
          <div class="account-preview">
            <span class="rel-chip" :class="Number(editInternal.user.active) === 1 ? 'ok' : 'warn'">{{ Number(editInternal.user.active) === 1 ? 'Aktif' : 'Nonaktif' }}</span>
            <span class="preview-role">{{ editInternal.user.role === 'admin' ? 'Admin Yayasan' : 'PIC · ' + outletNama(editInternal.outlet) }}</span>
          </div>
          <p v-if="editInternal.error" class="error">{{ editInternal.error }}</p>
          <p v-if="editInternal.success" class="success">{{ editInternal.success }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" @click="editInternal.buka = false" style="background: var(--line);">Tutup</button>
            <button type="submit" class="btn btn--primary" :disabled="editInternal.loading">{{ editInternal.loading ? 'Menyimpan...' : 'Simpan Perubahan' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Kelola Keterkaitan (utk akun yang sudah ada) -->
    <div v-if="kelola.buka && kelola.user" class="modal-overlay" @click.self="kelola.buka = false">
      <div class="modal-card">
        <h2 class="display" style="font-size: 18px; margin-bottom: 4px;">Kelola Keterkaitan</h2>
        <p class="ket" style="margin-bottom: 16px;">
          {{ kelola.user.nama }} — {{ kelola.user.role === 'siswa' ? 'Akun Siswa' : 'Akun Orang Tua' }}
        </p>

        <form @submit.prevent="simpanKelola" class="form">
          <template v-if="kelola.user.role === 'siswa'">
            <div class="field-row">
              <div class="field">
                <label>Kelas</label>
                <input v-model="kelola.kelas" type="text" class="input" placeholder="Contoh: 7B" />
              </div>
              <div class="field">
                <label>NIS</label>
                <input v-model="kelola.nis" type="text" class="input" placeholder="Contoh: 24071023" />
              </div>
            </div>
            <div class="field">
              <label>Orang Tua/Wali</label>
              <select v-model="kelola.ortu_id" class="input">
                <option value="">— Tidak terhubung —</option>
                <option v-for="o in daftarOrtu" :key="o.id" :value="o.id">{{ o.nama }} ({{ o.username }})</option>
              </select>
            </div>
          </template>

          <template v-else>
            <div class="field-row">
              <div class="field"><label>Hubungan</label><select v-model="kelola.hubungan" class="input"><option value="ibu">Ibu</option><option value="ayah">Ayah</option><option value="wali">Wali</option></select></div>
              <div class="field"><label>Nomor HP</label><input v-model="kelola.no_hp" type="tel" class="input" placeholder="0812 3456 7890" required /></div>
            </div>
            <div class="field"><label>Email <span class="optional">opsional</span></label><input v-model="kelola.email" type="email" class="input" placeholder="nama@email.com" /></div>
            <div class="verify-actions">
              <button type="button" class="btn-sm btn-sm--link" :disabled="kelola.loading || !kelola.no_hp" @click="verifikasiKontak('whatsapp', kelola)">Verifikasi WhatsApp</button>
              <button type="button" class="btn-sm btn-sm--link" :disabled="kelola.loading || !kelola.email" @click="verifikasiKontak('email', kelola)">Verifikasi email</button>
              <span class="hint">Verifikasi hanya setelah kontak dikonfirmasi langsung kepada pemilik akun.</span>
            </div>
            <p class="ket" style="margin: 0 0 8px;">Centang anak yang terhubung dengan akun ini:</p>
            <div class="anak-list" v-if="daftarSiswa.length">
              <label class="anak-item" v-for="s in daftarSiswa" :key="s.id">
                <input type="checkbox" :value="s.id" v-model="kelola.anak_ids" />
                <span>
                  {{ s.nama }}
                  <span class="rel-muted" v-if="s.kelas || s.nis"> — {{ [s.kelas, s.nis].filter(Boolean).join(' · ') }}</span>
                  <span class="rel-muted rel-warn-text" v-if="s.ortu_id && s.ortu_id !== kelola.user.id"> (saat ini wali: {{ s.ortu_nama }})</span>
                </span>
              </label>
            </div>
            <p class="hint" v-else>Belum ada akun siswa.</p>
          </template>

          <p v-if="kelola.error" class="error">{{ kelola.error }}</p>
          <p v-if="kelola.success" class="success">{{ kelola.success }}</p>

          <div class="modal-actions">
            <button type="button" class="btn" @click="kelola.buka = false" style="background: var(--line);">Tutup</button>
            <button type="submit" class="btn btn--primary" :disabled="kelola.loading">
              {{ kelola.loading ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { BASE_URL, api } from '~/utils/api'
import { parseCsv, toCsv, petakanImpor, TEMPLAT_IMPOR } from '~/utils/csv'

const adminBase = () => BASE_URL + '/admin'

const Pagination = {
  props: { page: { type: Number, default: 1 }, total: { type: Number, default: 0 }, perPage: { type: Number, default: 8 } },
  computed: { pages() { return Math.max(1, Math.ceil(this.total / this.perPage)) } },
  methods: { go(page) { if (page >= 1 && page <= this.pages && page !== this.page) this.$emit('change', page) } },
  render(h) {
    if (!(this.total > this.perPage)) return null
    return h('div', { staticClass: 'pagination' }, [
      h('button', { staticClass: 'page-btn', attrs: { disabled: this.page === 1 }, on: { click: () => this.go(this.page - 1) } }, '‹ Sebelumnya'),
      h('span', { staticClass: 'page-info' }, ['Halaman ', h('strong', String(this.page)), ' dari ', h('strong', String(this.pages))]),
      h('button', { staticClass: 'page-btn', attrs: { disabled: this.page === this.pages }, on: { click: () => this.go(this.page + 1) } }, 'Berikutnya ›')
    ])
  }
}

export default {


  components: { Pagination },
  data() {
    return {
      users: [],
      loadingList: true,
      usersError: '',
      activeTab: 'internal',
      perPage: 8,
      internalPage: 1,
      ortuPage: 1,
      siswaPage: 1,
      bukaModal: false,
      bukaPasangan: false,
      kls: { buka: false, mode: 'naik', pemetaan: [{ dari: '', ke: '' }], naikHasil: null, arsipKelas: '', arsipHasil: null, akuiSaldo: false, loading: false, error: '', sukses: '' },
      impor: { buka: false, tahap: 'pilih', namaFile: '', baris: [], pratinjau: null, hasil: null, loading: false, error: '' },
      resetSandiState: { buka: false, nama: '', username: '', sandi: '', error: '' },
      koreksi: { buka: false, id: null, nama: '', arah: 'tambah', nominal: null, alasan: '', loading: false, error: '', success: '' },
      pasangan: { siswa_nama: '', siswa_password: '', kelas: '', nis: '', ortu_nama: '', ortu_hubungan: 'ibu', ortu_no_hp: '', ortu_email: '', ortu_username: '', ortu_password: '', loading: false, error: '', success: '' },
      massal: { buka: false, role: 'siswa', kelas: '', konfirmasi: '', loading: false, error: '', hasil: '' },
      hasilAkun: null,
      jenisAkun: [
        { role: 'ortu', label: 'Orang tua', ket: 'Mengisi saldo dan membayar tagihan' },
        { role: 'siswa', label: 'Siswa', ket: 'Belanja dengan barcode dan PIN' },
        { role: 'pic', label: 'PIC', ket: 'Kasir kantin atau koperasi' }
      ],
      form: {
        nama: '',
        hubungan: 'ibu',
        no_hp: '',
        email: '',
        role: 'ortu',
        outlet: '',
        kelas: '',
        nis: '',
        ortu_id: '',
        anak_ids: [],
        anak_baru: []
      },
      loading: false,
      error: '',
      success: '',
      editInternal: { buka: false, user: null, nama: '', username: '', outlet: '', no_hp: '', email: '', password: '', loading: false, error: '', success: '' },
      kelola: {
        buka: false,
        user: null,
        hubungan: 'ibu',
        no_hp: '',
        email: '',
        kelas: '',
        nis: '',
        ortu_id: '',
        anak_ids: [],
        loading: false,
        error: '',
        success: ''
      }
    }
  },
  computed: {
    barisTampil() { const p = this.impor.pratinjau; if (!p) return []; return [...p.baris].sort((a, b) => (b.error.length > 0) - (a.error.length > 0)).slice(0, 200) },
    daftarOrtu() {
      return this.users.filter((u) => u.role === 'ortu')
    },
    daftarSiswa() {
      return this.users.filter((u) => u.role === 'siswa')
    },
    internalUsers() {
      return this.users.filter((u) => u.role === 'admin' || u.role === 'pic')
    },
    paginatedInternal() {
      const start = (this.internalPage - 1) * this.perPage
      return this.internalUsers.slice(start, start + this.perPage)
    },
    paginatedOrtu() {
      const start = (this.ortuPage - 1) * this.perPage
      return this.daftarOrtu.slice(start, start + this.perPage)
    },
    paginatedSiswa() {
      const start = (this.siswaPage - 1) * this.perPage
      return this.daftarSiswa.slice(start, start + this.perPage)
    }
  },
  mounted() {
    this.fetchUsers()
  },
  methods: {
    outletNama(key) { return ({ kantin_utama: 'Kantin Utama', kantin_b: 'Kantin Blok B', koperasi: 'Koperasi Sekolah' })[key] || key || '—' },
    authHeaders(withJson) {
      const token = this.$store.state.auth && this.$store.state.auth.token
      const headers = { Authorization: `Bearer ${token}` }
      if (withJson) headers['Content-Type'] = 'application/json'
      return headers
    },
    async fetchUsers() {
      this.loadingList = true
      this.usersError = ''
      try {
        const res = await fetch(`${adminBase()}/users`, { headers: this.authHeaders(false) })
        const users = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(users.error || 'Gagal mengambil data pengguna.')
        if (!Array.isArray(users)) throw new Error('Format data pengguna dari server tidak valid.')
        this.users = users
        this.internalPage = Math.min(this.internalPage, Math.max(1, Math.ceil(this.internalUsers.length / this.perPage)))
        this.ortuPage = Math.min(this.ortuPage, Math.max(1, Math.ceil(this.daftarOrtu.length / this.perPage)))
        this.siswaPage = Math.min(this.siswaPage, Math.max(1, Math.ceil(this.daftarSiswa.length / this.perPage)))
      } catch (err) {
        console.error('Gagal memuat pengguna:', err)
        this.usersError = err.message || 'Gagal mengambil data pengguna.'
      } finally {
        this.loadingList = false
      }
    },
    bukaMassal() { this.massal = { buka: true, role: 'siswa', kelas: '', konfirmasi: '', loading: false, error: '', hasil: '' } },
    async jalankanMassal() {
      const m = this.massal
      m.loading = true; m.error = ''
      try {
        const res = await fetch(`${adminBase()}/users/reset-password-massal`, { method: 'POST', headers: this.authHeaders(true), body: JSON.stringify({ role: m.role, kelas: m.role === 'siswa' ? m.kelas : undefined, konfirmasi: m.konfirmasi }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Gagal reset password')
        m.hasil = `${data.jumlah} akun diset ke password ${data.password_awal}. Mereka wajib menggantinya saat login.`
      } catch (e) {
        m.error = e.message
      } finally {
        m.loading = false
      }
    },
    bukaTambah() {
      this.resetForm()
      this.error = ''
      this.success = ''
      this.hasilAkun = null
      this.bukaModal = true
    },
    tutupTambah() {
      this.bukaModal = false
      this.hasilAkun = null
    },
    pilihJenis(role) {
      this.form.role = role
      this.error = ''
      this.onRoleChange()
    },
    bukaTambahPasangan() {
      this.pasangan = { siswa_nama: '', siswa_password: '', kelas: '', nis: '', ortu_nama: '', ortu_hubungan: 'ibu', ortu_no_hp: '', ortu_email: '', ortu_username: '', ortu_password: '', loading: false, error: '', success: '' }
      this.bukaPasangan = true
    },
    async submitPasangan() {
      this.pasangan.loading = true
      this.pasangan.error = ''
      this.pasangan.success = ''
      try {
        const res = await fetch(`${adminBase()}/users/siswa-ortu`, {
          method: 'POST', headers: this.authHeaders(true),
          body: JSON.stringify(this.pasangan)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal membuat akun')
        this.pasangan.success = `Berhasil! Siswa ${data.siswa.nama} dan orang tua ${data.ortu.nama} sudah terhubung.`
        await this.fetchUsers()

      } catch (err) {
        this.pasangan.error = err.message
      } finally {
        this.pasangan.loading = false
      }
    },
    resetForm() {
      this.form = { nama: '', hubungan: 'ibu', no_hp: '', email: '', role: 'ortu', outlet: '', kelas: '', nis: '', ortu_id: '', anak_ids: [], anak_baru: [] }
    },
    onRoleChange() {
      // Field keterkaitan tergantung role — bersihkan tiap kali role diganti
      // supaya tidak ada pilihan lama yang nyangkut & terkirim keliru.
      this.form.kelas = ''
      this.form.nis = ''
      this.form.ortu_id = ''
      this.form.anak_ids = []
      this.form.anak_baru = []
    },
    async submitUser() {
      this.error = ''
      this.success = ''
      this.loading = true

      try {
        const payload = { nama: this.form.nama, role: this.form.role }
        if (this.form.role !== 'siswa') {
          payload.no_hp = this.form.no_hp
          payload.email = this.form.email
        }
        if (this.form.role === 'ortu') payload.hubungan = this.form.hubungan
        if (this.form.role === 'pic') payload.outlet = this.form.outlet
        if (this.form.role === 'siswa') {
          payload.kelas = this.form.kelas
          payload.nis = this.form.nis
          payload.ortu_id = this.form.ortu_id || null
        }
        if (this.form.role === 'ortu') {
          payload.anak_ids = this.form.anak_ids
          const baru = this.form.anak_baru.filter((a) => a.nama || a.nis || a.kelas)
          if (baru.length) payload.anak_baru = baru
        }

        const endpoint = this.form.role === 'siswa' ? '/users/siswa' : '/users'
        const res = await fetch(`${adminBase()}${endpoint}`, {
          method: 'POST',
          headers: this.authHeaders(true),
          body: JSON.stringify(payload)
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal membuat akun')

        this.hasilAkun = { nama: data.user.nama, username: data.user.username, password: data.password_awal, anak: data.anak_baru || [] }
        this.fetchUsers() // Refresh daftar user (termasuk keterkaitan barunya)
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    bukaEditInternal(u) {
      this.editInternal = { buka: true, user: u, nama: u.nama || '', username: u.username || '', outlet: u.outlet || '', no_hp: u.no_hp || '', email: u.email || '', password: '', loading: false, error: '', success: '' }
    },
    async simpanEditInternal() {
      const e = this.editInternal
      e.loading = true
      e.error = ''
      e.success = ''
      try {
        const res = await fetch(`${adminBase()}/users/${e.user.id}/profil-internal`, {
          method: 'PUT',
          headers: this.authHeaders(true),
          body: JSON.stringify({ nama: e.nama, username: e.username, outlet: e.user.role === 'pic' ? e.outlet : null, password: e.password || '' })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui akun')
        const rk = await fetch(`${adminBase()}/users/${e.user.id}/kontak`, { method: 'PUT', headers: this.authHeaders(true), body: JSON.stringify({ no_hp: e.no_hp, email: e.email }) })
        const dk = await rk.json().catch(() => ({}))
        if (!rk.ok) throw new Error(dk.error || 'Gagal menyimpan kontak')
        e.success = 'Akun berhasil diperbarui.'
        await this.fetchUsers()
        setTimeout(() => { e.buka = false }, 700)
      } catch (err) {
        e.error = err.message
      } finally {
        e.loading = false
      }
    },
    async verifikasiKontak(channel, state) {
      const destination = channel === 'email' ? state.email : state.no_hp
      const label = channel === 'email' ? 'email' : 'nomor WhatsApp'
      if (!destination || !window.confirm(`Pastikan ${label} ini sudah dikonfirmasi langsung kepada pemilik akun. Lanjutkan verifikasi?`)) return
      state.loading = true
      state.error = ''
      state.success = ''
      try {
        const contactResponse = await fetch(`${adminBase()}/users/${state.user.id}/kontak`, {
          method: 'PUT',
          headers: this.authHeaders(true),
          body: JSON.stringify({ no_hp: state.no_hp, email: state.email })
        })
        const contactResult = await contactResponse.json().catch(() => ({}))
        if (!contactResponse.ok) throw new Error(contactResult.error || 'Gagal menyimpan kontak')
        const response = await fetch(`${adminBase()}/users/${state.user.id}/verifikasi-kontak`, {
          method: 'POST',
          headers: this.authHeaders(true),
          body: JSON.stringify({ channel, konfirmasi: true, metode: 'telepon_resmi' })
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Gagal memverifikasi kontak')
        state.success = `${label} berhasil diverifikasi.`
        await this.fetchUsers()
        state.user = this.users.find((user) => user.id === state.user.id) || state.user
      } catch (error) {
        state.error = error.message || 'Gagal memverifikasi kontak.'
      } finally {
        state.loading = false
      }
    },
    bukaKelola(u) {
      if (u.role === 'admin' || u.role === 'pic') return this.bukaEditInternal(u)

      this.kelola.user = u
      this.kelola.error = ''
      this.kelola.success = ''
      if (u.role === 'siswa') {
        this.kelola.kelas = u.kelas || ''
        this.kelola.nis = u.nis || ''
        this.kelola.ortu_id = u.ortu_id || ''
      } else if (u.role === 'ortu') {
        this.kelola.anak_ids = (u.anak || []).map((a) => a.id)
        this.kelola.hubungan = u.hubungan || 'ibu'
        this.kelola.no_hp = u.no_hp || ''
        this.kelola.email = u.email || ''
      }
      this.kelola.buka = true
    },
    async simpanKelola() {
      const u = this.kelola.user
      this.kelola.loading = true
      this.kelola.error = ''
      this.kelola.success = ''

      try {
        let url
        let body
        if (u.role === 'siswa') {
          url = `${adminBase()}/users/${u.id}/profil-siswa`
          body = { kelas: this.kelola.kelas, nis: this.kelola.nis, ortu_id: this.kelola.ortu_id || null }
        } else {
          const rk = await fetch(`${adminBase()}/users/${u.id}/kontak`, { method: 'PUT', headers: this.authHeaders(true), body: JSON.stringify({ hubungan: this.kelola.hubungan, no_hp: this.kelola.no_hp, email: this.kelola.email }) })
          const dk = await rk.json().catch(() => ({}))
          if (!rk.ok) throw new Error(dk.error || 'Gagal menyimpan kontak')
          url = `${adminBase()}/users/${u.id}/anak`
          body = { anak_ids: this.kelola.anak_ids }
        }

        const res = await fetch(url, {
          method: 'PUT',
          headers: this.authHeaders(true),
          body: JSON.stringify(body)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan keterkaitan')

        this.kelola.success = 'Keterkaitan berhasil disimpan!'
        await this.fetchUsers()
        setTimeout(() => {
          this.kelola.buka = false
        }, 900)
      } catch (err) {
        this.kelola.error = err.message
      } finally {
        this.kelola.loading = false
      }
    },
    bukaImpor() { this.impor = { buka: true, tahap: 'pilih', namaFile: '', baris: [], pratinjau: null, hasil: null, loading: false, error: '' } },
    tutupImpor() { if (this.impor.loading) return; this.impor.buka = false; this.impor.hasil = null },
    unduhBerkas(nama, teks) {
      const url = URL.createObjectURL(new Blob([teks], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
    unduhTemplat() { this.unduhBerkas('templat-impor-siswa.csv', toCsv(TEMPLAT_IMPOR)) },
    async pilihFileImpor(ev) {
      const f = ev.target.files && ev.target.files[0]
      this.impor.error = ''; this.impor.pratinjau = null; this.impor.baris = []
      if (!f) return
      if (f.size > 1024 * 1024) { this.impor.error = 'File terlalu besar (maksimal 1 MB).'; return }
      this.impor.namaFile = f.name
      let teks
      try { teks = await f.text() } catch (e) { this.impor.error = 'File tidak bisa dibaca.'; return }
      const { baris, galat } = petakanImpor(parseCsv(teks))
      if (galat) { this.impor.error = galat; return }
      if (baris.length > 300) { this.impor.error = `File berisi ${baris.length} baris; maksimal 300 per impor. Pecah menjadi beberapa file.`; return }
      this.impor.baris = baris
      await this.kirimImpor(false)
    },
    async kirimImpor(simpan) {
      this.impor.loading = true; this.impor.error = ''
      try {
        const res = await fetch(`${adminBase()}/impor-siswa`, { method: 'POST', headers: this.authHeaders(true), body: JSON.stringify({ baris: this.impor.baris, simpan }) })
        const data = await res.json().catch(() => ({}))
        if (data && data.baris) this.impor.pratinjau = data
        if (!res.ok && !(data && data.baris && !simpan)) throw new Error(data.error || 'Impor gagal')
        if (simpan) {
          this.impor.hasil = data; this.impor.tahap = 'selesai'
          await this.fetchUsers()
        }
      } catch (e) { this.impor.error = e.message } finally { this.impor.loading = false }
    },
    async jalankanImpor() {
      if (!this.impor.pratinjau || this.impor.pratinjau.jumlah_error > 0) return
      if (!window.confirm(`Buat ${this.impor.pratinjau.valid} akun siswa dan akun orang tua terkait?`)) return
      await this.kirimImpor(true)
    },
    unduhKredensial() {
      const k = [['nama_siswa', 'kelas', 'nis', 'nama_ortu', 'username_ortu', 'password_ortu']]
      for (const a of this.impor.hasil.akun) k.push([a.nama_siswa, a.kelas, a.nis, a.nama_ortu, a.username_ortu, a.password_ortu || '(akun lama, password tidak diubah)'])
      this.unduhBerkas('akun-orang-tua-RAHASIA.csv', toCsv(k))
    },
    bukaKelas() { this.kls = { buka: true, mode: 'naik', pemetaan: [{ dari: '', ke: '' }], naikHasil: null, arsipKelas: '', arsipHasil: null, akuiSaldo: false, loading: false, error: '', sukses: '' } },
    async periksaNaik() {
      const k = this.kls; k.loading = true; k.error = ''; k.sukses = ''; k.naikHasil = null
      try { k.naikHasil = await api.naikKelas(k.pemetaan.filter((p) => p.dari || p.ke), false) } catch (e) { k.error = e.message } finally { k.loading = false }
    },
    async terapkanNaik() {
      const k = this.kls
      if (!window.confirm(`Pindahkan ${k.naikHasil.total_siswa} siswa ke kelas baru?`)) return
      k.loading = true; k.error = ''
      try { const r = await api.naikKelas(k.pemetaan.filter((p) => p.dari || p.ke), true); k.sukses = `Selesai: ${r.diubah} siswa dipindahkan.`; k.naikHasil = null; await this.fetchUsers() } catch (e) { k.error = e.message } finally { k.loading = false }
    },
    async periksaArsip() {
      const k = this.kls; k.loading = true; k.error = ''; k.sukses = ''; k.arsipHasil = null; k.akuiSaldo = false
      try { k.arsipHasil = await api.arsipKelas(k.arsipKelas, false, false) } catch (e) { k.error = e.message } finally { k.loading = false }
    },
    async terapkanArsip() {
      const k = this.kls
      if (!window.confirm(`Nonaktifkan ${k.arsipHasil.jumlah_siswa} siswa kelas ${k.arsipHasil.kelas}?`)) return
      k.loading = true; k.error = ''
      try { const r = await api.arsipKelas(k.arsipKelas, true, k.akuiSaldo); k.sukses = `Selesai: ${r.jumlah_siswa} siswa dan ${r.akun_ortu_ikut_nonaktif} akun orang tua dinonaktifkan.`; k.arsipHasil = null; await this.fetchUsers() } catch (e) { k.error = e.message } finally { k.loading = false }
    },
    async resetSandi(u) {
      if (!confirm(`Reset password ${u.nama}? Password lama tidak akan berlaku lagi.`)) return
      this.resetSandiState = { buka: true, nama: u.nama, username: '', sandi: '', error: '' }
      try {
        const res = await fetch(`${adminBase()}/users/${u.id}/reset-password`, { method: 'POST', headers: this.authHeaders(true) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Gagal mereset password')
        this.resetSandiState = { buka: true, nama: u.nama, username: data.username, sandi: data.password_sementara, error: '' }
      } catch (e) {
        this.resetSandiState = { buka: true, nama: u.nama, username: '', sandi: '', error: e.message }
      }
    },
    bukaKoreksi(u) {
      this.koreksi = { buka: true, id: u.id, nama: u.nama, arah: 'tambah', nominal: null, alasan: '', loading: false, error: '', success: '' }
    },
    async kirimKoreksi() {
      const k = this.koreksi
      const n = Math.abs(Number(k.nominal))
      if (!Number.isInteger(n) || n <= 0) { k.error = 'Nominal harus bilangan bulat lebih dari 0'; return }
      if (!confirm(`${k.arah === 'tambah' ? 'Tambah' : 'Kurangi'} saldo ${k.nama} sebesar Rp ${n.toLocaleString('id-ID')}?`)) return
      k.loading = true; k.error = ''
      try {
        const res = await fetch(`${adminBase()}/users/${k.id}/koreksi-saldo`, {
          method: 'POST', headers: this.authHeaders(true),
          body: JSON.stringify({ nominal: k.arah === 'tambah' ? n : -n, alasan: k.alasan })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan koreksi')
        k.success = `Berhasil. Saldo sekarang Rp ${Number(data.saldo_baru).toLocaleString('id-ID')}.`
      } catch (e) { k.error = e.message } finally { k.loading = false }
    },
    async ubahStatus(u) {
      const aktif = Number(u.active) === 1
      const aksi = aktif ? 'menonaktifkan' : 'mengaktifkan'
      if (!confirm(`Yakin ingin ${aksi} akun ${u.nama}?`)) return
      try {
        const res = await fetch(`${adminBase()}/users/${u.id}/status`, {
          method: 'PATCH',
          headers: this.authHeaders(true),
          body: JSON.stringify({ active: !aktif })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Gagal ${aksi} akun`)
        await this.fetchUsers()
      } catch (e) {
        alert(e.message)
      }
    },
    async hapusUser(id) {
      if (!confirm('Yakin ingin menghapus akun ini?')) return
      try {
        const res = await fetch(`${adminBase()}/users/${id}`, {
          method: 'DELETE',
          headers: this.authHeaders(false)
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          this.fetchUsers()
        } else {
          alert(data.error || 'Gagal menghapus akun')
        }
      } catch (e) {
        console.error(e)
      }
    }
  }
}
</script>

<style scoped>
.admin-page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.users-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid rgba(223, 74, 55, .24); border-radius: var(--r-sm); background: rgba(223, 74, 55, .06); color: var(--coral); font: 400 13px/1.5 var(--font-body); }
.users-error button { flex: none; border: 0; border-radius: var(--r-sm); padding: 8px 12px; background: var(--blue); color: #fff; cursor: pointer; font: 600 12px var(--font-body); }
.verify-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.verify-actions .hint { flex-basis: 100%; }
.top-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
.top-actions .btn { width:auto; white-space:nowrap; }
.top-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.display { font: 800 22px var(--font-display); margin: 0; color: var(--ink); }

.account-tabs { display:flex; gap:8px; border-bottom:1px solid var(--line); overflow-x:auto; }
.account-tab { border:1px solid var(--line); border-bottom:none; background:#fff; color:var(--muted); padding:10px 16px; border-radius:8px 8px 0 0; cursor:pointer; font:600 13px var(--font-body); white-space:nowrap; }
.account-tab span { display:inline-flex; min-width:20px; height:20px; align-items:center; justify-content:center; margin-left:6px; padding:0 5px; border-radius:10px; background:var(--bg); font-size:11px; }
.account-tab.active { color:var(--blue); background:#f7fbff; border-color:var(--blue); }
.account-section { display:flex; flex-direction:column; gap:10px; }
.section-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.section-head h2 { margin:0; font:800 17px var(--font-display); color:var(--ink); }
.section-head p { margin:3px 0 0; font:400 12px var(--font-body); color:var(--muted); }
.section-count { font:600 12px var(--font-body); color:var(--muted); background:var(--bg); padding:6px 10px; border-radius:20px; white-space:nowrap; }
.name-cell { font-weight:600; }
.empty-cell { text-align:center; color:var(--muted); padding:28px 16px; }
.pagination { display:flex; justify-content:center; align-items:center; gap:12px; padding:4px 0 8px; }
.page-btn { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:6px; padding:7px 11px; cursor:pointer; font:600 12px var(--font-body); }
.page-btn:hover:not(:disabled) { border-color:var(--blue); color:var(--blue); background:#f7fbff; }
.page-btn:disabled { opacity:.45; cursor:not-allowed; }
.modal-card--small { max-width: 520px; }
.modal-card--akun { max-width: 552px; padding: 0; }
.akun-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 12px; border-bottom: 1px solid var(--line); }
.akun-x { background: none; border: 0; font-size: 24px; line-height: 1; cursor: pointer; color: var(--muted, #667); }
.akun-body { padding: 16px 24px 8px; }
.akun-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 0 12px; }
.jenis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.jenis-kartu { text-align: left; border: 1px solid var(--line); background: #fff; border-radius: 10px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font: inherit; }
.jenis-kartu.aktif { border-color: #2a35b8; background: #eef0ff; }
.jenis-judul { font-weight: 700; font-size: 14px; }
.jenis-ket { font-size: 12px; color: #667; line-height: 1.3; }
.akun-body .field { margin-bottom: 14px; }
.akun-body .field > label { display: block; font-weight: 700; font-size: 13.5px; margin-bottom: 6px; color: var(--ink); }
.akun-body .optional { font-weight: 400; color: #778; font-size: 12.5px; margin-left: 4px; }
.anak-baru { display: grid; grid-template-columns: 1fr 110px 80px 28px; gap: 6px; margin-bottom: 6px; align-items: center; }
.kontak-cell small, .name-cell small { display: block; color: #778; font-size: 12px; }
.name-cell small.hub { text-transform: capitalize; }
.hasil-anak { margin-top: 8px; font-size: 13px; }
@media (max-width: 520px) { .anak-baru { grid-template-columns: 1fr 1fr; } }
.akun-foot .btn { width: auto; min-width: 96px; padding: 10px 18px; }
@media (max-width: 520px) { .jenis-grid { grid-template-columns: 1fr; } }
.optional { color: var(--muted); font-weight: 400; }
.account-preview { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--bg); }
.preview-role { color:var(--muted); font:500 12px var(--font-body); }

.page-info { font:400 12px var(--font-body); color:var(--muted); min-width:120px; text-align:center; }
@media (max-width: 800px) { .top-bar { align-items:flex-start; flex-direction:column; } .top-actions { width:100%; } .top-actions .btn { flex:1; } .card-table { overflow-x:auto; } table { min-width:850px; } .section-head { align-items:flex-start; } }

.ket { font: 400 13px var(--font-body); color: var(--muted); margin: 4px 0 0; }
.kls-tabs { display: flex; gap: 8px; margin: 10px 0 12px; }
.kls-baris { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.kls-baris .input { flex: 1; }
.impor-aksi { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.impor-aksi .input { flex: 1; }
.impor-ringkas { margin: 10px 0 8px; font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.error-text { color: var(--coral); font-size: 12px; }
.card-table { background: #fff; border-radius: 8px; border: 1px solid var(--line); overflow: hidden; }
table { width: 100%; border-collapse: collapse; text-align: left; font: 13.5px var(--font-body); }
th, td { padding: 14px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { background: var(--bg); font-weight: 600; color: var(--muted); }
.aksi-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 6px 12px; font-size: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; cursor: pointer; color: var(--coral); }
.btn-sm:hover { background: #ffebee; border-color: var(--coral); }
.btn-sm--link { color: var(--blue); }
.btn-sm--link:hover { background: #e3f2fd; border-color: var(--blue); }
.btn-sm--status { color: #6a4b00; }
.btn-sm--status:hover { background: #fff8e1; border-color: #f0c36a; }
.success-box { background: #f1f8e9; border: 1px solid #c5e1a5; border-radius: 8px; padding: 10px 12px; }
.pin-note { margin: 8px 0 0; font-size: 13px; color: var(--ink); }
.pin-note strong { font-size: 18px; letter-spacing: .12em; }
.pin-note span { color: var(--muted); font-size: 11.5px; }

.badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background: var(--bg); color: var(--ink); }
.badge.admin { background: #e3f2fd; color: #1565c0; }
.badge.siswa { background: #e8f5e9; color: #2e7d32; }
.badge.ortu { background: #fff3e0; color: #ef6c00; }
.badge.pic { background: #fce4ec; color: #c2185b; }

.rel-info { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; max-width: 320px; }
.rel-muted { color: var(--muted); font-size: 12px; }
.rel-warn-text { color: #ef6c00; }
.rel-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.rel-chip.ok { background: #e8f5e9; color: #2e7d32; }
.rel-chip.warn { background: #fff3e0; color: #ef6c00; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.modal-card { background: #fff; padding: 24px; border-radius: 10px; width: 100%; max-width: 480px; max-height: calc(100vh - 40px); overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.form { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
.field label { font: 500 12px var(--font-body); color: var(--muted); }
.input { border: 1.5px solid var(--line); border-radius: 6px; padding: 11px; font: 14px var(--font-body); outline: none; width: 100%; box-sizing: border-box; }
.input:focus { border-color: var(--blue); }
.hint { font: 400 11.5px var(--font-body); color: var(--muted); margin: 2px 0 0; }
.error { color: var(--coral); font-size: 12.5px; margin: 0; }
.success { color: #2e7d32; font-size: 12.5px; margin: 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

.subsection { border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.subhead { font: 700 12.5px var(--font-body); color: var(--ink); margin: 0; text-transform: uppercase; letter-spacing: 0.03em; }

.anak-list { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; border: 1.5px solid var(--line); border-radius: 6px; background: #fff; padding: 6px; }
.anak-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border-radius: 5px; font: 13.5px var(--font-body); cursor: pointer; }
.anak-item:hover { background: var(--bg); }
.anak-item input[type="checkbox"] { margin-top: 3px; }
</style>
