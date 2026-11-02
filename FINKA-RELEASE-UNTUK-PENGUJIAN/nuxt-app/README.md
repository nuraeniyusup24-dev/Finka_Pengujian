# Frontend FINKA terpadu

Frontend Nuxt 4/Vue 3 dengan compatibility mode Vue untuk mempertahankan perilaku UI selama migrasi bertahap. Halaman Admin, PIC, Siswa, dan Orang Tua tetap memakai navigasi dan desain yang ada. Daftar route dan status API terbaru tersedia di [../INTEGRASI.md](../INTEGRASI.md).

## Menjalankan

Jalankan backend lebih dulu (`npm run dev` di folder `backend`; database SQLite dibuat otomatis). Dari folder ini:

```powershell
npm ci
$env:API_BASE_URL = 'http://localhost:3001/api'
npm run dev
```

Buka `http://localhost:3000`. Build: `npm run build`; jalankan hasil production dengan `npm start` atau `npm run preview`. `API_BASE_URL` default-nya `http://localhost:3001/api`; `.env` frontend tidak diperlukan untuk default lokal. Deployment dapat mengatur `NUXT_PUBLIC_API_BASE_URL` sebagai runtime environment variable.

Frontend menggunakan Node.js `^22.22.3 || ^24.15.0 || >=26.0.0`, sesuai persyaratan Nuxt 4.6.3. Compatibility mode sementara mempertahankan filter template dan API Options yang lama; migration warning harus ditinjau sebelum mode kompatibilitas dihapus.

Build hanya membuktikan kompilasi dan generate route. Integrasi API perlu pengujian terpisah setelah backend dihubungkan ke database test yang benar.

## PIN pembayaran

Siswa dan Orang Tua membuat PIN 6 digit sendiri saat pertama kali masuk. PIN siswa digunakan untuk transaksi kantin/koperasi; PIN Orang Tua digunakan untuk mengonfirmasi pengajuan isi saldo dan pembayaran tagihan. Siswa dapat mengganti PIN dengan PIN lama melalui halaman PIN. Reset PIN siswa oleh Orang Tua menggunakan OTP dan memerlukan adapter Resend atau WhatsApp Cloud API yang dikonfigurasi, `PIN_OTP_SECRET` (minimal 32 karakter acak), schema database terbaru yang dibuat oleh backend, serta kontak yang sudah diverifikasi. Lihat [panduan instalasi](../PANDUAN-INSTALASI.md).
