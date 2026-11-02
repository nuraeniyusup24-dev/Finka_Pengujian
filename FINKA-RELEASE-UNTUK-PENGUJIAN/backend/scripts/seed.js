import 'dotenv/config'
import { ensureDemoData, initDb, db } from '../src/db.js'

try {
  await initDb()
  const created = await ensureDemoData()
  if (process.env.NODE_ENV === 'production') {
    console.log('Mode production: seed akun demo dinonaktifkan.')
  } else {
    if (!created) console.log('Database sudah berisi akun/data. Seed dilewati agar data tidak terhapus.')
    const rows = await db.prepare('SELECT role, username FROM users ORDER BY id').all()
    console.log('Akun tersedia:', rows)
  }
} finally {
  await db.close()
}
