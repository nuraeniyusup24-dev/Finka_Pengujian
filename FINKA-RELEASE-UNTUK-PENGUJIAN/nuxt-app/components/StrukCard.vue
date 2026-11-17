<template>
  <section class="card struk" data-testid="struk-card">
          <div class="brand">
            <FinkaMark :width="18" :height="20" color="var(--navy)" />
            <span class="display brand__nama">FINKA</span>
            <span class="brand__tipe">Struk digital</span>
          </div>

          <div class="hero">
            <span class="ikon" :class="'ikon--' + struk.status" aria-hidden="true">
              <svg v-if="struk.status === 'berhasil'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <svg v-else-if="struk.status === 'menunggu'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </span>
            <div class="status" :class="'status--' + struk.status">{{ struk.statusLabel }}</div>
            <div class="judul display">{{ struk.judul }}</div>
            <div class="nominal display num">{{ struk.nominalLabel }}</div>
            <div class="waktu">{{ struk.waktuLabel }}</div>
          </div>

          <div v-if="items.length" class="blok">
            <div class="blok__judul display">Rincian pembelian</div>
            <div v-for="(it, i) in items" :key="i" class="baris"><span>{{ it.nama }}</span><b class="num">x{{ it.qty }}</b></div>
          </div>

          <div class="blok">
            <div v-for="b in struk.baris" :key="b[0]" class="baris"><span>{{ b[0] }}</span><b>{{ b[1] }}</b></div>
          </div>
        </section>
</template>

<script>
export default {
  name: 'StrukCard',
  props: { struk: { type: Object, required: true } },
  computed: { items() { return this.struk.items || [] } }
}
</script>

<style scoped>
.struk { padding:18px; display:flex; flex-direction:column; gap:16px; }
.brand { display:flex; align-items:center; gap:8px; }
.brand__nama { font:800 15px var(--font-display); letter-spacing:.04em; color:var(--navy); }
.brand__tipe { margin-left:auto; font:600 10.5px var(--font-body); letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
.hero { display:flex; flex-direction:column; align-items:center; gap:6px; padding:6px 0 14px; border-bottom:1px dashed var(--line); text-align:center; }
.ikon { width:42px; height:42px; border-radius:50%; background:#e6f7ee; color:var(--green); display:flex; align-items:center; justify-content:center; }
.ikon--menunggu { background:#fff6e0; color:#B7791F; }
.ikon--dibatalkan { background:#fff0ef; color:var(--coral); }
.status { font:700 10.5px var(--font-body); letter-spacing:.08em; color:var(--green); }
.status--menunggu { color:#B7791F; }
.status--dibatalkan { color:var(--coral); }
.judul { font:700 14px var(--font-display); color:var(--ink); }
.nominal { font:800 30px var(--font-display); letter-spacing:-.03em; color:var(--ink); }
.waktu { font:400 12px var(--font-body); color:var(--muted); }
.blok { display:flex; flex-direction:column; gap:10px; }
.blok + .blok { padding-top:14px; border-top:1px dashed var(--line); }
.blok__judul { font:700 13px var(--font-display); color:var(--ink); }
.baris { display:flex; justify-content:space-between; gap:16px; font:400 12.5px/1.45 var(--font-body); }
.baris span { flex:none; color:var(--muted); }
.baris b { text-align:right; font-weight:600; overflow-wrap:anywhere; color:var(--ink); }
</style>
