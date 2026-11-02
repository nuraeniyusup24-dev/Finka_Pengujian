import 'dotenv/config'
import { db, initDb } from '../src/db.js'

// Seluruh tabel kini dibuat otomatis oleh initDb(); skrip ini dipertahankan hanya agar
// perintah lama tetap berjalan (idempoten).
try {
  await initDb()
  console.log('Schema sudah mutakhir.')
} finally {
  await db.close()
}
