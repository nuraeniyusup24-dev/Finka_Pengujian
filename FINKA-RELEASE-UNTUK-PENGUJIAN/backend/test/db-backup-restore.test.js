import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const backendPath = new URL('..', import.meta.url)

function runNode(args, dbPath) {
  return spawnSync(process.execPath, args, {
    cwd: backendPath,
    env: { ...process.env, NODE_ENV: 'production', DB_PATH: dbPath },
    encoding: 'utf8'
  })
}

test('backup konsisten dapat dipulihkan ke file SQLite baru dan tervalidasi', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-db-restore-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, 'source.db')
  const backup = join(directory, 'backup.db')
  const restored = join(directory, 'restored.db')
  const createDatabase = `
    import { db, initDb } from './src/db.js'
    try {
      await initDb()
      const user = await db.prepare("INSERT INTO users (role, nama, username) VALUES ('admin', 'Admin Backup', 'admin.backup')").run()
      await db.prepare("INSERT INTO ledger (siswa_id, tipe, nominal) VALUES (?, 'penyesuaian', 12345)").run(user.lastInsertRowid)
    } finally {
      await db.close()
    }
  `
  const initialized = runNode(['--input-type=module', '-e', createDatabase], source)
  assert.equal(initialized.status, 0, initialized.stderr)

  const backedUp = runNode(['scripts/db-backup.js', backup], source)
  assert.equal(backedUp.status, 0, backedUp.stderr)

  const restoredResult = runNode(['scripts/db-restore.js', backup, restored], source)
  assert.equal(restoredResult.status, 0, restoredResult.stderr)

  const verify = `
    import { DatabaseSync } from 'node:sqlite'
    const database = new DatabaseSync(process.env.DB_PATH, { readOnly: true })
    try {
      const user = database.prepare("SELECT username FROM users WHERE role = 'admin'").get()
      const ledger = database.prepare('SELECT nominal FROM ledger').get()
      console.log(JSON.stringify({ username: user?.username, nominal: ledger?.nominal }))
    } finally {
      database.close()
    }
  `
  const verified = runNode(['--input-type=module', '-e', verify], restored)
  assert.equal(verified.status, 0, verified.stderr)
  assert.match(verified.stdout, /"username":"admin\.backup"/)
  assert.match(verified.stdout, /"nominal":12345/)
})

test('restore menolak path database aktif dan tidak menimpa file', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'finka-db-restore-guard-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, 'source.db')
  const backup = join(directory, 'backup.db')
  const initialized = runNode(['--input-type=module', '-e', `
    import { db, initDb } from './src/db.js'
    try { await initDb() } finally { await db.close() }
  `], source)
  assert.equal(initialized.status, 0, initialized.stderr)
  assert.equal(runNode(['scripts/db-backup.js', backup], source).status, 0)

  const activeRestore = runNode(['scripts/db-restore.js', backup, source], source)
  assert.notEqual(activeRestore.status, 0)
  assert.match(activeRestore.stderr, /database aktif ditolak/)

  const existing = join(directory, 'existing.db')
  const restored = runNode(['scripts/db-restore.js', backup, existing], source)
  assert.equal(restored.status, 0, restored.stderr)
  const overwrite = runNode(['scripts/db-restore.js', backup, existing], source)
  assert.notEqual(overwrite.status, 0)
  assert.match(overwrite.stderr, /sudah ada/)
})
