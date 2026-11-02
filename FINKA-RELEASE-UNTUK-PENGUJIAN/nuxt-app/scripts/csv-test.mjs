import { parseCsv, toCsv, petakanImpor, TEMPLAT_IMPOR } from '../utils/csv.js'
let gagal = 0
const ok = (n, c, x) => { if (!c) gagal++; console.log(c ? 'OK   -' : 'GAGAL-', n, c ? '' : JSON.stringify(x)) }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
let r = parseCsv('﻿nama_siswa;nis;kelas;nama_ortu\r\nA;1;7A;Ortu A\r\n\r\nB;2;7B;"Ortu; B"\r\n')
ok('pemisah ; + BOM + CRLF + baris kosong dilewati', eq(r.rows, [['nama_siswa', 'nis', 'kelas', 'nama_ortu'], ['A', '1', '7A', 'Ortu A'], ['B', '2', '7B', 'Ortu; B']]) && eq(r.lines, [1, 2, 4]), r)
r = parseCsv('a,b\n"x ""kutip"" y","baris1\nbaris2"\nz,w')
ok('koma, kutip ganda, newline dalam kutip', eq(r.rows, [['a', 'b'], ['x "kutip" y', 'baris1\nbaris2'], ['z', 'w']]) && eq(r.lines, [1, 2, 4]), r)
r = parseCsv('a\tb\n1\t2'); ok('tab', eq(r.rows, [['a', 'b'], ['1', '2']]), r)
r = parseCsv(''); ok('kosong', r.rows.length === 0, r)
const t = petakanImpor(parseCsv(toCsv(TEMPLAT_IMPOR)))
ok('templat dapat dibaca kembali (3 baris, nomor baris 2..4)', !t.galat && t.baris.length === 3 && t.baris[0].nis === '25010001' && t.baris[2].no === 4 && t.baris[2].username_ortu === '', t)
const alias = petakanImpor(parseCsv('Nama Siswa;NISN;Kelas;Nama Orang Tua/Wali\nA;123;7A;B'))
ok('alias kepala kolom (Nama Siswa, NISN, Nama Orang Tua/Wali)', !alias.galat && alias.baris[0].nama_ortu === 'B' && alias.baris[0].nis === '123', alias)
ok('kolom wajib hilang -> galat jelas', /nis/.test(petakanImpor(parseCsv('nama_siswa;kelas;nama_ortu\nA;7A;B')).galat), 0)
ok('hanya judul -> galat', /belum ada data/.test(petakanImpor(parseCsv('nama_siswa;nis;kelas;nama_ortu')).galat), 0)
const c = toCsv([['=HYPERLINK("x")', '+1', 'normal', 'a;b', 'q"q']])
ok('anti injeksi rumus + escape', c === '﻿\'=HYPERLINK("x");\'+1;normal;"a;b";"q""q"\r\n'.replace('\'=HYPERLINK("x")', '"\'=HYPERLINK(""x"")"'), c)
console.log(gagal ? gagal + ' GAGAL' : 'SEMUA CSV TEST LULUS'); process.exit(gagal ? 1 : 0)
