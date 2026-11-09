/**
 * Route top-up dan pembayaran melalui transfer.
 *
 * Walaupun nama historisnya masih "topup", request dengan tagihan_id
 * juga dipakai untuk pembayaran tagihan. Status tetap diproses di backend
 * supaya frontend tidak bisa memalsukan pembayaran yang sudah diterima.
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { wajibLogin, wajibRole } from '../middleware/auth.js'
import { audit } from '../audit.js'

export const topupRouter = Router()

async function milikOrtu(siswaId, ortuId) {
  const profil = await db.prepare('SELECT ortu_id FROM siswa_profil WHERE user_id = ?').get(siswaId)
  return profil && profil.ortu_id === ortuId
}

// Ortu mengajukan top-up — untuk saldo saku (tagihan_id kosong) ATAU untuk
// membayar satu tagihan spesifik (tagihan_id diisi, misalnya SPP). Kode
// unik digenerate server supaya nanti bisa dicocokkan otomatis dengan
// mutasi bank asli (nominal + kode_unik = jumlah transfer yang harus
// persis sama).
topupRouter.post('/', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const { siswa_id, nominal, tagihan_id, pin } = req.body || {}
  const nilaiNominal = Number(nominal)
  if (!siswa_id || !Number.isInteger(nilaiNominal) || nilaiNominal <= 0) {
    return res.status(400).json({ error: 'siswa_id dan nominal (>0) wajib diisi' })
  }
  if (!/^\d{6}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'PIN konfirmasi 6 digit wajib diisi' })
  }
  const ortu = await db.prepare("SELECT pin_hash FROM users WHERE id = ? AND role = 'ortu'").get(req.user.id)
  if (!ortu?.pin_hash) {
    return res.status(428).json({ error: 'Buat PIN akun terlebih dahulu sebelum mengajukan pembayaran' })
  }
  if (!await bcrypt.compare(String(pin), ortu.pin_hash)) {
    await audit(req, 'PIN_TOPUP_GAGAL', 'Orang Tua memasukkan PIN konfirmasi yang salah', 'users', Number(req.user.id))
    return res.status(401).json({ error: 'PIN konfirmasi salah' })
  }
  if (!(await milikOrtu(siswa_id, req.user.id))) {
    return res.status(403).json({ error: 'Bukan anak dari akun ini' })
  }

  if (tagihan_id) {
    const tagihan = await db.prepare('SELECT * FROM tagihan WHERE id = ? AND siswa_id = ?').get(tagihan_id, siswa_id)
    if (!tagihan) return res.status(404).json({ error: 'Tagihan tidak ditemukan untuk siswa ini' })
    if (tagihan.status !== 'belum_bayar') return res.status(409).json({ error: tagihan.status === 'lunas' ? 'Tagihan sudah lunas' : 'Tagihan sudah dibatalkan atau tidak dapat dibayar' })
    if (nilaiNominal !== Number(tagihan.nominal)) return res.status(400).json({ error: 'Nominal pembayaran harus sama dengan nominal tagihan' })
  }

  const kodeUnik = Math.floor(Math.random() * 899) + 100 // 100–998
  const info = await db.prepare(
    `INSERT INTO topup_request (siswa_id, ortu_id, nominal, kode_unik, tagihan_id, status)
     VALUES (?, ?, ?, ?, ?, 'menunggu')`
  ).run(siswa_id, req.user.id, nilaiNominal, kodeUnik, tagihan_id || null)

  await audit(req, 'AJUKAN_TOPUP', `${siswa_id} · Rp ${nilaiNominal.toLocaleString('id-ID')} · total transfer Rp ${(nilaiNominal+kodeUnik).toLocaleString('id-ID')}`, 'topup_request', Number(info.lastInsertRowid))
  res.status(201).json({
    id: info.lastInsertRowid,
    siswa_id: Number(siswa_id),
    nominal: nilaiNominal,
    kode_unik: kodeUnik,
    tagihan_id: tagihan_id || null,
    total_transfer: nilaiNominal + kodeUnik,
    status: 'menunggu'
  })
})

function baris(row) {
  if (!row) return null
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    siswa: row.siswa_nama,
    kelas: row.kelas,
    ortu: row.ortu_nama,
    nominal: row.nominal,
    dasar: row.nominal,
    kode: row.kode_unik,
    kode_unik: row.kode_unik,
    tagihan_id: row.tagihan_id,
    tagihan_nama: row.tagihan_nama,
    tujuan: row.tagihan_nama ? ('Tagihan: ' + row.tagihan_nama) : 'Saldo saku',
    status: row.status,
    alasan_tolak: row.alasan_tolak,
    bukti_tersedia: Boolean(row.bukti_tersedia),
    bukti_diunggah_at: row.bukti_diunggah_at || null,
    pernah_ditolak: Number(row.pernah_ditolak || 0) === 1,
    waktu: row.created_at,
    diproses_at: row.diproses_at,
    cocok: true // pencocokan otomatis dgn mutasi bank asli: Fase 2, belum ada
  }
}

const SELECT_JOIN = `
  SELECT t.*, s.nama AS siswa_nama, p.kelas AS kelas, o.nama AS ortu_nama, b.nama AS tagihan_nama
       , EXISTS (SELECT 1 FROM topup_proof bp WHERE bp.topup_id = t.id) AS bukti_tersedia
       , (SELECT bp.uploaded_at FROM topup_proof bp WHERE bp.topup_id = t.id) AS bukti_diunggah_at
  FROM topup_request t
  JOIN users s ON s.id = t.siswa_id
  LEFT JOIN siswa_profil p ON p.user_id = s.id
  JOIN users o ON o.id = t.ortu_id
  LEFT JOIN tagihan b ON b.id = t.tagihan_id
`

// Antrean untuk admin — pengganti array dummy di store Vuex prototipe.
topupRouter.get('/', wajibLogin, wajibRole('admin'), async (req, res) => {
  const status = req.query.status
  const rows = status
    ? await db.prepare(SELECT_JOIN + ' WHERE t.status = ? ORDER BY t.id DESC').all(status)
    : await db.prepare(SELECT_JOIN + ' ORDER BY t.id DESC').all()
  res.json({ topup: rows.map(baris) })
})

topupRouter.get('/:id', wajibLogin, async (req, res) => {
  const row = await db.prepare(SELECT_JOIN + ' WHERE t.id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Tidak ditemukan' })
  if (req.user.role !== 'admin' && Number(row.ortu_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Tidak punya akses' })
  }
  res.json({ topup: baris(row) })
})

topupRouter.get('/:id/proof', wajibLogin, async (req, res) => {
  const request = await db.prepare('SELECT ortu_id, siswa_id FROM topup_request WHERE id = ?').get(req.params.id)
  if (!request) return res.status(404).json({ error: 'Permintaan top-up tidak ditemukan' })
  const pemilikOrtu = req.user.role === 'ortu' && Number(request.ortu_id) === Number(req.user.id)
  const pemilikSiswa = req.user.role === 'siswa' && Number(request.siswa_id) === Number(req.user.id)
  if (req.user.role !== 'admin' && !pemilikOrtu && !pemilikSiswa) {
    return res.status(403).json({ error: 'Tidak punya akses' })
  }
  const proof = await db.prepare('SELECT content_type, file_name, data_base64, file_size, uploaded_at FROM topup_proof WHERE topup_id = ?').get(req.params.id)
  if (!proof) return res.status(404).json({ error: 'Bukti transfer belum diunggah' })
  res.json({
    data_url: `data:${proof.content_type};base64,${proof.data_base64}`,
    bukti: {
      url: `data:${proof.content_type};base64,${proof.data_base64}`,
      data_url: `data:${proof.content_type};base64,${proof.data_base64}`,
      nama: proof.file_name,
      ukuran: Number(proof.file_size),
      diunggah_at: proof.uploaded_at
    }
  })
})

topupRouter.post('/:id/proof', wajibLogin, wajibRole('ortu'), async (req, res) => {
  const { data_url, nama, mime, ukuran } = req.body || {}
  const request = await db.prepare('SELECT ortu_id, status FROM topup_request WHERE id = ?').get(req.params.id)
  if (!request) return res.status(404).json({ error: 'Permintaan top-up tidak ditemukan' })
  if (Number(request.ortu_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Tidak punya akses' })
  if (request.status !== 'menunggu') return res.status(409).json({ error: 'Bukti hanya dapat diunggah untuk permintaan yang menunggu verifikasi' })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || typeof data_url !== 'string') {
    return res.status(400).json({ error: 'Bukti harus berupa gambar JPG, PNG, atau WEBP' })
  }
  if (data_url.length > 7 * 1024 * 1024) return res.status(413).json({ error: 'Ukuran bukti transfer maksimal 5 MB' })
  const matched = data_url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!matched || matched[1] !== mime) return res.status(400).json({ error: 'Format bukti transfer tidak valid' })

  const bytes = Buffer.from(matched[2], 'base64')
  if (bytes.toString('base64') !== matched[2] || bytes.length < 1 || bytes.length > 5 * 1024 * 1024 || Number(ukuran) !== bytes.length) {
    return res.status(400).json({ error: 'Ukuran bukti transfer tidak valid atau melebihi 5 MB' })
  }
  const signatureValid = mime === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!signatureValid) return res.status(400).json({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih' })

  const fileName = String(nama || 'bukti-transfer').replace(/[\\/\0]/g, '_').slice(0, 255)
  await db.prepare(
    `INSERT INTO topup_proof (topup_id, content_type, file_name, data_base64, file_size)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (topup_id) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       file_name = EXCLUDED.file_name,
       data_base64 = EXCLUDED.data_base64,
       file_size = EXCLUDED.file_size,
       uploaded_at = CURRENT_TIMESTAMP`
  ).run(req.params.id, mime, fileName, matched[2], bytes.length)
  const savedProof = await db.prepare('SELECT uploaded_at FROM topup_proof WHERE topup_id = ?').get(req.params.id)
  await audit(req, 'UNGGAH_BUKTI_TOPUP', `Request #${req.params.id} · ${fileName}`, 'topup_request', Number(req.params.id))
  res.status(201).json({ ok: true, nama: fileName, ukuran: bytes.length, diunggah_at: savedProof.uploaded_at })
})

async function prosesPersetujuan(req, id) {
  const trx = db.transaction(async () => {
    const permintaan = await db.prepare('SELECT * FROM topup_request WHERE id = ?').get(id)
    if (!permintaan) throw { code: 404, msg: 'Permintaan tidak ditemukan' }
    if (permintaan.status !== 'menunggu') throw { code: 409, msg: 'Sudah diproses sebelumnya' }
    const bukti = await db.prepare('SELECT topup_id FROM topup_proof WHERE topup_id = ?').get(id)
    if (!bukti) throw { code: 409, msg: 'Bukti transfer belum diunggah' }
    if (permintaan.tagihan_id) {
      const tagihan = await db.prepare('SELECT * FROM tagihan WHERE id = ?').get(permintaan.tagihan_id)
      if (!tagihan || Number(tagihan.siswa_id) !== Number(permintaan.siswa_id)) throw { code: 409, msg: 'Tagihan tidak cocok dengan siswa pada permintaan' }
      if (tagihan.status !== 'belum_bayar') throw { code: 409, msg: tagihan.status === 'lunas' ? 'Tagihan sudah lunas' : 'Tagihan sudah dibatalkan atau tidak dapat dibayar' }
      if (Number(tagihan.nominal) !== Number(permintaan.nominal)) throw { code: 409, msg: 'Nominal transfer tidak sama dengan nominal tagihan' }
    }

    await db.prepare(
      `UPDATE topup_request SET status = 'disetujui', diproses_oleh = ?, diproses_at = datetime('now')
       WHERE id = ?`
    ).run(req.user.id, id)

    if (permintaan.tagihan_id) {
      // Transfer ini earmark utk satu tagihan spesifik — lunaskan tagihan,
      // JANGAN kredit saldo saku (uangnya tidak pernah masuk dompet jajan).
      await db.prepare(`UPDATE tagihan SET status = 'lunas' WHERE id = ?`).run(permintaan.tagihan_id)
    } else {
      const nominalKredit = Number(permintaan.nominal) + Number(permintaan.kode_unik)
      const info = await db.prepare(
        `INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, ref_tabel, ref_id, dibuat_oleh)
         VALUES (?, 'topup', ?, ?, 'topup_request', ?, ?)`
      ).run(permintaan.siswa_id, nominalKredit, 'Top-up disetujui admin termasuk kode unik', id, req.user.id)
      permintaan.ledger_id = info.lastInsertRowid
    }

    await audit(req, 'SETUJUI_TOPUP', `Request #${id} · siswa #${permintaan.siswa_id} · Rp ${(Number(permintaan.nominal) + (permintaan.tagihan_id ? 0 : Number(permintaan.kode_unik))).toLocaleString('id-ID')}${permintaan.tagihan_id ? ' · tagihan #' + permintaan.tagihan_id : ''}`, 'topup_request', Number(id))
    return permintaan
  })

  return trx()
}

async function tolakOtomatisTanpaBukti(req, id) {
  const alasan = 'Bukti transfer tidak diunggah; ditolak otomatis saat verifikasi massal.'
  const info = await db.prepare(
    `UPDATE topup_request SET status = 'ditolak', alasan_tolak = ?, pernah_ditolak = 1, diproses_oleh = ?, diproses_at = datetime('now')
     WHERE id = ? AND status = 'menunggu'
       AND NOT EXISTS (SELECT 1 FROM topup_proof WHERE topup_id = topup_request.id)`
  ).run(alasan, req.user.id, id)
  if (info.changes === 0) throw { code: 409, msg: 'Permintaan sudah diproses atau bukti transfer sudah diunggah' }
  await audit(req, 'TOLAK_TOPUP_OTOMATIS', `Request #${id} · bukti transfer tidak diunggah`, 'topup_request', Number(id))
  return { status: 'ditolak', alasan }
}

topupRouter.post('/batch/verify', wajibLogin, wajibRole('admin'), async (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 300 ||
      ids.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
    return res.status(400).json({ error: 'Pilih 1–300 permintaan pembayaran yang valid' })
  }
  const uniqueIds = [...new Set(ids.map(Number))]
  const hasil = []

  for (const id of uniqueIds) {
    try {
      const request = await db.prepare('SELECT status FROM topup_request WHERE id = ?').get(id)
      if (!request) throw { code: 404, msg: 'Permintaan tidak ditemukan' }
      if (request.status !== 'menunggu') throw { code: 409, msg: 'Permintaan sudah diproses sebelumnya' }
      const proof = await db.prepare('SELECT topup_id FROM topup_proof WHERE topup_id = ?').get(id)
      if (!proof) {
        hasil.push({ id, ...(await tolakOtomatisTanpaBukti(req, id)) })
        continue
      }

      const approved = await prosesPersetujuan(req, id)
      hasil.push({ id, status: 'disetujui', tagihan_id: approved.tagihan_id || null })
    } catch (error) {
      if (error.msg && /tagihan tidak cocok|nominal transfer tidak sama|tagihan sudah lunas|tagihan.*dibatalkan/i.test(error.msg)) {
        try {
          const alasan = `Ditolak otomatis: ${error.msg}.`
          const info = await db.prepare(
            `UPDATE topup_request SET status = 'ditolak', alasan_tolak = ?, pernah_ditolak = 1, diproses_oleh = ?, diproses_at = datetime('now')
             WHERE id = ? AND status = 'menunggu'`
          ).run(alasan, req.user.id, id)
          if (info.changes) {
            await audit(req, 'TOLAK_TOPUP_OTOMATIS', `Request #${id} · ${error.msg}`, 'topup_request', id)
            hasil.push({ id, status: 'ditolak', alasan })
            continue
          }
        } catch (rejectError) {
          console.error(`Gagal menolak otomatis permintaan #${id}:`, rejectError)
        }
      }
      hasil.push({ id, status: 'gagal', error: error.msg || 'Permintaan tidak dapat diproses' })
    }
  }

  res.json({
    hasil,
    disetujui: hasil.filter((item) => item.status === 'disetujui').length,
    ditolak: hasil.filter((item) => item.status === 'ditolak').length,
    gagal: hasil.filter((item) => item.status === 'gagal').length
  })
})

topupRouter.post('/:id/approve', wajibLogin, wajibRole('admin'), async (req, res) => {
  const id = req.params.id
  try {
    const permintaan = await prosesPersetujuan(req, id)
    res.json({ ok: true, siswa_id: permintaan.siswa_id, nominal: permintaan.nominal, tagihan_id: permintaan.tagihan_id, ledger_id: permintaan.ledger_id || null })
  } catch (e) {
    res.status(e.code || 500).json({ error: e.msg || 'Gagal memproses' })
  }
})

topupRouter.post('/:id/tolak', wajibLogin, wajibRole('admin'), async (req, res) => {
  const { alasan } = req.body || {}
  const info = await db.prepare(
    `UPDATE topup_request SET status = 'ditolak', alasan_tolak = ?, pernah_ditolak = 1, diproses_oleh = ?, diproses_at = datetime('now')
     WHERE id = ? AND status = 'menunggu'`
  ).run(alasan || null, req.user.id, req.params.id)

  if (info.changes === 0) return res.status(409).json({ error: 'Tidak ditemukan atau sudah diproses' })
  await audit(req, 'TOLAK_TOPUP', `Request #${req.params.id}${alasan ? ' · ' + alasan : ''}`, 'topup_request', Number(req.params.id))
  res.json({ ok: true })
})

// Admin dapat menerima kembali pembayaran yang sebelumnya ditolak, misalnya
// saat transfer baru masuk/terdeteksi belakangan. Endpoint ini sengaja hanya
// menerima status `ditolak` agar tidak ada kredit/lunas ganda.
topupRouter.post('/:id/terima-kembali', wajibLogin, wajibRole('admin'), async (req, res) => {
  const id = req.params.id
  const trx = db.transaction(async () => {
    const permintaan = await db.prepare('SELECT * FROM topup_request WHERE id = ?').get(id)
    if (!permintaan) throw { code: 404, msg: 'Permintaan tidak ditemukan' }
    if (permintaan.status !== 'ditolak') throw { code: 409, msg: 'Hanya pembayaran yang ditolak yang dapat diterima kembali' }

    if (permintaan.tagihan_id) {
      const tagihan = await db.prepare('SELECT * FROM tagihan WHERE id = ?').get(permintaan.tagihan_id)
      if (!tagihan || Number(tagihan.siswa_id) !== Number(permintaan.siswa_id)) throw { code: 409, msg: 'Tagihan tidak cocok dengan siswa pada permintaan' }
      if (tagihan.status !== 'belum_bayar') throw { code: 409, msg: tagihan.status === 'lunas' ? 'Tagihan sudah lunas' : 'Tagihan sudah dibatalkan atau tidak dapat dibayar' }
      if (Number(tagihan.nominal) !== Number(permintaan.nominal)) throw { code: 409, msg: 'Nominal pembayaran tidak sama dengan tagihan' }
    }

    await db.prepare(`UPDATE topup_request SET status='disetujui', diproses_oleh=?, diproses_at=datetime('now') WHERE id=?`).run(req.user.id, id)

    if (permintaan.tagihan_id) {
      await db.prepare(`UPDATE tagihan SET status='lunas' WHERE id=?`).run(permintaan.tagihan_id)
    } else {
      const info = await db.prepare(`INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, ref_tabel, ref_id, dibuat_oleh) VALUES (?, 'topup', ?, ?, 'topup_request', ?, ?)`).run(
        permintaan.siswa_id, Number(permintaan.nominal) + Number(permintaan.kode_unik), 'Top-up diterima kembali setelah penolakan termasuk kode unik', id, req.user.id
      )
    }

    await audit(req, 'TERIMA_KEMBALI_TOPUP', `Request #${id} · pembayaran sebelumnya ditolak lalu diterima`, 'topup_request', Number(id))
    return permintaan
  })

  try {
    const permintaan = await trx()
    res.json({ ok: true, siswa_id: permintaan.siswa_id, nominal: permintaan.nominal, tagihan_id: permintaan.tagihan_id })
  } catch (e) {
    res.status(e.code || 500).json({ error: e.msg || 'Gagal menerima kembali pembayaran' })
  }
})
