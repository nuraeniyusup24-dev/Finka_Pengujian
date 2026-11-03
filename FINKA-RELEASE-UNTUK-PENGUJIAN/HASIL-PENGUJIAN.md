# Hasil pemeriksaan paket pengujian

Pembaruan: 3 November 2026. Hasil ini mencatat pemeriksaan kode lokal; bukan sertifikasi produksi.

## Pemeriksaan terakhir

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| Tes backend `npm test` | **27/27 lulus** pada 3 November 2026 | Mencakup tes API dengan DB disposable, impor siswa/wali, provisioning admin, pemulihan OTP tiruan, transaksi, dan backup/restore; bukan pengujian deployment staging. |
| Tes CSV frontend `node scripts/csv-test.mjs` | **11/11 lulus** pada 3 November 2026 | Tidak memanggil backend. |
| Build frontend `npm run build` | **Lulus** pada 3 November 2026 | Membuktikan kompilasi/generate, bukan alur UI/API end-to-end. Versi Node lokal yang diuji `24.14.1` berada di luar engines frontend; ulangi pada versi yang didukung sebelum rilis. |
| Smoke PDF jsPDF 4.2.1 | **Lulus**; menghasilkan `application/pdf` | Pemeriksaan lokal fungsi dasar, bukan cakupan seluruh konten invoice. |
| Seed pada `NODE_ENV=production` | **Tidak membuat user**; tes regresi menggunakan SQLite in-memory | Tidak menguji deployment sebenarnya. |
| Kecocokan route frontend/backend | **Cocok secara statis** untuk route yang dirangkum di [INTEGRASI.md](./INTEGRASI.md) | Belum membuktikan payload, respons, izin, dan efek transaksi di runtime. |
| Audit dependency produksi `npm audit --omit=dev` | **Frontend: 14 temuan** (12 moderate, 2 low); **backend: 0 temuan** setelah `npm audit fix` pada 3 November 2026 | Audit bukan review exploitability. Tinjau dependency transitive frontend; perbaikan otomatis yang ditawarkan memerlukan `--force` dan dapat menurunkan versi Nuxt. Frontend menggunakan Nuxt 4/Vue 3 compatibility mode, bukan Nuxt 2/Vue 2. |
| Pengiriman OTP nyata | **Belum diuji/diaktifkan** | Memerlukan kredensial Resend/Meta dan kontak test terverifikasi. |
| API finansial lokal | **Lulus** | Menguji pembayaran bersamaan, saldo/ledger, reversal pembatalan, akses PIC/siswa; memakai DB sementara, bukan deployment staging. |
| Backup dan restore lokal | **Lulus** | Snapshot dan restore tervalidasi pada file sementara; belum membuktikan retensi, enkripsi, akses storage, atau pemulihan staging. |
| Tampilan role mobile | **Lulus pemeriksaan browser lokal** pada 390 × 844 px untuk Orang Tua, PIC, dan Siswa; tab bar Orang Tua tetap di bawah saat konten digulir | Menggunakan build lokal dan database disposable; belum menguji perangkat fisik, browser lain, atau semua halaman/resolusi. |

## Status keamanan dan operasional

- Backend melewati semua tes otomatis yang tersedia pada pemeriksaan ini. Tes produksi memastikan database in-memory yang kosong tidak mendapat akun demo.
- Seed demo dibuat hanya saat `NODE_ENV` bukan `production` dan database kosong. `npm run admin:provision` menyediakan admin awal secara terbatas untuk database production kosong; prosedur itu belum dijalankan pada deployment nyata.
- Database memakai SQLite; skema dibuat otomatis melalui `initDb()` saat backend mulai.
- Akun orang tua baru dari impor Excel kini diwajibkan mengganti password sementara dan membuat PIN setelahnya; tes regresi backend untuk urutan ini lulus.
- Adapter Resend dan WhatsApp Cloud API tersedia, tetapi konfigurasi provider dan kontak terverifikasi diperlukan untuk menguji pengiriman sesungguhnya.
- Node lokal saat pemeriksaan adalah `v24.14.1`, di bawah rentang frontend yang didukung (`^22.22.3 || ^24.15.0 || >=26.0.0`); build lokal sukses, tetapi harus diulang setelah memasang versi yang didukung.
- ZIP rilis sebelumnya tidak menyertakan `.env`, file database, `node_modules`, atau output build. Periksa kembali arsip yang akan didistribusikan; jangan sertakan `.env`.
- Pemeriksaan statis yang melarang `.env` di root backend dapat gagal pada working copy yang memiliki file `.env` lokal. Itu bukan hasil pemeriksaan ZIP; pastikan file rahasia tidak masuk ke paket.

## Belum menjadi bukti rilis

Belum ada hasil staging untuk seluruh transaksi finansial dan role, deliverability OTP, atau pemulihan di lingkungan deployment. Jalankan skenario staging sebelum produksi, lalu ikuti [FITUR-DAN-BATASAN.md](./FITUR-DAN-BATASAN.md) dan [PANDUAN-PENGUJIAN.md](./PANDUAN-PENGUJIAN.md).
