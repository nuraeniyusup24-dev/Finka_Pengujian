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

test('Blokir kartu: siswa bisa memblokir dan mengaktifkan kembali, tetapi tidak bisa membuka blokir orang tua', { timeout: 30000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-kartu-blokir-'))
  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = join(directory, 'kartu-blokir-test.db')
  process.env.JWT_SECRET = 'kartu-blokir-jwt-secret'
  process.env.PIN_OTP_SECRET = 'kartu-blokir-pin-otp-secret'
  const { db, initDb, ensureDemoData } = await import('../src/db.js')
  const { startServer } = await import('../src/server.js')
  await initDb()
  await ensureDemoData()
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

  const aditya = await db.prepare("SELECT id FROM users WHERE username = 'aditya.p'").get()
  const siswa = await login(baseUrl, 'aditya.p', 'siswa123')
  const kayla = await login(baseUrl, 'kayla.p', 'siswa123')
  const ortu = await login(baseUrl, 'ortu.sari', 'ortu123')
  const kontrol = (token) => api(baseUrl, token, '/api/siswa/saya/kontrol')
  const post = (token, path) => api(baseUrl, token, path, { method: 'POST', body: '{}' })

  // Awal: kartu aktif
  let state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir, false)
  assert.equal(state.body.kartu_diblokir_oleh, null)
  assert.equal(state.body.bisa_buka_blokir, false)

  // Mengaktifkan kartu yang memang sudah aktif aman dan idempotent
  let buka = await post(siswa, '/api/siswa/saya/kartu/buka-blokir')
  assert.equal(buka.response.status, 200)
  assert.equal(buka.body.kartu_diblokir, false)

  // Siswa memblokir kartunya sendiri -> boleh dibuka kembali
  const blokir = await post(siswa, '/api/siswa/saya/kartu/blokir')
  assert.equal(blokir.response.status, 200)
  assert.equal(blokir.body.kartu_diblokir, true)
  assert.equal(blokir.body.kartu_diblokir_oleh, 'siswa')
  assert.equal(blokir.body.bisa_buka_blokir, true)
  state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir, true)
  assert.equal(state.body.bisa_buka_blokir, true)

  // Orang tua melihat siapa yang memblokir
  const kontrolOrtu = await api(baseUrl, ortu, `/api/ortu/anak/${aditya.id}/kontrol`)
  assert.equal(kontrolOrtu.body.kartu_diblokir, true)
  assert.equal(kontrolOrtu.body.kartu_diblokir_oleh, 'siswa')

  // Siswa lain tidak berpengaruh
  assert.equal((await kontrol(kayla)).body.kartu_diblokir, false)

  // Siswa mengaktifkan kembali -> aktif, dan dobel tap tidak error
  buka = await post(siswa, '/api/siswa/saya/kartu/buka-blokir')
  assert.equal(buka.response.status, 200)
  assert.equal(buka.body.kartu_diblokir, false)
  assert.equal((await post(siswa, '/api/siswa/saya/kartu/buka-blokir')).response.status, 200)
  state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir, false)
  assert.equal(state.body.kartu_diblokir_oleh, null)

  // Orang tua memblokir -> siswa TIDAK boleh membukanya
  const blokirOrtu = await api(baseUrl, ortu, `/api/ortu/anak/${aditya.id}/kontrol`, {
    method: 'PUT',
    body: JSON.stringify({ kartu_diblokir: true })
  })
  assert.equal(blokirOrtu.response.status, 200)
  assert.equal(blokirOrtu.body.kartu_diblokir_oleh, 'ortu')
  const ditolak = await post(siswa, '/api/siswa/saya/kartu/buka-blokir')
  assert.equal(ditolak.response.status, 403)
  state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir, true)
  assert.equal(state.body.kartu_diblokir_oleh, 'ortu')
  assert.equal(state.body.bisa_buka_blokir, false)

  // Siswa menekan blokir saat sudah diblokir orang tua -> tidak bisa "mengambil alih"
  const ambilAlih = await post(siswa, '/api/siswa/saya/kartu/blokir')
  assert.equal(ambilAlih.response.status, 200)
  assert.equal(ambilAlih.body.kartu_diblokir_oleh, 'ortu')
  assert.equal((await post(siswa, '/api/siswa/saya/kartu/buka-blokir')).response.status, 403)

  // Mengubah limit saja tidak mengubah pencatat blokir
  const ubahLimit = await api(baseUrl, ortu, `/api/ortu/anak/${aditya.id}/kontrol`, {
    method: 'PUT',
    body: JSON.stringify({ limit_aktif: true, limit: 35000 })
  })
  assert.equal(ubahLimit.body.kartu_diblokir, true)
  assert.equal(ubahLimit.body.kartu_diblokir_oleh, 'ortu')

  // Blokir lama tanpa pencatat (data sebelum upgrade) dianggap blokir orang tua
  await db.prepare('UPDATE siswa_kontrol SET kartu_diblokir = 1, kartu_diblokir_oleh = NULL WHERE user_id = ?').run(aditya.id)
  state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir_oleh, 'ortu')
  assert.equal((await post(siswa, '/api/siswa/saya/kartu/buka-blokir')).response.status, 403)

  // Orang tua membuka blokir -> aktif, pencatat kosong
  const bukaOrtu = await api(baseUrl, ortu, `/api/ortu/anak/${aditya.id}/kontrol`, {
    method: 'PUT',
    body: JSON.stringify({ kartu_diblokir: false })
  })
  assert.equal(bukaOrtu.body.kartu_diblokir, false)
  assert.equal(bukaOrtu.body.kartu_diblokir_oleh, null)
  state = await kontrol(siswa)
  assert.equal(state.body.kartu_diblokir, false)

  // Hanya siswa yang boleh memakai endpoint siswa
  assert.equal((await post(ortu, '/api/siswa/saya/kartu/buka-blokir')).response.status, 403)

  // Semua aksi tercatat di audit log
  const aksi = (await db.prepare("SELECT aksi FROM audit_log WHERE aksi IN ('BLOKIR_KARTU_SISWA','BUKA_BLOKIR_KARTU_SISWA')").all()).map(r => r.aksi)
  assert.ok(aksi.includes('BLOKIR_KARTU_SISWA'))
  assert.ok(aksi.includes('BUKA_BLOKIR_KARTU_SISWA'))
})
