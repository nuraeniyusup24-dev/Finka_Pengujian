/**
 * Route khusus akun Orang Tua.
 *
 * File ini menangani data yang boleh dilihat orang tua:
 * - daftar anak dan saldo;
 * - riwayat top-up/pembayaran;
 * - notifikasi status pembayaran.
 *
 * Validasi kepemilikan tetap dilakukan berdasarkan req.user.id dari JWT.
 */
import { Router } from 'express'
import { db, saldoSiswa } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'
import { audit } from '../audit.js'
import { createPinRecoveryService, PinRecoveryError } from '../pin-recovery/service.js'
import { configuredOtpProvider } from '../pin-recovery/provider.js'
import { listVerifiedResetMethods, pinRecoveryRepository } from '../pin-recovery/repository.js'

export const ortuRouter = Router()

const pinRecovery = createPinRecoveryService({
  repository: pinRecoveryRepository,
  provider: configuredOtpProvider(),
  secret: process.env.PIN_OTP_SECRET
})

function pinRecoveryFailure(res, error) {
  if (error instanceof PinRecoveryError) return res.status(error.status).json({ error: error.message })
  console.error('Operasi pemulihan PIN gagal (kesalahan internal).')
  return res.status(500).json({ error: 'Operasi pemulihan PIN gagal' })
}

ortuRouter.get('/anak/:id/pin-reset/options', wajibLogin, wajibRole('ortu'), async (req, res) => {
  try {
    const options = await pinRecoveryRepository.channelOptions({ parentId: req.user.id, studentId: Number(req.params.id) })
    if (!options) return res.status(404).json({ error: 'Siswa bukan anak dari akun Orang Tua ini' })
    res.json({ methods: listVerifiedResetMethods(options, configuredOtpProvider()) })
  } catch (error) { pinRecoveryFailure(res, error) }
})

ortuRouter.post('/anak/:id/pin-reset/request', wajibLogin, wajibRole('ortu'), async (req, res) => {
  try {
    const result = await pinRecovery.start({ parentId: req.user.id, studentId: Number(req.params.id), channel: String(req.body?.channel || '') })
    res.status(202).json({ pesan: 'OTP telah diminta. Periksa kanal kontak terverifikasi.', ...result })
  } catch (error) { pinRecoveryFailure(res, error) }
})

ortuRouter.post('/anak/:id/pin-reset/verify', wajibLogin, wajibRole('ortu'), async (req, res) => {
  try {
    const result = await pinRecovery.verify({ parentId: req.user.id, studentId: Number(req.params.id), challengeId: String(req.body?.challenge_id || ''), otp: String(req.body?.otp || '') })
    res.json(result)
  } catch (error) { pinRecoveryFailure(res, error) }
})

ortuRouter.post('/anak/:id/pin-reset/complete', wajibLogin, wajibRole('ortu'), async (req, res) => {
  try {
    const result = await pinRecovery.complete({
      req, parentId: req.user.id, studentId: Number(req.params.id),
      challengeId: String(req.body?.challenge_id || ''), resetToken: String(req.body?.reset_token || ''),
      pin: String(req.body?.pin_baru || ''), confirmation: String(req.body?.konfirmasi_pin || '')
    })
    res.json(result)
  } catch (error) { pinRecoveryFailure(res, error) }
})

ortuRouter.get('/profil', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const row = await db.prepare(`
    SELECT u.id, u.nama, u.username, p.hubungan, p.pekerjaan, p.no_hp, p.email
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ? AND u.role = 'ortu'
  `).get(req.user.id)
  if (!row) return res.status(404).json({ error: 'Akun orang tua tidak ditemukan' })
  res.json({ profil: { ...row, hubungan: row.hubungan || '', pekerjaan: row.pekerjaan || '', no_hp: row.no_hp || '', email: row.email || '' } })
})

