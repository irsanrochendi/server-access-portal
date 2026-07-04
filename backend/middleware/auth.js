import { verifyToken } from '../services/auth.js';
import { getDb } from '../database.js';

// In-memory throttling for activity touch (per-process, survives across requests)
const _activityTouch = new Map(); // userId -> timestamp

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token tidak ditemukan' });
    }
    const payload = verifyToken(header.split(' ')[1]);

    // Token version check — invalidate old tokens on force logout
    const db = getDb();
    const currentUser = db.prepare('SELECT id, name, username, email, division, role, is_active, token_version, impersonated_by, impersonation_expires_at FROM users WHERE id = ?').get(payload.id);
    if (!currentUser) return res.status(401).json({ error: 'User tidak ditemukan' });
    if (!currentUser.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan' });

    // Check if token_version in JWT matches DB (force logout)
    // Only check if JWT has token_version field (new tokens)
    if (payload.token_version !== undefined) {
      if (currentUser.token_version !== payload.token_version) {
        return res.status(401).json({
          error: 'Sesi Anda telah diakhiri oleh admin',
          code: 'FORCE_LOGOUT',
        });
      }
    }

    // Check impersonation expiration
    if (currentUser.impersonated_by && currentUser.impersonation_expires_at) {
      if (new Date(currentUser.impersonation_expires_at) < new Date()) {
        // Clear expired impersonation
        db.prepare(`UPDATE users SET impersonated_by = NULL, impersonation_expires_at = NULL WHERE id = ?`).run(currentUser.id);
        currentUser.impersonated_by = null;
        currentUser.impersonation_expires_at = null;
      }
    }

    req.user = currentUser;

    // Activity touch — throttled to max 1 update per minute per user
    const lastTouch = _activityTouch.get(currentUser.id);
    if (!lastTouch || Date.now() - lastTouch > 60_000) {
      // Use Unix timestamp (milliseconds) for accurate timezone handling
      db.prepare(`UPDATE users SET last_activity_at = ? WHERE id = ?`).run(Date.now(), currentUser.id);
      _activityTouch.set(currentUser.id, Date.now());
    }

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
