import { Router } from 'express'
import { db } from '../../db.js'
import { wajibLogin } from '../../middleware/auth.js'
import { hanyaAdmin } from '../../middleware/role.js'
import { audit } from '../../audit.js'

export const adminClassesRouter = Router()

function textClass(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseMapping(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
    return { error: 'Pemetaan kelas harus berisi 1–100 pasangan' }
  }
  const mapping = []
  const sources = new Set()
  const destinations = new Set()
  for (const item of input) {
    const from = textClass(item?.dari)
    const to = textClass(item?.ke)
    if (!from || !to || from.length > 80 || to.length > 80) {
      return { error: 'Setiap pasangan harus memiliki kelas asal dan tujuan (maksimal 80 karakter)' }
    }
    if (from === to) return { error: `Kelas asal dan tujuan tidak boleh sama: ${from}` }
    if (sources.has(from)) return { error: `Kelas asal duplikat: ${from}` }
    if (destinations.has(to)) return { error: `Kelas tujuan duplikat: ${to}` }
    sources.add(from)
    destinations.add(to)
    mapping.push({ dari: from, ke: to })
  }
  return { mapping }
}

adminClassesRouter.post('/kelas/naik', wajibLogin, hanyaAdmin, async (req, res) => {
  const parsed = parseMapping(req.body?.pemetaan)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  const mapping = parsed.mapping
  const froms = mapping.map(item => item.dari)
  const placeholders = froms.map(() => '?').join(',')

  try {
    const counts = await db.prepare(`SELECT kelas, COUNT(*) AS siswa FROM siswa_profil
      WHERE kelas IN (${placeholders}) GROUP BY kelas`).all(...froms)
    const countByClass = new Map(counts.map(row => [row.kelas, Number(row.siswa)]))
    const resultMapping = mapping.map(item => ({ ...item, siswa: countByClass.get(item.dari) || 0 }))
    const total = resultMapping.reduce((sum, item) => sum + item.siswa, 0)
    const empty = resultMapping.filter(item => item.siswa === 0).map(item => item.dari)

    if (req.body?.simpan !== true) {
      return res.json({ ok: true, total_siswa: total, pemetaan: resultMapping, kelas_kosong: empty, pratinjau: true })
    }
    if (total === 0) return res.status(409).json({ error: 'Tidak ada siswa di kelas asal yang dipilih' })

    const updated = await db.transaction(async () => {
      // CASE avoids overwrite when the destination of one mapping is another source.
      const caseSql = mapping.map(() => 'WHEN ? THEN ?').join(' ')
      const params = mapping.flatMap(item => [item.dari, item.ke])
      params.push(...froms)
      const info = await db.prepare(`UPDATE siswa_profil SET kelas = CASE kelas ${caseSql} ELSE kelas END
        WHERE kelas IN (${placeholders})`).run(...params)
      return info.changes
    })()
    await audit(req, 'KENAIKAN_KELAS', `${mapping.map(item => `${item.dari}→${item.ke}`).join(', ')} · ${updated} siswa`, 'siswa_profil', null)
    res.json({ ok: true, diubah: updated, total_siswa: total, pemetaan: resultMapping, kelas_kosong: empty })
  } catch (error) {
    console.error('Kenaikan kelas gagal:', error)
    res.status(500).json({ error: 'Gagal memproses kenaikan kelas' })
  }
})

