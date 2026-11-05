import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Lapisan database Finka: SQLite bawaan Node (node:sqlite), tanpa server database
 * terpisah. File database dibuat otomatis di backend/data/finka.db, atau di lokasi
 * DB_PATH (mis. volume persisten saat deploy). DB_PATH=:memory: dipakai untuk tes.
 *
 * Antarmuka (prepare().get/all/run, transaction, exec) sengaja tetap async dan sama
 * seperti sebelumnya, sehingga seluruh route tidak perlu diubah.
 */
const BACKEND_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DB_PATH = process.env.DB_PATH || resolve(BACKEND_ROOT, 'data', 'finka.db')
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true })

const sqlite = new DatabaseSync(DB_PATH)
if (DB_PATH !== ':memory:') sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

// Semua timestamp disimpan sebagai teks ISO-8601 UTC ('2026-10-31T05:21:00.000Z'),
// sama seperti yang dulu dikirim API ke frontend, dan aman diurutkan/dibandingkan sebagai string.
const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"

function sqliteSql(sql) {
  return String(sql)
    .replace(/CURRENT_TIMESTAMP\s*([+-])\s*INTERVAL\s*'(\d+)\s+(second|minute|hour|day)s?'/gi,
      (_, sign, n, unit) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','${sign}${n} ${unit.toLowerCase()}s')`)
    .replace(/CURRENT_TIMESTAMP|datetime\('now'\)/gi, NOW_SQL)
}

function bindValue(value) {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  return value
}

// Pertahankan kode error SQLSTATE yang dicek aplikasi (mis. '23505' = pelanggaran UNIQUE).
const SQLSTATE = { 2067: '23505', 1555: '23505', 787: '23503', 275: '23514', 1299: '23502' }
function normalizeError(error) {
  if (error?.code === 'ERR_SQLITE_ERROR') {
    error.sqliteCode = error.errcode
    if (SQLSTATE[error.errcode]) error.code = SQLSTATE[error.errcode]
  }
  return error
}

const plain = (row) => (row ? { ...row } : row)

/**
 * SQLite memakai satu koneksi. Agar request yang berjalan bersamaan tidak saling
 * "masuk" ke transaksi orang lain, transaksi dijalankan satu per satu (BEGIN IMMEDIATE)
 * dan query di luar transaksi menunggu sampai transaksi aktif selesai. Karena itu
 * penguncian baris (SELECT ... FOR UPDATE) tidak diperlukan lagi.
 */
const txStorage = new AsyncLocalStorage()
let txTail = Promise.resolve()
let activeTx = null

async function untilIdle() {
  while (activeTx && !txStorage.getStore()) await activeTx
}

async function guarded(fn) {
  await untilIdle()
  try { return fn() } catch (error) { throw normalizeError(error) }
}

class Statement {
  constructor(sql) {
    this.sql = sqliteSql(sql)
    this.stmt = null
  }

  #prepared() {
    if (!this.stmt) this.stmt = sqlite.prepare(this.sql)
    return this.stmt
  }

  get(...params) {
    return guarded(() => plain(this.#prepared().get(...params.map(bindValue))))
  }

  all(...params) {
    return guarded(() => this.#prepared().all(...params.map(bindValue)).map(plain))
  }

  run(...params) {
    return guarded(() => {
      const result = this.#prepared().run(...params.map(bindValue))
      const changes = Number(result.changes)
      const isInsert = /^\s*INSERT\b/i.test(this.sql)
      return {
        changes,
        lastInsertRowid: isInsert && changes > 0 ? Number(result.lastInsertRowid) : null
      }
    })
  }
}

export const db = {
  prepare(sql) {
    return new Statement(sql)
  },

  transaction(fn) {
    return async (...args) => {
      if (txStorage.getStore()) return fn(...args) // transaksi bersarang bergabung ke yang aktif

      const previous = txTail
      let release
      const done = new Promise((resolveDone) => { release = resolveDone })
      txTail = previous.then(() => done)
      await previous
      activeTx = done
      try {
        sqlite.exec('BEGIN IMMEDIATE')
        try {
          const result = await txStorage.run(true, () => fn(...args))
          sqlite.exec('COMMIT')
          return result
        } catch (error) {
          try { sqlite.exec('ROLLBACK') } catch { /* transaksi sudah berakhir */ }
          throw error
        }
      } finally {
        activeTx = null
        release()
      }
    }
  },

  // DDL / skrip multi-statement. Tidak melalui penerjemah SQL di atas.
  exec(sql) {
    return guarded(() => sqlite.exec(sql))
  },

  async close() {
    await untilIdle()
    if (sqlite.isOpen) sqlite.close()
  }
}

const TS = `TEXT NOT NULL DEFAULT (${NOW_SQL})`
const ID = 'INTEGER PRIMARY KEY AUTOINCREMENT'

export async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${ID},
      role TEXT NOT NULL CHECK(role IN ('admin','ortu','pic','siswa')),
      nama TEXT NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,
      pin_hash TEXT,
      outlet TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at ${TS}
    );

    CREATE TABLE IF NOT EXISTS user_avatars (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      file_size INTEGER NOT NULL CHECK(file_size > 0),
      updated_at ${TS}
    );

    CREATE TABLE IF NOT EXISTS siswa_profil (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      ortu_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kelas TEXT,
      nis TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      hubungan TEXT,
      pekerjaan TEXT,
      no_hp TEXT,
      email TEXT,
      no_hp_verified_at TEXT,
      email_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS siswa_kontrol (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      limit_aktif INTEGER NOT NULL DEFAULT 0 CHECK(limit_aktif IN (0,1)),
      limit_harian INTEGER NOT NULL DEFAULT 25000 CHECK(limit_harian > 0),
      kartu_diblokir INTEGER NOT NULL DEFAULT 0 CHECK(kartu_diblokir IN (0,1)),
      qr_version INTEGER NOT NULL DEFAULT 1 CHECK(qr_version > 0),
      updated_at ${TS}
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id ${ID},
      siswa_id INTEGER NOT NULL REFERENCES users(id),
      tipe TEXT NOT NULL CHECK(tipe IN ('topup','pembelian','tarik_tunai','bayar_tagihan','penyesuaian')),
      nominal INTEGER NOT NULL,
      keterangan TEXT,
      ref_tabel TEXT,
      ref_id INTEGER,
      dibuat_oleh INTEGER REFERENCES users(id),
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_siswa ON ledger(siswa_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger(ref_tabel, ref_id);

    -- Metadata transaksi POS tidak mengubah ledger sebagai sumber saldo utama.
    CREATE TABLE IF NOT EXISTS pos_transaction_meta (
      ledger_id INTEGER PRIMARY KEY REFERENCES ledger(id),
      pic_id INTEGER NOT NULL REFERENCES users(id),
      outlet TEXT,
      tipe_asal TEXT NOT NULL CHECK(tipe_asal IN ('pembelian','tarik_tunai')),
      total INTEGER NOT NULL CHECK(total > 0),
      status TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif','dibatalkan')),
      alasan_batal TEXT,
      dibatalkan_oleh INTEGER REFERENCES users(id),
      reversal_ledger_id INTEGER REFERENCES ledger(id),
      dibatalkan_at TEXT,
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_pos_meta_pic_created ON pos_transaction_meta(pic_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS pos_cash_settings (
      pic_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      kas_awal INTEGER NOT NULL DEFAULT 0 CHECK(kas_awal >= 0),
      updated_at ${TS}
    );

    CREATE TABLE IF NOT EXISTS pos_cash_closeouts (
      id ${ID},
      pic_id INTEGER NOT NULL REFERENCES users(id),
      outlet TEXT,
      tanggal TEXT NOT NULL,
      kas_awal INTEGER NOT NULL CHECK(kas_awal >= 0),
      total_pembelian INTEGER NOT NULL DEFAULT 0 CHECK(total_pembelian >= 0),
      total_tarik_tunai INTEGER NOT NULL DEFAULT 0 CHECK(total_tarik_tunai >= 0),
      kas_estimasi INTEGER NOT NULL,
      kas_fisik INTEGER NOT NULL CHECK(kas_fisik >= 0),
      selisih INTEGER NOT NULL,
      dibuat_oleh INTEGER REFERENCES users(id),
      created_at ${TS},
      UNIQUE(pic_id, tanggal)
    );
    CREATE INDEX IF NOT EXISTS idx_pos_closeout_date ON pos_cash_closeouts(tanggal DESC);

    CREATE TABLE IF NOT EXISTS audit_log (
      id ${ID},
      aktor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      aksi TEXT NOT NULL,
      perubahan TEXT NOT NULL DEFAULT '',
      ip TEXT,
      ref_tabel TEXT,
      ref_id INTEGER,
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(aktor_id);

    -- Rate limit percobaan PIN per kombinasi PIC dan siswa, tersimpan di database
    -- agar tidak hilang saat proses backend restart.
    CREATE TABLE IF NOT EXISTS pos_pin_attempts (
      pic_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
      window_started_at ${TS},
      locked_until TEXT,
      PRIMARY KEY(pic_id, siswa_id)
    );

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id ${ID},
      kategori TEXT NOT NULL,
      judul TEXT NOT NULL,
      pesan TEXT NOT NULL,
      ref_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
      ON admin_notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS tagihan (
      id ${ID},
      siswa_id INTEGER NOT NULL REFERENCES users(id),
      nama TEXT NOT NULL,
      nominal INTEGER NOT NULL CHECK(nominal > 0),
      jatuh_tempo TEXT,
      status TEXT NOT NULL DEFAULT 'belum_bayar' CHECK(status IN ('belum_bayar','lunas','dibatalkan')),
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_tagihan_siswa ON tagihan(siswa_id);

    CREATE TABLE IF NOT EXISTS topup_request (
      id ${ID},
      siswa_id INTEGER NOT NULL REFERENCES users(id),
      ortu_id INTEGER NOT NULL REFERENCES users(id),
      nominal INTEGER NOT NULL CHECK(nominal > 0),
      kode_unik INTEGER NOT NULL,
      tagihan_id INTEGER REFERENCES tagihan(id),
      status TEXT NOT NULL DEFAULT 'menunggu' CHECK(status IN ('menunggu','disetujui','ditolak')),
      alasan_tolak TEXT,
      pernah_ditolak INTEGER NOT NULL DEFAULT 0 CHECK(pernah_ditolak IN (0,1)),
      created_at ${TS},
      diproses_oleh INTEGER REFERENCES users(id),
      diproses_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topup_status ON topup_request(status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_topup_siswa ON topup_request(siswa_id);

    CREATE TABLE IF NOT EXISTS topup_proof (
      topup_id INTEGER PRIMARY KEY REFERENCES topup_request(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      file_size INTEGER NOT NULL CHECK(file_size > 0),
      uploaded_at ${TS}
    );

    CREATE TABLE IF NOT EXISTS produk (
      id ${ID},
      nama TEXT NOT NULL,
      harga INTEGER NOT NULL CHECK(harga > 0),
      outlet TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_produk_outlet ON produk(outlet);

    CREATE TABLE IF NOT EXISTS qr_used (
      token_hash TEXT PRIMARY KEY,
      siswa_id INTEGER NOT NULL REFERENCES users(id),
      used_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_qr_used_time ON qr_used(used_at);

    -- Pemulihan PIN siswa oleh Orang Tua (OTP + token reset sekali pakai).
    CREATE TABLE IF NOT EXISTS pin_otp_challenges (
      id TEXT PRIMARY KEY,
      parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose = 'pin_reset'),
      channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
      otp_digest TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      expires_at TEXT NOT NULL,
      otp_used_at TEXT,
      locked_at TEXT,
      reset_token_digest TEXT,
      reset_expires_at TEXT,
      reset_used_at TEXT,
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_pin_otp_parent_student_created
      ON pin_otp_challenges(parent_id, student_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS pin_otp_rate_limits (
      parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
      window_started_at TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
      last_requested_at TEXT NOT NULL,
      PRIMARY KEY(parent_id, student_id, channel)
    );

    -- Pemulihan password (OTP + token reset sekali pakai).
    CREATE TABLE IF NOT EXISTS password_otp_challenges (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
      otp_digest TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      expires_at TEXT NOT NULL,
      otp_used_at TEXT,
      locked_at TEXT,
      reset_token_digest TEXT,
      reset_expires_at TEXT,
      reset_used_at TEXT,
      created_at ${TS}
    );
    CREATE INDEX IF NOT EXISTS idx_password_otp_user_created
      ON password_otp_challenges(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS password_otp_rate_limits (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
      window_started_at TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
      last_requested_at TEXT NOT NULL,
      PRIMARY KEY(user_id, channel)
    );

    INSERT INTO siswa_kontrol (user_id)
      SELECT id FROM users WHERE role = 'siswa'
      ON CONFLICT (user_id) DO NOTHING;
  `)

  const userColumns = await db.prepare('PRAGMA table_info(users)').all()
  if (!userColumns.some((column) => column.name === 'must_change_password')) {
    await db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1))')
  }
  if (!userColumns.some((column) => column.name === 'outlet_hours')) {
    await db.exec('ALTER TABLE users ADD COLUMN outlet_hours TEXT')
  }
  const productColumns = await db.prepare('PRAGMA table_info(produk)').all()
  if (!productColumns.some((column) => column.name === 'kategori')) {
    await db.exec('ALTER TABLE produk ADD COLUMN kategori TEXT')
  }
  if (!productColumns.some((column) => column.name === 'deskripsi')) {
    await db.exec('ALTER TABLE produk ADD COLUMN deskripsi TEXT')
  }

  await db.exec(`UPDATE users
    SET must_change_password = 1
    WHERE role = 'ortu'
      AND must_change_password = 0
      AND EXISTS (
        SELECT 1 FROM audit_log a
        WHERE a.aksi = 'BUAT_AKUN'
          AND a.ref_tabel = 'users'
          AND a.ref_id = users.id
          AND a.perubahan LIKE '%impor siswa'
      )
      AND NOT EXISTS (
        SELECT 1 FROM audit_log a
        WHERE a.ref_tabel = 'users'
          AND a.ref_id = users.id
          AND a.aksi IN ('GANTI_PASSWORD', 'RESET_PASSWORD_MANDIRI')
      )`)

  // Backfill transaksi POS lama supaya riwayat sebelum upgrade juga bisa dibatalkan
  // dan direkonsiliasi. Ledger tetap menjadi sumber saldo; tabel ini hanya metadata.
  await db.exec(`INSERT INTO pos_transaction_meta (ledger_id, pic_id, outlet, tipe_asal, total, created_at)
    SELECT l.id, l.dibuat_oleh, u.outlet, l.tipe, ABS(l.nominal), l.created_at
    FROM ledger l JOIN users u ON u.id = l.dibuat_oleh
    WHERE u.role = 'pic' AND l.tipe IN ('pembelian','tarik_tunai') AND l.nominal < 0
    ON CONFLICT (ledger_id) DO NOTHING;`)

  await db.prepare("UPDATE produk SET outlet = 'kantin_utama' WHERE lower(outlet) = 'kantin utama'").run()
  await db.prepare("UPDATE produk SET outlet = 'kantin_b' WHERE lower(outlet) IN ('kantin blok b', 'kantin b')").run()
  await db.prepare("UPDATE produk SET outlet = 'koperasi' WHERE lower(outlet) = 'koperasi sekolah'").run()
}

export const OUTLET = Object.freeze({
  KANTIN_UTAMA: 'kantin_utama',
  KANTIN_B: 'kantin_b',
  KOPERASI: 'koperasi'
})

export function namaOutlet(key) {
  return {
    [OUTLET.KANTIN_UTAMA]: 'Kantin Utama',
    [OUTLET.KANTIN_B]: 'Kantin Blok B',
    [OUTLET.KOPERASI]: 'Koperasi Sekolah'
  }[key] || key || ''
}

export async function saldoSiswa(siswaId) {
  const row = await db.prepare('SELECT COALESCE(SUM(nominal), 0) AS saldo FROM ledger WHERE siswa_id = ?').get(siswaId)
  return Number(row?.saldo || 0)
}

export async function ensureDemoData() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Pembuatan akun demo dilewati karena NODE_ENV=production.')
    return false
  }

  const totalUsers = (await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n
  if (Number(totalUsers) > 0) return false

  const hash = (s) => bcrypt.hashSync(s, 10)
  const tx = await db.transaction(async () => {
    const insertUser = db.prepare(`INSERT INTO users (role, nama, username, password_hash, pin_hash) VALUES (?, ?, ?, ?, ?)`)
    const insertPic = db.prepare(`INSERT INTO users (role, nama, username, password_hash, pin_hash, outlet) VALUES (?, ?, ?, ?, ?, ?)`)
    const admin = await insertUser.run('admin', 'Admin Yayasan', 'admin', hash('admin123'), null)
    const ortu = await insertUser.run('ortu', 'Ibu Sari', 'ortu.sari', hash('ortu123'), null)
    await insertPic.run('pic', 'PIC Kantin Utama', 'pic.kantin.utama', hash('pic123'), null, OUTLET.KANTIN_UTAMA)
    await insertPic.run('pic', 'PIC Kantin Blok B', 'pic.kantin.b', hash('pic123'), null, OUTLET.KANTIN_B)
    await insertPic.run('pic', 'PIC Koperasi Sekolah', 'pic.koperasi', hash('pic123'), null, OUTLET.KOPERASI)
    const aditya = await insertUser.run('siswa', 'Aditya Pratama', 'aditya.p', hash('siswa123'), hash('135790'))
    const kayla = await insertUser.run('siswa', 'Kayla Pratama', 'kayla.p', hash('siswa123'), hash('135790'))

    const insertProfil = db.prepare('INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis) VALUES (?, ?, ?, ?)')
    await insertProfil.run(aditya.lastInsertRowid, ortu.lastInsertRowid, '7B', '24071023')
    await insertProfil.run(kayla.lastInsertRowid, ortu.lastInsertRowid, '4A', '24040518')

    const insertTagihan = db.prepare(`INSERT INTO tagihan (siswa_id, nama, nominal, jatuh_tempo) VALUES (?, ?, ?, ?)`)
    await insertTagihan.run(aditya.lastInsertRowid, 'SPP September 2026', 450000, '2026-09-10')
    await insertTagihan.run(kayla.lastInsertRowid, 'SPP September 2026', 400000, '2026-09-10')

    const insertProduk = db.prepare('INSERT INTO produk (nama, harga, outlet) VALUES (?, ?, ?)')
    for (const product of [
      ['Paket A — nasi + ayam + teh', 15000, OUTLET.KANTIN_UTAMA],
      ['Paket B — nasi + telur + teh', 12000, OUTLET.KANTIN_UTAMA],
      ['Mie ayam', 13000, OUTLET.KANTIN_UTAMA],
      ['Air mineral 600 ml', 4000, OUTLET.KANTIN_UTAMA],
      ['Buku tulis 38 lbr', 5000, OUTLET.KOPERASI]
    ]) await insertProduk.run(...product)

    return { adminId: admin.lastInsertRowid }
  })

  await tx()
  console.log('Database kosong → akun demo dibuat otomatis.')
  return true
}
