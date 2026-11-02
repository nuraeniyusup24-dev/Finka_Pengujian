import 'dotenv/config'
import { db, initDb, ensureDemoData } from '../src/db.js'

try {
  await initDb()
  const demoCreated = await ensureDemoData()
  if (process.env.NODE_ENV === 'production') {
    console.log('Mode production: akun demo tidak dibuat.')
  } else if (!demoCreated) {
    console.log('Database sudah berisi akun; seed demo dilewati.')
  }
  console.log('Database SQLite siap.')
} finally {
  await db.close()
}
