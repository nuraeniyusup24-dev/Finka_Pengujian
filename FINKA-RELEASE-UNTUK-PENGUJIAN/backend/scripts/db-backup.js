import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { chmodSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKEND_ROOT = fileURLToPath(new URL('..', import.meta.url))
const configuredPath = process.env.DB_PATH || resolve(BACKEND_ROOT, 'data', 'finka.db')
const sourcePath = configuredPath === ':memory:' ? null : resolve(configuredPath)
const backupPath = process.argv[2] ? resolve(process.argv[2]) : null
let source
let backupCreated = false

function quoteSqlString(value) {
  return `'${value.replace(/'/g, "''")}'`
}

function validateDatabase(path) {
  const database = new DatabaseSync(path, { readOnly: true })
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get()
    if (integrity?.integrity_check !== 'ok') throw new Error('Pemeriksaan integritas SQLite gagal.')
    if (database.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('Backup memiliki pelanggaran foreign key.')
    }
  } finally {
    database.close()
  }
}

try {
  if (!sourcePath) throw new Error('Backup tidak dapat dibuat dari DB_PATH=:memory:.')
  if (!backupPath) throw new Error('Berikan path file tujuan backup.')
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) throw new Error('File database sumber tidak ditemukan.')
  if (sourcePath.toLowerCase() === backupPath.toLowerCase()) throw new Error('Path backup tidak boleh sama dengan database aktif.')
  if (existsSync(backupPath)) throw new Error('File backup sudah ada; gunakan nama file baru agar backup lama tidak tertimpa.')

  mkdirSync(dirname(backupPath), { recursive: true })
  source = new DatabaseSync(sourcePath)
  source.exec('PRAGMA busy_timeout = 5000;')
  source.exec(`VACUUM INTO ${quoteSqlString(backupPath)};`)
  backupCreated = true
  try { chmodSync(backupPath, 0o600) } catch (error) {
    if (process.platform !== 'win32') throw error
  }
  validateDatabase(backupPath)
  console.log(`Backup SQLite berhasil dibuat dan tervalidasi: ${backupPath}`)
} catch (error) {
  console.error(`Backup gagal: ${error.message}`)
  process.exitCode = 1
} finally {
  if (source?.isOpen) source.close()
  if (process.exitCode && backupCreated && backupPath && existsSync(backupPath)) rmSync(backupPath)
}
