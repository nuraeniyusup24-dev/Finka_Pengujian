// Parser & penulis CSV kecil (tanpa dependensi) untuk impor siswa dan unduh kredensial.
// Mendukung pemisah ; , atau tab (Excel Indonesia memakai ;), BOM UTF-8, kutip ganda, dan baris baru dalam kutip.

export function deteksiPemisah(teks) {
  const baris = teks.split(/\r?\n/, 1)[0] || ''
  let terbaik = ','
  let max = -1
  for (const d of [';', ',', '\t']) {
    let n = 0
    let kutip = false
    for (const c of baris) { if (c === '"') kutip = !kutip; else if (c === d && !kutip) n++ }
    if (n > max) { max = n; terbaik = d }
  }
  return terbaik
}

// Mengembalikan { rows: string[][], lines: number[] } — lines[i] = nomor baris file tempat record ke-i dimulai.
export function parseCsv(teks) {
  let s = String(teks || '')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  const d = deteksiPemisah(s)
  const rows = []
  const lines = []
  let row = []
  let sel = ''
  let kutip = false
  let baris = 1
  let mulai = 1
  const tutupSel = () => { row.push(sel); sel = '' }
  const tutupBaris = () => {
    tutupSel()
    if (row.some((c) => String(c).trim() !== '')) { rows.push(row); lines.push(mulai) }
    row = []
  }
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (kutip) {
      if (c === '"') { if (s[i + 1] === '"') { sel += '"'; i++ } else kutip = false }
      else { if (c === '\n') baris++; sel += c }
    } else if (c === '"' && sel === '') kutip = true
    else if (c === d) tutupSel()
    else if (c === '\r') { /* abaikan */ }
    else if (c === '\n') { tutupBaris(); baris++; mulai = baris }
    else sel += c
  }
  if (sel !== '' || row.length) tutupBaris()
  return { rows, lines }
}

// Nilai yang diawali = + - @ bisa dieksekusi sebagai rumus di Excel; diberi awalan ' agar aman dibuka.
const netralkan = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v)

