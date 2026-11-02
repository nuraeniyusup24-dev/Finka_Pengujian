import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'

async function login(url, username, password) {
  const response = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  return body.token
}

async function api(url, token, path, body) {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { response, body: await response.json() }
}

test('admin dapat mengimpor akun siswa dan memverifikasi pembayaran secara massal', { timeout: 30000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-admin-import-'))
  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = join(directory, 'admin-import-test.db')
  process.env.JWT_SECRET = 'admin-import-test-jwt'

  const { db, initDb, ensureDemoData } = await import('../src/db.js')
  const { startServer } = await import('../src/server.js')
  await initDb()
  await ensureDemoData()
  const server = await startServer(0)
  await new Promise((resolve) => {
    if (server.listening) return resolve()
    server.once('listening', resolve)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const adminToken = await login(baseUrl, 'admin', 'admin123')
  const rows = [
    { no: 2, nama_siswa: 'Siswa Uji Satu', nis: 'TEST-IMPORT-001', kelas: '7A', nama_ortu: 'Orang Tua Uji', username_ortu: '' },
    { no: 3, nama_siswa: 'Siswa Uji Dua', nis: 'TEST-IMPORT-002', kelas: '7B', nama_ortu: 'Orang Tua Uji', username_ortu: '' }
  ]

  const preview = await api(baseUrl, adminToken, '/api/admin/impor-siswa', { baris: rows, simpan: false })
  assert.equal(preview.response.status, 200)
  assert.equal(preview.body.valid, 2)
  assert.equal(preview.body.jumlah_error, 0)

  const imported = await api(baseUrl, adminToken, '/api/admin/impor-siswa', { baris: rows, simpan: true })
  assert.equal(imported.response.status, 201, JSON.stringify(imported.body))
  assert.equal(imported.body.jumlah, 2)
  assert.ok(imported.body.akun.every((account) => account.password_siswa.length >= 8))
  assert.equal(imported.body.akun[0].username_ortu, imported.body.akun[1].username_ortu)
  assert.equal(imported.body.akun[0].password_ortu, imported.body.akun[1].password_ortu)

  for (const account of imported.body.akun) {
    const user = await db.prepare('SELECT password_hash, pin_hash FROM users WHERE username = ?').get(account.username_siswa)
    assert.ok(await bcrypt.compare(account.password_siswa, user.password_hash))
    assert.equal(user.pin_hash, null)
  }
  const parentCount = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE username = ? AND role = 'ortu'").get(imported.body.akun[0].username_ortu)
  assert.equal(Number(parentCount.count), 1)

  const student = await db.prepare("SELECT id FROM users WHERE username = 'aditya.p'").get()
  const parent = await db.prepare('SELECT ortu_id FROM siswa_profil WHERE user_id = ?').get(student.id)
  const missingProof = await db.prepare(`INSERT INTO topup_request (siswa_id, ortu_id, nominal, kode_unik, status)
    VALUES (?, ?, 12000, 123, 'menunggu')`).run(student.id, parent.ortu_id)
  const withProof = await db.prepare(`INSERT INTO topup_request (siswa_id, ortu_id, nominal, kode_unik, status)
    VALUES (?, ?, 15000, 234, 'menunggu')`).run(student.id, parent.ortu_id)
  await db.prepare(`INSERT INTO topup_proof (topup_id, content_type, file_name, data_base64, file_size)
    VALUES (?, 'image/png', 'proof.png', 'dGVzdA==', 4)`).run(withProof.lastInsertRowid)
  const bill = await db.prepare(`INSERT INTO tagihan (siswa_id, nama, nominal, status)
    VALUES (?, 'SPP Uji', 25000, 'belum_bayar')`).run(student.id)
  const mismatchedBill = await db.prepare(`INSERT INTO topup_request (siswa_id, ortu_id, nominal, kode_unik, tagihan_id, status)
    VALUES (?, ?, 20000, 345, ?, 'menunggu')`).run(student.id, parent.ortu_id, bill.lastInsertRowid)
  await db.prepare(`INSERT INTO topup_proof (topup_id, content_type, file_name, data_base64, file_size)
    VALUES (?, 'image/png', 'proof.png', 'dGVzdA==', 4)`).run(mismatchedBill.lastInsertRowid)

  const batch = await api(baseUrl, adminToken, '/api/topup/batch/verify', {
    ids: [missingProof.lastInsertRowid, withProof.lastInsertRowid, mismatchedBill.lastInsertRowid]
  })
  assert.equal(batch.response.status, 200, JSON.stringify(batch.body))
  assert.deepEqual(
    batch.body.hasil.map((item) => item.status),
    ['ditolak', 'disetujui', 'ditolak']
  )
  const noProofRequest = await db.prepare('SELECT alasan_tolak FROM topup_request WHERE id = ?').get(missingProof.lastInsertRowid)
  assert.match(noProofRequest.alasan_tolak, /tidak diunggah/)
  const paidBill = await db.prepare('SELECT status FROM tagihan WHERE id = ?').get(bill.lastInsertRowid)
  assert.equal(paidBill.status, 'belum_bayar')
})