ortuRouter.put('/profil', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const { nama, hubungan, pekerjaan, no_hp, email } = req.body || {}
  const namaBersih = String(nama || '').trim()
  const hubunganBersih = String(hubungan || '').trim()
  const pekerjaanBersih = String(pekerjaan || '').trim()
  const hpBersih = String(no_hp || '').trim()
  const emailBersih = String(email || '').trim().toLowerCase()
  if (!namaBersih || namaBersih.length > 100) return res.status(400).json({ error: 'Nama wajib diisi dan maksimal 100 karakter' })
  if (!['Ayah', 'Ibu', 'Wali'].includes(hubunganBersih)) return res.status(400).json({ error: 'Hubungan tidak valid' })
  if (!['PNS/ASN', 'Pegawai swasta', 'Wiraswasta', 'Guru/tenaga pendidik', 'TNI/Polri', 'Lainnya'].includes(pekerjaanBersih)) return res.status(400).json({ error: 'Pekerjaan tidak valid' })
  if (hpBersih && !/^08\d{8,11}$/.test(hpBersih)) return res.status(400).json({ error: 'Nomor HP harus 10–13 digit dan diawali 08' })
  if (emailBersih && (emailBersih.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBersih))) return res.status(400).json({ error: 'Email tidak valid' })
  await db.transaction(async () => {
    await db.prepare('UPDATE users SET nama = ? WHERE id = ? AND role = \'ortu\'').run(namaBersih, req.user.id)
    await db.prepare(`INSERT INTO user_profiles (user_id, hubungan, pekerjaan, no_hp, email)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET hubungan = EXCLUDED.hubungan, pekerjaan = EXCLUDED.pekerjaan,
      no_hp_verified_at = CASE WHEN user_profiles.no_hp IS DISTINCT FROM EXCLUDED.no_hp THEN NULL ELSE user_profiles.no_hp_verified_at END,
      email_verified_at = CASE WHEN user_profiles.email IS DISTINCT FROM EXCLUDED.email THEN NULL ELSE user_profiles.email_verified_at END,
      no_hp = EXCLUDED.no_hp, email = EXCLUDED.email`)
      .run(req.user.id, hubunganBersih, pekerjaanBersih, hpBersih || null, emailBersih || null)
  })()
  await audit(req, 'UBAH_PROFIL_ORTU', 'Profil orang tua diperbarui', 'users', Number(req.user.id))
  res.json({ pesan: 'Profil berhasil disimpan', profil: { id: req.user.id, nama: namaBersih, hubungan: hubunganBersih, pekerjaan: pekerjaanBersih, no_hp: hpBersih, email: emailBersih } })
})

async function milikOrtu(ortuId, siswaId) {
  return Boolean(await db.prepare("SELECT 1 FROM siswa_profil WHERE user_id = ? AND ortu_id = ?").get(siswaId, ortuId))
}

async function ringkasanKontrol(siswaId) {
  const row = await db.prepare('SELECT limit_aktif, limit_harian, kartu_diblokir FROM siswa_kontrol WHERE user_id = ?').get(siswaId)
  const spent = await db.prepare(`SELECT COALESCE(SUM(-nominal), 0) AS total FROM ledger
    WHERE siswa_id = ? AND tipe IN ('pembelian', 'tarik_tunai')
    AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now','+7 hours'), '-7 hours')`).get(siswaId)
  const limit = Number(row?.limit_harian || 25000)
  const used = Number(spent?.total || 0)
  return { limit_aktif: Boolean(row?.limit_aktif), limit, kartu_diblokir: Boolean(row?.kartu_diblokir), terpakai_hari_ini: used, sisa_limit: Math.max(0, limit - used) }
}

ortuRouter.get('/anak/:id/kontrol', wajibLogin, wajibRole('ortu'), async (req, res) => {
  if (!(await milikOrtu(req.user.id, req.params.id))) return res.status(403).json({ error: 'Bukan anak dari akun ini' })
  res.json(await ringkasanKontrol(req.params.id))
})

