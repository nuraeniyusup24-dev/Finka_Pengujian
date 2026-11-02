import { db } from './db.js'

export function ipPeminta(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || null
}

export async function audit(req, aksi, perubahan = '', refTabel = null, refId = null) {
  try {
    await db.prepare(`
      INSERT INTO audit_log (aktor_id, aksi, perubahan, ip, ref_tabel, ref_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user?.id || null, aksi, String(perubahan || ''), ipPeminta(req), refTabel, refId)
  } catch (e) {
    console.error('Audit log gagal:', e.message)
    throw e
  }
}

