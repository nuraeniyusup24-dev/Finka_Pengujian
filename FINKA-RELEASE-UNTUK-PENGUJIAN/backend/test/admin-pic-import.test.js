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

async function api(url, token, path, body, method = 'POST') {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  return { response, body: await response.json() }
}

test('admin dapat mengimpor PIC dan menu dengan password sementara tanpa PIN', { timeout: 30000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-pic-import-'))
  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = join(directory, 'pic-import-test.db')
  process.env.JWT_SECRET = 'pic-import-test-jwt'

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
    { no: 2, nama_pic: 'PIC Uji Kantin', username_pic: 'pic.import.test', password_sementara: 'Temporary-Pic-123!', nama_outlet: 'Kantin Uji Impor', jam_buka: '07:00', jam_tutup: '14:00', nama_menu: 'Nasi Uji', kategori: 'Makanan', harga: '12000', deskripsi: 'Nasi goreng telur' },
    { no: 3, nama_pic: 'PIC Uji Kantin', username_pic: 'pic.import.test', password_sementara: 'Temporary-Pic-123!', nama_outlet: 'Kantin Uji Impor', jam_buka: '07:00', jam_tutup: '14:00', nama_menu: 'Teh Uji', kategori: 'Minuman', harga: '4000', deskripsi: 'Teh manis dingin' }
  ]

  const preview = await api(baseUrl, adminToken, '/api/admin/impor-pic', { baris: rows, simpan: false })
  assert.equal(preview.response.status, 200, JSON.stringify(preview.body))
  assert.equal(preview.body.valid, 2)
  assert.equal(preview.body.jumlah_error, 0)
  assert.ok(preview.body.baris.every((row) => !('password_sementara' in row)))

  const duplicateMenu = await api(baseUrl, adminToken, '/api/admin/impor-pic', {
    baris: [rows[0], { ...rows[1], nama_menu: rows[0].nama_menu }],
    simpan: false
  })
  assert.equal(duplicateMenu.body.jumlah_error, 1)
  assert.match(duplicateMenu.body.baris[1].error, /Nama menu yang sama terulang/)

  const inconsistentHours = await api(baseUrl, adminToken, '/api/admin/impor-pic', {
    baris: [rows[0], { ...rows[1], username_pic: 'pic.import.other', nama_pic: 'PIC Kedua', jam_tutup: '15:00' }],
    simpan: false
  })
  assert.equal(inconsistentHours.body.jumlah_error, 1)
  assert.match(inconsistentHours.body.baris[1].error, /Jam operasional harus sama/)

  const imported = await api(baseUrl, adminToken, '/api/admin/impor-pic', { baris: rows, simpan: true })
  assert.equal(imported.response.status, 201, JSON.stringify(imported.body))
  assert.equal(imported.body.jumlah_pic, 1)
  assert.equal(imported.body.jumlah_menu, 2)
  const account = await db.prepare('SELECT password_hash, pin_hash, must_change_password, outlet_hours FROM users WHERE username = ?')
    .get('pic.import.test')
  assert.ok(await bcrypt.compare('Temporary-Pic-123!', account.password_hash))
  assert.equal(account.pin_hash, null)
  assert.equal(Number(account.must_change_password), 1)
  assert.equal(account.outlet_hours, '07:00–14:00')

  const picToken = await login(baseUrl, 'pic.import.test', 'Temporary-Pic-123!')
  const firstProfile = await api(baseUrl, picToken, '/api/auth/me', undefined, 'GET')
  assert.equal(firstProfile.body.user.wajib_ganti_password, true)
  assert.equal(firstProfile.body.user.wajib_buat_pin, false)
  const changedPassword = await api(baseUrl, picToken, '/api/auth/ganti-password', {
    password_lama: 'Temporary-Pic-123!',
    password_baru: 'Changed-Pic-Password-1!'
  })
  assert.equal(changedPassword.response.status, 200, JSON.stringify(changedPassword.body))
  const catalog = await api(baseUrl, picToken, '/api/pos/produk', undefined, 'GET')
  assert.equal(catalog.response.status, 200)
  assert.deepEqual(
    catalog.body.produk.map((product) => [product.nama, product.kategori, product.ket]),
    [['Nasi Uji', 'Makanan', 'Nasi goreng telur'], ['Teh Uji', 'Minuman', 'Teh manis dingin']]
  )

  const manuallyCreated = await api(baseUrl, adminToken, '/api/admin/users', {
    username: 'pic.manual.change',
    password: 'Temporary-Manual-123!',
    nama: 'PIC Manual',
    role: 'pic',
    outlet: 'Kantin Manual',
    outlet_jam: '08:00–16:00'
  })
  assert.equal(manuallyCreated.response.status, 201, JSON.stringify(manuallyCreated.body))
  const manualAccount = await db.prepare('SELECT must_change_password, pin_hash FROM users WHERE username = ?')
    .get('pic.manual.change')
  assert.equal(Number(manualAccount.must_change_password), 1)
  assert.equal(manualAccount.pin_hash, null)
})
