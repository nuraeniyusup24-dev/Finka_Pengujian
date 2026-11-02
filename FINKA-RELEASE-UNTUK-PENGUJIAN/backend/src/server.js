import 'dotenv/config'
/**
 * Entry point backend Finka.
 * Tugas file ini hanya menyiapkan Express, middleware umum, dan mendaftarkan route.
 * Logika bisnis disimpan di folder routes agar lebih mudah dicari dan diuji.
 */
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { siswaRouter } from './routes/siswa.js'
import { topupRouter } from './routes/topup.js'
import { tagihanRouter } from './routes/tagihan.js'
import { posRouter } from './routes/pos.js'
import { ortuRouter } from './routes/ortu.js'
import { adminRouter } from './routes/admin.js'
import { laporanRouter } from './routes/laporan.js'
import { configRouter } from './routes/config.js'
import { initDb, ensureDemoData, db } from './db.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const app = express()
// Browser hanya boleh mengakses API dari origin yang secara eksplisit diizinkan.
// Request non-browser tanpa Origin (mis. healthcheck/CLI) tetap dapat digunakan.
const allowedOrigins = new Set(
  String(process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
)
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(Object.assign(new Error('Origin tidak diizinkan oleh kebijakan CORS'), { status: 403 }))
  }
}))
app.use(express.json({ limit: '7mb' }))

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/siswa', siswaRouter)
app.use('/api/topup', topupRouter)
app.use('/api/tagihan', tagihanRouter)
app.use('/api/pos', posRouter)
app.use('/api/ortu', ortuRouter)
app.use('/api/admin', adminRouter)
app.use('/api/admin/laporan', laporanRouter)
app.use('/api/config', configRouter)

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  const status = Number(err.status) >= 400 && Number(err.status) < 500 ? Number(err.status) : 500
  res.status(status).json({ error: status === 413 ? 'Ukuran bukti transfer melebihi batas.' : 'Terjadi kesalahan di server' })
})

export async function startServer(port = process.env.PORT || 3001) {
  await initDb()
  if (process.env.NODE_ENV === 'production') {
    console.log('Mode production: akun demo tidak dibuat.')
  } else {
    await ensureDemoData()
  }
  const server = app.listen(port)
  server.once('listening', () => console.log(`Finka API jalan di http://localhost:${server.address().port}`))
  return server
}

function configureGracefulShutdown(server) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await db.close()
        process.exit(0)
      })
    })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const server = await startServer()
    configureGracefulShutdown(server)
  } catch (error) {
    console.error('Gagal menyiapkan database:', error)
    await db.close()
    process.exit(1)
  }
}
