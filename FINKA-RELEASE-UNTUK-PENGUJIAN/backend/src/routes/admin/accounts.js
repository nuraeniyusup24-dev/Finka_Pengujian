import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { audit } from '../../audit.js'
import { simpanProfilSiswa, simpanAnakOrtu, semuaIdValid, pesanErrorSql } from './helpers.js'


export const adminAccountsRouter = Router()

function teksValid(value, max, { min = 1 } = {}) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
}
function usernameValid(value) {
  return teksValid(value, 64) && /^[A-Za-z0-9._-]+$/.test(value.trim())
}
function passwordValid(value) {
  // bcrypt silently truncates after 72 bytes; reject longer passwords rather than hashing a prefix.
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72
}
function isUniqueViolation(error) { return error?.code === '23505' }

async function validasiImporPic(inputRows) {
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return { valid: 0, jumlah_error: 0, baris: [], pic: [] }
  }
  if (inputRows.length > 300) {
    return {
      valid: 0,
      jumlah_error: inputRows.length,
      baris: inputRows.map((row) => ({ ...row, error: 'Maksimal 300 baris menu per unggahan.' })),
      pic: []
    }
  }

  const baris = inputRows.map((row) => ({
    no: Number(row?.no) || 0,
    nama_pic: String(row?.nama_pic || '').trim(),
    username_pic: String(row?.username_pic || '').trim(),
    password_sementara: String(row?.password_sementara || ''),
    nama_outlet: String(row?.nama_outlet || '').trim(),
    jam_buka: String(row?.jam_buka || '').trim(),
    jam_tutup: String(row?.jam_tutup || '').trim(),
    nama_menu: String(row?.nama_menu || '').trim(),
    kategori: String(row?.kategori || '').trim(),
    harga: String(row?.harga || '').trim(),
    deskripsi: String(row?.deskripsi || '').trim(),
    error: ''
  }))
  const pic = new Map()
  const outletHours = new Map()
  const menus = new Set()
  const errors = []

  for (const row of baris) {
    const gagal = (message) => { if (!row.error) row.error = message }
    if (!teksValid(row.nama_pic, 80)) gagal('Nama PIC wajib diisi (maksimal 80 karakter).')
    else if (!usernameValid(row.username_pic)) gagal('Username PIC wajib diisi (maksimal 64 karakter; gunakan huruf, angka, titik, garis bawah, atau tanda hubung).')
    else if (!passwordValid(row.password_sementara)) gagal('Password sementara wajib minimal 8 karakter dan maksimal 72 byte.')
    else if (!teksValid(row.nama_outlet, 80)) gagal('Nama outlet wajib diisi (maksimal 80 karakter).')
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.jam_buka) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.jam_tutup) || row.jam_tutup <= row.jam_buka) gagal('Jam buka/tutup tidak valid.')
    else if (!teksValid(row.nama_menu, 120)) gagal('Nama menu wajib diisi (maksimal 120 karakter).')
    else if (!teksValid(row.kategori, 40)) gagal('Kategori wajib diisi (maksimal 40 karakter).')
    else if (!/^\d+$/.test(row.harga) || !Number.isSafeInteger(Number(row.harga)) || Number(row.harga) <= 0) gagal('Harga harus bilangan bulat lebih dari 0.')
    else if (row.deskripsi.length > 120) gagal('Deskripsi maksimal 120 karakter.')

    if (row.error) continue
    const account = {
      nama: row.nama_pic,
      password: row.password_sementara,
      outlet: row.nama_outlet,
      hours: `${row.jam_buka}–${row.jam_tutup}`
    }
    const prior = pic.get(row.username_pic)
    if (prior && (prior.nama !== account.nama || prior.password !== account.password ||
      prior.outlet !== account.outlet || prior.hours !== account.hours)) {
      gagal('Data PIC dengan username yang sama harus konsisten pada setiap baris menu.')
      continue
    }
    if (!prior) pic.set(row.username_pic, account)

    const outletKey = row.nama_outlet.toLowerCase()
    const priorHours = outletHours.get(outletKey)
    if (priorHours && priorHours !== account.hours) {
      gagal('Jam operasional harus sama untuk seluruh PIC pada outlet yang sama.')
      continue
    }
    if (!priorHours) outletHours.set(outletKey, account.hours)

    const menuKey = `${row.nama_outlet.toLowerCase()}\u0000${row.nama_menu.toLowerCase()}`
    if (menus.has(menuKey)) {
      gagal('Nama menu yang sama terulang pada outlet ini.')
      continue
    }
    menus.add(menuKey)
  }

  for (const [username, account] of pic) {
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      for (const row of baris) if (row.username_pic === username && !row.error) row.error = 'Username PIC sudah digunakan.'
    }
    const conflict = await db.prepare("SELECT id FROM users WHERE role = 'pic' AND lower(trim(outlet)) = lower(trim(?)) AND outlet_hours IS NOT NULL AND outlet_hours != ? LIMIT 1")
      .get(account.outlet, account.hours)
    if (conflict) {
      for (const row of baris) if (row.username_pic === username && !row.error) row.error = 'Jam operasional outlet harus sama untuk seluruh PIC pada outlet yang sama.'
    }
  }

  for (const row of baris) {
    if (row.error) continue
    const existing = await db.prepare('SELECT id FROM produk WHERE lower(trim(outlet)) = lower(trim(?)) AND lower(trim(nama)) = lower(trim(?)) LIMIT 1')
      .get(row.nama_outlet, row.nama_menu)
    if (existing) row.error = 'Nama menu sudah terdaftar pada outlet ini.'
  }

  for (const row of baris) if (row.error) errors.push(row)
  return {
    valid: baris.length - errors.length,
    jumlah_error: errors.length,
    baris: baris.map(({ password_sementara, ...row }) => row),
    pic: Array.from(pic.keys())
  }
}

