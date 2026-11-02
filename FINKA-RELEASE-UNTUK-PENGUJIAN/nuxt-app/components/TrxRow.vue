<template>
  <nuxt-link :to="to" class="row">
    <div class="ik" :class="masuk ? 'ik--in' : ''">{{ masuk ? '+' : 'K' }}</div>
    <div class="body">
      <div class="judul">{{ trx.judul }}</div>
      <div class="meta">{{ trx.meta }}</div>
      <div v-if="trx.kasir" class="pic">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--sand)" stroke-width="2.2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
        <span>{{ picLabel }}</span>
      </div>
    </div>
    <div class="kanan">
      <div class="nominal num" :class="masuk ? 'nominal--in' : ''">{{ masuk ? '+' : '−' }} {{ Math.abs(trx.nominal) | num }}</div>
      <div v-if="showSisa" class="sisa num">sisa {{ trx.sisa | num }}</div>
    </div>
  </nuxt-link>
</template>

<script>
export default {
  name: 'TrxRow',
  props: {
    trx: { type: Object, required: true },
    to: { type: [String, Object], required: true },
    showSisa: { type: Boolean, default: false }
  },
  computed: {
    masuk() { return this.trx.nominal > 0 },
    picLabel() { return (this.masuk ? 'Diverifikasi ' : 'Kasir ') + this.trx.kasir }
  }
}
</script>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--bg);
  color: inherit;
  cursor: pointer;
}
.row:hover { color: inherit; background: #FAFAFB; }
.ik {
  width: 34px; height: 34px; border-radius: var(--r-pill);
  background: var(--blue-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
  font: 700 12px var(--font-display); flex: none;
}
.ik--in { background: rgba(26,128,64,.1); color: var(--green); }
.body { flex: 1; min-width: 0; }
.judul { font: 600 13.5px var(--font-body); color: var(--ink); }
.meta { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 1px; }
.pic { display: flex; align-items: center; gap: 5px; margin-top: 3px; font: 500 11px var(--font-body); color: var(--muted); }
.kanan { text-align: right; }
.nominal { font: 700 13.5px var(--font-body); color: var(--ink); }
.nominal--in { color: var(--green); }
.sisa { font: 400 11px var(--font-body); color: var(--muted); margin-top: 1px; }
</style>

