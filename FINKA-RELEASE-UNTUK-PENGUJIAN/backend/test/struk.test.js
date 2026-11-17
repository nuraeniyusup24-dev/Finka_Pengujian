import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function login(url, username, password) {
  const r = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
  const b = await r.json(); assert.equal(r.status, 200); return b.token
}
const get = async (url, token, path) => {
  const r = await fetch(url + path, { headers: { Authorization: `Bearer ${token}` } })
  return { status: r.status, body: await r.json() }
}

test('Struk: rincian transaksi, saldo, kasir, dan kontrol akses', { timeout: 30000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'finka-struk-'))
  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = join(dir, 'struk.db')
  process.env.JWT_SECRET = 'struk-jwt-secret'
  process.env.PIN_OTP_SECRET = 'struk-pin-otp-secret'
  const { db, initDb, ensureDemoData } = await import('../src/db.js')
  const { startServer } = await import('../src/server.js')
  await initDb(); await ensureDemoData()
  const server = await startServer(0)
  await new Promise(r => server.listening ? r() : server.once('listening', r))
  const url = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise(r => server.close(r)); await db.close(); rmSync(dir, { recursive: true, force: true }) })

  const aditya = await db.prepare("SELECT id FROM users WHERE username = 'aditya.p'").get()
  const pic = await db.prepare("SELECT id FROM users WHERE role = 'pic' LIMIT 1").get()
  const topup = await db.prepare("INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh) VALUES (?, 'topup', 50000, 'Top-up uji', ?)").run(aditya.id, pic.id)
  const beli = await db.prepare("INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh) VALUES (?, 'pembelian', -12000, 'Nasi Ayam x1, Bakso x2, Teh x1', ?)").run(aditya.id, pic.id)
  await db.prepare("INSERT INTO pos_transaction_meta (ledger_id, pic_id, outlet, tipe_asal, total) VALUES (?, ?, 'Kantin A', 'pembelian', 12000)").run(beli.lastInsertRowid, pic.id)

  const siswa = await login(url, 'aditya.p', 'siswa123')
  const kayla = await login(url, 'kayla.p', 'siswa123')
  const ortu = await login(url, 'ortu.sari', 'ortu123')

  const s = await get(url, siswa, `/api/siswa/${aditya.id}/struk/${beli.lastInsertRowid}`)
  assert.equal(s.status, 200)
  const d = s.body.struk
  assert.equal(d.nomor, 'TRX-' + beli.lastInsertRowid)
  assert.equal(d.masuk, false)
  assert.equal(d.nominal, -12000)
  assert.equal(d.outlet, 'Kantin A')
  assert.equal(d.status, 'berhasil')
  assert.equal(d.saldo_sebelum - d.saldo_sesudah, 12000)
  assert.ok(d.oleh)
  assert.deepEqual(d.items.map(i => i.qty), [1, 2, 1])
  assert.equal(d.items.length, 3)
  assert.equal(d.items[1].nama, 'Bakso')
  assert.equal(d.items[1].qty, 2)

  const t1 = await get(url, siswa, `/api/siswa/${aditya.id}/struk/${topup.lastInsertRowid}`)
  assert.equal(t1.body.struk.masuk, true)
  assert.deepEqual(t1.body.struk.items, [])

  // Orang tua anak itu boleh, siswa lain ditolak, transaksi milik siswa lain tidak ditemukan
  assert.equal((await get(url, ortu, `/api/siswa/${aditya.id}/struk/${beli.lastInsertRowid}`)).status, 200)
  // PIC pemroses boleh; PIC lain tidak
  const picRow = await db.prepare('SELECT username FROM users WHERE id = ?').get(pic.id)
  const picTok = await login(url, picRow.username, 'pic123')
  assert.equal((await get(url, picTok, `/api/siswa/${aditya.id}/struk/${beli.lastInsertRowid}`)).status, 200)
  const lain = await db.prepare("SELECT username FROM users WHERE role = 'pic' AND id <> ? LIMIT 1").get(pic.id)
  if (lain) assert.equal((await get(url, await login(url, lain.username, 'pic123'), `/api/siswa/${aditya.id}/struk/${beli.lastInsertRowid}`)).status, 403)
  assert.equal((await get(url, kayla, `/api/siswa/${aditya.id}/struk/${beli.lastInsertRowid}`)).status, 403)
  const kid = await db.prepare("SELECT id FROM users WHERE username = 'kayla.p'").get()
  assert.equal((await get(url, kayla, `/api/siswa/${kid.id}/struk/${beli.lastInsertRowid}`)).status, 404)
  assert.equal((await get(url, siswa, `/api/siswa/${aditya.id}/struk/99999999`)).status, 404)
})