adminAccountsRouter.post('/users/siswa', wajibLogin, hanyaAdmin, async (req, res) => {
  const nama = String(req.body?.nama || '').trim()
  const kelas = String(req.body?.kelas || '').trim()
  const nis = String(req.body?.nis || '').trim()
  const ortuId = Number(req.body?.ortu_id)
  if (!nama || nama.length > 80 || !kelas || kelas.length > 20 || !nis || nis.length > 30 ||
      !/^[A-Za-z0-9._-]{1,30}$/.test(nis) || !Number.isInteger(ortuId) || ortuId <= 0) {
    return res.status(400).json({ error: 'Nama siswa, kelas, NIS, dan akun orang tua wajib diisi dengan benar' })
  }

  const username = nis
  const passwordAwal = crypto.randomBytes(9).toString('base64url')
  const passwordHash = bcrypt.hashSync(passwordAwal, 10)

  try {
    const result = await db.transaction(async () => {
      const ortu = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu' AND active = 1").get(ortuId)
      if (!ortu) {
        const error = new Error('Akun orang tua tidak ditemukan atau tidak aktif')
        error.status = 400
        throw error
      }
      const existingUsername = await db.prepare('SELECT id FROM users WHERE username = ?').get(username)
      if (existingUsername) {
        const error = new Error('NIS sudah digunakan sebagai username akun lain')
        error.status = 409
        throw error
      }
      const existingNis = await db.prepare('SELECT user_id FROM siswa_profil WHERE nis = ?').get(nis)
      if (existingNis) {
        const error = new Error('NIS sudah dipakai siswa lain')
        error.status = 409
        throw error
      }

      const student = await db.prepare(`INSERT INTO users
        (username, password_hash, nama, role, outlet, active, must_change_password)
        VALUES (?, ?, ?, 'siswa', NULL, 1, 1)`)
        .run(username, passwordHash, nama)
      await db.prepare(`INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis)
        VALUES (?, ?, ?, ?)`)
        .run(student.lastInsertRowid, ortuId, kelas, nis)
      return { id: student.lastInsertRowid, parentId: ortuId }
    })()

    await audit(req, 'BUAT_AKUN', `siswa · ${nama} · wali #${result.parentId}`, 'users', Number(result.id))
    res.status(201).json({
      message: 'Akun siswa berhasil dibuat dan dihubungkan ke akun orang tua',
      password_awal: passwordAwal,
      user: { id: result.id, username, nama, role: 'siswa', kelas, nis, ortu_id: result.parentId }
    })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    if (isUniqueViolation(error)) return res.status(409).json({ error: 'NIS atau username sudah digunakan akun lain' })
    console.error('Gagal membuat akun siswa:', error)
    res.status(500).json({ error: pesanErrorSql(error, 'Gagal membuat akun siswa') })
  }
})

