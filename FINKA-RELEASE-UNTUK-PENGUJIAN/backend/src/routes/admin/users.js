import { Router } from 'express'
import crypto from 'node:crypto'
import { db, saldoSiswa } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { audit } from '../../audit.js'
import bcrypt from 'bcryptjs'
import { simpanProfilSiswa, simpanAnakOrtu, semuaIdValid, pesanErrorSql } from './helpers.js'

export const adminUsersRouter = Router()

adminUsersRouter.get('/notifikasi', wajibLogin, hanyaAdmin, async (req, res) => {
  try {
    const notifikasi = await db.prepare(`SELECT id, kategori, judul, pesan, ref_user_id, created_at
      FROM admin_notifications ORDER BY id DESC LIMIT 100`).all()
    res.json({ notifikasi })
  } catch (error) {
    console.error('Gagal mengambil notifikasi Admin:', error.message)
    res.status(500).json({ error: 'Notifikasi Admin belum tersedia. Pastikan migrasi pin-recovery sudah diterapkan.' })
  }
})

// Endpoint untuk melihat daftar semua user, dilengkapi info keterkaitan:
// siswa membawa kelas/NIS/nama-ortu, ortu membawa daftar anak.
adminUsersRouter.get('/users', wajibLogin, hanyaAdmin, async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT u.id, u.username, u.nama, u.role, u.outlet, u.active,
             u.must_change_password AS wajib_ganti_password,
             (u.password_hash IS NOT NULL) AS password_terpasang,
             LOWER(up.hubungan) AS hubungan, up.pekerjaan, up.no_hp, up.email,
             sp.kelas AS kelas, sp.nis AS nis, sp.ortu_id AS ortu_id,
             ortuUser.nama AS ortu_nama
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN siswa_profil sp ON sp.user_id = u.id
      LEFT JOIN users ortuUser ON ortuUser.id = sp.ortu_id
      ORDER BY u.id ASC
    `).all()

    const anakRows = await db.prepare(`
      SELECT sp.ortu_id AS ortu_id, s.id AS id, s.nama AS nama, sp.kelas AS kelas, sp.nis AS nis
      FROM siswa_profil sp JOIN users s ON s.id = sp.user_id
      WHERE sp.ortu_id IS NOT NULL
      ORDER BY s.nama ASC
    `).all()
    const anakByOrtu = {}
    for (const r of anakRows) {
      const anak = anakByOrtu[r.ortu_id] || (anakByOrtu[r.ortu_id] = [])
      anak.push({ id: r.id, nama: r.nama, kelas: r.kelas, nis: r.nis })
    }

    const result = list.map((u) => (u.role === 'ortu' ? { ...u, anak: anakByOrtu[u.id] || [] } : u))
    res.json(result)
  } catch (err) {
    console.error('Gagal mengambil daftar user:', err)
    res.status(500).json({ error: 'Gagal mengambil data pengguna' })
  }
})

adminUsersRouter.put('/users/:id/kontak', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id)
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan' })
  const { hubungan, pekerjaan, no_hp, email } = req.body || {}
  const hp = String(no_hp || '').trim()
  const mail = String(email || '').trim().toLowerCase()
  if (hp && hp.length > 20) return res.status(400).json({ error: 'Nomor HP maksimal 20 karakter' })
  if (mail && (mail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail))) return res.status(400).json({ error: 'Email tidak valid' })
  let relation = null
  if (hubungan !== undefined) {
    const values = { ibu: 'Ibu', ayah: 'Ayah', wali: 'Wali', Ibu: 'Ibu', Ayah: 'Ayah', Wali: 'Wali' }
    relation = values[hubungan]
    if (!relation) return res.status(400).json({ error: 'Hubungan tidak valid' })
  }
  await db.prepare(`INSERT INTO user_profiles (user_id, hubungan, pekerjaan, no_hp, email)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET
    hubungan = COALESCE(EXCLUDED.hubungan, user_profiles.hubungan),
    pekerjaan = COALESCE(EXCLUDED.pekerjaan, user_profiles.pekerjaan),
    no_hp_verified_at = CASE WHEN user_profiles.no_hp IS DISTINCT FROM EXCLUDED.no_hp THEN NULL ELSE user_profiles.no_hp_verified_at END,
    email_verified_at = CASE WHEN user_profiles.email IS DISTINCT FROM EXCLUDED.email THEN NULL ELSE user_profiles.email_verified_at END,
    no_hp = EXCLUDED.no_hp, email = EXCLUDED.email`)
    .run(id, relation, pekerjaan || null, hp || null, mail || null)
  await audit(req, 'UBAH_KONTAK_AKUN', `${target.role} #${id} · kontak diperbarui`, 'users', id)
  res.json({ message: 'Kontak berhasil diperbarui' })
})

