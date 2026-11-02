// Middleware akses berdasarkan role.
export function hanyaAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next()
  return res.status(403).json({ error: 'Akses ditolak. Khusus Admin.' })
}

