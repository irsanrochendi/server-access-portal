import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/announcements — list with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { pinned, priority, page = 1, limit = 20 } = req.query;

  let sql = `SELECT a.*, u.name as author_name FROM announcements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.is_active = 1`;
  const params = [];

  // Only show non-expired or null-expires announcements
  sql += ` AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))`;

  if (pinned !== undefined) {
    sql += ' AND a.is_pinned = ?';
    params.push(pinned === 'true' ? 1 : 0);
  }
  if (priority) {
    sql += ' AND a.priority = ?';
    params.push(priority);
  }

  // Order: pinned first, then by created_at desc
  sql += ' ORDER BY a.is_pinned DESC, a.created_at DESC';

  const offset = (parseInt(page) - 1) * (parseInt(limit) || 20);
  const pageLimit = parseInt(limit) || 20;
  sql += ' LIMIT ? OFFSET ?';
  params.push(pageLimit, offset);

  const announcements = db.prepare(sql).all(...params);

  // Total count for pagination (same filters, no limit/offset)
  let countSql = `SELECT COUNT(*) as cnt FROM announcements a WHERE a.is_active = 1
    AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))`;
  const countParams = [];
  if (pinned !== undefined) {
    countSql += ' AND a.is_pinned = ?';
    countParams.push(pinned === 'true' ? 1 : 0);
  }
  if (priority) {
    countSql += ' AND a.priority = ?';
    countParams.push(priority);
  }
  const { cnt: total } = db.prepare(countSql).get(...countParams);
  const totalPages = Math.ceil(total / pageLimit);

  res.json({ announcements, total, totalPages, page: parseInt(page), limit: pageLimit });
});

// GET /api/announcements/:id — detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ? AND a.is_active = 1
  `).get(req.params.id);

  if (!announcement) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
  res.json({ announcement });
});

// POST /api/announcements — create (admin)
router.post('/', authorize('admin'), (req, res) => {
  const db = getDb();
  const { title, content, priority, is_pinned, expires_at } = req.body;

  if (!title || !content) return res.status(400).json({ error: 'Judul dan konten wajib diisi' });

  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  const safePriority = priority && validPriorities.includes(priority) ? priority : 'normal';

  const result = db.prepare(`
    INSERT INTO announcements (title, content, author_id, priority, is_pinned, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, content, req.user.id, safePriority, is_pinned ? 1 : 0, expires_at || null);

  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  // Log activity
  db.prepare(
    `INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
     VALUES (?, 'create', 'announcements', ?, ?, datetime('now'))`
  ).run(req.user.id, `Membuat pengumuman: ${title}`, req.ip);

  res.status(201).json({ announcement });
});

// PUT /api/announcements/:id — update (admin)
router.put('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const { title, content, priority, is_pinned, expires_at } = req.body;

  const existing = db.prepare('SELECT * FROM announcements WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
  if (!title || !content) return res.status(400).json({ error: 'Judul dan konten wajib diisi' });

  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  const safePriority = priority && validPriorities.includes(priority) ? priority : existing.priority;

  db.prepare(`
    UPDATE announcements
    SET title = ?, content = ?, priority = ?, is_pinned = ?, expires_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, content, safePriority, is_pinned !== undefined ? (is_pinned ? 1 : 0) : existing.is_pinned, expires_at !== undefined ? expires_at : existing.expires_at, req.params.id);

  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);

  // Log activity
  db.prepare(
    `INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
     VALUES (?, 'update', 'announcements', ?, ?, datetime('now'))`
  ).run(req.user.id, `Memperbarui pengumuman: ${title}`, req.ip);

  res.json({ announcement });
});

// DELETE /api/announcements/:id — delete (admin, soft delete)
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });

  db.prepare(`UPDATE announcements SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

  // Log activity
  db.prepare(
    `INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
     VALUES (?, 'delete', 'announcements', ?, ?, datetime('now'))`
  ).run(req.user.id, `Menghapus pengumuman: ${existing.title}`, req.ip);

  res.json({ message: 'Pengumuman dihapus' });
});

// PATCH /api/announcements/:id/pin — toggle pin (admin)
router.patch('/:id/pin', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });

  const newPinned = existing.is_pinned ? 0 : 1;
  db.prepare(`UPDATE announcements SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?`).run(newPinned, req.params.id);

  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);

  res.json({ announcement });
});

export default router;