<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin'
})
</script>

<template>
  <div class="page">
    <div class="card form">
      <div class="steps">
        <div v-for="(s, i) in steps" :key="i" class="step">
          <span class="step__no" :class="s.on ? 'is-on' : ''">{{ i + 1 }}</span>
          <span class="step__label" :class="s.on ? 'is-on' : ''">{{ s.label }}</span>
          <span class="step__line"></span>
        </div>
      </div>

      <section>
        <div class="h display">Jenis tagihan</div>
        <div class="jenis">
          <button
            v-for="(j, i) in jenisTagihan"
            :key="j.label"
            class="jenis__box"
            :class="draft.jenis === i ? 'is-on' : ''"
            @click="pilihJenis(i, j)"
          >
            <div class="jenis__nama">{{ j.label }}</div>
            <div class="jenis__ket">{{ j.ket }}</div>
          </button>
        </div>
      </section>

      <section>
        <div class="h display">Penerima</div>
        <div class="target">
          <button
            v-for="(t, i) in ['Per kelas', 'Per angkatan', 'Semua siswa']"
            :key="t"
            class="chip chip--pill"
            :class="draft.target === i ? 'chip--on' : ''"
            @click="patch({ target: i })"
          >{{ t }}</button>
        </div>
        <div class="kelas">
          <button
            v-for="k in kelas"
            :key="k.kelas"
            class="chip kelas__chip"
            :class="terpilih(k.kelas) ? 'chip--on' : ''"
            @click="toggleKelas(k.kelas)"
          >
            <span class="box" :class="terpilih(k.kelas) ? 'is-on' : ''">
              <svg v-if="terpilih(k.kelas)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            {{ k.kelas }} ({{ k.n }})
          </button>
        </div>
      </section>

      <div class="dua">
        <section>
          <div class="h display">Nominal per siswa</div>
          <div class="input">
            <span class="display">Rp</span>
            <input :value="nominalStr" class="input__field display num" inputmode="numeric" @input="setNominal" />
          </div>
          <div class="chips">
            <button
              v-for="n in [150000, 400000, 450000]"
              :key="n"
              class="chip num"
              :class="draft.nominal === n ? 'chip--on' : ''"
              @click="patch({ nominal: n })"
            >{{ $num(n) }}</button>
          </div>
        </section>
        <section>
          <div class="h display">Jatuh tempo</div>
          <div class="tempo">
            <button
              v-for="(d, i) in tempoOpsi"
              :key="d.label"
              class="tempo__box"
              :class="draft.tempo === i ? 'is-on' : ''"
              @click="patch({ tempo: i })"
            >
              <span>{{ d.label }}</span>
              <i>{{ d.ket }}</i>
            </button>
          </div>
        </section>
      </div>

      <section>
        <div class="h display">Opsi penerbitan</div>
        <div class="opsi">
          <div v-for="o in opsi" :key="o.k" class="opsi__row">
            <div>
              <div class="opsi__label">{{ o.label }}</div>
              <div class="opsi__ket">{{ o.ket }}</div>
            </div>
            <ToggleSwitch :value="draft[o.k]" @input="(v) => patch({ [o.k]: v })" />
          </div>
        </div>
      </section>
    </div>

    <div class="kanan">
      <div class="card invoice">
        <div class="invoice__head">
          <span class="h display">Pratinjau invoice</span>
          <span class="sub">contoh untuk {{ contoh.kelas }}</span>
        </div>
        <div class="invoice__body">
          <div class="kop">
            <div class="kop__brand">
              <FinkaMark :width="18" :height="20" color="var(--navy)" />
              <div>
                <div class="kop__nama display">Yayasan Nurul Ilmi</div>
                <div class="kop__alamat">Jl. Melati Raya 12, Bandung</div>
              </div>
            </div>
            <div class="kop__no">
              <div class="mini">NOMOR</div>
              <div class="display num">INV/2026/09/0{{ 128 + draft.jenis }}</div>
            </div>
          </div>
          <div class="garis"></div>

          <div class="kepada">
            <div>
              <div class="mini">Ditagihkan kepada</div>
              <div class="kepada__nama">{{ contoh.ortu }}</div>
              <div class="kepada__sub">{{ contoh.siswa }} · {{ contoh.kelas }} · NIS {{ contoh.nis }}</div>
            </div>
            <div class="ka">
              <div class="mini">Jatuh tempo</div>
              <div class="kepada__tempo">{{ tempoOpsi[draft.tempo].tanggal }}</div>
              <div class="kepada__sub">Terbit 2 Sep 2026</div>
            </div>
          </div>

          <div class="rincian">
            <div class="rincian__row">
              <b>{{ jenisTagihan[draft.jenis].label }}</b>
              <b class="num">{{ draft.nominal | rp }}</b>
            </div>
            <div class="rincian__periode">{{ jenisTagihan[draft.jenis].periode }}</div>
            <div v-if="draft.dendaOn" class="rincian__row rincian__row--muted">
              <span>Denda keterlambatan (setelah tempo)</span>
              <span class="num">{{ 25000 | rp }}</span>
            </div>
            <div class="garis"></div>
            <div class="rincian__total">
              <span>Total tagihan</span>
              <b class="display num">{{ draft.nominal | rp }}</b>
            </div>
          </div>

          <div class="hero">
            <div class="hero__eyebrow">TRANSFER TEPAT SAMPAI 3 DIGIT</div>
            <div class="hero__angka">
              <span class="hero__rp display">Rp</span>
              <span class="display num">{{ dasarStr }}</span>
              <span class="display num kode">{{ kodeStr }}</span>
            </div>
            <div class="hero__bank">BCA 872 011 4556 · a.n. Yayasan Nurul Ilmi</div>
          </div>

          <p class="fine">Kode unik 3 digit dibuat otomatis per orang tua saat invoice diterbitkan. Tagihan lunas setelah admin memverifikasi bukti transfer.</p>
        </div>
      </div>

      <div class="card ringkas">
        <div class="h display">Ringkasan penerbitan</div>
        <div class="ringkas__row"><span>Penerima</span><b>{{ penerimaLabel }}</b></div>
        <div class="ringkas__row"><span>Jumlah siswa</span><b class="num">{{ $num(jumlah) }} siswa</b></div>
        <div class="ringkas__row"><span>Nominal per siswa</span><b class="num">{{ draft.nominal | rp }}</b></div>
        <div class="garis"></div>
        <div class="ringkas__total"><span>Total diterbitkan</span><b class="display num">{{ total | rp }}</b></div>

        <div v-if="draft.terbit" class="sukses">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <p>{{ pesanSukses }}</p>
        </div>

        <div v-if="admin" class="ringkas__aksi">
          <nuxt-link to="/admin/tagihan" class="btn-sm btn-sm--ghost">Batal</nuxt-link>
          <button class="btn-sm btn-sm--primary" :disabled="!valid" @click="terbitkan">
            {{ draft.terbit ? 'Terbitkan lagi' : 'Terbitkan ' + $num(jumlah) + ' invoice' }}
          </button>
        </div>
        <div v-else class="kunci">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>
          <span>Akun Monitoring tidak bisa menerbitkan tagihan.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {

  data() {
    return {
      opsi: [
        { k: 'kirimNotif', label: 'Kirim notifikasi ke orang tua', ket: 'Push dan email saat invoice terbit' },
        { k: 'dendaOn', label: 'Denda keterlambatan', ket: 'Rp 25.000 setelah jatuh tempo' },
        { k: 'cicilan', label: 'Izinkan cicilan', ket: 'Orang tua boleh bayar bertahap' }
      ]
    }
  },
  computed: {
    admin() { return this.$store.getters['admin/admin'] },
    draft() { return this.$store.state.admin.draft },
    kelas() { return this.$store.state.admin.kelas },
    jenisTagihan() { return this.$store.state.admin.jenisTagihan },
    tempoOpsi() { return this.$store.state.admin.tempoOpsi },
    contoh() { return this.$store.getters['admin/contohPenerima'] },
    jumlah() { return this.$store.getters['admin/jumlahPenerima'] },
    total() { return this.$store.getters['admin/totalTerbit'] },
    valid() { return this.jumlah > 0 && this.draft.nominal > 0 },
    nominalStr() { return this.$num(this.draft.nominal) },
    dasarStr() { return this.$num(this.draft.nominal + 110).slice(0, -3) },
    kodeStr() { return this.$num(this.draft.nominal + 110).slice(-3) },
    steps() {
      return [
        { label: 'Isi detail', on: true },
        { label: 'Pratinjau', on: true },
        { label: 'Terbitkan', on: this.draft.terbit }
      ]
    },
    penerimaLabel() {
      if (this.draft.target === 2) return 'Semua kelas (1.284 siswa)'
      const dipilih = this.$store.getters['admin/kelasTerpilih']
      if (this.draft.target === 1) {
        const ang = dipilih.map((k) => k.kelas[0]).filter((v, i, a) => a.indexOf(v) === i)
        return 'Angkatan ' + (ang.length ? ang.join(', ') : 'belum dipilih')
      }
      return this.draft.kelasPilih.length ? this.draft.kelasPilih.join(', ') : 'Belum dipilih'
    },
    pesanSukses() {
      return this.$num(this.jumlah) + ' invoice diterbitkan senilai ' + this.$rp(this.total) +
        '. Kode unik per orang tua sudah dibuat' + (this.draft.kirimNotif ? ' dan notifikasi terkirim.' : '.')
    }
  },
  methods: {
    patch(p) { if (this.admin) this.$store.commit('admin/patchDraft', p) },
    pilihJenis(i, j) { this.patch({ jenis: i, nominal: j.default }) },
    setNominal(e) { this.patch({ nominal: this.$parseRp(e.target.value) }) },
    terpilih(k) { return this.draft.target === 2 || this.draft.kelasPilih.indexOf(k) >= 0 },
    toggleKelas(k) { if (this.admin && this.draft.target !== 2) this.$store.commit('admin/toggleKelas', k) },
    terbitkan() { if (this.admin && this.valid) this.$store.commit('admin/terbitkan') }
  }
}
</script>

