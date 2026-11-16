<template>
  <div v-if="open" class="cm-overlay" role="presentation" @click.self="batal">
    <section class="cm" role="alertdialog" aria-modal="true" :aria-labelledby="uid + '-judul'" :aria-describedby="uid + '-pesan'">
      <div class="cm__ikon" :class="'cm__ikon--' + tone" aria-hidden="true">
        <svg v-if="tone === 'danger'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      <h2 :id="uid + '-judul'" class="cm__judul display">{{ title }}</h2>
      <p :id="uid + '-pesan'" class="cm__pesan">{{ message }}</p>
      <div class="cm__aksi">
        <button ref="tombolBatal" type="button" class="cm__btn cm__btn--batal" :disabled="loading" @click="batal">{{ cancelLabel }}</button>
        <button type="button" class="cm__btn" :class="'cm__btn--' + tone" :disabled="loading" @click="$emit('confirm')">{{ loading ? 'Memproses…' : confirmLabel }}</button>
      </div>
    </section>
  </div>
</template>

<script>
// Pop-up konfirmasi bawaan aplikasi (pengganti window.confirm). Tampilan mengikuti pop-up struk digital.
let urut = 0

export default {
  name: 'ConfirmModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    confirmLabel: { type: String, default: 'Ya' },
    cancelLabel: { type: String, default: 'Batal' },
    // 'danger' = tindakan memblokir (merah), 'primary' = tindakan biasa (biru)
    tone: { type: String, default: 'primary' },
    loading: { type: Boolean, default: false }
  },
  emits: ['confirm', 'cancel'],
  data() {
    urut += 1
    return { uid: 'cm' + urut }
  },
  watch: {
    open(buka) {
      if (buka) this.saatBuka()
      else document.removeEventListener('keydown', this.saatTombol)
    }
  },
  mounted() {
    if (this.open) this.saatBuka()
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.saatTombol)
  },
  methods: {
    saatBuka() {
      document.addEventListener('keydown', this.saatTombol)
      // Fokus awal di "Batal" supaya Enter/Spasi yang tidak sengaja tidak langsung mengonfirmasi
      this.$nextTick(() => { if (this.$refs.tombolBatal) this.$refs.tombolBatal.focus() })
    },
    batal() {
      if (this.loading) return
      this.$emit('cancel')
    },
    saatTombol(e) {
      if (e.key === 'Escape') { e.preventDefault(); this.batal(); return }
      if (e.key !== 'Tab') return
      // Fokus tetap berputar di dalam pop-up
      const tombol = Array.from(this.$el.querySelectorAll('button:not([disabled])'))
      if (!tombol.length) { e.preventDefault(); return }
      const awal = tombol[0]
      const akhir = tombol[tombol.length - 1]
      if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus() }
      else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus() }
    }
  }
}
</script>

<style scoped>
.cm-overlay { position: fixed; inset: 0; z-index: 1600; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(10,13,35,.58); }
.cm { box-sizing: border-box; width: min(100%, 340px); padding: 22px 20px 18px; border-radius: 20px; background: #fff; box-shadow: 0 20px 60px rgba(10,13,35,.24); text-align: center; display: flex; flex-direction: column; align-items: center; }
.cm__ikon { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.cm__ikon--danger { background: rgba(223,74,55,.1); color: var(--coral); }
.cm__ikon--primary { background: var(--blue-soft); color: var(--blue); }
.cm__judul { margin: 0; color: var(--ink); font-size: 16px; }
.cm__pesan { margin: 8px 0 0; color: var(--muted); font: 400 12.5px/1.55 var(--font-body); text-wrap: pretty; }
.cm__aksi { display: flex; gap: 10px; width: 100%; margin-top: 18px; }
.cm__btn { flex: 1; min-height: 42px; padding: 0 12px; border-radius: var(--r-pill); border: 1px solid transparent; font: 700 12.5px var(--font-body); cursor: pointer; }
.cm__btn:disabled { opacity: .6; cursor: wait; }
.cm__btn--batal { background: #fff; border-color: var(--line); color: var(--ink); }
.cm__btn--danger { background: var(--coral); color: #fff; }
.cm__btn--primary { background: var(--blue); color: #fff; }
.cm__btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
</style>
