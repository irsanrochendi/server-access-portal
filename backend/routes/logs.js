import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// POST /api/logs/activity — log an activity (any authenticated user)
router.post('/activity', (req, res) => {
  const { action, module, description, metadata } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });

  const db = getDb();
  db.prepare(
    'INSERT INTO activity_logs (user_id, action, module, description, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, action, module || null, description || null, metadata ? JSON.stringify(metadata) : null, new Date().toISOString().replace('T', ' ').substring(0, 19));

  res.json({ success: true });
});

// GET /api/logs — admin only
router.get('/', authorize('admin'), (req, res) => {
  const { action, search, limit = 50, offset = 0 } = req.query;
  const db = getDb();
  let sql = `SELECT al.*, u.name as user_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
  const params = [];

  if (action) { sql += ' AND al.action = ?'; params.push(action); }
  if (search) { sql += ' AND (al.description LIKE ? OR al.module LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit) || 50, parseInt(offset) || 0);

  const logs = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM activity_logs').get().cnt;
  res.json({ logs, total });
});

export default router;
