<script setup>
definePageMeta({
  layout: 'phone',
  middleware: ['auth', 'ortu']
})
</script>


<template>
  <div class="halaman-profil">
    <header class="header">
      <button type="button" class="tombol-kembali" @click="$router.push('/ortu')">
        ← Kembali
      </button>
      <h1>Profil Orang Tua</h1>
      <p>Kelola informasi akun dan data kontak kamu.</p>
    </header>

    <section class="kartu-profil">
      <ProfileAvatar :initials="inisial" :size="58" />
      <div>
        <h2>{{ form.nama || 'Nama Orang Tua' }}</h2>
        <p>Informasi akun Orang Tua</p>
      </div>
    </section>

    <form class="form-profil" @submit.prevent="simpan">
      <div class="judul-form">
        <h2>Informasi Pribadi</h2>
        <p>Pastikan data yang kamu masukkan benar.</p>
      </div>

      <label for="nama">Nama lengkap</label>
      <input
        id="nama"
        v-model.trim="form.nama"
        type="text"
        maxlength="100"
        placeholder="Masukkan nama lengkap"
        required
      />

      <label for="hubungan">Hubungan dengan siswa</label>
      <select id="hubungan" v-model="form.hubungan" required>
        <option disabled value="">Pilih hubungan</option>
        <option value="Ayah">Ayah</option>
        <option value="Ibu">Ibu</option>
        <option value="Wali">Wali</option>
      </select>

      <label for="pekerjaan">Pekerjaan</label>
      <select id="pekerjaan" v-model="form.pekerjaan" required>
        <option disabled value="">Pilih pekerjaan</option>
        <option value="PNS/ASN">PNS/ASN</option>
        <option value="Pegawai swasta">Pegawai swasta</option>
        <option value="Wiraswasta">Wiraswasta</option>
        <option value="Guru/tenaga pendidik">Guru/tenaga pendidik</option>
        <option value="TNI/Polri">TNI/Polri</option>
        <option value="Lainnya">Lainnya</option>
      </select>

      <label for="no-hp">Nomor HP</label>
      <input
        id="no-hp"
        v-model.trim="form.no_hp"
        type="tel"
        maxlength="20"
        autocomplete="tel"
        placeholder="08 / +62 / 62"
      />
      <p class="field-hint">10–13 digit. Awalan 08, 62, atau +62 dapat digunakan; spasi dan tanda hubung akan dirapikan.</p>

      <label for="email">Email</label>
      <input
        id="email"
        v-model.trim="form.email"
        type="email"
        placeholder="nama@email.com"
      />

      
<div v-if="pesan" class="pesan" :class="{ gagal: gagal }">
  {{ pesan }}
</div>

<button
  class="tombol-simpan"
  type="submit"
  :disabled="menyimpan || memuat"
