# Fitur dan batasan rilis

## Status

Paket ini untuk pengujian terkontrol, belum untuk produksi. Pemeriksaan kompilasi dan unit test tidak menggantikan tes staging untuk transaksi finansial, akses antar-role, pemulihan, atau pemulihan data.

## Fitur yang ada

- Satu frontend Nuxt untuk role Admin, PIC, Siswa, dan Orang Tua.
- Backend Express dengan penyimpanan SQLite lokal.
- Pendaftaran dan verifikasi kontak melalui alur admin; provider OTP Resend dan WhatsApp Cloud API tersedia setelah kredensial serta kontak terverifikasi disiapkan.
- POS, top-up, pembayaran tagihan, laporan, pembatalan transaksi/tagihan, serta administrasi kas dan kelas.
- Startup menginisialisasi schema. Seed demo berjalan hanya di luar `NODE_ENV=production`; database yang sudah berisi akun tidak ditimpa.

Kecocokan URL frontend/backend telah diperiksa secara statis di [INTEGRASI.md](./INTEGRASI.md). Pemeriksaan statis bukan bukti fungsi route di runtime.

## Batasan dan risiko yang belum selesai

1. **Uji API lokal belum menggantikan staging.** Tes otomatis memakai database disposable dan kini mencakup pembayaran bersamaan, saldo/ledger, pembatalan, serta sebagian batas role. Ulangi skenario ini di staging dengan konfigurasi deployment yang menyerupai produksi, lalu perluas ke transaksi POS/top-up dan semua role.
2. **Pengiriman OTP nyata belum dikonfigurasi.** Kredensial Resend/Meta dan kontak test yang terverifikasi harus disediakan oleh operator. Tes adapter menggunakan provider tiruan dan tidak menguji deliverability.
3. **Dependency runtime bersih, tetapi toolchain build masih memiliki advisory.** Frontend memakai Nuxt 4.6.4 dan Vue 3.5.44 dengan `@vue/compat`; Nuxt dipindahkan ke dev dependencies karena hanya dipakai untuk build/dev. Pada 5 November 2026, `npm audit --omit=dev` menemukan 0 temuan untuk frontend runtime dan backend. Audit penuh frontend masih melaporkan 12 temuan di rantai Nuxt/build (6 moderate, 6 low). `npm audit fix` aman dan pembaruan patch tidak menyelesaikan advisory tersebut; solusi otomatis tersisa menawarkan downgrade ke Nuxt 4.1.3, yang tidak diterapkan tanpa penilaian kompatibilitas. Amankan pipeline build dan tinjau advisory tooling sebelum rilis.
4. **Provisioning admin tersedia, tetapi belum diuji pada deployment nyata.** `npm run admin:provision` hanya berjalan dalam production, meminta password tersembunyi, dan menolak database yang tidak kosong. Uji prosedur di staging terlebih dahulu. Jangan salin database demo ke production.
5. **Backup/restore tersedia dan diuji lokal, tetapi belum menjadi latihan operasional.** `npm run db:backup` membuat snapshot SQLite konsisten; `npm run db:restore` memulihkan ke file baru dan memeriksa integritas. Tentukan retensi, enkripsi, akses terbatas, lokasi di luar host, RPO/RTO, serta lakukan latihan pemulihan staging.
6. **Rekening top-up harus dikonfigurasi oleh Admin.** Isi rekening resmi di menu Pengaturan; pembayaran tetap gagal tertutup hingga semua detail tersedia. Nilai dapat disediakan melalui menu tersebut atau variabel `PAYMENT_BANK_NAME`, `PAYMENT_BANK_ACCOUNT`, dan `PAYMENT_ACCOUNT_HOLDER`. Data yang disimpan dari aplikasi berada di database SQLite dan harus tercakup dalam backup.
7. **Hardening deployment masih diperlukan.** Gunakan HTTPS, secret unik per lingkungan, `CORS_ORIGINS` yang dibatasi ke origin resmi, kredensial provider di secret manager, dan pemantauan/log tanpa OTP, PIN, token, atau data rekening. Secret development lokal sudah dirotasi, tetapi secret deployment tetap tanggung jawab operator.

## Urutan sebelum rilis produksi

1. Siapkan lingkungan staging dan file database disposable yang terpisah dari data pengguna.
2. Jalankan `npm test` di `backend`, tes CSV, build frontend, lalu skenario API/UI pada [PANDUAN-PENGUJIAN.md](./PANDUAN-PENGUJIAN.md).
3. Jalankan `npm test`, lalu uji transaksi POS/top-up, konkurensi, saldo/ledger, idempotensi pembatalan, seluruh role, dan latihan backup/restore pada staging.
4. Konfigurasikan provider OTP sandbox dan uji pengiriman ke kontak milik tim yang sudah diverifikasi.
5. Atur detail rekening resmi secara privat dan pastikan alur transfer serta verifikasi cocok pada staging.
6. Perbarui Node ke versi yang didukung frontend (`^22.22.3`, `^24.15.0`, atau `>=26.0.0`), lalu ulangi build dan tes.
7. Latih `npm run admin:provision` pada database staging kosong, tinjau konfigurasi deployment, selesaikan advisory dependency tanpa downgrade tak teruji, lalu ulangi seluruh pengujian.

Lihat [hasil pemeriksaan](./HASIL-PENGUJIAN.md) untuk pengujian terakhir yang benar-benar dijalankan.