<style scoped>
.page { display: grid; grid-template-columns: 1fr 470px; gap: 16px; align-items: start; }
.form { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
.h { font: 700 13px var(--font-display); margin-bottom: 11px; }

.steps { display: flex; align-items: center; gap: 10px; }
.step { display: flex; align-items: center; gap: 10px; }
.step__no {
  width: 24px; height: 24px; border-radius: var(--r-pill);
  background: var(--bg); color: var(--muted); font: 700 11.5px var(--font-body);
  display: flex; align-items: center; justify-content: center;
}
.step__no.is-on { background: var(--blue); color: #fff; }
.step__label { font: 600 12.5px var(--font-body); color: var(--muted); }
.step__label.is-on { color: var(--ink); }
.step__line { width: 26px; height: 1px; background: var(--line); }

.jenis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.jenis__box { border: 1.5px solid var(--line); background: #fff; border-radius: 10px; padding: 14px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 5px; }
.jenis__box.is-on { border-color: var(--blue); background: var(--blue-soft); }
.jenis__nama { font: 600 13px var(--font-body); }
.jenis__ket { font: 400 11.5px var(--font-body); color: var(--muted); }

.target { display: flex; gap: 8px; margin-bottom: 12px; }
.kelas { border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.kelas__chip { display: flex; align-items: center; gap: 7px; flex: none; font-size: 12px; }
.box { width: 13px; height: 13px; border-radius: 3px; border: 1.5px solid var(--disabled); display: flex; align-items: center; justify-content: center; }
.box.is-on { border-color: var(--blue); background: var(--blue); }

.dua { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.input { border: 1.5px solid var(--blue); border-radius: var(--r-sm); padding: 12px 14px; display: flex; align-items: center; gap: 8px; }
.input > span { font: 700 16px var(--font-display); }
.input__field { flex: 1; border: none; outline: none; font: 700 20px var(--font-display); color: var(--ink); width: 100%; }
.chips { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.tempo { display: flex; flex-direction: column; gap: 8px; }
.tempo__box { border: 1px solid var(--line); background: #fff; border-radius: var(--r-sm); padding: 11px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
.tempo__box.is-on { border-color: var(--blue); background: var(--blue-soft); }
.tempo__box span { font: 600 12.5px var(--font-body); }
.tempo__box.is-on span { color: var(--blue); }
.tempo__box i { font: 400 11.5px var(--font-body); color: var(--muted); font-style: normal; }

.opsi { display: flex; flex-direction: column; gap: 10px; }
.opsi__row { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 15px; }
.opsi__label { font: 600 12.5px var(--font-body); }
.opsi__ket { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 2px; }

.kanan { display: flex; flex-direction: column; gap: 16px; }
.invoice { overflow: hidden; }
.invoice__head { padding: 14px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.invoice__head .h { margin: 0; }
.sub { font: 400 11.5px var(--font-body); color: var(--muted); }
.invoice__body { padding: 22px 20px; display: flex; flex-direction: column; gap: 18px; }
.kop { display: flex; align-items: flex-start; justify-content: space-between; }
.kop__brand { display: flex; align-items: center; gap: 9px; }
.kop__nama { font: 700 13px var(--font-display); }
.kop__alamat { font: 400 10.5px var(--font-body); color: var(--muted); }
.kop__no { text-align: right; }
.kop__no > div:last-child { font: 700 12px var(--font-display); margin-top: 2px; }
.mini { font: 500 10.5px var(--font-body); color: var(--muted); letter-spacing: .04em; }
.garis { height: 1px; background: var(--line); }

.kepada { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ka { text-align: right; }
.kepada__nama { font: 600 12.5px var(--font-body); margin-top: 3px; }
.kepada__sub { font: 400 11.5px var(--font-body); color: var(--muted); margin-top: 1px; }
.kepada__tempo { font: 600 12.5px var(--font-body); color: var(--coral); margin-top: 3px; }

.rincian { background: var(--bg); border-radius: 10px; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
.rincian__row { display: flex; justify-content: space-between; gap: 12px; font: 600 12.5px var(--font-body); }
.rincian__row--muted { font-weight: 400; color: var(--muted); font-size: 12px; }
.rincian__periode { font: 400 11.5px var(--font-body); color: var(--muted); }
.rincian__total { display: flex; justify-content: space-between; align-items: baseline; font: 600 13px var(--font-body); }
.rincian__total b { font: 800 21px var(--font-display); letter-spacing: -.02em; }

.hero { background: var(--navy); border-radius: 10px; padding: 15px; display: flex; flex-direction: column; gap: 9px; }
.hero__eyebrow { font: 500 10.5px var(--font-body); color: var(--sand); letter-spacing: .07em; }
.hero__angka { display: flex; align-items: baseline; gap: 2px; color: #fff; font: 800 24px var(--font-display); letter-spacing: -.02em; }
.hero__rp { font: 600 13px var(--font-display); margin-right: 3px; }
.kode { color: var(--sand); }
.hero__bank { font: 400 11px var(--font-body); color: rgba(255,255,255,.6); }
.fine { margin: 0; font: 400 10.5px/1.5 var(--font-body); color: var(--muted); text-wrap: pretty; }

.ringkas { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.ringkas__row { display: flex; justify-content: space-between; font: 400 12.5px var(--font-body); color: var(--muted); }
.ringkas__row b { font-weight: 600; color: var(--ink); }
.ringkas__total { display: flex; justify-content: space-between; align-items: baseline; font: 600 13px var(--font-body); }
.ringkas__total b { font: 800 22px var(--font-display); letter-spacing: -.02em; }
.sukses { background: rgba(26,128,64,.08); border-radius: var(--r-sm); padding: 13px; display: flex; gap: 10px; align-items: flex-start; }
.sukses svg { flex: none; margin-top: 1px; }
.sukses p { margin: 0; font: 400 12px/1.5 var(--font-body); color: var(--green); text-wrap: pretty; }
.ringkas__aksi { display: flex; gap: 10px; }
.btn-sm { border: none; border-radius: var(--r-sm); font: 700 13.5px var(--font-display); padding: 12px 18px; cursor: pointer; text-align: center; }
.btn-sm--ghost { background: #fff; border: 1px solid var(--line); color: var(--muted); font: 600 13px var(--font-body); }
.btn-sm--primary { flex: 1; background: var(--blue); color: #fff; }
.btn-sm--primary:hover { background: var(--blue-dark); }
.btn-sm--primary:disabled { background: var(--disabled); cursor: not-allowed; }
.kunci { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px; font: 400 12.5px var(--font-body); color: var(--muted); }
</style>
