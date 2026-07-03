import { verifyToken } from '../services/auth.js';
import { getDb } from '../database.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token tidak ditemukan' });
    }
    const payload = verifyToken(header.split(' ')[1]);
    const user = getDb().prepare('SELECT id, name, username, email, division, role, is_active FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' });
    if (!user.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired, silakan login ulang' });
    return res.status(401).json({ error: 'Token invalid' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak: insufficient role' });
    }
    next();
  };
}
