<script setup>
definePageMeta({
  layout: 'phone'
})
</script>

<template>
  <div v-if="siswa" class="wrap">
    <ScreenHeader title="Konfirmasi Siswa" to="/pic/scan" />
    <div class="body">
      <div class="who">
        <div class="foto">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--sand)" stroke-width="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
          <span>foto siswa<br />(placeholder)</span>
        </div>
        <div class="who__id">
          <div class="nama display">{{ siswa.nama }}</div>
          <div class="sub">{{ siswa.kelas }} · NIS {{ siswa.nis }}</div>
          <div class="label">SALDO SAAT INI</div>
          <div class="saldo display num" :class="cukup ? '' : 'is-bad'">{{ siswa.saldo | rp }}</div>
        </div>
      </div>

      <div class="keranjang">
        <div class="keranjang__judul display">{{ mode === 'tunai' ? 'Penarikan tunai' : 'Keranjang' }}</div>
        <div v-for="(c, i) in items" :key="i" class="baris">
          <span>{{ c.label }}</span>
          <b class="num">{{ c.harga | rp }}</b>
        </div>
        <div class="garis"></div>
        <div class="baris baris--total">
          <span>Total</span>
          <b class="display num">{{ total | rp }}</b>
        </div>
      </div>

      <div class="cek" :class="cukup ? 'cek--ok' : 'cek--bad'">
        <svg v-if="cukup" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16h.01M12 3l9.5 17H2.5z" /></svg>
        <p>{{ pesan }}</p>
      </div>

      <div class="spacer"></div>
      <button class="btn" :class="cukup ? 'btn--primary' : 'btn--bad'" @click="lanjut">
        {{ cukup ? 'Minta PIN siswa' : 'Lihat penolakan' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {

  computed: {
    siswa() { return this.$store.getters['pos/siswaScan'] },
    mode() { return this.$store.state.pos.mode },
    items() { return this.$store.getters['pos/items'] },
    total() { return this.$store.getters['pos/total'] },
    cukup() { return this.$store.getters['pos/cukup'] },
    pesan() {
      return this.cukup
        ? 'Saldo mencukupi. Sisa setelah transaksi ' + this.$rp(this.siswa.saldo - this.total) + '.'
        : 'Saldo kurang ' + this.$rp(this.total - this.siswa.saldo) + '. Transaksi akan ditolak.'
    }
  },
  mounted() {
    if (!this.siswa) this.$router.replace('/pic')
  },
  methods: {
    lanjut() {
      this.$store.commit('pos/acakKeypad')
      this.$router.push(this.cukup ? '/pic/pin' : '/pic/gagal')
    }
  }
}
</script>

<style scoped>
.wrap { flex: 1; display: flex; flex-direction: column; background: #fff; min-height: 0; }
.body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }

.who { display: flex; gap: 16px; align-items: center; }
.foto {
  width: 96px; height: 120px; flex: none; border-radius: var(--r-sm);
  background: var(--bg); border: 1px solid var(--line);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  font: 400 9.5px/1.35 var(--font-body); color: var(--muted); text-align: center;
}
.who__id { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.nama { font: 700 19px var(--font-display); letter-spacing: -.01em; }
.sub { font: 400 13px var(--font-body); color: var(--muted); }
.label { font: 500 11px var(--font-body); color: var(--muted); letter-spacing: .06em; margin-top: 8px; }
.saldo { font: 800 25px var(--font-display); letter-spacing: -.02em; }
.saldo.is-bad { color: var(--coral); }

.keranjang { background: var(--bg); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 11px; }
.keranjang__judul { font: 700 12.5px var(--font-display); }
.baris { display: flex; justify-content: space-between; gap: 12px; font: 400 12.5px var(--font-body); color: var(--muted); }
.baris b { font: 600 12.5px var(--font-body); color: var(--ink); }
.baris--total { align-items: baseline; color: var(--ink); font-weight: 600; font-size: 13px; }
.baris--total b { font: 700 18px var(--font-display); }
.garis { height: 1px; background: var(--line); }

.cek { border-radius: var(--r-md); padding: 14px; display: flex; gap: 11px; align-items: flex-start; }
.cek--ok { background: rgba(26,128,64,.08); }
.cek--bad { background: rgba(223,74,55,.08); }
.cek svg { flex: none; margin-top: 1px; }
.cek p { margin: 0; font: 400 12.5px/1.5 var(--font-body); text-wrap: pretty; }
.cek--ok p { color: var(--green); }
.cek--bad p { color: var(--coral); }

.btn--bad { background: var(--coral); color: #fff; }
.spacer { flex: 1; }
</style>
