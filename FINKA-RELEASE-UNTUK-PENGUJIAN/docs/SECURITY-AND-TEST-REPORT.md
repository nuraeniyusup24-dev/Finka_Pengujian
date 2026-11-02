> **Catatan:** laporan ini ditulis saat backend masih memakai PostgreSQL. Backend kini memakai SQLite (`node:sqlite`); rujukan ke PostgreSQL, Docker, `docker-compose.test.yml`, dan row lock di bawah bersifat historis.

# FINKA — laporan hardening dan verifikasi

> **Laporan historis (26 Oktober 2026):** bagian di bawah mendokumentasikan pemeriksaan ketika konfigurasi dan database masih berbeda. Backend paket saat ini menggunakan SQLite, bukan PostgreSQL. Gunakan [HASIL-PENGUJIAN.md](../HASIL-PENGUJIAN.md) untuk status verifikasi terkini; jangan menyalin langkah PostgreSQL lama sebagai prosedur rilis saat ini.

Tanggal pemeriksaan: 2026-10-26

## Perubahan yang diterapkan

1. Menghapus `backend/.env` dari paket distribusi. Nilai aslinya tidak dicetak ke laporan.
2. Mengganti `backend/.env.example` dengan placeholder aman.
3. Mengubah CORS dari `cors()` terbuka menjadi daftar origin eksplisit lewat `CORS_ORIGINS` (dipisah koma). Default lokal hanya `http://localhost:3000`.
4. Menambahkan `backend/src/routes/admin/billing.js` dan mendaftarkannya di router admin:
   - `GET /api/admin/tagihan`: daftar tagihan, filter status/kelas/bulan/siswa, limit dan cursor sederhana; admin-only.
   - `PUT /api/admin/tagihan/:id`: mengubah nama, nominal dan tenggat hanya jika tagihan belum lunas; validasi input, row lock PostgreSQL, transaksi dan audit log.
5. Menambahkan `backend/docker-compose.test.yml` untuk PostgreSQL disposable lokal pada port 55432 dengan data di tmpfs. File ini disiapkan untuk dijalankan di mesin yang memiliki Docker; belum dijalankan di lingkungan pemeriksaan ini.
6. Memperbaiki pembayaran tagihan agar mengunci baris tagihan (`FOR UPDATE`) sebelum memeriksa status dan menulis ledger, mencegah dua pembayaran bersamaan mendebit tagihan yang sama.
7. Memperbaiki validasi tanggal dan ID siswa untuk penerbitan tagihan massal; sebelumnya pola tanggal salah sehingga tanggal valid ditolak. Validasi tanggal digunakan juga saat edit tagihan.
8. Menambahkan endpoint admin `POST /api/admin/kelas/naik` (pratinjau + penerapan atomik) dan `POST /api/admin/kelas/arsip` (pratinjau saldo/tagihan + penonaktifan siswa dan orang tua yang tidak lagi memiliki anak aktif).
9. Menambahkan tes unit untuk validasi tanggal kalender dan integer positif.

**Penting:** menghapus `.env` dari ZIP tidak mencabut atau merotasi kredensial yang mungkin pernah dibagikan. Rotasi kredensial database, JWT, QR, PIN/OTP dan kredensial layanan eksternal perlu dilakukan di sistem sumber/deployment, lalu semua layanan terkait dimulai ulang.

## Verifikasi pada sesi ini

- `npm run test:static`: **lulus**. Memeriksa sintaks 36 file JavaScript di `backend/src`, `backend/test`, dan `backend/scripts`, serta memastikan `.env`, `.env.local`, dan `.env.production` tidak ada di root backend.
- `node --test test/validation.test.js`: **3/3 lulus** (validasi tanggal kalender dan integer positif).
- Tes CSV frontend: **9/9 lulus** pada pemeriksaan ini.
- `node --check` untuk file JavaScript backend: **lulus**.
- Tes unit: **tidak berhasil dimulai pada pengulangan terakhir**. Node gagal mengimpor `bcryptjs` karena instalasi dependensi lokal tidak lengkap (entrypoint paket tidak ada). Ini bukan kegagalan assertion tes dan bukan hasil lulus. Catatan 13/13 dari pengujian terdahulu belum dapat direproduksi pada sesi ini.
- Build frontend sebelumnya: **perintah build berhasil** pada pemeriksaan sebelumnya; build belum diulang pada sesi ini.
- PostgreSQL/API/E2E: **belum dijalankan**. Docker, `psql`, dan server PostgreSQL tidak tersedia di lingkungan ini. Jangan menganggap alur transaksi/role sudah lulus.
- `npm audit --offline` mengembalikan nol advisori, tetapi hasil offline tidak memuat data advisori terbaru dan **tidak boleh dianggap audit keamanan yang valid**. Audit online masih perlu dijalankan di mesin/CI dengan akses registry npm.

