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
  process.env.PAYMENT_BANK_NAME = ''
  process.env.PAYMENT_BANK_ACCOUNT = ''
  process.env.PAYMENT_ACCOUNT_HOLDER = ''
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
  const unconfiguredPayment = await api(baseUrl, adminToken, '/api/config/pembayaran')
  assert.equal(unconfiguredPayment.response.status, 200)
  assert.equal(unconfiguredPayment.body.rekening, null)
  process.env.PAYMENT_BANK_NAME = 'Bank Uji'
  process.env.PAYMENT_BANK_ACCOUNT = '0000001234'
  process.env.PAYMENT_ACCOUNT_HOLDER = 'Akun Pengujian'
  const configuredPayment = await api(baseUrl, adminToken, '/api/config/pembayaran')
  assert.deepEqual(configuredPayment.body.rekening, {
    bank: 'Bank Uji',
    nomor: '0000001234',
    atas_nama: 'Akun Pengujian'
  })
  process.env.PAYMENT_BANK_NAME = ''
  process.env.PAYMENT_BANK_ACCOUNT = ''
  process.env.PAYMENT_ACCOUNT_HOLDER = ''
  const picToken = await login(baseUrl, 'pic.kantin.utama', 'pic123')
  const studentToken = await login(baseUrl, 'aditya.p', 'siswa123')
  const usersResult = await api(baseUrl, picToken, '/api/admin/users')
  assert.equal(usersResult.response.status, 403)

  const createdPic = await api(baseUrl, adminToken, '/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      username: 'pic.gedung.a',
      password: 'testing123',
      nama: 'PIC Gedung A',
      role: 'pic',
      outlet: 'Kantin Gedung A',
      outlet_jam: '07:30–14:30'
    })
  })
  assert.equal(createdPic.response.status, 201, JSON.stringify(createdPic.body))
  const picUsers = await api(baseUrl, adminToken, '/api/admin/users')
  assert.equal(picUsers.response.status, 200)
  assert.equal(picUsers.body.find(user => user.id === createdPic.body.user.id).outlet_jam, '07:30–14:30')
  const picWithoutHours = await api(baseUrl, adminToken, '/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      username: 'pic.tanpa.jam',
      password: 'testing123',
      nama: 'PIC Tanpa Jam',
      role: 'pic',
      outlet: 'Kantin Tanpa Jam'
    })
  })
  assert.equal(picWithoutHours.response.status, 400)
  const customProduct = await api(baseUrl, adminToken, '/api/pos/produk', {
    method: 'POST',
    body: JSON.stringify({ nama: 'Roti Gedung A', harga: 5000, outlet: 'Kantin Gedung A', kategori: 'Roti', deskripsi: 'Roti isi cokelat' })
  })
  assert.equal(customProduct.response.status, 201, JSON.stringify(customProduct.body))
  assert.equal(customProduct.body.produk.kategori, 'Roti')
  const updatedProduct = await api(baseUrl, adminToken, `/api/pos/produk/${customProduct.body.produk.id}`, {
    method: 'PUT',
    body: JSON.stringify({ nama: 'Roti Gedung A', harga: 6000, kategori: 'Camilan', deskripsi: 'Roti isi keju' })
  })
  assert.equal(updatedProduct.response.status, 200, JSON.stringify(updatedProduct.body))
  assert.equal(updatedProduct.body.produk.deskripsi, 'Roti isi keju')
  const unregisteredProduct = await api(baseUrl, adminToken, '/api/pos/produk', {
    method: 'POST',
    body: JSON.stringify({ nama: 'Produk tanpa outlet', harga: 5000, outlet: 'Outlet Tidak Terdaftar' })
  })
  assert.equal(unregisteredProduct.response.status, 400)
  let customPicToken = await login(baseUrl, 'pic.gedung.a', 'testing123')
  const firstPicProfile = await api(baseUrl, customPicToken, '/api/auth/me')
  assert.equal(firstPicProfile.body.user.wajib_ganti_password, true)
  assert.equal(firstPicProfile.body.user.wajib_buat_pin, false)
  const changedPicPassword = await api(baseUrl, customPicToken, '/api/auth/ganti-password', {
    method: 'POST',
    body: JSON.stringify({ password_lama: 'testing123', password_baru: 'testing123-changed' })
  })
  assert.equal(changedPicPassword.response.status, 200, JSON.stringify(changedPicPassword.body))
  customPicToken = await login(baseUrl, 'pic.gedung.a', 'testing123-changed')
  const customCatalog = await api(baseUrl, customPicToken, '/api/pos/produk')
  assert.equal(customCatalog.response.status, 200)
  assert.equal(customCatalog.body.outlet, 'Kantin Gedung A')
  assert.ok(customCatalog.body.produk.some(product => product.nama === 'Roti Gedung A' && product.kategori === 'Camilan' && product.ket === 'Roti isi keju'))

  const students = await api(baseUrl, adminToken, '/api/siswa')
  assert.equal(students.response.status, 200)
  const aditya = students.body.siswa.find(student => student.nama === 'Aditya Pratama')
  const kayla = students.body.siswa.find(student => student.nama === 'Kayla Pratama')
  assert.ok(aditya && kayla)

  const crossAccount = await api(baseUrl, studentToken, `/api/siswa/${kayla.id}/saldo`)
  assert.equal(crossAccount.response.status, 403)

  const parentToken = await login(baseUrl, 'ortu.sari', 'ortu123')
  const issued = await api(baseUrl, adminToken, '/api/admin/tagihan/bulk', {
    method: 'POST',
    body: JSON.stringify({
      nama: 'SPP Integrasi',
      nominal: 275000,
      jatuh_tempo: '2026-12-10',
      siswa_ids: [aditya.id],
      kirim_notifikasi: true
    })
  })
  assert.equal(issued.response.status, 201, JSON.stringify(issued.body))
  assert.equal(issued.body.notifikasi_terkirim, 1)
  const parentBills = await api(baseUrl, parentToken, `/api/tagihan?siswa_id=${aditya.id}`)
  assert.ok(parentBills.body.tagihan.some(item => item.nama === 'SPP Integrasi'))
  const issuedNotifications = await api(baseUrl, parentToken, '/api/ortu/notifikasi')
  const issuedNotification = issuedNotifications.body.notifikasi.find(item => item.tipe === 'tagihan_diterbitkan')
  assert.ok(issuedNotification)
  assert.equal(issuedNotification.tagihan_id, parentBills.body.tagihan.find(item => item.nama === 'SPP Integrasi').id)

  const reminder = await api(baseUrl, adminToken, '/api/admin/tagihan/pengingat', { method: 'POST', body: '{}' })
  assert.equal(reminder.response.status, 200, JSON.stringify(reminder.body))
  assert.ok(reminder.body.jumlah_tagihan >= 1)
  const remindedNotifications = await api(baseUrl, parentToken, '/api/ortu/notifikasi')
  assert.ok(remindedNotifications.body.notifikasi.some(item => item.tipe === 'pengingat_tagihan'))

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
