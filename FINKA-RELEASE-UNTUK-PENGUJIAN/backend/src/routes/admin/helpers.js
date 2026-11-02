import { db } from '../../db.js'

// Simpan kelas/NIS/wali utk satu siswa. Bikin baris siswa_profil kalau
// belum ada (mis. akun lama yang dibuat sebelum fitur keterkaitan ini ada).
async function profilSiswaAda(siswaId) {
  const row = await db.prepare('SELECT user_id FROM siswa_profil WHERE user_id = ?').get(siswaId)
  return Boolean(row)
}

export async function simpanProfilSiswa(siswaId, { kelas, nis, ortu_id }) {
  if (await profilSiswaAda(siswaId)) {
    await db.prepare('UPDATE siswa_profil SET kelas = ?, nis = ?, ortu_id = ? WHERE user_id = ?')
      .run(kelas || null, nis || null, ortu_id || null, siswaId)
  } else {
    await db.prepare('INSERT INTO siswa_profil (user_id, ortu_id, kelas, nis) VALUES (?, ?, ?, ?)')
      .run(siswaId, ortu_id || null, kelas || null, nis || null)
  }
}

// Ganti SELURUH daftar anak milik satu akun ortu dengan daftar baru —
// anak lama yang tidak lagi dipilih otomatis dilepas keterkaitannya.
export async function simpanAnakOrtu(ortuId, anakIds) {
  // Jalankan pada executor/transaksi yang memanggil helper ini. Membuka transaksi
  // baru di sini dapat membuat deadlock dan tidak melihat akun ortu yang belum commit.
  await db.prepare('UPDATE siswa_profil SET ortu_id = NULL WHERE ortu_id = ?').run(ortuId)
  for (const anakId of anakIds) {
    if (await profilSiswaAda(anakId)) {
      await db.prepare('UPDATE siswa_profil SET ortu_id = ? WHERE user_id = ?').run(ortuId, anakId)
    } else {
      await db.prepare('INSERT INTO siswa_profil (user_id, ortu_id) VALUES (?, ?)').run(anakId, ortuId)
    }
  }
}

export async function semuaIdValid(ids, role) {
  if (!ids.length) return true
  const placeholders = ids.map(() => '?').join(',')
  const ditemukan = await db.prepare(
    `SELECT id FROM users WHERE role = ? AND id IN (${placeholders})`
  ).all(role, ...ids)
  return ditemukan.length === ids.length
}

export function pesanErrorSql(err, fallback) {
  if (String(err.message || '').includes('siswa_profil_nis_key') || String(err.message || '').includes('UNIQUE constraint failed: siswa_profil.nis')) {
    return 'NIS sudah dipakai siswa lain'
  }
  return fallback
}

