# Hasil pemeriksaan paket pengujian

Pembaruan: 1 November 2026. Hasil ini mencatat pemeriksaan kode lokal; bukan sertifikasi produksi.

## Pemeriksaan terakhir

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| Tes backend `npm test` | **26/26 lulus** | Mencakup tes API dengan DB disposable, provisioning admin, dan backup/restore; bukan pengujian deployment staging. |
| Tes CSV frontend `node scripts/csv-test.mjs` | **9/9 lulus** | Tidak memanggil backend. |
| Build frontend `npm run build` | **Lulus** setelah pembaruan dependency | Membuktikan kompilasi/generate, bukan alur UI/API end-to-end. |
| Smoke PDF jsPDF 4.2.1 | **Lulus**; menghasilkan `application/pdf` | Pemeriksaan lokal fungsi dasar, bukan cakupan seluruh konten invoice. |
| Seed pada `NODE_ENV=production` | **Tidak membuat user**; tes regresi menggunakan SQLite in-memory | Tidak menguji deployment sebenarnya. |
| Kecocokan route frontend/backend | **Cocok secara statis** untuk route yang dirangkum di [INTEGRASI.md](./INTEGRASI.md) | Belum membuktikan payload, respons, izin, dan efek transaksi di runtime. |
| Audit dependency produksi terakhir | **62 temuan:** 24 high, 25 moderate, 13 low, 0 critical | Framework Nuxt 2/Vue 2 masih EOL; lakukan audit ulang saat rilis dan migrasikan framework. |
| Pengiriman OTP nyata | **Belum diuji/diaktifkan** | Memerlukan kredensial Resend/Meta dan kontak test terverifikasi. |
| API finansial lokal | **Lulus** | Menguji pembayaran bersamaan, saldo/ledger, reversal pembatalan, akses PIC/siswa; memakai DB sementara, bukan deployment staging. |
| Backup dan restore lokal | **Lulus** | Snapshot dan restore tervalidasi pada file sementara; belum membuktikan retensi, enkripsi, akses storage, atau pemulihan staging. |

## Status keamanan dan operasional

- Backend melewati semua tes otomatis yang tersedia pada pemeriksaan ini. Tes produksi memastikan database in-memory yang kosong tidak mendapat akun demo.
- Seed demo dibuat hanya saat `NODE_ENV` bukan `production` dan database kosong. `npm run admin:provision` menyediakan admin awal secara terbatas untuk database production kosong; prosedur itu belum dijalankan pada deployment nyata.
- Database memakai SQLite; skema dibuat otomatis melalui `initDb()` saat backend mulai.
- Adapter Resend dan WhatsApp Cloud API tersedia, tetapi konfigurasi provider dan kontak terverifikasi diperlukan untuk menguji pengiriman sesungguhnya.
- ZIP rilis sebelumnya tidak menyertakan `.env`, file database, `node_modules`, atau output build. Periksa kembali arsip yang akan didistribusikan; jangan sertakan `.env`.
- Pemeriksaan statis yang melarang `.env` di root backend dapat gagal pada working copy yang memiliki file `.env` lokal. Itu bukan hasil pemeriksaan ZIP; pastikan file rahasia tidak masuk ke paket.

## Belum menjadi bukti rilis

Belum ada hasil staging untuk seluruh transaksi finansial dan role, deliverability OTP, atau pemulihan di lingkungan deployment. Jalankan skenario staging sebelum produksi, lalu ikuti [FITUR-DAN-BATASAN.md](./FITUR-DAN-BATASAN.md) dan [PANDUAN-PENGUJIAN.md](./PANDUAN-PENGUJIAN.md).