adminUsersRouter.post('/users/:id/verifikasi-kontak', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { channel, konfirmasi, metode } = req.body || {}
  const fields = {
    email: { contact: 'email', verified: 'email_verified_at' },
    whatsapp: { contact: 'no_hp', verified: 'no_hp_verified_at' }
  }
  const selected = fields[channel]
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID akun tidak valid' })
  if (!selected || konfirmasi !== true || !['tatap_muka', 'telepon_resmi'].includes(metode)) {
    return res.status(400).json({ error: 'Metode dan konfirmasi verifikasi kontak wajib diisi' })
  }
  try {
    await db.transaction(async () => {
      const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id)
      if (!target) {
        const error = new Error('Akun tidak ditemukan'); error.status = 404; throw error
      }
      const profile = await db.prepare(`SELECT ${selected.contact} AS contact FROM user_profiles WHERE user_id = ?`).get(id)
      if (!profile?.contact) {
        const error = new Error('Kontak belum disimpan'); error.status = 409; throw error
      }
      await db.prepare(`UPDATE user_profiles SET ${selected.verified} = CURRENT_TIMESTAMP WHERE user_id = ?`).run(id)
      await audit(req, 'VERIFIKASI_KONTAK_AKUN', `${target.role} · ${channel} diverifikasi dengan metode ${metode}`, 'users', id)
    })()
    res.json({ pesan: 'Status verifikasi kontak diperbarui' })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Gagal memverifikasi kontak Orang Tua:', error.message)
    res.status(500).json({ error: 'Gagal memverifikasi kontak' })
  }
})

adminUsersRouter.post('/users/:id/reset-password', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const target = await db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id)
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan' })
  if (target.role === 'admin' && id === Number(req.user.id)) return res.status(400).json({ error: 'Admin tidak dapat mereset password akunnya sendiri dari menu ini' })
  const passwordSementara = crypto.randomBytes(9).toString('base64url')
  const passwordHash = bcrypt.hashSync(passwordSementara, 10)
  await db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(passwordHash, id)
  await audit(req, 'RESET_PASSWORD_AKUN', `${target.role} #${id} · password direset`, 'users', id)
  res.json({ username: target.username, password_sementara: passwordSementara })
})

adminUsersRouter.post('/users/:id/koreksi-saldo', wajibLogin, hanyaAdmin, async (req, res) => {
  const siswaId = Number(req.params.id)
  const nominal = Number(req.body?.nominal)
  const alasan = String(req.body?.alasan || '').trim()
  if (!Number.isInteger(siswaId) || siswaId <= 0 || !Number.isSafeInteger(nominal) || nominal === 0 || Math.abs(nominal) > 1000000000) return res.status(400).json({ error: 'ID siswa dan nominal koreksi tidak valid' })
  if (alasan.length < 5 || alasan.length > 250) return res.status(400).json({ error: 'Alasan wajib 5–250 karakter' })
  const siswa = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'siswa'").get(siswaId)
  if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' })
  try {
    await db.transaction(async () => {
      await db.prepare('SELECT id FROM users WHERE id = ?').get(siswaId)
      if (await saldoSiswa(siswaId) + nominal < 0) throw { code: 402, msg: 'Koreksi tidak boleh membuat saldo menjadi negatif' }
      await db.prepare(`INSERT INTO ledger (siswa_id, tipe, nominal, keterangan, dibuat_oleh)
        VALUES (?, 'penyesuaian', ?, ?, ?)`).run(siswaId, nominal, alasan, req.user.id)
      await audit(req, 'KOREKSI_SALDO', `Siswa #${siswaId} · nominal ${nominal} · ${alasan}`, 'users', siswaId)
    })()
  } catch (error) {
    return res.status(error.code || 500).json({ error: error.msg || 'Koreksi saldo gagal' })
  }
  res.json({ saldo_baru: await saldoSiswa(siswaId) })
})

