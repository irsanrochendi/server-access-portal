import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/settings
router.get('/', (req, res) => {
  const settings = getDb().prepare('SELECT * FROM settings ORDER BY id').all();
  res.json({ settings });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const db = getDb();
  const { settings } = req.body;
  if (!Array.isArray(settings)) return res.status(400).json({ error: 'Array settings required' });

  const stmt = db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
  for (const { key, value } of settings) {
    stmt.run(String(value), key);
  }

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'update', 'settings', 'Pengaturan portal diupdate', ?, datetime('now'))`)
    .run(req.user.id, req.ip);

  const newSettings = db.prepare('SELECT * FROM settings ORDER BY id').all();
  res.json({ settings: newSettings });
});

export default router;
