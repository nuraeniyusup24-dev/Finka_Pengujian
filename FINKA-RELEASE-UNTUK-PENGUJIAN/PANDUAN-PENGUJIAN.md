# Panduan pengujian

Lakukan semua tes yang menulis data hanya pada database SQLite disposable yang baru melalui `DB_PATH`. Jangan gunakan database lama. Baca [fitur dan batasan](./FITUR-DAN-BATASAN.md) dan [catatan integrasi](./INTEGRASI.md) sebelum menjalankan skrip smoke/integrasi.

## Urutan pemeriksaan aman

1. Jalankan tes backend dari `backend`: `npm test`. Tes memakai database/file sementara dan mencakup kontrak OTP tiruan, proteksi seed, provisioning admin, backup/restore, akses role, pembayaran bersamaan, dan pembatalan. Tidak ada OTP nyata yang dikirim; database pengguna tidak disentuh.
2. Jalankan tes CSV murni dari `nuxt-app`: `node scripts/csv-test.mjs`.
3. Jalankan frontend `npm run build` dari `nuxt-app`; build hanya memeriksa kompilasi/generate route.
4. Schema SQLite dibuat otomatis oleh `initDb()` saat backend mulai; tidak ada migrasi manual terpisah pada paket ini. Gunakan `NODE_ENV=development` dan `DB_PATH` yang menunjuk file disposable khusus.
5. Ulangi alur finansial/API dan alur antarmuka pada staging terisolasi dengan akun serta database uji. Untuk provider OTP nyata, gunakan kredensial sandbox dan kontak milik tim yang sudah diverifikasi; tes provider unit tidak membuktikan deliverability.
6. Latih backup dan pemulihan pada staging. Contoh perintah ada di [README backend](./backend/README.md); jangan arahkan restore ke database aktif.

## Skenario per role

| Role | Skenario | Hasil yang diharapkan |
|---|---|---|
| Admin | Login, buka dashboard, daftar akun, audit/notifikasi | Menu Admin terbuka; endpoint baca menampilkan data. Buat/ubah akun hanya pada DB disposable. |
| Admin/Siswa/Orang Tua | Impor Excel berisi data santri dan `password_ortu` untuk akun wali baru; login menggunakan nama/NIS/username dan password masing-masing | Password awal minimal 8 karakter; anak yang berbagi wali memakai password_ortu yang sama; akun wali yang sudah ada dapat ditautkan tanpa mengubah password-nya; password tidak muncul dalam respons pratinjau; siswa dan wali baru wajib mengganti password sementara masing-masing saat login pertama, lalu membuat PIN sebelum memakai fitur finansial. PIN siswa digunakan untuk pembayaran kantin/koperasi dan PIN wali untuk konfirmasi isi saldo/tagihan. |
| Admin | Baca verifikasi kontak | Kontak hanya ditandai terverifikasi setelah pemeriksaan identitas sesuai prosedur sekolah. Jangan menandai data contoh sebagai kontak nyata. |
| PIC | Login, daftar produk outlet, scan QR siswa | Produk sesuai outlet; QR aktif dapat dikenali dan QR kedaluwarsa/terpakai/dirotasi ditolak. |
| PIC | Pembelian dan tarik tunai | Uji hanya dengan akun, saldo, produk, dan data yang boleh berubah di DB disposable; periksa saldo dan ledger setelah transaksi. |
| Siswa | Login, lihat saldo/riwayat, tampilkan QR | Data sesuai akun; QR dinamis tersedia dan tidak menjadi QR statis. |
| Siswa | Ganti PIN dengan PIN lama | PIN lama yang benar dapat mengganti PIN; PIN lama yang salah ditolak. Hanya pada akun test. |
| Orang Tua | Login, lihat anak/saldo, profil, riwayat, tagihan | Data hanya untuk relasi akun tersebut; perubahan profil terbatas pada akun test. |
| Orang Tua | Atur limit/blokir dan rotasi QR anak | Backend menyimpan kontrol; transaksi/QR yang diblokir atau memakai versi lama ditolak. Operasi ini menyentuh database test. |
| Orang Tua | Buka “Lupa PIN belanja anak?” | Dengan provider belum dikonfigurasi, permintaan harus gagal tertutup. Dengan provider sandbox, OTP hanya dikirim ke kontak terverifikasi dan reset baru berhasil setelah verifikasi. |

## Catat hasil dan error

Untuk setiap skenario, catat: tanggal/jam, commit atau nama paket, role yang dipakai, langkah, hasil yang diharapkan, hasil aktual, status HTTP bila ada, dan tangkapan layar yang sudah disamarkan. Jangan catat password, token, OTP, PIN, URL database lengkap, atau isi `.env`. Catat error tanpa header `Authorization` atau body sensitif.

Laporkan tes statis, build, API, dan end-to-end secara terpisah. Build sukses hanya berarti frontend berhasil dikompilasi.