adminAccountsRouter.post('/impor-siswa', wajibLogin, hanyaAdmin, async (req, res) => {
  const rows = req.body?.baris
  const simpan = req.body?.simpan === true
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 300) {
    return res.status(400).json({ error: 'Impor harus berisi 1–300 baris siswa' })
  }

  const normalized = rows.map((row, index) => ({
    no: Number.isInteger(Number(row?.no)) && Number(row.no) > 0 ? Number(row.no) : index + 2,
    nama_siswa: String(row?.nama_siswa || '').trim(),
    nis: String(row?.nis || '').trim(),
    kelas: String(row?.kelas || '').trim(),
    password_siswa: String(row?.password_siswa ?? ''),
    nama_ortu: String(row?.nama_ortu || '').trim(),
    username_ortu: String(row?.username_ortu || '').trim(),
    password_ortu: String(row?.password_ortu ?? ''),
    error: ''
  }))
  const nisCount = new Map()
  const parentNames = new Map()
  const parentPasswords = new Map()
  const existingParents = new Map()
  for (const row of normalized) {
    nisCount.set(row.nis, (nisCount.get(row.nis) || 0) + 1)
    const key = row.username_ortu ? `u:${row.username_ortu.toLowerCase()}` : `n:${row.nama_ortu.toLowerCase()}`
    if (!parentNames.has(key)) parentNames.set(key, row.nama_ortu)
    else if (parentNames.get(key).toLowerCase() !== row.nama_ortu.toLowerCase()) {
      row.error = 'Nama orang tua berbeda untuk username yang sama.'
    }
    if (row.username_ortu && !existingParents.has(row.username_ortu.toLowerCase())) {
      const parent = await db.prepare('SELECT role, active FROM users WHERE lower(username) = lower(?)').get(row.username_ortu)
      existingParents.set(row.username_ortu.toLowerCase(), parent || null)
    }
    const existingParent = row.username_ortu ? existingParents.get(row.username_ortu.toLowerCase()) : null
    if (!existingParent) {
      if (!parentPasswords.has(key)) parentPasswords.set(key, row.password_ortu)
      else if (parentPasswords.get(key) !== row.password_ortu) {
        row.error = 'Password orang tua harus sama untuk semua siswa yang memakai akun orang tua yang sama.'
      }
    }
  }

  for (const row of normalized) {
    const errors = []
    if (!row.nama_siswa || row.nama_siswa.length > 80) errors.push('Nama siswa wajib diisi (maksimal 80 karakter).')
    if (!row.nis || row.nis.length > 30 || !/^[A-Za-z0-9._-]{1,30}$/.test(row.nis)) errors.push('NIS wajib dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.')
    if (!row.kelas || row.kelas.length > 20) errors.push('Kelas wajib diisi (maksimal 20 karakter).')
    if (!passwordValid(row.password_siswa)) errors.push('Password siswa wajib diisi (8–72 byte).')
    if (!row.nama_ortu || row.nama_ortu.length > 80) errors.push('Nama orang tua wajib diisi (maksimal 80 karakter).')
    if (row.username_ortu && !usernameValid(row.username_ortu)) errors.push('Username orang tua tidak valid.')
    const existingParent = row.username_ortu ? existingParents.get(row.username_ortu.toLowerCase()) : null
    if (!existingParent && !passwordValid(row.password_ortu)) errors.push('Password orang tua wajib diisi untuk akun baru (8–72 byte).')
    if (nisCount.get(row.nis) > 1) errors.push('NIS duplikat di dalam file.')

    if (row.nis && /^[A-Za-z0-9._-]{1,30}$/.test(row.nis)) {
      const existing = await db.prepare('SELECT user_id FROM siswa_profil WHERE nis = ?').get(row.nis)
      const existingUsername = await db.prepare('SELECT id FROM users WHERE username = ?').get(row.nis)
      if (existing || existingUsername) errors.push('NIS atau username sudah digunakan.')
    }
    if (existingParent && (existingParent.role !== 'ortu' || Number(existingParent.active) !== 1)) {
      errors.push('Username orang tua sudah digunakan atau akunnya tidak aktif.')
    }
    if (row.error) errors.push(row.error)
    row.error = [...new Set(errors)].join(' ')
  }

  const preview = {
    ok: normalized.every((row) => !row.error),
    pratinjau: !simpan,
    valid: normalized.filter((row) => !row.error).length,
    jumlah_error: normalized.filter((row) => row.error).length,
    baris: normalized.map(({ password_siswa, password_ortu, ...row }) => row)
  }
  if (!simpan) return res.json(preview)
  if (preview.jumlah_error) return res.status(400).json({ ...preview, error: 'Perbaiki baris yang ditandai sebelum menyimpan.' })

  try {
    const result = await db.transaction(async () => {
      const parentByKey = new Map()
      const accounts = []

      for (const row of normalized) {
        const parentKey = row.username_ortu
          ? `u:${row.username_ortu.toLowerCase()}`
          : `n:${row.nama_ortu.toLowerCase()}`
        let parent = parentByKey.get(parentKey)
        if (!parent) {
          if (row.username_ortu) {
            const existing = await db.prepare("SELECT id, username, nama, role, active FROM users WHERE lower(username) = lower(?)").get(row.username_ortu)
            if (existing) {
              if (existing.role !== 'ortu' || Number(existing.active) !== 1) {
                const error = new Error(`Akun orang tua "${row.username_ortu}" tidak valid atau tidak aktif.`)
                error.status = 409
                throw error
              }
              parent = { id: Number(existing.id), username: existing.username, nama: existing.nama, password: '' }
            }
          }

          if (!parent) {
            const base = row.username_ortu || String(row.nama_ortu)
              .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
              .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 36) || 'ortu'
            let username = row.username_ortu || ''
            if (!username) {
              do {
                username = `${base}.${crypto.randomBytes(3).toString('hex')}`
              } while (await db.prepare('SELECT id FROM users WHERE username = ?').get(username))
            }
            const password = row.password_ortu
            const created = await db.prepare(`INSERT INTO users (username, password_hash, nama, role, outlet, active, must_change_password)
              VALUES (?, ?, ?, 'ortu', NULL, 1, 1)`)
              .run(username, bcrypt.hashSync(password, 10), row.nama_ortu)
            parent = { id: Number(created.lastInsertRowid), username, nama: row.nama_ortu, password }
            await audit(req, 'BUAT_AKUN', `ortu · ${row.nama_ortu} · impor siswa`, 'users', parent.id)
          }
          parentByKey.set(parentKey, parent)
        }

        const passwordHash = bcrypt.hashSync(row.password_siswa, 10)
        const student = await db.prepare(`INSERT INTO users
          (username, password_hash, nama, role, outlet, active, must_change_password)
          VALUES (?, ?, ?, 'siswa', NULL, 1, 1)`)
          .run(row.nis, passwordHash, row.nama_siswa)
        await db.prepare('INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis) VALUES (?, ?, ?, ?)')
          .run(student.lastInsertRowId, parent.id, row.kelas, row.nis)
        await audit(req, 'BUAT_AKUN', `siswa · ${row.nama_siswa} · kelas ${row.kelas} · impor Excel`, 'users', Number(student.lastInsertRowId))
        accounts.push({
          nama_siswa: row.nama_siswa,
          kelas: row.kelas,
          nis: row.nis,
          username_siswa: row.nis,
          nama_ortu: parent.nama,
          username_ortu: parent.username,
          password_ortu: parent.password || '(akun lama, password tidak diubah)'
        })
      }

      return accounts
    })()
    res.status(201).json({ ok: true, jumlah: result.length, akun: result })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    if (isUniqueViolation(error)) return res.status(409).json({ error: 'NIS atau username sudah dipakai. Muat ulang data, lalu periksa file Excel.' })
    console.error('Gagal mengimpor akun siswa:', error)
    res.status(500).json({ error: pesanErrorSql(error, 'Gagal menyimpan impor akun siswa') })
  }
})

