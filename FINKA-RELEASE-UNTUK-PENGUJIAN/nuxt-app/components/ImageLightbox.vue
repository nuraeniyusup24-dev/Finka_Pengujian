<template>
  <div v-if="src" class="viewer" role="dialog" aria-modal="true" :aria-label="alt || 'Pratinjau gambar'" @click.self="$emit('close')" @keydown.esc.stop.prevent="$emit('close')">
    <header class="viewer__head">
      <span class="viewer__name">{{ name || alt || 'Gambar' }}</span>
      <button type="button" class="viewer__close" aria-label="Tutup gambar" @click="$emit('close')">×</button>
    </header>
    <div class="viewer__body" @click="$emit('close')">
      <img :src="src" :alt="alt || 'Gambar diperbesar'" @click.stop="toggleZoom" :class="zoomed ? 'viewer__image--zoom' : ''" />
    </div>
    <div class="viewer__hint">Klik gambar untuk {{ zoomed ? 'memperkecil' : 'memperbesar' }} · Tekan Esc untuk menutup</div>
  </div>
</template>

<script>
export default {
  name: 'ImageLightbox',
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  data() {
    return { zoomed: false, overflowSebelumnya: '' }
  },
  mounted() {
    this.overflowSebelumnya = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', this.tanganiTombol)
  },
  beforeDestroy() {
    document.body.style.overflow = this.overflowSebelumnya
    document.removeEventListener('keydown', this.tanganiTombol)
  },
  methods: {
    toggleZoom() { this.zoomed = !this.zoomed },
    tanganiTombol(event) {
      if (event.key === 'Escape') this.$emit('close')
    }
  }
}
</script>

<style scoped>
.viewer { position: fixed; inset: 0; z-index: 2000; display: flex; flex-direction: column; background: rgba(0, 0, 0, .94); color: #fff; }
.viewer__head { min-height: 58px; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: rgba(0, 0, 0, .35); }
.viewer__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 14px var(--font-body); }
.viewer__close { width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .12); color: #fff; cursor: pointer; font: 400 30px/1 var(--font-body); }
.viewer__close:hover { background: rgba(255, 255, 255, .22); }
.viewer__body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 18px; }
.viewer__body img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in; transition: transform .18s ease; }
.viewer__body img.viewer__image--zoom { max-width: none; max-height: none; cursor: zoom-out; transform: scale(1.6); }
.viewer__hint { padding: 10px 16px 18px; color: rgba(255, 255, 255, .72); text-align: center; font: 400 12px var(--font-body); }
</style>