// Ubah kelas/NIS/wali untuk SATU akun siswa yang sudah ada — dipakai utk
// melengkapi akun lama yang belum terhubung, atau memindahkan wali.
adminUsersRouter.put('/users/:id/profil-siswa', wajibLogin, hanyaAdmin, async (req, res) => {
  const siswaId = Number(req.params.id)
  const { kelas, nis, ortu_id } = req.body || {}

  const siswa = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'siswa'").get(siswaId)
  if (!siswa) {
    return res.status(404).json({ error: 'Akun siswa tidak ditemukan' })
  }
  if (ortu_id) {
    const ortu = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu'").get(ortu_id)
    if (!ortu) {
      return res.status(400).json({ error: 'Akun orang tua yang dipilih tidak ditemukan' })
    }
  }

  try {
    await simpanProfilSiswa(siswaId, { kelas, nis, ortu_id: ortu_id || null })
    await audit(req, 'UBAH_PROFIL_SISWA', `Siswa #${siswaId} · kelas ${kelas || '-'} · NIS ${nis || '-'} · ortu #${ortu_id || '-'}`, 'users', siswaId)
    res.json({ message: 'Data siswa berhasil diperbarui' })
  } catch (err) {
    console.error('Gagal memperbarui profil siswa:', err)
    res.status(500).json({ error: pesanErrorSql(err, 'Gagal memperbarui data siswa') })
  }
})

// Ganti seluruh daftar anak untuk SATU akun ortu yang sudah ada.
adminUsersRouter.put('/users/:id/anak', wajibLogin, hanyaAdmin, async (req, res) => {
  const ortuId = Number(req.params.id)
  const { anak_ids } = req.body || {}

  const ortu = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu'").get(ortuId)
  if (!ortu) {
    return res.status(404).json({ error: 'Akun orang tua tidak ditemukan' })
  }
  if (!Array.isArray(anak_ids)) {
    return res.status(400).json({ error: 'anak_ids harus berupa daftar id siswa' })
  }
  const anakIds = anak_ids.map(Number)
  if (!await semuaIdValid(anakIds, 'siswa')) {
    return res.status(400).json({ error: 'Salah satu akun siswa yang dipilih tidak ditemukan' })
  }

  try {
    await db.transaction(async () => {
      await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ortu'").get(ortuId)
      if (anakIds.length && !await semuaIdValid(anakIds, 'siswa')) {
        const error = new Error('Salah satu akun siswa yang dipilih tidak ditemukan'); error.status = 400; throw error
      }
      await simpanAnakOrtu(ortuId, anakIds)
      await audit(req, 'UBAH_KETERKAITAN_ANAK', `Ortu #${ortuId} · ${anakIds.length} anak`, 'users', ortuId)
    })()
    res.json({ message: 'Keterkaitan anak berhasil diperbarui' })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    console.error('Gagal memperbarui keterkaitan anak:', error.message)
    res.status(500).json({ error: 'Gagal memperbarui keterkaitan anak' })
  }
})