adminAccountsRouter.post('/impor-pic', wajibLogin, hanyaAdmin, async (req, res) => {
  const rows = req.body?.baris
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'File harus berisi minimal satu baris PIC dan menu.' })
  }
  if (rows.length > 300) return res.status(400).json({ error: 'Maksimal 300 baris menu per unggahan.' })

  const simpan = req.body?.simpan === true
  try {
    if (!simpan) return res.json(await validasiImporPic(rows))

    const result = await db.transaction(async () => {
      const preview = await validasiImporPic(rows)
      if (preview.jumlah_error) {
        const error = new Error('Perbaiki baris yang ditandai sebelum menyimpan impor.')
        error.status = 400
        error.preview = preview
        throw error
      }

      const picByUsername = new Map()
      for (const row of rows) {
        const username = String(row.username_pic).trim()
        if (!picByUsername.has(username)) {
          picByUsername.set(username, {
            nama: String(row.nama_pic).trim(),
            password: String(row.password_sementara),
            outlet: String(row.nama_outlet).trim(),
            hours: `${String(row.jam_buka).trim()}–${String(row.jam_tutup).trim()}`
          })
        }
      }

      const createdPic = []
      for (const [username, pic] of picByUsername) {
        const user = await db.prepare(`INSERT INTO users
          (username, password_hash, nama, role, outlet, outlet_hours, active, must_change_password)
          VALUES (?, ?, ?, 'pic', ?, ?, 1, 1)`)
          .run(username, bcrypt.hashSync(pic.password, 10), pic.nama, pic.outlet, pic.hours)
        const userId = Number(user.lastInsertRowid)
        createdPic.push({ id: userId, nama: pic.nama, username, outlet: pic.outlet, outlet_jam: pic.hours })
        await audit(req, 'BUAT_AKUN', `pic · ${pic.nama} · ${pic.outlet} · impor Excel`, 'users', userId)
      }

      for (const row of rows) {
        const namaMenu = String(row.nama_menu).trim()
        const kategori = String(row.kategori).trim()
        const outlet = String(row.nama_outlet).trim()
        const harga = Number(row.harga)
        const deskripsi = String(row.deskripsi || '').trim()
        const product = await db.prepare('INSERT INTO produk (nama, harga, outlet, kategori, deskripsi) VALUES (?, ?, ?, ?, ?)')
          .run(namaMenu, harga, outlet, kategori, deskripsi || null)
        await audit(req, 'BUAT_PRODUK', `${namaMenu} · Rp ${harga.toLocaleString('id-ID')} · ${outlet} · impor Excel`, 'produk', Number(product.lastInsertRowid))
      }

      return { jumlah_pic: createdPic.length, jumlah_menu: rows.length, akun: createdPic }
    })()
    res.status(201).json({ ok: true, ...result })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message, ...(error.preview ? { ...error.preview } : {}) })
    if (isUniqueViolation(error)) return res.status(409).json({ error: 'Username PIC atau menu sudah digunakan. Muat ulang data, lalu periksa file Excel.' })
    console.error('Gagal mengimpor akun PIC dan menu:', error)
    res.status(500).json({ error: pesanErrorSql(error, 'Gagal menyimpan impor akun PIC dan menu') })
  }
})

