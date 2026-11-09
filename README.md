# FINKA

FINKA adalah aplikasi pengelolaan transaksi dan layanan keuangan siswa di lingkungan sekolah. Aplikasi ini menghubungkan siswa, orang tua/wali, petugas kantin (PIC), dan admin melalui satu frontend dan API backend.

> **Status proyek:** Untuk pengujian terkontrol; belum siap digunakan di lingkungan produksi. Build dan tes otomatis tidak menggantikan pengujian staging untuk seluruh transaksi, hak akses, pengiriman OTP, dan pemulihan data. Baca [fitur dan batasan](./FITUR-DAN-BATASAN.md) sebelum mencoba atau mengembangkan aplikasi.

## Fitur

- **Siswa:** melihat profil, saldo, riwayat, serta struk digital transaksi/top-up yang sudah diverifikasi; melakukan transaksi dengan QR; mengatur PIN; dan memblokir kartu.
- **Orang tua/wali:** melihat aktivitas anak, struk dan bukti transfer beserta status verifikasi, mengatur limit belanja, memblokir kartu, mengajukan isi saldo, membayar tagihan, serta mengelola PIN anak.
- **PIC:** memindai QR siswa, memproses transaksi kantin atau koperasi sesuai outlet, dan membuka struk digital dari riwayat transaksi.
- **Admin:** mengelola akun, siswa, tagihan, pembayaran, dan operasional aplikasi.
- **Layanan pendukung:** invoice, laporan, bukti transfer, dan pemulihan akun dengan OTP. Pengiriman OTP memerlukan konfigurasi provider serta kontak terverifikasi.

## Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | Nuxt 4, Vue 3, Vuex 4 |
| Backend | Node.js, Express |
| Database | SQLite melalui `node:sqlite` |
| Autentikasi | JWT |

Database disimpan sebagai file lokal (`backend/data/finka.db` secara default). PostgreSQL atau server database terpisah tidak diperlukan.

## Persyaratan

- Node.js `^22.22.3`, `^24.15.0`, atau `>=26.0.0` agar sesuai dengan versi Nuxt yang digunakan.
- npm.

## Menjalankan secara lokal

Perintah berikut menggunakan PowerShell dan dijalankan dari folder utama proyek.

### 1. Siapkan konfigurasi backend

```powershell
Copy-Item .\backend\.env.example .\backend\.env
notepad .\backend\.env
```

Isi `JWT_SECRET`, `QR_SECRET`, dan `PIN_OTP_SECRET` dengan secret acak yang kuat dan berbeda. Jangan bagikan atau commit file `.env`. Untuk menjalankan fitur pemulihan akun, konfigurasi provider OTP dan kontak terverifikasi sesuai [panduan instalasi](./PANDUAN-INSTALASI.md).

### 2. Instal dependency

Di terminal pertama:

```powershell
Set-Location .\backend
npm ci
npm run dev
```

Backend berjalan di `http://localhost:3001`; health check tersedia di `http://localhost:3001/api/health`. Schema database dibuat otomatis saat backend dimulai. Di luar mode production, data demo hanya dibuat jika database masih kosong.

### 3. Jalankan frontend

Buka terminal PowerShell kedua di folder utama proyek:

```powershell
Set-Location .\nuxt-app
npm ci
$env:API_BASE_URL = 'http://localhost:3001/api'
npm run dev
```

Buka `http://localhost:3000`. Biarkan kedua terminal tetap berjalan selama menggunakan aplikasi.

## Pengujian dan build

Jalankan perintah dari folder utama proyek:

```powershell
npm --prefix backend test
node .\nuxt-app\scripts\csv-test.mjs
npm --prefix nuxt-app run build
```

Tes dan build lokal bukan pengujian end-to-end atau sertifikasi keamanan. Sebelum deployment, ikuti [panduan pengujian](./PANDUAN-PENGUJIAN.md) dan jalankan skenario pada lingkungan staging dengan database terpisah.

## Struktur proyek

```text
.
├── backend/                 # API Express, SQLite, dan tes backend
├── nuxt-app/                # Frontend Nuxt
├── PANDUAN-INSTALASI.md     # Setup lokal dan konfigurasi OTP
├── PANDUAN-PENGUJIAN.md     # Skenario pengujian
├── FITUR-DAN-BATASAN.md     # Status, batasan, dan prasyarat rilis
├── INTEGRASI.md             # Catatan integrasi frontend/backend
└── HASIL-PENGUJIAN.md       # Catatan hasil pemeriksaan
```

## Keamanan

- Gunakan secret dan database yang berbeda untuk development, staging, dan production.
- Jangan commit `.env`, kredensial, file database lokal, token, PIN, atau OTP.
- Jangan gunakan akun demo atau database pengujian untuk data nyata.
- Untuk deployment, siapkan HTTPS, batasi `CORS_ORIGINS`, simpan kredensial provider di secret manager, dan uji backup/restore.
- Tinjau [batasan rilis](./FITUR-DAN-BATASAN.md) dan hasil pemeriksaan terbaru sebelum menggunakan aplikasi di luar pengujian.
