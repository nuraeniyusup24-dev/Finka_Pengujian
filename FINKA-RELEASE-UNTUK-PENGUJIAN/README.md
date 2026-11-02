# FINKA

FINKA adalah aplikasi pengelolaan transaksi dan layanan keuangan siswa di lingkungan sekolah. Aplikasi ini menghubungkan siswa, orang tua/wali, petugas kantin (PIC), dan admin melalui satu frontend serta API backend.

> **Status:** Paket ini ditujukan untuk pengujian terkontrol dan belum siap produksi. Build berhasil bukan bukti bahwa semua alur sudah teruji end-to-end. Periksa [fitur dan batasan](./FITUR-DAN-BATASAN.md), [catatan integrasi](./INTEGRASI.md), dan [hasil pemeriksaan](./HASIL-PENGUJIAN.md).

## Fitur utama

- **Siswa:** melihat profil, saldo dan riwayat; menggunakan QR kartu tetap untuk transaksi; membuat PIN pembayaran saat pertama kali masuk; dan memblokir kartu jika hilang.
- **Orang Tua/Wali:** melihat data dan aktivitas anak, mengatur limit belanja, memblokir atau membuka blokir kartu, mereset PIN pembayaran anak, serta membuat PIN konfirmasi untuk pengajuan top-up dan pembayaran tagihan.
- **PIC:** memindai QR siswa dan memproses transaksi kantin/koperasi sesuai outlet.
- **Admin:** mengelola akun, siswa, tagihan, pembayaran dan operasional aplikasi.
- **Pemulihan akun:** alur reset password dan reset PIN menggunakan OTP tersedia pada aplikasi. Pengiriman OTP bergantung pada konfigurasi provider serta kontak yang sudah diverifikasi.

**Catatan:** Kecocokan route frontend/backend telah diperiksa secara statis, tetapi belum membuktikan alur runtime. Provider OTP memerlukan kredensial dan kontak terverifikasi. Lihat [fitur dan batasan](./FITUR-DAN-BATASAN.md) dan [catatan integrasi](./INTEGRASI.md).

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | Nuxt 4, Vue 3, Vuex 4 |
| Backend | Node.js 22.13+, Express |
| Database | SQLite (file lokal, tanpa server database) |
| Autentikasi | JWT |
| QR | QR kartu siswa tetap, dengan validasi di backend |

## Struktur proyek

```text
.
├── backend/                 # API Express, database, dan tes
├── nuxt-app/                # Frontend Nuxt untuk seluruh role
├── PANDUAN-INSTALASI.md     # Langkah setup lokal yang lebih lengkap
├── PANDUAN-PENGUJIAN.md     # Skenario pengujian per role
├── FITUR-DAN-BATASAN.md     # Status rilis dan pekerjaan yang masih tersisa
├── INTEGRASI.md             # Catatan integrasi frontend/backend
└── HASIL-PENGUJIAN.md       # Hasil pemeriksaan paket
```

## Menjalankan secara lokal

Persyaratan backend: Node.js 22.13 atau lebih baru. Untuk frontend Nuxt 4.6.3, gunakan Node.js `^22.22.3 || ^24.15.0 || >=26.0.0`. **Tidak perlu PostgreSQL atau server database lain**; data disimpan di satu file SQLite (`backend/data/finka.db`, dibuat otomatis). Inisialisasi aplikasi membuat schema otomatis. Akun demo hanya dibuat di luar `NODE_ENV=production` dan hanya jika database kosong.

Pengguna dapat masuk menggunakan nama lengkap akun. Username atau NIS yang sudah terdaftar tetap dapat digunakan; jika nama lengkap sama pada beberapa akun, gunakan username atau NIS.

Untuk konfigurasi rahasia dan akun demo, ikuti [PANDUAN-INSTALASI.md](./PANDUAN-INSTALASI.md). Untuk mengulang dari nol, hentikan backend lalu hapus folder `backend/data`.

1. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi konfigurasi lokal yang diperlukan. Jangan commit atau membagikan `.env`.
2. Di terminal pertama:

   ```powershell
   cd .\backend
   npm ci
   npm run dev
   ```

3. Di terminal kedua:

   ```powershell
   cd .\nuxt-app
   npm ci
   $env:API_BASE_URL = 'http://localhost:3001/api'
   npm run dev
   ```

4. Buka `http://localhost:3000`. Backend menyediakan health check di `http://localhost:3001/api/health`.

Lokasi file database dapat diubah dengan `DB_PATH` di `backend/.env`. Untuk menjalankan produksi, atur `NODE_ENV=production`; startup dan perintah seed tidak akan membuat akun demo.

## Pemeriksaan

Jalankan dari direktori proyek:

```powershell
npm --prefix backend test
npm --prefix nuxt-app run build
```

Tes backend mencakup pemulihan PIN/password, kontrak adapter OTP, validasi, dan pencegahan seed demo di production. Build frontend memeriksa kompilasi; keduanya tidak menggantikan pengujian API, deliverability provider OTP, printer, atau alur lintas role secara end-to-end.

## Keamanan dan konfigurasi

- Buat secret JWT, QR, dan OTP yang kuat dan berbeda untuk tiap lingkungan.
- Simpan kredensial provider email/WhatsApp dan koneksi database hanya di environment backend. Jangan masukkan rahasia ke README, source control, atau tangkapan layar.
- Jangan gunakan akun demo di luar database disposable.
- Frontend masih memakai Nuxt 2 dan Vue 2 yang sudah mencapai akhir masa dukungan. Audit dependency produksi terakhir pada 1 November 2026 melaporkan 62 temuan (24 high, 25 moderate, 13 low). Perbaikan kompatibel telah diterapkan, tetapi advisory pada framework lama masih ada; jangan gunakan untuk produksi sebelum migrasi framework dan pengujian ulang.
- Sebelum penggunaan nyata, selesaikan [pekerjaan tersisa](./FITUR-DAN-BATASAN.md), konfigurasi CORS dan provider OTP, serta jalankan tes staging dan prosedur backup/pemulihan.
