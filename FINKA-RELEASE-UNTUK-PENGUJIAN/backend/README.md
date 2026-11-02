# Backend FINKA — sumber dipertahankan

Backend Express/SQLite berasal dari `finka-work/backend`. Implementasi autentikasi, otorisasi, ledger, dan transaksi asal dipertahankan. Perubahan integrasi pada proyek final tercatat di [../INTEGRASI.md](../INTEGRASI.md).

## Setup lokal yang aman

Tidak perlu server database. Backend memakai SQLite bawaan Node.js (`node:sqlite`), sehingga data tersimpan di satu file (default `backend/data/finka.db`, dapat diubah lewat `DB_PATH` di `.env`; jangan commit atau bagikan file `.env` maupun file database).

Persyaratan: Node.js 22.13 atau lebih baru (disarankan versi di `.nvmrc`). Tidak ada dependency native yang perlu dikompilasi, jadi kompiler C++ tidak dibutuhkan. Node mungkin menampilkan peringatan `ExperimentalWarning: SQLite`; itu normal dan dapat disembunyikan dengan `node --no-warnings`.

```powershell
Copy-Item .env.example .env # lalu isi JWT_SECRET, QR_SECRET, PIN_OTP_SECRET di .env
npm ci
npm run dev                 # atau: npm start. Schema dibuat otomatis
```

Di luar production, database kosong akan diisi akun demo saat startup. `NODE_ENV=production` menonaktifkan seed demo pada startup maupun skrip seed. `npm run db:init` (alias `db:setup`) menyiapkan schema tanpa menjalankan server; akun demo hanya dibuat jika mode bukan production dan database kosong.

Untuk membuat nilai acak `JWT_SECRET` / `QR_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Seluruh tabel (termasuk kontrol siswa, pemulihan PIN/password, dan notifikasi admin) dibuat oleh `initDb()` saat server atau `db:init` dijalankan; operasinya idempoten.

Provisioning admin awal tersedia melalui `npm run admin:provision`. Jalankan dari folder `backend` dengan `NODE_ENV=production` dan `DB_PATH` production yang benar setelah membuat schema. Perintah hanya menerima database yang benar-benar kosong, meminta password secara tersembunyi di terminal, dan hanya dapat membuat admin satu kali. Jangan salin akun demo ke production atau memakai kredensial pengujian di lingkungan nyata.

## Backup dan pemulihan SQLite

Hentikan backend untuk melakukan latihan pemulihan dan pergantian file. Backup online menggunakan snapshot konsisten SQLite (`VACUUM INTO`), sehingga tidak menyalin file WAL secara manual. Gunakan path baru agar file lama tidak tertimpa:

```powershell
$env:DB_PATH = '.\data\finka.db'
npm run db:backup -- .\backups\finka-2026-11-01.db
npm run db:restore -- .\backups\finka-2026-11-01.db .\data\finka-restore-test.db
```

Kedua perintah memeriksa integritas dan foreign key. Restore selalu membuat file baru dan menolak database aktif atau tujuan yang sudah ada. Sesudah hasil restore diverifikasi, hentikan backend dan lakukan cutover secara eksplisit dengan mengubah `DB_PATH`. Simpan backup terenkripsi dengan akses terbatas dan kebijakan retensi; latihan lokal tidak menggantikan pemulihan staging.

Health endpoint: `GET /api/health` pada port default `3001`.

## PIN pembayaran

Siswa dan Orang Tua yang belum memiliki PIN diarahkan membuat PIN 6 digit saat pertama kali masuk melalui `POST /api/auth/me/pin`. PIN siswa dipakai untuk transaksi POS dan pembayaran tagihan dari saldo; PIN Orang Tua wajib dikirim dan diverifikasi server pada setiap pengajuan top-up atau pembayaran tagihan. Akun siswa lama yang sudah memiliki PIN tetap dapat mengubahnya setelah memasukkan PIN lama melalui `POST /api/siswa/saya/ganti-pin`.

## Foto profil

Semua role yang sudah login dapat menyimpan foto profil sendiri melalui `POST /api/auth/me/avatar`. Foto JPG, PNG, atau WEBP diperiksa format dan ukurannya oleh server; ukuran maksimum setelah diproses adalah 1 MB. `GET /api/auth/me` mengembalikan foto akun sebagai data URL untuk ditampilkan pada profil. Data foto disimpan per akun di database SQLite.

Reset PIN Orang Tua menggunakan `GET /api/ortu/anak/:id/pin-reset/options`, lalu `POST .../request`, `POST .../verify`, dan `POST .../complete`. Pemulihan password semua role tersedia melalui `POST /api/auth/password-reset/request`, `/verify`, dan `/complete`. OTP dikirim lewat Resend (email) atau WhatsApp Cloud API. Isi kredensial provider di environment backend sesuai `.env.example` dan set `PIN_OTP_SECRET` dengan minimal 32 karakter acak. Schema dibuat oleh `initDb()` saat startup; tidak ada perintah `db:migrate-pin-recovery` pada paket ini. OTP hanya dapat dikirim ke kontak yang diverifikasi admin; siswa memakai kontak orang tua/wali terverifikasi. Jangan log kode OTP atau kredensial provider.

Schema pemulihan PIN menambah status verifikasi kontak, challenge dan rate limit OTP, serta `admin_notifications`. Status kontak baru/null dan kontak lama **tidak otomatis dianggap terverifikasi**. Admin dapat mencatat verifikasi melalui `POST /api/admin/users/:id/verifikasi-kontak` setelah pemeriksaan identitas sesuai prosedur resmi sekolah; perubahan nomor/email menghapus status verifikasinya. Cara/proof verifikasi operasional masih perlu disahkan sekolah.

Notifikasi reset tersedia pada `GET /api/admin/notifikasi` dan halaman Audit Admin setelah migrasi. Daftar diperbarui saat halaman dibuka/refresh; tidak real-time. Audit dan notifikasi ditulis dalam transaksi yang sama dengan reset, dan tidak menyertakan PIN, OTP, password, atau hash.

Tes pemulihan PIN dan password memakai sender palsu khusus proses tes dan tidak mengirim OTP sungguhan. `npm test` juga mencakup alur API ke database disposable, provisioning admin, dan latihan backup/restore; semua itu bukan pengganti tes staging maupun integrasi provider.

## Tes

Jangan jalankan `npm run smoke-test` terhadap database lama: skrip membuat user, top-up, transaksi ledger, pembayaran tagihan, dan menonaktifkan user. Skrip integrasi di `nuxt-app/scripts/integration-test.mjs` juga menulis transaksi dan memiliki asumsi password Orang Tua yang berbeda dari data demo saat ini. Lihat [../HASIL-PENGUJIAN.md](../HASIL-PENGUJIAN.md) sebelum menjalankan tes apa pun.