// Edit profil akun internal (Admin/PIC). Role tidak dapat diubah dari sini.
// Password boleh dikosongkan jika tidak ingin diganti.
adminUsersRouter.put('/users/:id/profil-internal', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { nama, username, password, outlet } = req.body || {}
  if (!nama || !String(nama).trim() || !username || !String(username).trim()) {
    return res.status(400).json({ error: 'Nama dan username wajib diisi' })
  }

  const target = await db.prepare('SELECT id, nama, username, role, outlet FROM users WHERE id = ? AND role IN (\'admin\', \'pic\')').get(id)
  if (!target) return res.status(404).json({ error: 'Akun Admin/PIC tidak ditemukan' })

  const normalizedUsername = String(username).trim()
  const duplicate = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalizedUsername, id)
  if (duplicate) return res.status(409).json({ error: 'Username sudah digunakan akun lain' })

  let nextOutlet = null
  if (target.role === 'pic') {
    nextOutlet = String(outlet || '').trim()
    if (!nextOutlet || nextOutlet.length > 80) return res.status(400).json({ error: 'Nama outlet PIC wajib diisi (maksimal 80 karakter)' })
  }

  try {
    if (password && String(password).length > 0) {
      const passwordHash = bcrypt.hashSync(String(password), 10)
      await db.prepare('UPDATE users SET nama = ?, username = ?, password_hash = ?, outlet = ? WHERE id = ?')
        .run(String(nama).trim(), normalizedUsername, passwordHash, nextOutlet, id)
    } else {
      await db.prepare('UPDATE users SET nama = ?, username = ?, outlet = ? WHERE id = ?')
        .run(String(nama).trim(), normalizedUsername, nextOutlet, id)
    }

    await audit(req, 'UBAH_AKUN_INTERNAL', `${target.role} · ${target.nama} → ${String(nama).trim()}`, 'users', id)
    const updated = await db.prepare('SELECT id, username, nama, role, outlet, active FROM users WHERE id = ?').get(id)
    res.json({ message: 'Akun berhasil diperbarui', user: updated })
  } catch (err) {
    console.error('Gagal memperbarui akun internal:', err)
    res.status(500).json({ error: 'Gagal memperbarui akun' })
  }
})

// Nonaktifkan/aktifkan akun tanpa menghapus histori transaksi.
adminUsersRouter.patch('/users/:id/status', wajibLogin, hanyaAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const active = req.body && (req.body.active === true || Number(req.body.active) === 1) ? 1 : 0
  if (id === Number(req.user.id)) return res.status(400).json({ error: 'Admin tidak dapat menonaktifkan akun sendiri' })
  const target = await db.prepare('SELECT id, nama, role, active FROM users WHERE id = ?').get(id)
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan' })
  await db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id)
  await audit(req, active ? 'AKTIFKAN_AKUN' : 'NONAKTIFKAN_AKUN', `${target.role} · ${target.nama}`, 'users', id)
  res.json({ ok: true, active: !!active, message: active ? 'Akun diaktifkan' : 'Akun dinonaktifkan' })
})

// Endpoint untuk menghapus user berdasarkan ID
adminUsersRouter.delete('/users/:id', wajibLogin, hanyaAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const stmt = await db.prepare('DELETE FROM users WHERE id = ?')
    const target = await db.prepare('SELECT id,nama,role,username FROM users WHERE id = ?').get(id)
    const info = await stmt.run(id)

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' })
    }

    await audit(req, 'HAPUS_AKUN', `${target?.role || '-'} · ${target?.nama || id}`, 'users', Number(id))
    res.json({ message: 'User berhasil dihapus' })
  } catch (err) {
    console.error('Gagal menghapus user:', err)
    // Biasanya krn FK: akun ini masih dipakai di siswa_profil (sbg siswa
    // atau sbg ortu) atau di ledger/tagihan/topup_request.
    if (String(err.message || '').includes('violates foreign key constraint')) {
      return res.status(409).json({
        error: 'Akun ini masih terhubung dengan data lain (siswa/ortu/riwayat transaksi). Lepas keterkaitannya dulu lewat "Kelola", baru hapus.'
      })
    }
    res.status(500).json({ error: 'Gagal menghapus user' })
  }
})
