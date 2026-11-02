<template>
  <div class="pad">
    <button v-for="(k, i) in tombol" :key="i" class="key" :class="k.ghost ? 'key--ghost' : ''" @click="k.act">{{ k.label }}</button>
  </div>
</template>

<script>
export default {
  name: 'NumPad',
  props: {
    keys: { type: Array, default: () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] },
    tripleZero: { type: Boolean, default: false }
  },
  computed: {
    tombol() {
      const out = this.keys.slice(0, 9).map((n) => ({ label: String(n), act: () => this.$emit('key', n) }))
      out.push(
        this.tripleZero
          ? { label: '000', act: () => this.$emit('key', '000') }
          : { label: '', ghost: true, act: () => {} }
      )
      out.push({ label: String(this.keys[9]), act: () => this.$emit('key', this.keys[9]) })
      out.push({ label: '⌫', ghost: true, act: () => this.$emit('hapus') })
      return out
    }
  }
}
</script>

<style scoped>
.pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.key {
  height: 62px; border: none; border-radius: var(--r-md);
  background: rgba(255,255,255,.1); color: #fff;
  font: 600 24px var(--font-display); cursor: pointer; user-select: none;
}
.key:hover { background: rgba(255,255,255,.2); }
.key--ghost { background: transparent; }
</style>

