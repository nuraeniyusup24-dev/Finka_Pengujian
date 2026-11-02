import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKEND_ROOT = fileURLToPath(new URL('..', import.meta.url))
const configuredPath = process.env.DB_PATH || resolve(BACKEND_ROOT, 'data', 'finka.db')
const activePath = configuredPath === ':memory:' ? null : resolve(configuredPath)
const backupPath = process.argv[2] ? resolve(process.argv[2]) : null
const restoredPath = process.argv[3] ? resolve(process.argv[3]) : null
let restoredCreated = false

function validateDatabase(path) {
  const database = new DatabaseSync(path, { readOnly: true })
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get()
    if (integrity?.integrity_check !== 'ok') throw new Error('Pemeriksaan integritas SQLite gagal.')
    if (database.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('Database memiliki pelanggaran foreign key.')
    }
  } finally {
    database.close()
  }
}

try {
  if (!backupPath || !restoredPath) {
    throw new Error('Penggunaan: node scripts/db-restore.js <file-backup> <path-database-baru>')
  }
  if (!existsSync(backupPath) || !statSync(backupPath).isFile()) throw new Error('File backup tidak ditemukan.')
  if (backupPath.toLowerCase() === restoredPath.toLowerCase()) throw new Error('File tujuan tidak boleh sama dengan file backup.')
  if (activePath && activePath.toLowerCase() === restoredPath.toLowerCase()) {
    throw new Error('Restore ke database aktif ditolak; gunakan path baru dan lakukan cutover saat layanan berhenti.')
  }
  if (existsSync(restoredPath) || existsSync(`${restoredPath}-wal`) || existsSync(`${restoredPath}-shm`)) {
    throw new Error('Path tujuan atau file sidecar SQLite sudah ada; pilih path baru.')
  }

  validateDatabase(backupPath)
  mkdirSync(dirname(restoredPath), { recursive: true })
  copyFileSync(backupPath, restoredPath, constants.COPYFILE_EXCL)
  restoredCreated = true
  validateDatabase(restoredPath)
  console.log(`Restore berhasil dan tervalidasi pada file baru: ${restoredPath}`)
} catch (error) {
  console.error(`Restore gagal: ${error.message}`)
  process.exitCode = 1
} finally {
  if (process.exitCode && restoredCreated && restoredPath && existsSync(restoredPath)) rmSync(restoredPath)
}
