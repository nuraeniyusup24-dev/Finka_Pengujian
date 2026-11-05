# Panduan instalasi di Windows

## 1. Siapkan perangkat

Pasang Node.js `^22.22.3`, `^24.15.0`, atau `>=26.0.0` agar satu versi kompatibel dengan frontend Nuxt 4.6.4 dan backend. Periksa versi di PowerShell dengan `node --version`; versi di luar rentang tersebut belum didukung meskipun sebagian perintah mungkin berjalan. **PostgreSQL tidak diperlukan**: backend memakai SQLite yang sudah ada di dalam Node.js.

Pastikan PowerShell berada di folder proyek yang berisi folder `backend` dan `nuxt-app`. Jika hasil ekstrak memiliki folder pembungkus seperti `FINKA-RELEASE-UNTUK-PENGUJIAN`, masuk ke folder itu terlebih dahulu:

```powershell
Set-Location .\FINKA-RELEASE-UNTUK-PENGUJIAN
Test-Path .\nuxt-app\package.json
```

Perintah terakhir harus menampilkan `True`. Jalankan langkah selanjutnya dari folder proyek tersebut, bukan dari folder `Downloads` atau folder pembungkus di luarnya.

## 2. Atur backend

Di PowerShell:

```powershell
cd .\backend
Copy-Item .env.example .env
notepad .env
```

Isi `JWT_SECRET`, `QR_SECRET`, dan `PIN_OTP_SECRET` dengan nilai acak panjang yang berbeda-beda. Jangan kirim isi `.env` melalui chat atau laporan. `DB_PATH` boleh dibiarkan (default `./data/finka.db`; folder dan file dibuat otomatis). Backend sudah memiliki adapter pengiriman OTP untuk Resend dan WhatsApp Cloud API; pilih dan konfigurasi setidaknya satu provider untuk mengaktifkan pemulihan akun. `NODE_ENV=production` menonaktifkan pembuatan akun demo.

Instal dependency:

```powershell
npm ci
```

Tidak ada langkah migrasi manual. Saat backend dijalankan, schema dibuat otomatis. Di luar production, database kosong akan diisi akun demo, profil siswa, tagihan, dan produk. Di production, demo tidak dibuat; siapkan akun admin awal melalui prosedur provisioning yang disetujui sebelum membuka layanan. Untuk mengulang database pengujian dari nol, hentikan backend lalu hapus folder `backend\data`.

## 3. Jalankan backend

Masih di folder `backend`:

```powershell
npm run dev
```

Health check: buka `http://localhost:3001/api/health`; hasil normal `{"ok":true}`. Biarkan terminal ini berjalan. Jangan menjalankan `npm run smoke-test` atau skrip penghapusan pada data yang ingin dipertahankan (smoke test menambah data uji).

Jika PowerShell menampilkan prompt lanjutan `>>` alih-alih prompt biasa, tekan `Ctrl+C` satu kali untuk membatalkan masukan sebelumnya, lalu jalankan perintah berikutnya setelah prompt normal muncul.

Jika `npm ci` menampilkan `EPERM` saat menghapus file di `nuxt-app\node_modules` lalu `nuxt is not recognized`, instalasi dependency terhenti karena Windows tidak dapat mengganti file yang sedang dipakai (biasanya karena server Nuxt lama masih berjalan). Tekan `Ctrl+C` di terminal frontend yang sedang menjalankan Nuxt. Setelah server berhenti, kembali ke folder proyek dan ulangi:

```powershell
Set-Location .\nuxt-app
npm ci
npm run dev
```

Peringatan `EBADENGINE` bukan penyebab `EPERM`; perbarui Node.js ke versi yang didukung sebelum penggunaan jangka panjang.

## 4. Jalankan frontend

Buka terminal PowerShell kedua pada folder paket:

```powershell
cd .\nuxt-app
npm ci
$env:API_BASE_URL = 'http://localhost:3001/api'
npm run dev
```