## Matriks E2E wajib sebelum rilis

| Role | Alur yang harus diuji | Kriteria lulus utama |
|---|---|---|
| Admin | login, verifikasi top-up, kelola tagihan, laporan, tutup kas | hanya admin dapat mengakses route admin; setiap perubahan tercatat di audit log |
| PIC/kasir | login, lihat saldo/kas, scan QR, pembayaran, tutup kas, pembatalan | transaksi dan reversal atomik; saldo/ledger tidak ganda; kas fisik direkonsiliasi |
| Orang tua | login, lihat anak/saldo/tagihan, ajukan top-up, unggah bukti, bayar tagihan, riwayat | tidak dapat mengakses data keluarga lain; status pembayaran konsisten dengan ledger |
| Siswa | login, lihat saldo/riwayat, transaksi dengan PIN, kontrol belanja | batas belanja/PIN berlaku di server; saldo tidak negatif; QR tidak memberi akses lintas siswa |

Gunakan akun dummy dan database disposable. Tambahkan tes negatif untuk token hilang/kedaluwarsa, role salah, nominal tidak valid, request duplikat, saldo tidak cukup, dan dua transaksi bersamaan.

## Catatan status endpoint historis (v3; superseded oleh bagian v5/v6 di bawah)

Daftar berikut adalah status pada versi laporan terdahulu dan tidak mencerminkan status paket terbaru. Endpoint kas dan pembatalan kemudian ditambahkan; tetap verifikasi integrasi pada staging:

- `GET /api/pos/kas`
- `PUT /api/pos/kas`
- `POST /api/pos/transaksi/:id/batal`
- `GET /api/pos/tutup-kas`
- `POST /api/pos/tutup-kas`
- `GET /api/admin/tutup-kas`
- `POST /api/admin/tagihan/:id/batal`

Lihat bagian pembaruan v5/v6 di bawah untuk status implementasi terkini. Semua endpoint finansial tetap memerlukan tes integrasi sebelum produksi.

## Menjalankan PostgreSQL test lokal

Dari folder `backend` pada mesin dengan Docker Compose:

```sh
docker compose -f docker-compose.test.yml up -d --wait
```

Set `DATABASE_URL=postgresql://finka_test:finka_test_local_only@127.0.0.1:55432/finka_test`, `JWT_SECRET` dan `QR_SECRET` khusus tes di terminal. Setelah target database diverifikasi, jalankan `npm ci`, `npm run db:setup`, lalu `npm test`. Backend perlu di-start dengan environment tersebut untuk smoke/API tests. Jangan menggunakan URL ini untuk production.

## Syarat sebelum rilis

1. Rotasi semua secret/kredensial yang pernah ikut dibagikan.
2. Jalankan PostgreSQL disposable dan pengujian integrasi pada mesin dengan Docker/registry npm.
3. Definisikan schema dan aturan bisnis untuk kas, tutup kas, pembatalan transaksi, dan pembatalan tagihan.
4. Jalankan E2E per role (admin, PIC, orang tua, siswa), termasuk pemeriksaan saldo/ledger tidak ganda.
5. Jalankan `npm audit` online atau scanner SCA setara pada pipeline CI dan perbaiki temuan.
6. Set `CORS_ORIGINS` ke origin frontend produksi yang tepat sebelum deployment.


## Perbaikan endpoint kas dan pembatalan (v5)

Endpoint berikut sudah ditambahkan pada kode: `GET/PUT /api/pos/kas`, `GET/POST /api/pos/tutup-kas`, `GET /api/admin/tutup-kas`, `POST /api/pos/transaksi/:id/batal`, dan `POST /api/admin/tagihan/:id/batal`.

- Pengaturan kas awal hanya dapat diubah sebelum transaksi pertama pada tanggal lokal Jakarta dan sebelum kas ditutup. Penutupan memerlukan kas awal yang sudah disimpan.
- Tutup kas menyimpan snapshot satu kali per PIC per tanggal, termasuk kas awal, pembelian digital, penarikan tunai, kas fisik, dan selisih. Karena pembelian siswa dibayar dari saldo digital, estimasi kas fisik dihitung sebagai kas awal dikurangi penarikan tunai; pembelian ditampilkan sebagai informasi, bukan uang tunai masuk.
- Pembatalan POS mengunci transaksi, memverifikasi PIC pemilik, membuat entri pembalikan positif pada ledger, menandai metadata transaksi dibatalkan, dan menolak pembatalan ganda. Transaksi pada tanggal yang sudah ditutup tidak dapat dibatalkan.
- Pembatalan tagihan memakai status terminal `dibatalkan`. Jika tagihan dibayar dari saldo, dibuat entri pembalikan ledger dalam transaksi yang sama. Tagihan yang lunas melalui transfer ditolak untuk pembatalan otomatis karena pengembalian uang transfer harus diselesaikan manual terlebih dahulu. Pembayaran/top-up tertaut ke tagihan yang dibatalkan juga ditolak.
- `initDb()` memperluas constraint status tagihan dan mengisi metadata transaksi POS lama dari ledger untuk mendukung laporan/pembatalan setelah upgrade. Tetap buat backup database sebelum deploy migrasi.