adminClassesRouter.post('/kelas/arsip', wajibLogin, hanyaAdmin, async (req, res) => {
  const kelas = textClass(req.body?.kelas)
  const simpan = req.body?.simpan === true
  const akuiSaldo = req.body?.akui_saldo === true
  if (!kelas || kelas.length > 80) return res.status(400).json({ error: 'Nama kelas wajib diisi (maksimal 80 karakter)' })

  try {
    const rows = await db.prepare(`SELECT u.id, sp.ortu_id, COALESCE(SUM(l.nominal), 0) AS saldo
      FROM users u JOIN siswa_profil sp ON sp.user_id = u.id
      LEFT JOIN ledger l ON l.siswa_id = u.id
      WHERE u.role = 'siswa' AND u.active = 1 AND sp.kelas = ?
      GROUP BY u.id, sp.ortu_id`).all(kelas)
    const studentIds = rows.map(row => Number(row.id))
    const balances = rows.map(row => ({ id: Number(row.id), saldo: Number(row.saldo || 0) }))
    const withBalance = balances.filter(row => row.saldo !== 0)
    const totalBalance = withBalance.reduce((sum, row) => sum + row.saldo, 0)
    const unpaid = studentIds.length
      ? await db.prepare(`SELECT COUNT(*) AS n FROM tagihan WHERE status = 'belum_bayar' AND siswa_id IN (${studentIds.map(() => '?').join(',')})`).get(...studentIds)
      : { n: 0 }
    const parents = studentIds.length
      ? await db.prepare(`SELECT COUNT(*) AS n FROM users parent
          WHERE parent.role = 'ortu' AND parent.active = 1
            AND EXISTS (SELECT 1 FROM siswa_profil sp JOIN users child ON child.id = sp.user_id
              WHERE sp.ortu_id = parent.id AND child.role = 'siswa' AND child.active = 1
                AND child.id IN (${studentIds.map(() => '?').join(',')}))
            AND NOT EXISTS (SELECT 1 FROM siswa_profil sp JOIN users child ON child.id = sp.user_id
              WHERE sp.ortu_id = parent.id AND child.role = 'siswa' AND child.active = 1
                AND child.id NOT IN (${studentIds.map(() => '?').join(',')}))`).get(...studentIds, ...studentIds)
      : { n: 0 }

    if (!simpan) {
      return res.json({ ok: true, pratinjau: true, kelas, jumlah_siswa: studentIds.length,
        akun_ortu_ikut_nonaktif: Number(parents.n || 0), tagihan_belum_dibayar: Number(unpaid.n || 0),
        siswa_bersaldo: withBalance.length, total_saldo: totalBalance })
    }
    if (!studentIds.length) return res.status(409).json({ error: 'Tidak ada siswa aktif pada kelas ini' })
    if (withBalance.length && !akuiSaldo) return res.status(409).json({ error: 'Konfirmasi bahwa saldo siswa sudah ditangani sebelum mengarsipkan kelas' })

    const result = await db.transaction(async () => {
      const ids = studentIds
      const deactivateStudents = await db.prepare(`UPDATE users SET active = 0 WHERE role = 'siswa' AND active = 1 AND id IN (${ids.map(() => '?').join(',')})`).run(...ids)
      const deactivateParents = await db.prepare(`UPDATE users parent SET active = 0
        WHERE parent.role = 'ortu' AND parent.active = 1
          AND EXISTS (SELECT 1 FROM siswa_profil archived WHERE archived.ortu_id = parent.id
            AND archived.user_id IN (${ids.map(() => '?').join(',')}))
          AND NOT EXISTS (
            SELECT 1 FROM siswa_profil sp JOIN users child ON child.id = sp.user_id
            WHERE sp.ortu_id = parent.id AND child.role = 'siswa' AND child.active = 1
          )`).run(...ids)
      return { siswa: deactivateStudents.changes, ortu: deactivateParents.changes }
    })()
    await audit(req, 'ARSIP_KELAS', `Kelas ${kelas} · ${result.siswa} siswa dinonaktifkan · saldo tersisa ${totalBalance}`, 'siswa_profil', null)
    res.json({ ok: true, kelas, jumlah_siswa: result.siswa, akun_ortu_ikut_nonaktif: result.ortu,
      tagihan_belum_dibayar: Number(unpaid.n || 0), siswa_bersaldo: withBalance.length, total_saldo: totalBalance })
  } catch (error) {
    console.error('Arsip kelas gagal:', error)
    res.status(500).json({ error: 'Gagal mengarsipkan kelas' })
  }
})
