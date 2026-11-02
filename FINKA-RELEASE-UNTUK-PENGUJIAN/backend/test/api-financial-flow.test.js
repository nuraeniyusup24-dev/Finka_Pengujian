import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

async function api(url, token, path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  })
  return { response, body: await response.json() }
}

test('API menguji batas role serta pembayaran bersamaan dan pembatalan ledger', { timeout: 30000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-api-flow-'))
  const dbPath = join(directory, 'staging-test.db')
  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = dbPath
  process.env.JWT_SECRET = 'api-test-jwt-secret'
  process.env.PIN_OTP_SECRET = 'api-test-pin-otp-secret'
  const { db, initDb, ensureDemoData } = await import('../src/db.js')
  const { startServer } = await import('../src/server.js')
  await initDb()
  await ensureDemoData()
  const admin = await db.prepare("SELECT id FROM users WHERE username = 'admin'").get()
  const student = await db.prepare("SELECT id FROM users WHERE username = 'aditya.p'").get()
  await db.prepare("INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh) VALUES (?, 'topup', 500000, 'Saldo untuk tes API', ?)").run(student.id, admin.id)
  const server = await startServer(0)
  await new Promise(resolve => {
    if (server.listening) return resolve()
    server.once('listening', resolve)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const adminToken = await login(baseUrl, 'admin', 'admin123')
  const picToken = await login(baseUrl, 'pic.kantin.utama', 'pic123')
  const studentToken = await login(baseUrl, 'aditya.p', 'siswa123')
  const usersResult = await api(baseUrl, picToken, '/api/admin/users')
  assert.equal(usersResult.response.status, 403)

  const students = await api(baseUrl, adminToken, '/api/siswa')
  assert.equal(students.response.status, 200)
  const aditya = students.body.siswa.find(student => student.nama === 'Aditya Pratama')
  const kayla = students.body.siswa.find(student => student.nama === 'Kayla Pratama')
  assert.ok(aditya && kayla)

  const crossAccount = await api(baseUrl, studentToken, `/api/siswa/${kayla.id}/saldo`)
  assert.equal(crossAccount.response.status, 403)

  const bills = await api(baseUrl, adminToken, `/api/tagihan?siswa_id=${aditya.id}`)
  assert.equal(bills.response.status, 200)
  const bill = bills.body.tagihan.find(item => item.status === 'belum_bayar')
  assert.ok(bill)
  const before = await api(baseUrl, adminToken, `/api/siswa/${aditya.id}/saldo`)
  assert.equal(before.response.status, 200)

  const payments = await Promise.all([
    api(baseUrl, adminToken, `/api/tagihan/${bill.id}/bayar`, { method: 'POST', body: '{}' }),
    api(baseUrl, adminToken, `/api/tagihan/${bill.id}/bayar`, { method: 'POST', body: '{}' })
  ])
  assert.deepEqual(payments.map(item => item.response.status).sort(), [200, 409])
  const afterPayment = await api(baseUrl, adminToken, `/api/siswa/${aditya.id}/saldo`)
  assert.equal(afterPayment.body.saldo, before.body.saldo - bill.nominal)

  const cancelled = await api(baseUrl, adminToken, `/api/admin/tagihan/${bill.id}/batal`, {
    method: 'POST',
    body: JSON.stringify({ alasan: 'Pembatalan uji integrasi' })
  })
  assert.equal(cancelled.response.status, 200)
  assert.ok(cancelled.body.tagihan.reversal_ledger_id)
  const afterCancellation = await api(baseUrl, adminToken, `/api/siswa/${aditya.id}/saldo`)
  assert.equal(afterCancellation.body.saldo, before.body.saldo)

  const duplicateCancellation = await api(baseUrl, adminToken, `/api/admin/tagihan/${bill.id}/batal`, {
    method: 'POST',
    body: JSON.stringify({ alasan: 'Tes idempotensi' })
  })
  assert.equal(duplicateCancellation.response.status, 409)
})