adminAccountsRouter.post('/users/:id/password', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const password = req.body?.password
  const confirmation = req.body?.konfirmasi_password
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID akun tidak valid' })
  if (!passwordValid(password) || password !== confirmation) {
    return res.status(400).json({ error: 'Password harus 8–72 byte dan konfirmasinya harus sama' })
  }

  try {
    const result = await db.transaction(async () => {
      const target = await db.prepare("SELECT id, nama, username FROM users WHERE id = ? AND role = 'siswa'").get(id)
      if (!target) {
        const error = new Error('Akun siswa tidak ditemukan')
        error.status = 404
        throw error
      }
      const passwordHash = bcrypt.hashSync(password, 10)
      await db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(passwordHash, id)
      await audit(req, 'ATUR_PASSWORD_AWAL_SISWA', `Admin mengatur password awal siswa #${id}`, 'users', id)
      return target
    })()
    res.json({
      message: 'Password awal berhasil diatur. Siswa wajib menggantinya saat login pertama.',
      user: { id: result.id, nama: result.nama, username: result.username, password_terpasang: true, wajib_ganti_password: true }
    })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Gagal mengatur password awal siswa:', error)
    res.status(500).json({ error: 'Gagal mengatur password awal siswa' })
  }
})

adminAccountsRouter.post('/users', wajibLogin, hanyaAdmin, async (req, res) => {
  const { username: inputUsername, password: inputPassword, nama, role, kelas, nis, ortu_id, anak_ids, anak_baru, outlet, outlet_jam, hubungan, pekerjaan, no_hp, email } = req.body || {}
  let username = typeof inputUsername === 'string' ? inputUsername.trim() : ''
  let password = typeof inputPassword === 'string' ? inputPassword : ''
  let passwordDibuatServer = false
  const outletNama = typeof outlet === 'string' ? outlet.trim() : ''
  const emailBersih = String(email || '').trim().toLowerCase()
  const hpInput = String(no_hp || '').trim().replace(/[\s()-]/g, '')
  const hpBersih = /^\+628\d{8,11}$/.test(hpInput) ? '08' + hpInput.slice(3) : hpInput

  // Form pendaftaran Admin tidak meminta username/password; server membuat kredensial
  // acak yang hanya dikembalikan satu kali. Jika API caller mengirim nilai sendiri,
  // nilai itu tetap divalidasi dan tidak diganti diam-diam.
  if (!teksValid(nama, 80) || !role) {
    return res.status(400).json({ error: 'Nama dan role wajib diisi' })
  }
  if (!username) {
    const slug = String(nama).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 36) || 'akun'
    username = `${slug}.${crypto.randomBytes(3).toString('hex')}`
  }
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url')
    passwordDibuatServer = true
  }
  if (!usernameValid(username) || !passwordValid(password) || !teksValid(nama, 80)) {
    return res.status(400).json({ error: 'Username harus 1–64 karakter (huruf, angka, titik, garis bawah, atau tanda hubung); nama maksimal 80 karakter; password minimal 8 karakter dan maksimal 72 byte' })
  }
  if (role === 'siswa' && (!teksValid(kelas, 20) || !teksValid(nis, 30))) {
    return res.status(400).json({ error: 'Kelas dan NIS wajib diisi untuk akun siswa' })
  }
  if (role === 'siswa' && !/^[A-Za-z0-9._-]{1,30}$/.test(String(nis || '').trim())) {
    return res.status(400).json({ error: 'NIS hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung' })
  }

  const usernameBersih = String(username).trim()
  const namaBersih = String(nama).trim()

  // Validasi role yang diperbolehkan
  const roleValid = ['admin', 'siswa', 'ortu', 'pic']
  if (!roleValid.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid. Pilih: admin, siswa, ortu, atau pic' })
  }

  if (role === 'pic' && (!outletNama || outletNama.length > 80)) {
    return res.status(400).json({ error: 'Nama outlet PIC wajib diisi (maksimal 80 karakter)' })
  }
  const outletJam = typeof outlet_jam === 'string' ? outlet_jam.trim() : ''
  const jamOperasional = outletJam.match(/^((?:[01]\d|2[0-3]):[0-5]\d)–((?:[01]\d|2[0-3]):[0-5]\d)$/)
  if (role === 'pic' && (!jamOperasional || jamOperasional[2] <= jamOperasional[1])) {
    return res.status(400).json({ error: 'Jam operasional PIC wajib diisi dengan format jam buka dan tutup yang valid' })
  }
  if (role !== 'pic' && outlet_jam) {
    return res.status(400).json({ error: 'Jam operasional hanya boleh diisi untuk akun PIC' })
  }
  if (role !== 'pic' && outlet) {
    return res.status(400).json({ error: 'Outlet hanya boleh diisi untuk akun PIC' })
  }
  if (hpBersih && !/^08\d{8,11}$/.test(hpBersih)) {
    return res.status(400).json({ error: 'Nomor WhatsApp harus 10–13 digit dengan awalan 08 atau +62' })
  }
  if (emailBersih && (emailBersih.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBersih))) {
    return res.status(400).json({ error: 'Format email tidak valid' })
  }

  // Validasi keterkaitan LEBIH DULU, sebelum akun dibuat — supaya tidak
  // nyisa akun setengah jadi kalau ternyata link yang dipilih tidak valid.
  if (role === 'siswa' && ortu_id) {
    const ortu = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu'").get(ortu_id)
    if (!ortu) {
      return res.status(400).json({ error: 'Akun orang tua yang dipilih tidak ditemukan' })
    }
  }
  const anakIds = role === 'ortu' && Array.isArray(anak_ids) ? anak_ids.map(Number) : []
  const anakBaru = role === 'ortu' && Array.isArray(anak_baru) ? anak_baru : []
  if (anakBaru.length > 10) return res.status(400).json({ error: 'Maksimal 10 siswa baru dapat dibuat sekaligus' })
  if (anakBaru.some(a => !teksValid(a?.nama, 80) || !teksValid(a?.kelas, 20) || !teksValid(a?.nis, 30) || !/^[A-Za-z0-9._-]{1,30}$/.test(String(a?.nis || '').trim()))) {
    return res.status(400).json({ error: 'Setiap siswa baru harus memiliki nama, kelas, dan NIS valid' })
  }
  const nisAnakBaru = anakBaru.map(a => String(a.nis).trim())
  if (new Set(nisAnakBaru).size !== nisAnakBaru.length) return res.status(409).json({ error: 'Ada NIS ganda di daftar siswa baru' })
  if (role === 'ortu' && anakIds.length && !await semuaIdValid(anakIds, 'siswa')) {
    return res.status(400).json({ error: 'Salah satu akun siswa yang dipilih tidak ditemukan' })
  }

  try {
    const result = await db.transaction(async () => {
      if (role === 'siswa' && ortu_id) {
        const parent = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu' AND active = 1").get(Number(ortu_id))
        if (!parent) { const error = new Error('Akun orang tua tidak ditemukan atau tidak aktif'); error.status = 400; throw error }
      }
      if (role === 'ortu' && anakIds.length && !await semuaIdValid(anakIds, 'siswa')) {
        const error = new Error('Salah satu akun siswa yang dipilih tidak ditemukan'); error.status = 400; throw error
      }

      const salt = bcrypt.genSaltSync(10)
      const password_hash = bcrypt.hashSync(password, salt)
      const info = await db.prepare(`
        INSERT INTO users (username, password_hash, pin_hash, nama, role, outlet, outlet_hours, active, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(usernameBersih, password_hash, null, namaBersih, role, role === 'pic' ? outletNama : null, role === 'pic' ? outletJam : null, ['siswa', 'pic'].includes(role) ? 1 : 0)
      const userId = info.lastInsertRowid

      if (hubungan || pekerjaan || hpBersih || emailBersih) {
        const hubunganMap = { ibu: 'Ibu', ayah: 'Ayah', wali: 'Wali' }
        await db.prepare(`INSERT INTO user_profiles (user_id, hubungan, pekerjaan, no_hp, email) VALUES (?, ?, ?, ?, ?)`)
          .run(userId, hubunganMap[String(hubungan || '').toLowerCase()] || null, teksValid(pekerjaan, 100) ? pekerjaan.trim() : null, hpBersih || null, emailBersih || null)
      }
      if (role === 'siswa') await simpanProfilSiswa(userId, { kelas: String(kelas).trim(), nis: String(nis).trim(), ortu_id: ortu_id ? Number(ortu_id) : null })
      if (role === 'ortu' && anakIds.length) await simpanAnakOrtu(userId, anakIds)

      const anakBaruHasil = []
      if (role === 'ortu' && anakBaru.length) {
        const placeholders = nisAnakBaru.map(() => '?').join(',')
        const existingNis = await db.prepare(`SELECT nis FROM siswa_profil WHERE nis IN (${placeholders})`).all(...nisAnakBaru)
        const existingUsernames = await db.prepare(`SELECT username FROM users WHERE username IN (${placeholders})`).all(...nisAnakBaru)
        if (existingNis.length || existingUsernames.length) {
          const error = new Error('Salah satu NIS siswa baru sudah digunakan'); error.status = 409; throw error
        }
        for (const anak of anakBaru) {
          const anakNama = anak.nama.trim()
          const anakNis = String(anak.nis).trim()
          const anakKelas = anak.kelas.trim()
          const anakPassword = crypto.randomBytes(9).toString('base64url')
          const anakHash = bcrypt.hashSync(anakPassword, 10)
          const student = await db.prepare(`INSERT INTO users (username, password_hash, nama, role, outlet, active)
            VALUES (?, ?, ?, 'siswa', NULL, 1)`).run(anakNis, anakHash, anakNama)
          await db.prepare('INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis) VALUES (?, ?, ?, ?)')
            .run(student.lastInsertRowid, userId, anakKelas, anakNis)
          anakBaruHasil.push({ nama: anakNama, kelas: anakKelas, nis: anakNis, username: anakNis, password: anakPassword })
          await audit(req, 'BUAT_AKUN', `siswa · ${anakNama} · wali #${userId}`, 'users', Number(student.lastInsertRowid))
        }
      }

      await audit(req, 'BUAT_AKUN', `${role} · ${namaBersih}${role === 'pic' ? ' · ' + outletNama : ''}`, 'users', userId)
      await db.prepare(`INSERT INTO admin_notifications (kategori, judul, pesan, ref_user_id) VALUES ('akun', ?, ?, ?)`)
        .run('Akun baru ditambahkan', `${namaBersih} · ${role === 'pic' ? 'PIC' : role}${role === 'pic' ? ' · ' + outletNama : ''}${anakBaruHasil.length ? ` · ${anakBaruHasil.length} siswa baru` : ''}`, userId)
      return { userId, anakBaru: anakBaruHasil }
    })()

    res.status(201).json({
      message: 'Akun berhasil dibuat',
      user: { id: result.userId, username: usernameBersih, nama: namaBersih, role, outlet: role === 'pic' ? outletNama : null },
      ...(passwordDibuatServer ? { password_awal: password } : {}),
      ...(result.anakBaru.length ? { anak_baru: result.anakBaru } : {})
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'Username atau NIS sudah digunakan akun lain' })
    console.error('Gagal membuat user:', err)
    res.status(500).json({ error: pesanErrorSql(err, 'Terjadi kesalahan pada server saat membuat akun') })
  }
})


