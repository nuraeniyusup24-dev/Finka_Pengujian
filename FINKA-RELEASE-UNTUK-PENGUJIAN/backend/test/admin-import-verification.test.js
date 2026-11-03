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

async function getApi(url, token, path) {
  const response = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
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
    { no: 2, nama_siswa: 'Siswa Uji Satu', nis: 'TEST-IMPORT-001', kelas: '7A', password_siswa: 'ExcelPass-001!', nama_ortu: 'Orang Tua Uji', username_ortu: '', password_ortu: 'ParentPass-001!' },
    { no: 3, nama_siswa: 'Siswa Uji Dua', nis: 'TEST-IMPORT-002', kelas: '7B', password_siswa: 'ExcelPass-002!', nama_ortu: 'Orang Tua Uji', username_ortu: '', password_ortu: 'ParentPass-001!' }
  ]

  const preview = await api(baseUrl, adminToken, '/api/admin/impor-siswa', { baris: rows, simpan: false })
  assert.equal(preview.response.status, 200)
  assert.equal(preview.body.valid, 2)
  assert.equal(preview.body.jumlah_error, 0)
  assert.ok(preview.body.baris.every((row) => !('password_siswa' in row) && !('password_ortu' in row)))

  const imported = await api(baseUrl, adminToken, '/api/admin/impor-siswa', { baris: rows, simpan: true })
  assert.equal(imported.response.status, 201, JSON.stringify(imported.body))
  assert.equal(imported.body.jumlah, 2)
  assert.ok(imported.body.akun.every((account) => !('password_siswa' in account)))
  assert.equal(imported.body.akun[0].username_ortu, imported.body.akun[1].username_ortu)
  assert.equal(imported.body.akun[0].password_ortu, 'ParentPass-001!')
  assert.equal(imported.body.akun[1].password_ortu, 'ParentPass-001!')
  const importedParent = await db.prepare('SELECT password_hash, pin_hash, must_change_password FROM users WHERE username = ?').get(imported.body.akun[0].username_ortu)
  assert.ok(await bcrypt.compare('ParentPass-001!', importedParent.password_hash))
  assert.equal(importedParent.pin_hash, null)
  assert.equal(Number(importedParent.must_change_password), 1)
  const parentToken = await login(baseUrl, imported.body.akun[0].username_ortu, 'ParentPass-001!')
  const parentProfile = await getApi(baseUrl, parentToken, '/api/auth/me')
  assert.equal(parentProfile.body.user.role, 'ortu')
  assert.equal(parentProfile.body.user.wajib_ganti_password, true)
  assert.equal(parentProfile.body.user.wajib_buat_pin, true)
  const parentPinBeforePasswordChange = await api(baseUrl, parentToken, '/api/auth/me/pin', {
    pin: '864210',
    konfirmasi_pin: '864210'
  })
  assert.equal(parentPinBeforePasswordChange.response.status, 403)
  assert.match(parentPinBeforePasswordChange.body.error, /Ganti password sementara/)
  const parentPasswordChanged = await api(baseUrl, parentToken, '/api/auth/ganti-password', {
    password_lama: 'ParentPass-001!',
    password_baru: 'parent-password-2'
  })
  assert.equal(parentPasswordChanged.response.status, 200, JSON.stringify(parentPasswordChanged.body))
  const parentProfileAfterPasswordChange = await getApi(baseUrl, parentToken, '/api/auth/me')
  assert.equal(parentProfileAfterPasswordChange.body.user.wajib_ganti_password, false)
  assert.equal(parentProfileAfterPasswordChange.body.user.wajib_buat_pin, true)
  const parentPinCreated = await api(baseUrl, parentToken, '/api/auth/me/pin', {
    pin: '864210',
    konfirmasi_pin: '864210'
  })
  assert.equal(parentPinCreated.response.status, 200, JSON.stringify(parentPinCreated.body))
  const parentProfileAfterPin = await getApi(baseUrl, parentToken, '/api/auth/me')
  assert.equal(parentProfileAfterPin.body.user.wajib_ganti_password, false)
  assert.equal(parentProfileAfterPin.body.user.wajib_buat_pin, false)
  await login(baseUrl, imported.body.akun[0].username_ortu, 'parent-password-2')

  const legacyImport = await api(baseUrl, adminToken, '/api/admin/impor-siswa', {
    baris: [{
      no: 2,
      nama_siswa: 'Siswa Uji Legacy',
      nis: 'TEST-IMPORT-LEGACY',
      kelas: '7C',
      password_siswa: 'ExcelPass-Legacy!',
      nama_ortu: 'Orang Tua Legacy',
      username_ortu: '',
      password_ortu: 'ParentPass-Legacy!'
    }],
    simpan: true
  })
  assert.equal(legacyImport.response.status, 201, JSON.stringify(legacyImport.body))
  const legacyParent = await db.prepare('SELECT id FROM users WHERE username = ?').get(legacyImport.body.akun[0].username_ortu)
  await db.prepare('UPDATE users SET must_change_password = 0 WHERE id = ?').run(legacyParent.id)
  await initDb()
  const legacyParentAfterMigration = await db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(legacyParent.id)
  assert.equal(Number(legacyParentAfterMigration.must_change_password), 1)
  const changedParentAfterMigration = await db.prepare('SELECT must_change_password FROM users WHERE username = ?').get(imported.body.akun[0].username_ortu)
  assert.equal(Number(changedParentAfterMigration.must_change_password), 0)

  for (const account of imported.body.akun) {
    const user = await db.prepare('SELECT password_hash, pin_hash, must_change_password FROM users WHERE username = ?').get(account.username_siswa)
    const row = rows.find((item) => item.nis === account.nis)
    assert.ok(await bcrypt.compare(row.password_siswa, user.password_hash))
    assert.equal(user.pin_hash, null)
    assert.equal(Number(user.must_change_password), 1)
  }

  const studentUsername = imported.body.akun[0].username_siswa
  const missingPassword = await api(baseUrl, adminToken, '/api/admin/impor-siswa', {
    baris: [{ ...rows[0], nis: 'TEST-IMPORT-MISSING-PASSWORD', password_siswa: '' }],
    simpan: false
  })
  assert.equal(missingPassword.response.status, 200)
  assert.equal(missingPassword.body.jumlah_error, 1)
  assert.match(missingPassword.body.baris[0].error, /Password siswa wajib/)

  const missingParentPassword = await api(baseUrl, adminToken, '/api/admin/impor-siswa', {
    baris: [{ ...rows[0], nis: 'TEST-IMPORT-MISSING-PARENT-PASSWORD', password_ortu: '' }],
    simpan: false
  })
  assert.equal(missingParentPassword.body.jumlah_error, 1)
  assert.match(missingParentPassword.body.baris[0].error, /Password orang tua wajib/)

  const existingParentWithoutPassword = await api(baseUrl, adminToken, '/api/admin/impor-siswa', {
    baris: [{ ...rows[0], nis: 'TEST-LINK-001', nama_ortu: 'Ibu Sari', username_ortu: 'ortu.sari', password_ortu: '' }],
    simpan: false
  })
  assert.equal(existingParentWithoutPassword.body.jumlah_error, 0, JSON.stringify(existingParentWithoutPassword.body))
  assert.ok(existingParentWithoutPassword.body.baris.every((row) => !('password_ortu' in row)))

  const mismatchedSiblingPasswords = await api(baseUrl, adminToken, '/api/admin/impor-siswa', {
    baris: [{ ...rows[0], nis: 'TEST-IMPORT-PARENT-PASS-A' }, { ...rows[1], nis: 'TEST-IMPORT-PARENT-PASS-B', password_ortu: 'DifferentPass-002!' }],
    simpan: false
  })
  assert.equal(mismatchedSiblingPasswords.body.jumlah_error, 1)
  assert.match(mismatchedSiblingPasswords.body.baris[1].error, /Password orang tua harus sama/)

  const studentBeforeAdminReset = await db.prepare('SELECT id FROM users WHERE username = ?').get(studentUsername)
  const importedPasswordToken = await login(baseUrl, 'Siswa Uji Satu', rows[0].password_siswa)
  const importedProfile = await getApi(baseUrl, importedPasswordToken, '/api/auth/me')
  assert.equal(importedProfile.body.user.wajib_ganti_password, true)
  assert.equal(importedProfile.body.user.wajib_buat_pin, true)
  const blockedRequest = await getApi(baseUrl, importedPasswordToken, '/api/siswa/saya/kontrol')
  assert.equal(blockedRequest.response.status, 403)

  const wrongNamePassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: studentUsername, password: rows[1].password_siswa })
  })
  assert.equal(wrongNamePassword.status, 401)

  const passwordSet = await api(baseUrl, adminToken, `/api/admin/users/${studentBeforeAdminReset.id}/password`, {
    password: 'temporary-password-1',
    konfirmasi_password: 'temporary-password-1'
  })
  assert.equal(passwordSet.response.status, 200, JSON.stringify(passwordSet.body))
  const userAfterSet = await db.prepare('SELECT password_hash, must_change_password FROM users WHERE id = ?').get(studentBeforeAdminReset.id)
  assert.ok(await bcrypt.compare('temporary-password-1', userAfterSet.password_hash))
  assert.equal(Number(userAfterSet.must_change_password), 1)
  const adminUserList = await getApi(baseUrl, adminToken, '/api/admin/users')
  assert.equal(adminUserList.response.status, 200)
  const listedStudent = adminUserList.body.find((user) => Number(user.id) === Number(studentBeforeAdminReset.id))
  assert.equal(Number(listedStudent.password_terpasang), 1)
  assert.equal(Number(listedStudent.wajib_ganti_password), 1)

  const studentToken = await login(baseUrl, studentUsername, 'temporary-password-1')
  const firstProfile = await getApi(baseUrl, studentToken, '/api/auth/me')
  assert.equal(firstProfile.response.status, 200)
  assert.equal(firstProfile.body.user.wajib_ganti_password, true)
  assert.equal(firstProfile.body.user.wajib_buat_pin, true)

  const passwordChanged = await api(baseUrl, studentToken, '/api/auth/ganti-password', {
    password_lama: 'temporary-password-1',
    password_baru: 'student-password-2'
  })
  assert.equal(passwordChanged.response.status, 200, JSON.stringify(passwordChanged.body))
  const updatedProfile = await getApi(baseUrl, studentToken, '/api/auth/me')
  assert.equal(updatedProfile.body.user.wajib_ganti_password, false)

  const personalToken = await login(baseUrl, studentUsername, 'student-password-2')
  const pinCreated = await api(baseUrl, personalToken, '/api/auth/me/pin', {
    pin: '864209',
    konfirmasi_pin: '864209'
  })
  assert.equal(pinCreated.response.status, 200, JSON.stringify(pinCreated.body))

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
