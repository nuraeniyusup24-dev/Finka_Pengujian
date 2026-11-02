<template>
  <div class="avatar-control">
    <button
      class="avatar"
      :style="{ width: size + 'px', height: size + 'px' }"
      type="button"
      :disabled="mengunggah"
      :aria-label="mengunggah ? 'Mengunggah foto profil' : 'Ubah foto profil'"
      @click="$refs.file.click()"
    >
      <img v-if="user.avatar" :src="user.avatar" alt="" />
      <span v-else>{{ initials }}</span>
      <span class="avatar__overlay">{{ mengunggah ? '…' : 'Ubah' }}</span>
    </button>
    <input
      ref="file"
      class="avatar__input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      @change="pilihFoto"
    />
    <span class="avatar__label">Ubah foto</span>
    <p v-if="error" class="avatar__feedback avatar__feedback--error" role="alert">{{ error }}</p>
    <p v-else-if="success" class="avatar__feedback" role="status">{{ success }}</p>
  </div>
</template>

<script>
import { api } from '~/utils/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_AVATAR_SIZE = 1024 * 1024

export default {
  name: 'ProfileAvatar',
  props: {
    initials: { type: String, default: '' },
    size: { type: Number, default: 48 }
  },
  data() {
    return { mengunggah: false, error: '', success: '' }
  },
  computed: {
    user() { return this.$store.state.auth.user || {} }
  },
  methods: {
    async pilihFoto(event) {
      const file = event.target.files && event.target.files[0]
      event.target.value = ''
      this.error = ''
      this.success = ''
      if (!file) return
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.error = 'Pilih foto berformat JPG, PNG, atau WEBP.'
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        this.error = 'Ukuran foto maksimal 10 MB.'
        return
      }

      this.mengunggah = true
      try {
        const foto = await this.kecilkanFoto(file)
        const dataUrl = await this.bacaDataUrl(foto)
        const result = await api.uploadAvatar(dataUrl, 'image/jpeg', foto.size)
        const user = Object.assign({}, this.user, { avatar: result.avatar })
        this.$store.commit('auth/setAuth', { token: this.$store.state.auth.token, user })
        this.success = 'Foto profil berhasil diperbarui.'
      } catch (error) {
        this.error = error.message || 'Foto profil tidak dapat disimpan.'
      } finally {
        this.mengunggah = false
      }
    },
    bacaDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Foto tidak dapat dibaca.'))
        reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'))
        reader.readAsDataURL(file)
      })
    },
    async kecilkanFoto(file) {
      const source = await this.bacaDataUrl(file)
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('File yang dipilih bukan gambar yang valid.'))
        img.src = source
      })
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Foto tidak dapat diproses di perangkat ini.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
      if (!blob) throw new Error('Foto tidak dapat diproses di perangkat ini.')
      if (blob.size > MAX_AVATAR_SIZE) throw new Error('Foto terlalu besar setelah diproses. Pilih foto lain.')
      return blob
    }
  }
}
</script>

<style scoped>
.avatar-control { display: flex; flex: none; flex-direction: column; align-items: center; gap: 4px; }
.avatar { position: relative; display: flex; align-items: center; justify-content: center; flex: none; overflow: hidden; padding: 0; border: 0; border-radius: 50%; background: var(--blue-soft); color: var(--blue); font: 700 14px var(--font-display); cursor: pointer; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar__overlay { position: absolute; right: 0; bottom: 0; left: 0; padding: 3px 0; background: rgba(10, 13, 59, .65); color: #fff; font: 500 9px/1.2 var(--font-body); }
.avatar:disabled { cursor: wait; }
.avatar:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.avatar__input { display: none; }
.avatar__label { color: var(--blue); font: 500 9px var(--font-body); }
.avatar__feedback { max-width: 140px; margin: 2px 0 0; color: var(--green); font: 400 10px/1.4 var(--font-body); text-align: center; }
.avatar__feedback--error { color: var(--coral); }
</style>
