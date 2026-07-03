import { Router } from 'express';
import { testAdConnection, getAdConfig, updateAdConfig, listAdUsers } from '../services/adService.js';
import { getDb } from '../database.js';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/ad/users — Sinkron AD users ke database lokal
router.get('/users', authorize('admin'), async (req, res) => {
  try {
    const adUsers = await listAdUsers();
    const db = getDb();
    const excludedEmails = ['access.server@ad.ast.com', 'nextcloud@ad.ast.com'];

    let created = 0, updated = 0, removed = 0;

    // Daftar email AD yang valid
    const validAdEmails = adUsers
      .map(u => u.email?.toLowerCase())
      .filter(Boolean)
      .filter(e => !excludedEmails.includes(e));

    // Hapus AD user yang sudah tidak ada di AD
    const dbUsers = db.prepare("SELECT id, email FROM users WHERE password_hash = 'AD_USER'").all();
    for (const dbUser of dbUsers) {
      if (dbUser.email && !validAdEmails.includes(dbUser.email.toLowerCase())) {
        db.prepare("DELETE FROM users WHERE id = ?").run(dbUser.id);
        removed++;
      }
    }

    for (const adUser of adUsers) {
      if (!adUser.email || excludedEmails.includes(adUser.email.toLowerCase())) continue;

      // Simpan division sebelum DELETE agar tidak hilang saat re-sync
      const prevDivision = db.prepare(
        "SELECT division FROM users WHERE password_hash = 'AD_USER' AND email = ?"
      ).get(adUser.email)?.division || '';

      // Hapus yg sudah ada di DB sebelumnya
      db.prepare("DELETE FROM users WHERE password_hash = 'AD_USER' AND email = ?").run(adUser.email);

      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(adUser.email);

      if (existing) {
        // Update name & role dari AD
        if (existing.role !== adUser.role) {
          db.prepare("UPDATE users SET name = ?, role = ?, updated_at = datetime('now') WHERE id = ?")
            .run(adUser.name, adUser.role, existing.id);
          updated++;
        }
      } else {
        // Auto-create user dari AD — pertahankan division yang sudah pernah diset
        db.prepare('INSERT INTO users (name, email, password_hash, role, is_active, division) VALUES (?, ?, ?, ?, 1, ?)')
          .run(adUser.name, adUser.email, 'AD_USER', adUser.role, prevDivision);
        created++;
      }
    }

    // Log activity
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

    res.json({
      users: adUsers,
      count: adUsers.length,
      synced: { created, updated, removed },
      totalLocalUsers: totalUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ad/test — Admin test koneksi AD
router.post('/test', authorize('admin'), async (req, res) => {
  const result = await testAdConnection(req.body);
  res.json(result);
});

// GET /api/ad/config — Admin lihat konfigurasi AD (tanpa password)
router.get('/config', authorize('admin'), (req, res) => {
  const config = getAdConfig();
  res.json({
    url: config.url,
    baseDN: config.baseDN,
    username: config.username,
    enabled: config.enabled,
    userFilter: config.userFilter,
    groupFilter: config.groupFilter,
  });
});

// PUT /api/ad/config — Admin update konfigurasi AD
router.put('/config', authorize('admin'), (req, res) => {
  const { url, baseDN, username, password, enabled, userFilter, groupFilter } = req.body;
  const updates = {};
  if (url !== undefined) updates.url = url;
  if (baseDN !== undefined) updates.baseDN = baseDN;
  if (username !== undefined) updates.username = username;
  if (password !== undefined) updates.password = password;
  if (enabled !== undefined) updates.enabled = enabled;
  if (userFilter !== undefined) updates.userFilter = userFilter;
  if (groupFilter !== undefined) updates.groupFilter = groupFilter;
  updateAdConfig(updates);
  const config = getAdConfig();
  res.json({ ...config, password: undefined });
});

export default router;
