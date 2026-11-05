/**
 * Route transaksi POS untuk PIC/outlet.
 * Semua transaksi tetap divalidasi di server. Frontend hanya mengirim
 * pilihan produk, jumlah, dan PIN sesuai alur UI.
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, saldoSiswa, OUTLET, namaOutlet } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'
import { audit } from '../audit.js'

export const posRouter = Router()

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'dev-qr-secret-ganti-saat-produksi'
function verifikasiQrToken(token) {
  try {
    const payload = jwt.verify(String(token || ''), QR_SECRET)
    if (payload.type !== 'finka_student_qr' || !payload.siswa_id) return null
    return payload
  } catch { return null }
}

async function kontrolSiswa(siswaId) {
  return await db.prepare('SELECT limit_aktif, limit_harian, kartu_diblokir, qr_version FROM siswa_kontrol WHERE user_id = ?').get(siswaId) || {
    limit_aktif: false, limit_harian: 25000, kartu_diblokir: false, qr_version: 1
  }
}

async function cekBatasBelanja(siswaId, nominal) {
  const kontrol = await kontrolSiswa(siswaId)
  if (kontrol.kartu_diblokir) throw { code: 403, msg: 'Kartu siswa sedang diblokir' }
  if (!kontrol.limit_aktif) return
  const row = await db.prepare(`SELECT COALESCE(SUM(-nominal), 0) AS total FROM ledger
    WHERE siswa_id = ? AND tipe IN ('pembelian', 'tarik_tunai')
    AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now','+7 hours'), '-7 hours')`).get(siswaId)
  if (Number(row?.total || 0) + nominal > Number(kontrol.limit_harian)) throw { code: 402, msg: 'Limit belanja harian tidak mencukupi' }
}

// QR kartu siswa tetap per versi kartu; rotasi oleh Orang Tua membatalkan token lama.
posRouter.get('/qr', wajibLogin, wajibRole('siswa'), async (req, res) => {
  const siswa = await db.prepare(`SELECT u.id, u.nama, sp.kelas, sp.nis FROM users u LEFT JOIN siswa_profil sp ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'siswa' AND u.active = 1`).get(req.user.id)
  if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' })
  const control = await kontrolSiswa(siswa.id)
  if (control.kartu_diblokir) return res.status(403).json({ error: 'Kartu siswa sedang diblokir' })
  const token = jwt.sign(
    { type: 'finka_student_qr', siswa_id: Number(siswa.id), qr_version: Number(control.qr_version || 1) },
    QR_SECRET,
    { algorithm: 'HS256', noTimestamp: true }
  )
  res.json({ token, siswa: { id: siswa.id, nama: siswa.nama, kelas: siswa.kelas, nis: siswa.nis } })
})

posRouter.post('/qr/resolve', wajibLogin, wajibRole('pic'), async (req, res) => {
  const token = req.body && req.body.token
  const payload = verifikasiQrToken(token)
  if (!payload) return res.status(401).json({ error: 'QR kedaluwarsa atau tidak valid' })
  const control = await kontrolSiswa(payload.siswa_id)
  if (control.kartu_diblokir) return res.status(403).json({ error: 'Kartu siswa sedang diblokir' })
  if (Number(payload.qr_version || 1) !== Number(control.qr_version || 1)) return res.status(401).json({ error: 'QR kartu tidak berlaku. Gunakan QR kartu yang valid.' })
  const siswa = await db.prepare(`SELECT u.id, u.nama, sp.kelas, sp.nis FROM users u LEFT JOIN siswa_profil sp ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'siswa' AND u.active = 1`).get(Number(payload.siswa_id))
  if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan atau tidak aktif' })
  res.json({ ok: true, token, siswa: { ...siswa, saldo: await saldoSiswa(siswa.id) } })
})

async function validasiQrUntukTransaksi(token, siswaId) {
  const payload = verifikasiQrToken(token)
  if (!payload || Number(payload.siswa_id) !== Number(siswaId)) throw { code: 401, msg: 'QR tidak valid atau bukan milik siswa ini' }
  const control = await kontrolSiswa(siswaId)
  if (control.kartu_diblokir) throw { code: 403, msg: 'Kartu siswa sedang diblokir' }
  if (Number(payload.qr_version || 1) !== Number(control.qr_version || 1)) throw { code: 401, msg: 'QR kartu tidak berlaku. Gunakan QR kartu yang valid.' }
  const siswa = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'siswa' AND active = 1").get(siswaId)
  if (!siswa) throw { code: 404, msg: 'Akun siswa tidak ditemukan atau tidak aktif' }
}


function outletPic(req) {
  return req.user && req.user.role === 'pic' ? req.user.outlet : null
}

posRouter.get('/produk', wajibLogin, async (req, res) => {
  if (!['admin', 'pic'].includes(req.user.role)) return res.status(403).json({ error: 'Tidak punya akses' })
  const outlet = outletPic(req)
  const rows = outlet
    ? await db.prepare('SELECT id, nama, harga, outlet, kategori, deskripsi FROM produk WHERE outlet = ? ORDER BY id ASC').all(outlet)
    : await db.prepare('SELECT id, nama, harga, outlet, kategori, deskripsi FROM produk ORDER BY id ASC').all()
  const produk = rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    ket: r.deskripsi || namaOutlet(r.outlet) || r.outlet || '',
    harga: r.harga,
    outlet: r.outlet,
    tile: (r.nama || '?').trim().charAt(0).toUpperCase(),
    kategori: r.kategori || namaOutlet(r.outlet) || r.outlet || '',
    stok: null
  }))
  res.json({ produk, outlet: outlet || null })
})

posRouter.post('/produk', wajibLogin, wajibRole('admin', 'pic'), async (req, res) => {
  const { nama, harga, outlet, kategori, deskripsi } = req.body || {}
  const nominal = Number(harga)
  const targetOutlet = req.user.role === 'pic' ? req.user.outlet : outlet
  const productName = String(nama || '').trim()
  const category = String(kategori || '').trim()
  const description = String(deskripsi || '').trim()
  if (!productName || productName.length > 120 || !Number.isInteger(nominal) || nominal <= 0 ||
      category.length > 40 || description.length > 120) {
    return res.status(400).json({ error: 'Nama produk dan harga (>0) wajib diisi' })
  }
  const registeredPicOutlet = req.user.role === 'admin' && targetOutlet
    ? await db.prepare("SELECT id FROM users WHERE role = 'pic' AND outlet = ? LIMIT 1").get(String(targetOutlet).trim())
    : null
  const outletValid = req.user.role === 'pic'
    ? Boolean(String(targetOutlet || '').trim())
    : Object.values(OUTLET).includes(targetOutlet) || Boolean(registeredPicOutlet)
  if (!outletValid) {
    return res.status(400).json({ error: 'Outlet produk tidak valid' })
  }
  const info = await db.prepare('INSERT INTO produk (nama, harga, outlet, kategori, deskripsi) VALUES (?, ?, ?, ?, ?)')
    .run(productName, nominal, String(targetOutlet).trim(), category || null, description || null)
  const produk = await db.prepare('SELECT id, nama, harga, outlet, kategori, deskripsi FROM produk WHERE id = ?').get(info.lastInsertRowid)
  await audit(req, 'BUAT_PRODUK', `${produk.nama} · Rp ${produk.harga.toLocaleString('id-ID')} · ${namaOutlet(produk.outlet)}`, 'produk', Number(produk.id))
  res.status(201).json({ message: 'Produk berhasil ditambahkan', produk })
})

posRouter.put('/produk/:id', wajibLogin, wajibRole('admin', 'pic'), async (req, res) => {
  const id = Number(req.params.id)
  const nama = String(req.body?.nama || '').trim()
  const harga = Number(req.body?.harga)
  const kategori = String(req.body?.kategori || '').trim()
  const deskripsi = String(req.body?.deskripsi || '').trim()
  if (!Number.isInteger(id) || id <= 0 || !nama || nama.length > 120 || !Number.isInteger(harga) || harga <= 0 ||
      kategori.length > 40 || deskripsi.length > 120) {
    return res.status(400).json({ error: 'ID, nama produk, dan harga valid wajib diisi' })
  }
  const product = await db.prepare('SELECT id, outlet FROM produk WHERE id = ?').get(id)
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' })
  if (req.user.role === 'pic' && product.outlet !== req.user.outlet) return res.status(403).json({ error: 'Produk bukan milik outlet akun PIC ini' })
  await db.prepare('UPDATE produk SET nama = ?, harga = ?, kategori = ?, deskripsi = ? WHERE id = ?')
    .run(nama, harga, kategori || null, deskripsi || null, id)
  await audit(req, 'UBAH_PRODUK', `Produk #${id} diperbarui`, 'produk', id)
  const updated = await db.prepare('SELECT id, nama, harga, outlet, kategori, deskripsi FROM produk WHERE id = ?').get(id)
  res.json({ message: 'Produk berhasil diperbarui', produk: updated })
})

posRouter.delete('/produk/:id', wajibLogin, wajibRole('admin', 'pic'), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID produk tidak valid' })
  const product = await db.prepare('SELECT id, nama, outlet FROM produk WHERE id = ?').get(id)
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' })
  if (req.user.role === 'pic' && product.outlet !== req.user.outlet) return res.status(403).json({ error: 'Produk bukan milik outlet akun PIC ini' })
  await db.prepare('DELETE FROM produk WHERE id = ?').run(id)
  await audit(req, 'HAPUS_PRODUK', `Produk #${id} dihapus`, 'produk', id)
  res.json({ message: 'Produk berhasil dihapus' })
})

posRouter.get('/riwayat-hari-ini', wajibLogin, wajibRole('pic'), async (req, res) => {
  const rows = await db.prepare(`SELECT l.id, l.siswa_id, s.nama AS siswa_nama,
      sp.kelas, l.tipe, l.nominal, l.keterangan, l.created_at
    FROM ledger l
    JOIN users s ON s.id = l.siswa_id
    LEFT JOIN siswa_profil sp ON sp.user_id = s.id
    WHERE l.dibuat_oleh = ? AND l.tipe IN ('pembelian', 'tarik_tunai')
      AND l.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now','+7 hours'), '-7 hours')
    ORDER BY l.id DESC
    LIMIT 100`).all(req.user.id)
  res.json({ riwayat: rows })
})


async function pinCocok(siswaId, pin) {
  const user = await db.prepare("SELECT pin_hash FROM users WHERE id = ? AND role = 'siswa' AND active = 1").get(siswaId)
  if (!user || !user.pin_hash) return false
  return bcrypt.compareSync(String(pin), user.pin_hash)
}

async function pinTerkunci(picId, siswaId) {
  const row = await db.prepare(`SELECT locked_until > CURRENT_TIMESTAMP AS terkunci
    FROM pos_pin_attempts WHERE pic_id = ? AND siswa_id = ?`).get(picId, siswaId)
  return row?.terkunci === true || row?.terkunci === 1
}

async function catatPinGagal(picId, siswaId) {
  await db.transaction(async () => {
    await db.prepare(`INSERT INTO pos_pin_attempts (pic_id, siswa_id, attempts, window_started_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP) ON CONFLICT (pic_id, siswa_id) DO NOTHING`).run(picId, siswaId)
    const row = await db.prepare('SELECT attempts, window_started_at, locked_until FROM pos_pin_attempts WHERE pic_id = ? AND siswa_id = ?').get(picId, siswaId)
    const expiredWindow = !row.window_started_at || (Date.now() - new Date(row.window_started_at).getTime()) >= 15 * 60 * 1000
    const attempts = expiredWindow ? 1 : Number(row.attempts || 0) + 1
    const locked = attempts >= 5
    await db.prepare(`UPDATE pos_pin_attempts SET attempts = ?, window_started_at = ?,
      locked_until = CASE WHEN ? THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE NULL END
      WHERE pic_id = ? AND siswa_id = ?`).run(
      attempts, expiredWindow ? new Date() : row.window_started_at, locked, picId, siswaId
    )
  })()
}

async function hapusPinGagal(picId, siswaId) {
  await db.prepare('DELETE FROM pos_pin_attempts WHERE pic_id = ? AND siswa_id = ?').run(picId, siswaId)
}

// Dipakai layar PIN di app PIC untuk feedback cepat "PIN salah" — TIDAK
// memindahkan uang. Endpoint transaksi/tarik-tunai di bawah selalu cek
// ulang PIN sendiri sebelum benar-benar menulis ledger, jadi klien tidak
// bisa melewati pengecekan hanya dengan tidak memanggil endpoint ini.
posRouter.post('/verifikasi-pin', wajibLogin, wajibRole('pic'), async (req, res) => {
  const siswaId = Number(req.body?.siswa_id)
  const pin = String(req.body?.pin || '')
  if (!Number.isSafeInteger(siswaId) || siswaId <= 0 || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'ID siswa dan PIN 6 digit wajib diisi dengan benar' })
  }
  if (await pinTerkunci(req.user.id, siswaId)) return res.status(429).json({ error: 'Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.' })
  const cocok = await pinCocok(siswaId, pin)
  if (!cocok) {
    await catatPinGagal(req.user.id, siswaId)
    return res.json({ cocok: false })
  }
  await hapusPinGagal(req.user.id, siswaId)
  res.json({ cocok: true })
})

posRouter.post('/transaksi', wajibLogin, wajibRole('pic'), async (req, res) => {
  const { siswa_id, pin, items, qr_token } = req.body || {}
  const siswaId = Number(siswa_id)
  if (!Number.isSafeInteger(siswaId) || siswaId <= 0 || !/^\d{6}$/.test(String(pin || '')) ||
      typeof qr_token !== 'string' || qr_token.length > 4096 || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'siswa_id, PIN 6 digit, QR valid, dan 1–50 item wajib diisi dengan benar' })
  }
  if (await pinTerkunci(req.user.id, siswaId)) return res.status(429).json({ error: 'Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.' })
  if (!await pinCocok(siswaId, pin)) {
    await catatPinGagal(req.user.id, siswaId)
    await audit(req, 'PIN_GAGAL', `Siswa #${siswaId}`)
    return res.status(401).json({ error: 'PIN salah' })
  }
  await hapusPinGagal(req.user.id, siswaId)

  const trx = db.transaction(async () => {
    await validasiQrUntukTransaksi(qr_token, siswaId)
    let total = 0
    const rincian = []
    for (const item of items) {
      const produkId = Number(item?.produk_id)
      if (!Number.isSafeInteger(produkId) || produkId <= 0) throw { code: 400, msg: 'ID produk tidak valid' }
      const produk = await db.prepare('SELECT * FROM produk WHERE id = ?').get(produkId)
      if (!produk) throw { code: 400, msg: 'Produk tidak ditemukan: ' + item.produk_id }
      if (req.user.outlet && produk.outlet !== req.user.outlet) throw { code: 403, msg: 'Produk bukan milik outlet akun PIC ini' }
      const qty = Number(item.qty)
      if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 100) throw { code: 400, msg: 'Jumlah produk harus bilangan bulat 1–100' }
      const lineTotal = Number(produk.harga) * qty
      if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0 || !Number.isSafeInteger(total + lineTotal)) throw { code: 400, msg: 'Total transaksi terlalu besar atau tidak valid' }
      total += lineTotal
      rincian.push(produk.nama + ' x' + qty)
    }

    const lockedStudent = await db.prepare("SELECT id, pin_hash FROM users WHERE id = ? AND role = 'siswa' AND active = 1").get(siswaId)
    if (!lockedStudent) throw { code: 404, msg: 'Akun siswa tidak ditemukan atau tidak aktif' }
    if (!lockedStudent.pin_hash || !bcrypt.compareSync(String(pin), lockedStudent.pin_hash)) throw { code: 401, msg: 'PIN salah atau sudah berubah; ulangi transaksi' }
    const saldo = await saldoSiswa(siswaId)
    if (saldo < total) throw { code: 402, msg: 'Saldo tidak mencukupi' }
    await cekBatasBelanja(siswaId, total)

    const info = await db.prepare(
      `INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh)
       VALUES (?, 'pembelian', ?, ?, ?)`
    ).run(siswaId, -total, rincian.join(', '), req.user.id)
    await db.prepare(`INSERT INTO pos_transaction_meta (ledger_id, pic_id, outlet, tipe_asal, total)
      VALUES (?, ?, ?, 'pembelian', ?)`).run(info.lastInsertRowid, req.user.id, req.user.outlet || null, total)

    await audit(req, 'TRANSAKSI_POS', `Siswa #${siswa_id} · ${rincian.join(', ')} · Rp ${total.toLocaleString('id-ID')}`, 'ledger', Number(info.lastInsertRowid))
    return { total, ledger_id: info.lastInsertRowid, saldo_baru: await saldoSiswa(siswaId) }
  })

  try {
    const hasil = await trx()
    res.json({ ok: true, ...hasil })
  } catch (e) {
    if (e.code === 401) await catatPinGagal(req.user.id, siswaId).catch(() => {})
    res.status(e.code || 500).json({ error: e.msg || 'Transaksi gagal' })
  }
})

posRouter.post('/tarik-tunai', wajibLogin, wajibRole('pic'), async (req, res) => {
  const { siswa_id, pin, nominal, qr_token } = req.body || {}
  const nilaiNominal = Number(nominal)
  const siswaId = Number(siswa_id)
  if (!Number.isSafeInteger(siswaId) || siswaId <= 0 || !/^\d{6}$/.test(String(pin || '')) ||
      typeof qr_token !== 'string' || qr_token.length > 4096 || !Number.isSafeInteger(nilaiNominal) || nilaiNominal <= 0) {
    return res.status(400).json({ error: 'siswa_id, PIN 6 digit, QR valid, dan nominal positif wajib diisi' })
  }
  if (await pinTerkunci(req.user.id, siswaId)) return res.status(429).json({ error: 'Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.' })
  if (!await pinCocok(siswaId, pin)) {
    await catatPinGagal(req.user.id, siswaId)
    await audit(req, 'PIN_GAGAL', `Siswa #${siswaId}`)
    return res.status(401).json({ error: 'PIN salah' })
  }
  await hapusPinGagal(req.user.id, siswaId)

  const trx = db.transaction(async () => {
    await validasiQrUntukTransaksi(qr_token, siswaId)
    const lockedStudent = await db.prepare("SELECT id, pin_hash FROM users WHERE id = ? AND role = 'siswa' AND active = 1").get(siswaId)
    if (!lockedStudent) throw { code: 404, msg: 'Akun siswa tidak ditemukan atau tidak aktif' }
    if (!lockedStudent.pin_hash || !bcrypt.compareSync(String(pin), lockedStudent.pin_hash)) throw { code: 401, msg: 'PIN salah atau sudah berubah; ulangi transaksi' }
    const saldo = await saldoSiswa(siswaId)
    if (saldo < nilaiNominal) throw { code: 402, msg: 'Saldo tidak mencukupi' }
    await cekBatasBelanja(siswaId, nilaiNominal)

    const info = await db.prepare(
      `INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh)
       VALUES (?, 'tarik_tunai', ?, 'Penarikan tunai di outlet', ?)`
    ).run(siswaId, -nilaiNominal, req.user.id)
    await db.prepare(`INSERT INTO pos_transaction_meta (ledger_id, pic_id, outlet, tipe_asal, total)
      VALUES (?, ?, ?, 'tarik_tunai', ?)`).run(info.lastInsertRowid, req.user.id, req.user.outlet || null, nilaiNominal)
    await audit(req, 'AMBIL_TUNAI', `Siswa #${siswa_id} · Rp ${nilaiNominal.toLocaleString('id-ID')}`, 'ledger', Number(info.lastInsertRowid))
    return { ledger_id: info.lastInsertRowid, saldo_baru: await saldoSiswa(siswaId) }
  })

  try {
    const hasil = await trx()
    res.json({ ok: true, ...hasil })
  } catch (e) {
    if (e.code === 401) await catatPinGagal(req.user.id, siswaId).catch(() => {})
    res.status(e.code || 500).json({ error: e.msg || 'Penarikan gagal' })
  }
})


// Kas awal adalah uang fisik pembuka laci. Pembelian siswa memakai saldo digital,
// sehingga tidak menambah uang fisik; penarikan tunai mengurangi kas fisik.
async function tanggalLokalHariIni() {
  const row = await db.prepare("SELECT date('now','+7 hours') AS tanggal").get()
  return String(row.tanggal).slice(0, 10)
}

posRouter.get('/kas', wajibLogin, wajibRole('pic'), async (req, res) => {
  try {
    const row = await db.prepare('SELECT kas_awal, updated_at FROM pos_cash_settings WHERE pic_id = ?').get(req.user.id)
    res.json({ kas_awal: Number(row?.kas_awal || 0), kas_diatur: Boolean(row), updated_at: row?.updated_at || null, outlet: req.user.outlet || null })
  } catch (error) {
    console.error('Gagal membaca kas awal:', error)
    res.status(500).json({ error: 'Gagal membaca pengaturan kas' })
  }
})

posRouter.put('/kas', wajibLogin, wajibRole('pic'), async (req, res) => {
  const kasAwal = Number(req.body?.kas_awal)
  if (!Number.isSafeInteger(kasAwal) || kasAwal < 0) return res.status(400).json({ error: 'kas_awal harus bilangan bulat nol atau lebih' })
  try {
    const today = await tanggalLokalHariIni()
    const existingCloseout = await db.prepare('SELECT id FROM pos_cash_closeouts WHERE pic_id = ? AND tanggal = ?').get(req.user.id, today)
    if (existingCloseout) return res.status(409).json({ error: 'Kas awal tidak dapat diubah setelah kas hari ini ditutup' })
    const activity = await db.prepare(`SELECT COUNT(*) AS n FROM pos_transaction_meta
      WHERE pic_id = ? AND date(created_at,'+7 hours') = ?`).get(req.user.id, today)
    if (Number(activity?.n || 0) > 0) return res.status(409).json({ error: 'Kas awal tidak dapat diubah setelah transaksi pertama hari ini' })
    await db.prepare(`INSERT INTO pos_cash_settings (pic_id, kas_awal, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(pic_id) DO UPDATE SET kas_awal = EXCLUDED.kas_awal, updated_at = CURRENT_TIMESTAMP`).run(req.user.id, kasAwal)
    await audit(req, 'UBAH_KAS_AWAL', `Kas awal diatur menjadi Rp ${kasAwal.toLocaleString('id-ID')}`, 'pos_cash_settings', Number(req.user.id))
    res.json({ ok: true, kas_awal: kasAwal })
  } catch (error) {
    console.error('Gagal menyimpan kas awal:', error)
    res.status(500).json({ error: 'Gagal menyimpan kas awal' })
  }
})

posRouter.get('/tutup-kas', wajibLogin, wajibRole('pic'), async (req, res) => {
  try {
    const tanggal = await tanggalLokalHariIni()
    const settings = await db.prepare('SELECT kas_awal FROM pos_cash_settings WHERE pic_id = ?').get(req.user.id)
    const closeout = await db.prepare('SELECT * FROM pos_cash_closeouts WHERE pic_id = ? AND tanggal = ?').get(req.user.id, tanggal)
    const totals = await db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN tipe_asal = 'pembelian' AND status = 'aktif' THEN total ELSE 0 END), 0) AS total_pembelian,
        COALESCE(SUM(CASE WHEN tipe_asal = 'tarik_tunai' AND status = 'aktif' THEN total ELSE 0 END), 0) AS total_tarik_tunai,
        COUNT(*) FILTER (WHERE status = 'aktif') AS jumlah_transaksi
      FROM pos_transaction_meta
      WHERE pic_id = ? AND date(created_at,'+7 hours') = ?`).get(req.user.id, tanggal)
    const kasAwal = Number(closeout?.kas_awal ?? settings?.kas_awal ?? 0)
    const totalPembelian = Number(closeout?.total_pembelian ?? totals.total_pembelian ?? 0)
    const totalTarikTunai = Number(closeout?.total_tarik_tunai ?? totals.total_tarik_tunai ?? 0)
    const kasEstimasi = kasAwal - totalTarikTunai
    res.json({ tanggal, kas_awal: kasAwal, total_pembelian: totalPembelian,
      total_tarik_tunai: totalTarikTunai, jumlah_transaksi: Number(totals.jumlah_transaksi || 0),
      kas_estimasi: Number(closeout?.kas_estimasi ?? kasEstimasi), kas_diatur: Boolean(settings) || Boolean(closeout), tutup: Boolean(closeout), penutupan: closeout || null })
  } catch (error) {
    console.error('Gagal membaca status tutup kas:', error)
    res.status(500).json({ error: 'Gagal membaca status tutup kas' })
  }
})

posRouter.post('/tutup-kas', wajibLogin, wajibRole('pic'), async (req, res) => {
  const kasFisik = Number(req.body?.kas_fisik)
  if (!Number.isSafeInteger(kasFisik) || kasFisik < 0) return res.status(400).json({ error: 'kas_fisik harus bilangan bulat nol atau lebih' })
  try {
    const tanggal = await tanggalLokalHariIni()
    const result = await db.transaction(async () => {
      await db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id)
      const already = await db.prepare('SELECT id FROM pos_cash_closeouts WHERE pic_id = ? AND tanggal = ?').get(req.user.id, tanggal)
      if (already) throw { code: 409, msg: 'Kas hari ini sudah ditutup' }
      const settings = await db.prepare('SELECT kas_awal FROM pos_cash_settings WHERE pic_id = ?').get(req.user.id)
      if (!settings) throw { code: 409, msg: 'Atur kas awal terlebih dahulu sebelum menutup kas' }
      const totals = await db.prepare(`SELECT
          COALESCE(SUM(CASE WHEN tipe_asal = 'pembelian' AND status = 'aktif' THEN total ELSE 0 END), 0) AS total_pembelian,
          COALESCE(SUM(CASE WHEN tipe_asal = 'tarik_tunai' AND status = 'aktif' THEN total ELSE 0 END), 0) AS total_tarik_tunai
        FROM pos_transaction_meta WHERE pic_id = ? AND date(created_at,'+7 hours') = ?`).get(req.user.id, tanggal)
      const kasAwal = Number(settings?.kas_awal || 0)
      const totalPembelian = Number(totals.total_pembelian || 0)
      const totalTarikTunai = Number(totals.total_tarik_tunai || 0)
      const kasEstimasi = kasAwal - totalTarikTunai
      const selisih = kasFisik - kasEstimasi
      const inserted = await db.prepare(`INSERT INTO pos_cash_closeouts
        (pic_id, outlet, tanggal, kas_awal, total_pembelian, total_tarik_tunai, kas_estimasi, kas_fisik, selisih, dibuat_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, req.user.outlet || null, tanggal,
          kasAwal, totalPembelian, totalTarikTunai, kasEstimasi, kasFisik, selisih, req.user.id)
      return { id: inserted.lastInsertRowid, tanggal, kas_awal: kasAwal, total_pembelian: totalPembelian,
        total_tarik_tunai: totalTarikTunai, kas_estimasi: kasEstimasi, kas_fisik: kasFisik, selisih }
    })()
    await audit(req, 'TUTUP_KAS_PIC', `Tanggal ${result.tanggal} · kas fisik Rp ${kasFisik.toLocaleString('id-ID')} · selisih Rp ${result.selisih.toLocaleString('id-ID')}`, 'pos_cash_closeouts', Number(result.id))
    res.status(201).json({ ok: true, penutupan: result })
  } catch (error) {
    if (Number.isInteger(error.code) && error.code >= 400 && error.code <= 599) return res.status(error.code).json({ error: error.msg })
    if (error.code === '23505') return res.status(409).json({ error: 'Kas hari ini sudah ditutup' })
    console.error('Gagal menutup kas:', error)
    res.status(500).json({ error: 'Gagal menutup kas' })
  }
})

posRouter.post('/transaksi/:id/batal', wajibLogin, wajibRole('pic'), async (req, res) => {
  const id = Number(req.params.id)
  const alasan = String(req.body?.alasan || '').trim()
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'ID transaksi tidak valid' })
  if (!alasan || alasan.length > 500) return res.status(400).json({ error: 'Alasan pembatalan wajib diisi (maksimal 500 karakter)' })
  try {
    const result = await db.transaction(async () => {
      const ledger = await db.prepare("SELECT * FROM ledger WHERE id = ? AND tipe IN ('pembelian','tarik_tunai')").get(id)
      if (!ledger) throw { code: 404, msg: 'Transaksi POS tidak ditemukan' }
      if (Number(ledger.dibuat_oleh) !== Number(req.user.id)) throw { code: 403, msg: 'Transaksi bukan milik PIC ini' }
      const meta = await db.prepare('SELECT * FROM pos_transaction_meta WHERE ledger_id = ?').get(id)
      if (meta?.status === 'dibatalkan') throw { code: 409, msg: 'Transaksi sudah dibatalkan' }
      const transactionDate = await db.prepare("SELECT date(created_at,'+7 hours') AS tanggal FROM ledger WHERE id = ?").get(id)
      const closed = await db.prepare('SELECT id FROM pos_cash_closeouts WHERE pic_id = ? AND tanggal = ?').get(req.user.id, String(transactionDate.tanggal).slice(0, 10))
      if (closed) throw { code: 409, msg: 'Transaksi tidak dapat dibatalkan setelah kas tanggal tersebut ditutup' }
      const duplicate = await db.prepare("SELECT id FROM ledger WHERE ref_tabel = 'pembatalan_pos' AND ref_id = ? LIMIT 1").get(id)
      if (duplicate) throw { code: 409, msg: 'Transaksi sudah memiliki pembalikan ledger' }
      const total = Math.abs(Number(ledger.nominal))
      if (!Number.isSafeInteger(total) || total <= 0) throw { code: 409, msg: 'Nominal transaksi tidak valid untuk dibatalkan' }
      if (!meta) {
        await db.prepare(`INSERT INTO pos_transaction_meta (ledger_id, pic_id, outlet, tipe_asal, total)
          VALUES (?, ?, ?, ?, ?)`).run(id, req.user.id, req.user.outlet || null, ledger.tipe, total)
      }
      const reversal = await db.prepare(`INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, ref_tabel, ref_id, dibuat_oleh)
        VALUES (?, 'penyesuaian', ?, ?, 'pembatalan_pos', ?, ?)`)
        .run(ledger.siswa_id, total, `Pembalikan transaksi POS #${id}: ${alasan}`, id, req.user.id)
      await db.prepare(`UPDATE pos_transaction_meta SET status = 'dibatalkan', alasan_batal = ?, dibatalkan_oleh = ?,
        reversal_ledger_id = ?, dibatalkan_at = CURRENT_TIMESTAMP WHERE ledger_id = ?`)
        .run(alasan, req.user.id, reversal.lastInsertRowid, id)
      await audit(req, 'BATAL_TRANSAKSI_POS', `Transaksi #${id} · siswa #${ledger.siswa_id} · Rp ${total.toLocaleString('id-ID')} · ${alasan}`, 'ledger', id)
      return { ledger_id: id, reversal_ledger_id: reversal.lastInsertRowid, siswa_id: ledger.siswa_id, nominal_dibalik: total }
    })()
    res.json({ ok: true, ...result, saldo_baru: await saldoSiswa(result.siswa_id) })
  } catch (error) {
    if (Number.isInteger(error.code) && error.code >= 400 && error.code <= 599) return res.status(error.code).json({ error: error.msg })
    console.error('Gagal membatalkan transaksi POS:', error)
    res.status(500).json({ error: 'Gagal membatalkan transaksi POS' })
  }
})
