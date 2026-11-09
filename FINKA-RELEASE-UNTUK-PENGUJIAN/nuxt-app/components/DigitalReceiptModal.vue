<template>
  <div v-if="receipt || loading || error" class="receipt-overlay" role="presentation" @click.self="$emit('close')">
    <section class="receipt" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <header class="receipt__top">
        <div class="receipt__brand display">FINKA <span>STRUK DIGITAL</span></div>
        <button type="button" class="receipt__close" aria-label="Tutup struk" @click="$emit('close')">×</button>
      </header>

      <div v-if="loading" class="receipt__state">Memuat struk…</div>
      <div v-else-if="error" class="receipt__state receipt__error" role="alert">{{ error }}</div>
      <template v-else-if="receipt">
        <div class="receipt__hero">
          <div class="receipt__status" :class="'receipt__status--' + receipt.tone">{{ receipt.status }}</div>
          <h2 id="receipt-title" class="receipt__title display">{{ receipt.title }}</h2>
          <div class="receipt__amount display num">{{ receipt.amount | rp }}</div>
          <div v-if="receipt.date" class="receipt__date">{{ receipt.date | waktu }}</div>
        </div>

        <div class="receipt__details">
          <div v-for="(item, index) in receipt.details" :key="index">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
          </div>
        </div>

        <section v-if="receipt.proofAvailable" class="receipt__proof">
          <h3 class="display">Bukti transfer</h3>
          <p v-if="proofError" class="receipt__error" role="alert">{{ proofError }}</p>
          <button v-else-if="proof" type="button" class="receipt__proof-open" @click="viewerTerbuka = true">
            <img :src="proof" alt="Bukti transfer yang diunggah" />
            <span>Lihat bukti transfer</span>
          </button>
          <p v-else class="receipt__hint">Memuat bukti transfer…</p>
        </section>
        <p v-else-if="receipt.proofMessage" class="receipt__hint">{{ receipt.proofMessage }}</p>
      </template>
      <button type="button" class="receipt__done" @click="$emit('close')">Tutup</button>
    </section>

    <ImageLightbox
      v-if="viewerTerbuka && proof"
      :src="proof"
      alt="Bukti transfer yang diunggah"
      @close="viewerTerbuka = false"
    />
  </div>
</template>

<script>
export default {
  name: 'DigitalReceiptModal',
  props: {
    receipt: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    proof: { type: String, default: '' },
    proofError: { type: String, default: '' }
  },
  data() {
    return { viewerTerbuka: false }
  }
}
</script>

<style scoped>
.receipt-overlay { position:fixed; inset:0; z-index:1500; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(10,13,35,.58); }
.receipt { box-sizing:border-box; width:min(100%, 430px); max-height:min(90vh, 760px); overflow-y:auto; padding:20px; border-radius:20px; background:#fff; box-shadow:0 20px 60px rgba(10,13,35,.24); }
.receipt__top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.receipt__brand { color:var(--navy); font-size:14px; font-weight:800; letter-spacing:.04em; }
.receipt__brand span { margin-left:8px; color:var(--muted); font:600 9px var(--font-body); letter-spacing:.1em; }
.receipt__close { width:34px; height:34px; flex:none; border:0; border-radius:50%; background:var(--bg); color:var(--ink); cursor:pointer; font:400 25px/1 var(--font-body); }
.receipt__hero { display:flex; flex-direction:column; align-items:center; gap:8px; padding:22px 0 18px; text-align:center; }
.receipt__status { padding:5px 10px; border-radius:var(--r-pill); background:var(--bg); color:var(--muted); font:700 10px var(--font-body); }
.receipt__status--ok { background:rgba(26,128,64,.1); color:var(--green); }
.receipt__status--wait { background:rgba(192,169,127,.2); color:var(--sand-ink); }
.receipt__status--bad { background:rgba(223,74,55,.1); color:var(--coral); }
.receipt__title { margin:2px 0 0; color:var(--ink); font-size:15px; }
.receipt__amount { color:var(--ink); font-size:29px; font-weight:800; }
.receipt__date { color:var(--muted); font:400 11px var(--font-body); }
.receipt__details { display:flex; flex-direction:column; gap:10px; padding:14px 0; border-top:1px dashed var(--line); border-bottom:1px dashed var(--line); }
.receipt__details div { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; font:400 12px/1.45 var(--font-body); }
.receipt__details span { flex:none; color:var(--muted); }
.receipt__details b { text-align:right; font-weight:600; overflow-wrap:anywhere; }
.receipt__proof { padding-top:14px; }
.receipt__proof h3 { margin:0 0 8px; color:var(--ink); font-size:13px; }
.receipt__proof-open { display:flex; width:100%; flex-direction:column; align-items:center; gap:7px; padding:10px; border:0; border-radius:var(--r-sm); background:var(--bg); color:var(--blue); cursor:zoom-in; font:500 11px var(--font-body); }
.receipt__proof-open img { display:block; max-width:100%; max-height:250px; object-fit:contain; }
.receipt__hint,.receipt__state { margin:0; padding:16px 0; text-align:center; color:var(--muted); font:400 12px/1.5 var(--font-body); }
.receipt__error { color:var(--coral); }
.receipt__done { width:100%; margin-top:16px; padding:11px; border:0; border-radius:var(--r-pill); background:var(--blue); color:#fff; cursor:pointer; font:700 12px var(--font-body); }
@media (max-width:360px) { .receipt { padding:16px; } }
</style>