export function toCsv(rows, pemisah = ';') {
  const esc = (v) => {
    const s = netralkan(String(v ?? ''))
    return new RegExp('["\\n\\r' + (pemisah === '\t' ? '\\t' : pemisah) + ']').test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return '﻿' + rows.map((r) => r.map(esc).join(pemisah)).join('\r\n') + '\r\n'
}

const KUNCI = {
  nama_siswa: ['namasiswa', 'siswa', 'nama', 'namalengkap', 'namalengkapsiswa'],
  nis: ['nis', 'nisn', 'nomorinduk', 'nomorinduksiswa'],
  kelas: ['kelas', 'rombel'],
  password_siswa: ['passwordsiswa', 'password', 'sandisiswa'],
  nama_ortu: ['namaortu', 'namaorangtua', 'ortu', 'orangtua', 'wali', 'namawali', 'namaorangtuawali'],
  username_ortu: ['usernameortu', 'userortu', 'usernameorangtua', 'idortu', 'usernamewali'],
  password_ortu: ['passwordortu', 'passwordorangtua', 'passwordwali', 'sandiortu']
}

// Cocokkan kepala kolom dengan nama kolom baku; kembalikan baris objek siap kirim ke server.
export function petakanImpor({ rows, lines }) {
  if (!rows.length) return { baris: [], galat: 'File kosong.' }
  const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const kepala = rows[0].map(norm)
  const idx = {}
  for (const [k, alias] of Object.entries(KUNCI)) idx[k] = kepala.findIndex((h) => alias.includes(h))
  const hilang = ['nama_siswa', 'nis', 'kelas', 'password_siswa', 'nama_ortu', 'password_ortu'].filter((k) => idx[k] < 0)
  if (hilang.length) return { baris: [], galat: 'Kolom wajib tidak ditemukan di baris pertama: ' + hilang.join(', ') + '. Gunakan templat.' }
  const baris = rows.slice(1).map((r, i) => {
    const o = { no: lines[i + 1] }
    for (const k of Object.keys(KUNCI)) o[k] = idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : ''
    return o
  })
  if (!baris.length) return { baris: [], galat: 'File hanya berisi baris judul, belum ada data siswa.' }
  return { baris, galat: '' }
}

export const TEMPLAT_IMPOR = [
  ['nama_siswa', 'nis', 'kelas', 'password_siswa', 'nama_ortu', 'username_ortu', 'password_ortu'],
  ['Rina Wulandari', '25010001', '7A', 'Contoh-Rina-741!', 'Bapak Hadi', '', 'Contoh-Ortu-741!'],
  ['Raka Wulandari', '25010002', '7B', 'Contoh-Raka-852!', 'Bapak Hadi', '', 'Contoh-Ortu-741!'],
  ['Sinta Putri', '25010003', '7A', 'Contoh-Sinta-963!', 'Ibu Dewi', '', 'Contoh-Ortu-963!']
]

const KUNCI_PIC = {
  nama_pic: ['namapic', 'namakasir', 'namapetugas'],
  username_pic: ['usernamepic', 'usernamekasir', 'username'],
  password_sementara: ['passwordsementara', 'passwordawal', 'passwordpic', 'password'],
  nama_outlet: ['namaoutlet', 'outlet', 'namakantin'],
  jam_buka: ['jambuka', 'bukapukul', 'mulaioperasional'],
  jam_tutup: ['jamtutup', 'tutuppukul', 'akhiroperasional'],
  nama_menu: ['namamenu', 'namaproduk', 'menu', 'produk'],
  kategori: ['kategori', 'jenismenu'],
  harga: ['harga', 'hargajual'],
  deskripsi: ['deskripsi', 'keterangan', 'ket']
}

export const TEMPLAT_IMPOR_PIC = [
  ['nama_pic', 'username_pic', 'password_sementara', 'nama_outlet', 'jam_buka', 'jam_tutup', 'nama_menu', 'kategori', 'harga', 'deskripsi'],
  ['Sari Wulandari', 'pic.kantin.sari', 'Ganti-Saya-2026!', 'Kantin Gedung A', '07:00', '14:00', 'Nasi goreng', 'Makanan', '12000', 'Nasi goreng telur'],
  ['Sari Wulandari', 'pic.kantin.sari', 'Ganti-Saya-2026!', 'Kantin Gedung A', '07:00', '14:00', 'Es teh', 'Minuman', '4000', 'Es teh manis']
]

function formatJamImpor(value) {
  const text = String(value ?? '').trim()
  const jamText = text.match(/^(\d{1,2}):([0-5]\d)$/)
  if (jamText && Number(jamText[1]) <= 23) return `${jamText[1].padStart(2, '0')}:${jamText[2]}`

  const fraction = Number(text)
  if (text && Number.isFinite(fraction) && fraction >= 0 && fraction < 1) {
    const minutes = Math.round(fraction * 24 * 60) % (24 * 60)
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  }
  return text
}

export function petakanImporPic({ rows, lines }) {
  if (!rows.length) return { baris: [], galat: 'File kosong.' }
  const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const kepala = rows[0].map(norm)
  const idx = {}
  for (const [key, alias] of Object.entries(KUNCI_PIC)) idx[key] = kepala.findIndex((h) => alias.includes(h))
  const wajib = Object.keys(KUNCI_PIC).filter((key) => key !== 'deskripsi')
  const hilang = wajib.filter((key) => idx[key] < 0)
  if (hilang.length) return { baris: [], galat: 'Kolom wajib tidak ditemukan di baris pertama: ' + hilang.join(', ') + '. Gunakan templat PIC.' }
  const baris = rows.slice(1).map((row, i) => {
    const data = { no: lines[i + 1] }
    for (const key of Object.keys(KUNCI_PIC)) {
      data[key] = idx[key] >= 0 ? String(row[idx[key]] ?? '').trim() : ''
    }
    data.jam_buka = formatJamImpor(data.jam_buka)
    data.jam_tutup = formatJamImpor(data.jam_tutup)
    return data
  })
  if (!baris.length) return { baris: [], galat: 'File hanya berisi baris judul, belum ada data PIC dan menu.' }
  return { baris, galat: '' }
}
