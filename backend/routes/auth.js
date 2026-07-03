import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database.js';
import { generateToken } from '../services/auth.js';
import { authenticate } from '../middleware/auth.js';
import { authenticateAD, getAdConfig } from '../services/adService.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib' });

    const db = getDb();
    const adConfig = getAdConfig();

    // Support login via email atau username
    const localUser = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email, email);
    if (localUser) {
      // Cek apakah user ini punya password lokal
      if (localUser.password_hash && localUser.password_hash !== 'AD_USER') {
        const valid = bcrypt.compareSync(password, localUser.password_hash);
        if (valid) {
          if (!localUser.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan' });

          db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`)
            .run(localUser.id, 'login', 'auth', `User ${localUser.name} login (local)`, req.ip);

          const token = generateToken(localUser);
          const { password_hash, ...userData } = localUser;
          return res.json({ token, user: userData, authMethod: 'local' });
        }
        return res.status(401).json({ error: 'Password salah' });
      }
    }

    // --- PATH 2: Active Directory ---
    if (adConfig.enabled) {
      let adResult;
      try {
        adResult = await authenticateAD(email, password);
      } catch (adErr) {
        // AD gagal (timeout/down) — jangan throw, biarkan user coba path lain
        return res.status(401).json({
          error: 'Server Active Directory tidak merespon. Coba lagi nanti.',
        });
      }

      if (adResult.success) {
        let portalUser = db.prepare('SELECT * FROM users WHERE email = ?').get(adResult.user.email);

        if (!portalUser) {
          // Auto-create user dari AD
          const result = db.prepare(
            'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)'
          ).run(adResult.user.name, adResult.user.email, 'AD_USER', adResult.user.role);
          portalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }
        // Role TIDAK di-update otomatis saat login — biar admin atur manual.
        // Role hanya di-update lewat Sync AD (halaman Users).

        db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`)
          .run(portalUser.id, 'login', 'auth', `User ${portalUser.name} login via AD`, req.ip);

        const token = generateToken(portalUser);
        const { password_hash, ...userData } = portalUser;
        return res.json({ token, user: userData, authMethod: 'ad', adGroups: adResult.user.groups });
      }
    }

    // --- PATH 3: Local user tapi password salah ---
    if (localUser) {
      return res.status(401).json({ error: 'Password salah' });
    }

    // --- FALLBACK: tidak ditemukan ---
    return res.status(401).json({
      error: adConfig.enabled
        ? 'Email tidak ditemukan di portal maupun Active Directory'
        : 'Email atau password salah',
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server. Silakan coba lagi.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  getDb().prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))`)
    .run(req.user.id, 'logout', 'auth', `User ${req.user.name} logout`, req.ip);
  res.json({ message: 'Logout berhasil' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
