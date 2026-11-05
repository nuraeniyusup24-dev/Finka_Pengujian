# Hasil pemeriksaan paket pengujian

Pembaruan: 5 November 2026. Hasil ini mencatat pemeriksaan kode lokal; bukan sertifikasi produksi.

## Pemeriksaan terakhir

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| Tes backend `npm test` | **28/28 lulus** pada 5 November 2026 | Mencakup API dengan DB disposable, impor siswa/PIC, provisioning admin, pemulihan OTP tiruan, transaksi, konfigurasi rekening fail-closed, dan backup/restore; bukan pengujian deployment staging. |
| Tes CSV frontend `npm run test:csv` | **13/13 lulus** pada 5 November 2026 | Menguji pemetaan XLSX/CSV PIC dan siswa; tidak memanggil backend. |
| Build frontend `npm run build` dan smoke output production | **Lulus** pada 5 November 2026 dengan Nuxt 4.6.4; output merespons HTTP 200 | Bukan alur UI/API end-to-end. Node lokal `24.14.1` masih di luar engines frontend; ulangi pada versi yang didukung sebelum rilis. |
| Pemeriksaan statis backend `npm run test:static` | **Lulus**, 47 file JavaScript | File `.env` lokal yang diabaikan Git tidak dianggap sebagai file paket; file rahasia terlacak/tidak diabaikan tetap ditolak. |
| Smoke PDF jsPDF 4.2.1 | **Lulus**; menghasilkan `application/pdf` | Pemeriksaan lokal fungsi dasar, bukan cakupan seluruh konten invoice. |
| Seed pada `NODE_ENV=production` | **Tidak membuat user**; tes regresi menggunakan SQLite in-memory | Tidak menguji deployment sebenarnya. |
| Kecocokan route frontend/backend | **Cocok secara statis** untuk route yang dirangkum di [INTEGRASI.md](./INTEGRASI.md) | Belum membuktikan payload, respons, izin, dan efek transaksi di runtime. |
| Audit dependency runtime `npm audit --omit=dev` | **Frontend: 0 temuan**; **backend: 0 temuan** | Nuxt 4.6.4 kini dideklarasikan sebagai dev dependency (alat build); build output diuji terpisah. |
| Audit seluruh dependency frontend `npm audit` | **12 temuan** pada rantai build Nuxt (6 moderate, 6 low) | `npm audit fix` aman dan pembaruan Nuxt patch tidak menyelesaikan seluruhnya. Perbaikan otomatis yang tersisa menawarkan downgrade ke Nuxt 4.1.3; tidak dipaksakan karena bisa merusak kompatibilitas. Tinjau advisory tooling sebelum mempercayai pipeline build. |
| Pengiriman OTP nyata | **Belum diuji/diaktifkan** | Menunggu operator mengatur kredensial Resend/Meta dan kontak test terverifikasi secara privat. |
| API finansial lokal | **Lulus** | Menguji pembayaran bersamaan, saldo/ledger, reversal pembatalan, akses PIC/siswa; memakai DB sementara, bukan deployment staging. |
| Backup dan restore lokal | **Lulus** | Snapshot dan restore tervalidasi pada file sementara; belum membuktikan retensi, enkripsi, akses storage, atau pemulihan staging. |
| Tampilan role mobile | **Lulus pemeriksaan browser lokal** pada 390 × 844 px untuk Orang Tua, PIC, dan Siswa; tab bar Orang Tua tetap di bawah saat konten digulir | Menggunakan build lokal dan database disposable; belum menguji perangkat fisik, browser lain, atau semua halaman/resolusi. |

## Status keamanan dan operasional

- Backend melewati semua tes otomatis yang tersedia pada pemeriksaan ini. Tes produksi memastikan database in-memory yang kosong tidak mendapat akun demo.
- Tiga secret development lokal telah dirotasi pada 5 November 2026; nilainya tidak ditampilkan atau ditambahkan ke Git. Rotasi ini tidak mengatur secret deployment lain.
- Endpoint konfigurasi rekening tidak lagi memakai rekening contoh. Jika salah satu variabel rekening kosong, API mengembalikan `rekening: null` dan alur pengajuan top-up pada UI tidak dapat dilanjutkan.
- Nuxt adalah dev dependency agar instalasi runtime tidak membawa toolchain build. Salinan output production yang diinstal bersih dengan `npm ci --omit=dev` di folder sementara berhasil start dan merespons HTTP 200; instalasi ini mengaudit 0 vulnerability runtime.
- Seed demo dibuat hanya saat `NODE_ENV` bukan `production` dan database kosong. `npm run admin:provision` menyediakan admin awal secara terbatas untuk database production kosong; prosedur itu belum dijalankan pada deployment nyata.
- Database memakai SQLite; skema dibuat otomatis melalui `initDb()` saat backend mulai.
- Akun orang tua baru dari impor Excel kini diwajibkan mengganti password sementara dan membuat PIN setelahnya; tes regresi backend untuk urutan ini lulus.
- Adapter Resend dan WhatsApp Cloud API tersedia, tetapi konfigurasi provider dan kontak terverifikasi diperlukan untuk menguji pengiriman sesungguhnya.
- Node lokal saat pemeriksaan adalah `v24.14.1`, di bawah rentang frontend yang didukung (`^22.22.3 || ^24.15.0 || >=26.0.0`); build lokal sukses, tetapi harus diulang setelah memasang versi yang didukung.
- ZIP rilis sebelumnya tidak menyertakan `.env`, file database, `node_modules`, atau output build. Periksa kembali arsip yang akan didistribusikan; jangan sertakan `.env`.
- Pemeriksaan statis mengizinkan `.env` lokal hanya jika diabaikan Git dan tidak terlacak; verifikasi ulang isi ZIP/deployment agar tidak membawa file rahasia.

## Belum menjadi bukti rilis

Belum ada hasil staging untuk seluruh transaksi finansial dan role, deliverability OTP, atau pemulihan di lingkungan deployment. Jalankan skenario staging sebelum produksi, lalu ikuti [FITUR-DAN-BATASAN.md](./FITUR-DAN-BATASAN.md) dan [PANDUAN-PENGUJIAN.md](./PANDUAN-PENGUJIAN.md).
