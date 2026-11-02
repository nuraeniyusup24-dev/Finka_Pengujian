import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('admin awal hanya dapat dibuat sekali di production pada database kosong', () => {
  const script = `
    import bcrypt from 'bcryptjs'
    import { db, initDb } from './src/db.js'
    import { createInitialAdmin } from './src/admin-provisioning.js'
    try {
      await initDb()
      const admin = await createInitialAdmin({
        nama: 'Admin Uji',
        username: 'admin.uji',
        password: 'passphrase-uji-minimal-14'
      })
      const row = await db.prepare('SELECT role, active, password_hash FROM users WHERE id = ?').get(admin.id)
      if (row.role !== 'admin' || row.active !== 1 || !await bcrypt.compare('passphrase-uji-minimal-14', row.password_hash)) {
        throw new Error('Admin atau hash password tidak sesuai.')
      }
      let secondAttemptRejected = false
      try {
        await createInitialAdmin({ nama: 'Admin Kedua', username: 'admin.kedua', password: 'passphrase-uji-minimal-14' })
      } catch {
        secondAttemptRejected = true
      }
      const count = await db.prepare('SELECT COUNT(*) AS count FROM users').get()
      console.log(JSON.stringify({ username: admin.username, count: Number(count.count), secondAttemptRejected }))
    } finally {
      await db.close()
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', DB_PATH: ':memory:', JWT_SECRET: 'test-secret' },
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"username":"admin\.uji"/)
  assert.match(result.stdout, /"count":1/)
  assert.match(result.stdout, /"secondAttemptRejected":true/)
})

test('admin awal ditolak di luar production', () => {
  const script = `
    import { db, initDb } from './src/db.js'
    import { createInitialAdmin } from './src/admin-provisioning.js'
    try {
      await initDb()
      await createInitialAdmin({ nama: 'Admin Uji', username: 'admin.uji', password: 'passphrase-uji-minimal-14' })
    } finally {
      await db.close()
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', DB_PATH: ':memory:' },
    encoding: 'utf8'
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /hanya diizinkan saat NODE_ENV=production/)
})

test('perintah provisioning di luar production tidak membuka atau membuat database', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-admin-provision-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const dbPath = join(directory, 'must-not-exist.db')
  const result = spawnSync(process.execPath, ['scripts/provision-admin.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'development', DB_PATH: dbPath },
    encoding: 'utf8'
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /set NODE_ENV=production/)
  assert.equal(existsSync(dbPath), false)
})