### Verifikasi v4 lanjutan

- `node backend/scripts/static-check.js`: lulus (cek sintaks JS dan tidak ada `.env` root).
- `node --test backend/test/validation.test.js`: 3/3 lulus.
- `npm ci --ignore-scripts --no-audit --no-fund` timeout pada lingkungan ini; dependency penuh tidak terpasang, sehingga tes yang membutuhkan `bcryptjs`/Express tidak dapat dijalankan.
- Belum dilakukan tes integrasi terhadap PostgreSQL yang sebenarnya. Endpoint baru membutuhkan verifikasi staging untuk lock/rollback, hak akses tiap role, tutup kas, dan pembalikan ledger sebelum produksi.

## Pembaruan pemeriksaan pendaftaran, POS, dan tampilan audit (v6, 2026-10-27)

Perubahan kode lanjutan pada versi ini:

- Form admin untuk membuat akun orang tua/PIC sekarang dapat meminta server membuat username unik dan password awal acak bila form tidak mengirim kredensial. Password awal hanya dikirim pada respons pembuatan akun, tidak pernah disimpan sebagai teks biasa. Password yang diberikan langsung harus 8–72 byte agar tidak terkena pemotongan bcrypt.
- Pembuatan akun dan profil/relasi terkait dijalankan dalam transaksi database agar kegagalan saat menyimpan profil atau anak membatalkan seluruh pembuatan akun.
- Form orang tua yang menambahkan siswa baru sekaligus kini memproses hingga 10 siswa baru dalam transaksi yang sama, memvalidasi nama/kelas/NIS, menolak NIS ganda, membuat password acak untuk tiap siswa, dan mengembalikan kredensial satu kali ke UI.
- Pembaruan relasi orang tua-anak memakai transaksi tunggal; helper relasi tidak lagi membuka transaksi database bersarang.
- Transaksi POS memvalidasi ID siswa/produk, format PIN, ukuran keranjang, kuantitas 1–100, dan overflow nominal. Baris siswa aktif dikunci sebelum saldo dibaca; PIN dicek ulang di dalam transaksi setelah baris terkunci.
- Ditambahkan rate limit percobaan PIN berbasis PostgreSQL: lima kegagalan per pasangan PIC/siswa dalam jendela 15 menit mengunci percobaan selama 15 menit. Tabel dibuat oleh `initDb()` saat backend start.
- Halaman audit log dihapus dari UI admin, referensi navigasi/API kliennya dihapus, dan endpoint baca/ekspor audit admin tidak lagi disediakan. Pencatatan audit internal di backend dan tabel `audit_log` tetap aktif untuk investigasi dan rekonsiliasi.

### Hasil verifikasi v6

- `npm run test:static`: **lulus**, 37 file JavaScript backend lolos `node --check` dan tidak ada `.env` root.
- `node --test test/validation.test.js`: **3/3 lulus**.
- `npm test`: **belum lulus penuh** di lingkungan ini. Dua test suite pemulihan tidak dapat mulai karena paket `bcryptjs` tidak terpasang pada working copy; tiga tes validasi tetap lulus. Ini bukan bukti bahwa seluruh backend lulus.
- Tes API dengan PostgreSQL, tes konkurensi pembayaran, dan tes UI end-to-end belum dijalankan. Karena itu, jangan menyebut sistem siap produksi sebelum tes staging selesai.

### Checklist staging yang masih wajib

1. Jalankan `npm ci` dari registry npm, lalu `npm test`.
2. Jalankan database disposable/staging dan tes pendaftaran akun orang tua, pendaftaran siswa tunggal, pembuatan orang tua + siswa sekaligus, NIS duplikat, dan rollback jika profil gagal.
3. Uji dua transaksi POS bersamaan pada saldo yang sama; saldo tidak boleh negatif dan ledger tidak boleh mendebit lebih dari total saldo yang tersedia.
4. Uji lima PIN salah, respons `429` selama lockout, PIN benar setelah masa lockout, serta rotasi PIN saat transaksi berlangsung.
5. Uji role PIC tidak bisa membaca atau menulis data admin; orang tua tidak bisa mengakses siswa keluarga lain.
6. Pastikan audit tetap ditulis di backend meskipun halaman audit tidak tersedia di dashboard.
