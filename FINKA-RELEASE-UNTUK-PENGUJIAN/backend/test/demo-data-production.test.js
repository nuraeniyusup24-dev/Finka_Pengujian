import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('database production tidak membuat akun demo saat kosong', () => {
  const script = `
    const { db, initDb, ensureDemoData } = await import('./src/db.js')
    try {
      await initDb()
      const created = await ensureDemoData()
      const users = await db.prepare('SELECT COUNT(*) AS count FROM users').get()
      console.log(JSON.stringify({ created, users: Number(users.count) }))
    } finally {
      await db.close()
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', DB_PATH: ':memory:' },
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"created":false/)
  assert.match(result.stdout, /"users":0/)
})