Buka `http://localhost:3000`. `API_BASE_URL` harus menunjuk backend paket yang baru dijalankan. Jika backend memakai port lain, gunakan port yang sama pada nilai tersebut.

## Akun demo

`ensureDemoData()` hanya berjalan di luar `NODE_ENV=production`, dan membuat akun hanya bila database kosong. Kredensial pengujian di bawah tidak boleh digunakan di production. Database yang sudah berisi pengguna tidak ditimpa.

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Orang Tua | `ortu.sari` | `ortu123` |
| PIC Kantin Utama | `pic.kantin.utama` | `pic123` |
| PIC Kantin Blok B | `pic.kantin.b` | `pic123` |
| PIC Koperasi | `pic.koperasi` | `pic123` |
| Siswa | `aditya.p` atau `kayla.p` | `siswa123` |

PIN demo siswa pada kode adalah `135790`. Ganti password/PIN pada lingkungan pengujian sesuai kebijakan tim. Jangan gunakan akun demo di lingkungan nyata.

## Mengaktifkan pengiriman OTP

Provider OTP di bawah memakai konfigurasi backend dari `backend/.env`. Tidak perlu memasang paket tambahan. Isi kredensial hanya di `.env` lokal atau secret manager deployment—jangan masukkan kredensial ke frontend, source control, tangkapan layar, atau chat. `PIN_OTP_SECRET` wajib berupa secret acak minimal 32 karakter dan berbeda dari secret lain. Secret ini dipakai untuk pemulihan password sekaligus PIN.

### Email melalui Resend (opsi yang disarankan untuk mulai)

1. Siapkan akun Resend dan verifikasi domain/alamat pengirim yang akan digunakan.
2. Buat API key di Resend.
3. Isi di `backend/.env`:

   ```dotenv
   RESEND_API_KEY=re_ganti_dengan_api_key
   OTP_FROM_EMAIL=Finka <otp@domain-yang-sudah-diverifikasi.example>
   ```

4. Pastikan email akun Orang Tua yang dipakai untuk reset sudah diverifikasi oleh Admin. Email yang hanya tersimpan di profil tetapi belum diverifikasi tidak dapat menerima OTP.
5. Simpan `.env`, lalu hentikan dan mulai ulang backend agar konfigurasi terbaca.

### WhatsApp Cloud API (opsional)

Konfigurasikan `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, dan `WHATSAPP_OTP_TEMPLATE` di `backend/.env`. Template harus sudah disetujui di Meta dan cocok dengan payload adapter: isi body memiliki dua parameter teks berurutan, kode OTP lalu lama berlaku dalam menit. Bahasa default `id`; sesuaikan `WHATSAPP_OTP_TEMPLATE_LANGUAGE` dengan bahasa template. `WHATSAPP_GRAPH_API_VERSION` dapat dibiarkan pada nilai contoh atau diatur ke versi Graph API yang masih didukung akun Meta.

Nomor WhatsApp Orang Tua harus berformat Indonesia yang didukung aplikasi dan sudah diverifikasi oleh Admin. Simpan `.env`, lalu mulai ulang backend.

### Uji pengiriman

Gunakan akun test dengan email/nomor milik tim dan kontak yang statusnya sudah diverifikasi. Di aplikasi, buka alur lupa password atau (sebagai Orang Tua) reset PIN siswa, minta satu OTP, lalu pastikan pesan diterima dan verifikasi kode berhasil. Jangan mencatat atau membagikan OTP. Jika permintaan gagal, periksa konfigurasi provider dan status pengirim/template pada dashboard provider; respons aplikasi memang tidak mengungkap kredensial atau kode OTP.

Tanpa kredensial provider lengkap, secret OTP yang valid, dan kontak terverifikasi, fitur tetap gagal tertutup dan tidak mengubah password/PIN. Adapter memiliki batas waktu request 10 detik. PIN reset tetap memerlukan database/schema yang sudah terinisialisasi.