>
  {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
</button>

<p class="catatan">
  Username akun tidak dapat diubah melalui halaman ini.
</p>
    </form>

    <p v-if="memuat" class="status">Memuat profil...</p>
  </div>
</template>

<script>
function rapikanHpIndonesia(value) {
  let nomor = String(value || '').replace(/[\s().-]/g, '')
  if (nomor.startsWith('+62')) nomor = '0' + nomor.slice(3)
  else if (nomor.startsWith('62')) nomor = '0' + nomor.slice(2)
  return /^08\d{8,11}$/.test(nomor) ? nomor : null
}

export default {



  data() {
    return {
      memuat: true,
      menyimpan: false,
      gagal: false,
      pesan: '',
      form: {
        nama: '',
        hubungan: '',
        pekerjaan: '',
        no_hp: '',
        email: ''
      }
    }
  },

  computed: {
    inisial() {
      return (this.form.nama || 'OT')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(kata => kata.charAt(0).toUpperCase())
        .join('')
    }
  },

  async mounted() {
    try {
      const hasil = await this.$api.profilOrtu()
      const profil = hasil.profil || {}

      this.form = {
        nama: profil.nama || '',
        hubungan: profil.hubungan || '',
        pekerjaan: profil.pekerjaan || '',
        no_hp: profil.no_hp || '',
        email: profil.email || ''
      }
    } catch (error) {
      this.gagal = true
      this.pesan = error.message || 'Gagal memuat profil.'
    } finally {
      this.memuat = false
    }
  },

  methods: {
    async simpan() {
      this.pesan = ''
      this.gagal = false

      if (!this.form.nama.trim()) {
        this.gagal = true
        this.pesan = 'Nama lengkap wajib diisi.'
        return
      }

      if (!this.form.hubungan || !this.form.pekerjaan) {
        this.gagal = true
        this.pesan = 'Pilih hubungan dan pekerjaan terlebih dahulu.'
        return
      }
      const noHpBersih = this.form.no_hp ? rapikanHpIndonesia(this.form.no_hp) : ''
      if (this.form.no_hp && !noHpBersih) {
        this.gagal = true
        this.pesan = 'Nomor HP harus 10–13 digit dengan awalan 08, 62, atau +62.'
        return
      }
      const emailBersih = this.form.email.trim().toLowerCase()
      if (emailBersih && (emailBersih.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBersih))) {
        this.gagal = true
        this.pesan = 'Format email tidak valid.'
        return
      }

      this.menyimpan = true

      try {
        const hasil = await this.$api.simpanProfilOrtu({
          nama: this.form.nama,
          hubungan: this.form.hubungan,
          pekerjaan: this.form.pekerjaan,
          no_hp: noHpBersih,
          email: emailBersih
        })

        const profil = hasil.profil || {}

        this.form.nama = profil.nama || this.form.nama
        this.form.hubungan = profil.hubungan || this.form.hubungan
        this.form.pekerjaan = profil.pekerjaan || this.form.pekerjaan
        this.form.no_hp = profil.no_hp || ''
        this.form.email = profil.email || ''
        const akun = this.$store.state.auth.user
        if (akun && profil.nama) {
          this.$store.commit('auth/setAuth', { token: this.$store.state.auth.token, user: Object.assign({}, akun, { nama: profil.nama }) })
        }

        this.pesan = hasil.pesan || 'Profil berhasil disimpan.'
      } catch (error) {
        this.gagal = true
        this.pesan = error.message || 'Gagal menyimpan profil.'
      } finally {
        this.menyimpan = false
      }
    }
  }
}
</script>

<style scoped>
.halaman-profil {
  min-height: 100%;
  box-sizing: border-box;
  padding: 24px 20px 32px;
  background: #f5f6fb;
  color: #101344;
}

.header {
  margin-bottom: 22px;
}

.tombol-kembali {
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: #2938c5;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.header h1 {
  margin: 18px 0 6px;
  font-size: 25px;
  font-weight: 800;
}

.header p,
.kartu-profil p,
.judul-form p {
  margin: 0;
  color: #777d95;
  font-size: 14px;
  line-height: 1.6;
}

.kartu-profil {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  margin-bottom: 18px;
  border: 1px solid #e8eaf3;
  border-radius: 18px;
  background: #fff;
}

.kartu-profil h2 {
  margin: 0 0 5px;
  font-size: 18px;
}

.form-profil {
  padding: 22px 18px;
  border: 1px solid #e8eaf3;
  border-radius: 18px;
  background: #fff;
}

.judul-form {
  margin-bottom: 22px;
}

.judul-form h2 {
  margin: 0 0 6px;
  font-size: 19px;
}

.form-profil label {
  display: block;
  margin: 17px 0 8px;
  font-size: 14px;
  font-weight: 700;
}

.field-hint { margin:-3px 0 0; color:#777d95; font-size:12px; line-height:1.4; }

.form-profil input,
.form-profil select {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: 1px solid #dfe2ed;
  border-radius: 11px;
  outline: none;
  background: #fff;
  color: #101344;
  font-size: 14px;
}

.form-profil input:focus,
.form-profil select:focus {
  border-color: #2938c5;
  box-shadow: 0 0 0 3px rgba(41, 56, 197, 0.1);
}

.tombol-simpan {
  width: 100%;
  min-height: 49px;
  margin-top: 22px;
  border: 0;
  border-radius: 12px;
  background: #2938c5;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.tombol-simpan:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pesan {
  margin-top: 18px;
  padding: 12px;
  border-radius: 10px;
  background: #e8f8ee;
  color: #187544;
  font-size: 14px;
  line-height: 1.5;
}

.pesan.gagal {
  background: #fff0ef;
  color: #c63730;
}

.catatan,
.status {
  margin: 15px 0 0;
  color: #777d95;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
</style>