ortuRouter.put('/anak/:id/kontrol', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const siswaId = Number(req.params.id)
  if (!(await milikOrtu(req.user.id, siswaId))) return res.status(403).json({ error: 'Bukan anak dari akun ini' })
  const { limit_aktif, limit, kartu_diblokir } = req.body || {}
  if (limit !== undefined && ![15000, 25000, 35000, 50000].includes(Number(limit))) return res.status(400).json({ error: 'Limit harian tidak valid' })
  if (limit_aktif !== undefined && typeof limit_aktif !== 'boolean') return res.status(400).json({ error: 'limit_aktif harus boolean' })
  if (kartu_diblokir !== undefined && typeof kartu_diblokir !== 'boolean') return res.status(400).json({ error: 'kartu_diblokir harus boolean' })
  await db.prepare(`INSERT INTO siswa_kontrol (user_id, limit_aktif, limit_harian, kartu_diblokir)
    VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET
    limit_aktif = COALESCE(?, siswa_kontrol.limit_aktif),
    limit_harian = COALESCE(?, siswa_kontrol.limit_harian),
    kartu_diblokir = COALESCE(?, siswa_kontrol.kartu_diblokir)`)
    .run(siswaId, limit_aktif ?? false, Number(limit) || 25000, kartu_diblokir ?? false,
      limit_aktif ?? null, limit === undefined ? null : Number(limit), kartu_diblokir ?? null)
  await audit(req, 'UBAH_KONTROL_SISWA', `Kontrol kartu/limit siswa #${siswaId} diperbarui`, 'users', siswaId)
  res.json(await ringkasanKontrol(siswaId))
})