// Buat siswa + orang tua sekaligus dalam satu transaksi database.
// Jika salah satu insert gagal, keduanya dibatalkan sehingga tidak ada akun yatim.
adminAccountsRouter.post('/users/siswa-ortu', wajibLogin, hanyaAdmin, async (req, res) => {
  const {
    siswa_nama, siswa_password, kelas, nis,
    ortu_nama, ortu_username, ortu_password, ortu_hubungan, ortu_no_hp, ortu_email
  } = req.body || {}

  if (!teksValid(siswa_nama, 80) || !passwordValid(siswa_password) || !teksValid(kelas, 20) ||
      !teksValid(nis, 30) || !teksValid(ortu_nama, 80) || !usernameValid(ortu_username) || !passwordValid(ortu_password)) {
    return res.status(400).json({ error: 'Nama, kelas, NIS, username orang tua, dan password harus valid; password 8–72 byte' })
  }
  const siswaUsername = String(nis).trim()
  const ortuUsernameBersih = String(ortu_username).trim()
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(siswaUsername)) return res.status(400).json({ error: 'NIS hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung' })
  const phone = String(ortu_no_hp || '').trim().replace(/[\s()-]/g, '')
  const phoneClean = /^\+628\d{8,11}$/.test(phone) ? '08' + phone.slice(3) : phone
  const emailClean = String(ortu_email || '').trim().toLowerCase()
  if (phoneClean && !/^08\d{8,11}$/.test(phoneClean)) return res.status(400).json({ error: 'Nomor WhatsApp orang tua tidak valid' })
  if (emailClean && (emailClean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailClean))) return res.status(400).json({ error: 'Email orang tua tidak valid' })

  try {
    const hash = (password) => bcrypt.hashSync(password, 10)
    const create = db.transaction(async () => {
      const existing = await db.prepare('SELECT username FROM users WHERE username IN (?, ?)').all(siswaUsername, ortuUsernameBersih)
      if (existing.length) { const error = new Error(`Username sudah digunakan: ${existing.map(x => x.username).join(', ')}`); error.status = 409; throw error }
      const existingNis = await db.prepare('SELECT user_id FROM siswa_profil WHERE nis = ?').get(siswaUsername)
      if (existingNis) { const error = new Error('NIS sudah dipakai siswa lain'); error.status = 409; throw error }
      const ortu = await db.prepare(`
        INSERT INTO users (username, password_hash, nama, role, outlet)
        VALUES (?, ?, ?, 'ortu', NULL)
      `).run(ortuUsernameBersih, hash(ortu_password), ortu_nama.trim())
      const hubunganMap = { ibu: 'Ibu', ayah: 'Ayah', wali: 'Wali' }
      await db.prepare(`INSERT INTO user_profiles (user_id, hubungan, no_hp, email)
        VALUES (?, ?, ?, ?)`)
        .run(ortu.lastInsertRowid, hubunganMap[String(ortu_hubungan || '').toLowerCase()] || null, phoneClean || null, emailClean || null)

      const siswa = await db.prepare(`
        INSERT INTO users (username, password_hash, nama, role, outlet, active, must_change_password)
        VALUES (?, ?, ?, 'siswa', NULL, 1, 1)
      `).run(siswaUsername, hash(siswa_password), siswa_nama.trim())

      await db.prepare(`
        INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis)
        VALUES (?, ?, ?, ?)
      `).run(siswa.lastInsertRowid, ortu.lastInsertRowid, kelas.trim(), siswaUsername)

      await audit(req, 'BUAT_SISWA_ORTU', `${siswa_nama.trim()} (${siswaUsername}) · wali ${ortu_nama.trim()}`, 'users', Number(siswa.lastInsertRowid))
      await db.prepare(`INSERT INTO admin_notifications (kategori, judul, pesan, ref_user_id) VALUES ('akun', ?, ?, ?)`)
        .run('Akun siswa dan orang tua ditambahkan', `${siswa_nama.trim()} (kelas ${kelas.trim()}) terhubung dengan ${ortu_nama.trim()}`, Number(siswa.lastInsertRowid))
      return { siswaId: siswa.lastInsertRowid, ortuId: ortu.lastInsertRowid }
    })

    const result = await create()
    res.status(201).json({
      message: 'Akun siswa dan orang tua berhasil dibuat dan langsung terhubung',
      siswa: { id: result.siswaId, nama: siswa_nama.trim(), username: siswaUsername, role: 'siswa', kelas: kelas.trim(), nis: siswaUsername },
      ortu: { id: result.ortuId, nama: ortu_nama.trim(), username: ortuUsernameBersih, role: 'ortu' }
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'Username atau NIS sudah digunakan akun lain' })
    console.error('Gagal membuat siswa + orang tua:', err)
    res.status(500).json({ error: pesanErrorSql(err, 'Gagal membuat akun siswa dan orang tua') })
  }
})
