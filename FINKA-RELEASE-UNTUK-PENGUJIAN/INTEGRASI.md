# Catatan integrasi teknis

Frontend utama berbasis pekerjaan FINKA Siswa/Orang Tua; halaman Admin/PIC berasal dari frontend kedua. Backend Express dipertahankan (database kini SQLite, bukan PostgreSQL) dari proyek backend rekan. Berkas dalam paket adalah salinan rilis; paket ini tidak membawa folder sumber lain.

## Komponen dan konfigurasi

- Frontend: Nuxt 4/Vue 3 di `nuxt-app`; `API_BASE_URL` digunakan untuk development/build lokal, sedangkan deployment dapat mengatur `NUXT_PUBLIC_API_BASE_URL` saat runtime.
- Backend: Express/SQLite (`node:sqlite`) di `backend`; port default `3001`, file database di `DB_PATH` (default `backend/data/finka.db`).
- API client frontend mengirim token melalui header `Authorization: Bearer ...` dan mengubah respons error menjadi pesan/status HTTP.
- `backend/src/server.js` mendaftarkan route auth, siswa, top-up, tagihan, POS, Orang Tua, Admin, dan laporan. Health check: `GET /api/health`.

## Route penting yang cocok secara statis

| Fitur | Frontend | Backend |
|---|---|---|
| Kontrol Siswa | `GET /siswa/saya/kontrol` | `GET /api/siswa/saya/kontrol` |
| Ganti PIN Siswa | `POST /siswa/saya/ganti-pin` dengan PIN lama dan baru | `POST /api/siswa/saya/ganti-pin` |
| Baca/simpan kontrol anak | `GET/PUT /ortu/anak/:id/kontrol` | `GET/PUT /api/ortu/anak/:id/kontrol` |
| Blokir dan limit harian | Payload PUT kontrol anak | Backend membaca/menyimpan `siswa_kontrol`; enforcement transaksi dilakukan di server |
| Rotasi QR | `POST /ortu/anak/:id/qr-kartu/rotasi` | `POST /api/ortu/anak/:id/qr-kartu/rotasi` |
| Pemulihan PIN | GET options; POST request, verify, complete | Route dengan method/path sama pada `/api/ortu/anak/:id/pin-reset/...` |
| Pembuatan PIN pertama kali | `POST /auth/me/pin` setelah login untuk siswa/Orang Tua tanpa PIN | `POST /api/auth/me/pin`; PIN disimpan sebagai hash |
| Foto profil akun | `GET /auth/me` memuat foto; `POST /auth/me/avatar` menyimpan foto akun aktif | Endpoint terautentikasi untuk semua role; JPG/PNG/WEBP, maksimal 1 MB setelah diproses |
| Konfirmasi isi saldo/tagihan | `POST /topup` mengirim PIN konfirmasi Orang Tua | `POST /api/topup` memverifikasi PIN sebelum membuat permintaan |
| Pembayaran tagihan dari saldo | `POST /tagihan/:id/bayar` untuk siswa/Orang Tua mengirim PIN | `POST /api/tagihan/:id/bayar` memverifikasi PIN sebelum mengurangi saldo |

Route sensitif menerapkan autentikasi/role. Route Orang Tua memvalidasi relasi wali-anak. Adapter Resend dan WhatsApp Cloud API tersedia di backend; OTP baru dapat dikirim setelah kredensial provider, `PIN_OTP_SECRET`, dan kontak terverifikasi dikonfigurasi. Lihat [PANDUAN-INSTALASI.md](./PANDUAN-INSTALASI.md).

## Kecocokan route frontend/backend

Pemeriksaan statis terhadap `nuxt-app/plugins/api.js` dan router backend menemukan route berikut tersedia:

| Fitur | Frontend | Backend |
|---|---|---|
| Riwayat dan kas PIC | `GET /pos/riwayat-hari-ini`, `GET/PUT /pos/kas` | `GET /api/pos/riwayat-hari-ini`, `GET/PUT /api/pos/kas` |
| Tutup kas PIC/Admin | `GET/POST /pos/tutup-kas`, `GET /admin/tutup-kas` | `GET/POST /api/pos/tutup-kas`, `GET /api/admin/tutup-kas` |
| Pembatalan transaksi POS | `POST /pos/transaksi/:id/batal` | `POST /api/pos/transaksi/:id/batal` |
| Bukti transfer top-up | `GET/POST /topup/:id/proof` | `GET/POST /api/topup/:id/proof` |
| Konfigurasi pembayaran | `GET /config/pembayaran` | `GET /api/config/pembayaran` |
| Kelola tagihan | `GET/PUT /admin/tagihan`, `POST /admin/tagihan/:id/batal` | `GET/PUT /api/admin/tagihan`, `POST /api/admin/tagihan/:id/batal` |
| Promosi/arsip kelas | `POST /admin/kelas/naik`, `POST /admin/kelas/arsip` | `POST /api/admin/kelas/naik`, `POST /api/admin/kelas/arsip` |

Kecocokan route ini hanya hasil pemeriksaan statis, bukan bukti bahwa setiap halaman, payload, hak akses, dan efek transaksi sudah lulus tes runtime. Lakukan tes API dan UI pada database staging disposable sebelum rilis.

## Batas teknis dan keamanan

- `initDb()` membuat tabel/index yang belum ada dan menjalankan normalisasi nilai `produk.outlet` setiap startup.
- Startup tidak membuat akun demo saat `NODE_ENV=production`. Di mode selain production, akun demo hanya dibuat jika database kosong.
- Seluruh schema dibuat otomatis oleh `initDb()` saat backend dimulai; tidak ada lagi migrasi terpisah.
- Skrip smoke dan integration test menulis akun/transaksi/tagihan/ledger. Jalankan hanya setelah database disposable terverifikasi.
- Detail operasional, skenario tes, pekerjaan tersisa, dan status hasil ada pada `PANDUAN-INSTALASI.md`, `PANDUAN-PENGUJIAN.md`, `FITUR-DAN-BATASAN.md`, dan `HASIL-PENGUJIAN.md`.