ortuRouter.get('/anak-anak', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT s.id, s.nama, s.active, p.kelas, p.nis
     FROM siswa_profil p JOIN users s ON s.id = p.user_id
     WHERE p.ortu_id = ?
     ORDER BY s.id ASC`
  ).all(req.user.id)

  const anak = await Promise.all(rows.map(async (r) => ({ ...r, saldo: await saldoSiswa(r.id), ...(await ringkasanKontrol(r.id)) })))
  res.json({ anak })
})


function statusLabel(status) {
  return status === 'menunggu' ? 'Menunggu verifikasi' : status === 'disetujui' ? 'Diterima' : 'Ditolak'
}

// Riwayat transfer orang tua: mencakup isi saldo dan pembayaran tagihan.
ortuRouter.get('/riwayat-pembayaran', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const rows = await db.prepare(`
    SELECT t.*, s.nama AS siswa_nama, b.nama AS tagihan_nama
    FROM topup_request t
    JOIN users s ON s.id = t.siswa_id
    LEFT JOIN tagihan b ON b.id = t.tagihan_id
    WHERE t.ortu_id = ?
    ORDER BY t.id DESC
    LIMIT 100
  `).all(req.user.id)

  const directRows = await db.prepare(`
    SELECT l.id, l.siswa_id, s.nama AS siswa_nama, l.nominal, l.created_at, b.nama AS tagihan_nama
    FROM ledger l
    JOIN users s ON s.id = l.siswa_id
    JOIN siswa_profil sp ON sp.user_id = l.siswa_id
    JOIN tagihan b ON b.id = l.ref_id
    WHERE sp.ortu_id = ? AND l.tipe = 'bayar_tagihan'
    ORDER BY l.id DESC
    LIMIT 100
  `).all(req.user.id)

  const mapped = rows.map(r => ({
    id: r.id,
    siswa_id: r.siswa_id,
    siswa: r.siswa_nama,
    jenis: r.tagihan_id ? 'bayar_tagihan' : 'topup',
    judul: r.tagihan_id ? 'Bayar ' + r.tagihan_nama : 'Top-up saldo',
    nominal: r.nominal,
    total_transfer: Number(r.nominal) + Number(r.kode_unik),
    kode_unik: r.kode_unik,
    tagihan_id: r.tagihan_id,
    status: r.status,
    status_label: statusLabel(r.status),
    alasan_tolak: r.alasan_tolak,
    pernah_ditolak: Number(r.pernah_ditolak || 0) === 1,
    waktu: r.created_at,
    diproses_at: r.diproses_at
  })).concat(directRows.map(r => ({
    id: 'ledger-' + r.id,
    siswa_id: r.siswa_id,
    siswa: r.siswa_nama,
    jenis: 'bayar_tagihan',
    judul: 'Bayar ' + r.tagihan_nama,
    nominal: Math.abs(Number(r.nominal)),
    total_transfer: Math.abs(Number(r.nominal)),
    kode_unik: null,
    tagihan_id: r.ref_id,
    status: 'disetujui',
    status_label: 'Diterima',
    alasan_tolak: null,
    pernah_ditolak: false,
    waktu: r.created_at,
    diproses_at: r.created_at
  }))).sort((a,b) => String(b.waktu).localeCompare(String(a.waktu))).slice(0, 100)
  res.json({ riwayat: mapped })
})

// Notifikasi status pembayaran orang tua. Data diturunkan dari request
// pembayaran agar tidak ada status UI yang berbeda dari database.
ortuRouter.get('/notifikasi', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const rows = await db.prepare(`
    SELECT t.*, s.nama AS siswa_nama, b.nama AS tagihan_nama
    FROM topup_request t
    JOIN users s ON s.id = t.siswa_id
    LEFT JOIN tagihan b ON b.id = t.tagihan_id
    WHERE t.ortu_id = ?
    ORDER BY t.id DESC
    LIMIT 50
  `).all(req.user.id)

  const directRows = await db.prepare(`
    SELECT l.id, l.siswa_id, s.nama AS siswa_nama, l.nominal, l.created_at, b.nama AS tagihan_nama, l.ref_id
    FROM ledger l
    JOIN users s ON s.id = l.siswa_id
    JOIN siswa_profil sp ON sp.user_id = l.siswa_id
    JOIN tagihan b ON b.id = l.ref_id
    WHERE sp.ortu_id = ? AND l.tipe = 'bayar_tagihan'
    ORDER BY l.id DESC
    LIMIT 50
  `).all(req.user.id)

  const notifikasi = rows.map(r => {
    const tujuan = r.tagihan_id ? ('Pembayaran ' + (r.tagihan_nama || 'tagihan')) : 'Top-up saldo'
    let judul = tujuan + ' menunggu verifikasi'
    let isi = `${r.siswa_nama}: ${Number(r.nominal).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })} masih menunggu verifikasi admin.`
    let tipe = 'pembayaran_menunggu'
    if (r.status === 'ditolak') {
      judul = tujuan + ' ditolak'
      isi = `${r.siswa_nama}: pembayaran ditolak${r.alasan_tolak ? ' — ' + r.alasan_tolak : ''}.`
      tipe = 'pembayaran_ditolak'
    } else if (r.status === 'disetujui') {
      judul = r.pernah_ditolak ? tujuan + ' diterima setelah penolakan' : tujuan + ' diterima'
      isi = r.tagihan_id
        ? `${r.siswa_nama}: tagihan ${r.tagihan_nama || 'sekolah'} telah lunas setelah transfer diverifikasi. Buka tagihan untuk melihat rincian pembayaran.`
        : `${r.siswa_nama}: ${r.pernah_ditolak ? 'pembayaran yang sebelumnya ditolak kini sudah diterima.' : 'pembayaran sudah diterima dan saldo telah diproses.'}`
      tipe = r.pernah_ditolak ? 'pembayaran_diterima_kembali' : 'pembayaran_diterima'
    }
    return { id: r.id, tipe, judul, isi, waktu: r.diproses_at || r.created_at, baru: true, status: r.status, siswa_id: r.siswa_id, tagihan_id: r.tagihan_id }
  }).concat(directRows.map(r => ({
    id: 'ledger-' + r.id,
    tipe: 'pembayaran_diterima',
    judul: 'Pembayaran ' + r.tagihan_nama + ' diterima',
    isi: `${r.siswa_nama}: pembayaran tagihan sudah diproses dari saldo anak.`,
    waktu: r.created_at,
    baru: true,
    status: 'disetujui',
    siswa_id: r.siswa_id,
    tagihan_id: r.ref_id
  })))
  res.json({ notifikasi })
})
