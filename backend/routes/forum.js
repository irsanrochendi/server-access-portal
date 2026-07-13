import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/forum/categories
router.get('/categories', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM forum_categories ORDER BY sort_order, id').all();
  res.json({ categories });
});

// POST /api/forum/categories (admin)
router.post('/categories', authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, description = '', icon = 'message-circle' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  try {
    const info = db.prepare('INSERT INTO forum_categories (name, description, icon) VALUES (?, ?, ?)').run(name, description, icon);
    const category = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ category });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Nama kategori sudah ada' });
    res.status(500).json({ error: 'Gagal membuat kategori' });
  }
});

// PUT /api/forum/categories/:id (admin)
router.put('/categories/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  try {
    db.prepare("UPDATE forum_categories SET name = ?, description = COALESCE(?, description), icon = COALESCE(?, icon), updated_at = datetime('now') WHERE id = ?").run(name, description, icon, req.params.id);
    const category = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
    res.json({ category });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Nama kategori sudah ada' });
    res.status(500).json({ error: 'Gagal memperbarui kategori' });
  }
});

// DELETE /api/forum/categories/:id (admin)
router.delete('/categories/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  const topicsCount = db.prepare('SELECT COUNT(*) as cnt FROM forum_topics WHERE category_id = ? AND is_deleted = 0').get(req.params.id);
  if (topicsCount.cnt > 0) return res.status(400).json({ error: 'Kategori masih memiliki ' + topicsCount.cnt + ' topik. Pindahkan atau hapus terlebih dahulu.' });
  db.prepare('DELETE FROM forum_categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kategori dihapus' });
});

// GET /api/forum/topics
router.get('/topics', (req, res) => {
  const db = getDb();
  const { category_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let sql = "SELECT t.*, u.name as author_name, c.name as category_name FROM forum_topics t LEFT JOIN users u ON t.author_id = u.id LEFT JOIN forum_categories c ON t.category_id = c.id WHERE t.is_deleted = 0";
  const params = [];
  if (category_id) { sql += ' AND t.category_id = ?'; params.push(category_id); }
  sql += ' ORDER BY t.is_pinned DESC, t.updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const topics = db.prepare(sql).all(...params);
  const totalSql = "SELECT COUNT(*) as cnt FROM forum_topics t WHERE t.is_deleted = 0" + (category_id ? ' AND t.category_id = ?' : '');
  const total = db.prepare(totalSql).get(...(category_id ? [category_id] : []));
  res.json({ topics, total: total.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/forum/topics/:id
router.get('/topics/:id', (req, res) => {
  const db = getDb();
  const topic = db.prepare("SELECT t.*, u.name as author_name, c.name as category_name FROM forum_topics t LEFT JOIN users u ON t.author_id = u.id LEFT JOIN forum_categories c ON t.category_id = c.id WHERE t.id = ? AND t.is_deleted = 0").get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  db.prepare('UPDATE forum_topics SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  const replies = db.prepare("SELECT r.*, u.name as author_name FROM forum_replies r LEFT JOIN users u ON r.author_id = u.id WHERE r.topic_id = ? AND r.is_deleted = 0 ORDER BY r.created_at ASC").all(req.params.id);
  res.json({ topic, replies });
});

// POST /api/forum/topics
router.post('/topics', (req, res) => {
  const db = getDb();
  const { category_id, title, content } = req.body;
  const author_id = req.user.id;
  if (!category_id || !title || !content) return res.status(400).json({ error: 'Kategori, judul, dan konten wajib diisi' });
  const category = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(category_id);
  if (!category) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  const info = db.prepare('INSERT INTO forum_topics (category_id, author_id, title, content) VALUES (?, ?, ?, ?)').run(category_id, author_id, title, content);
  db.prepare("UPDATE forum_categories SET reply_count = reply_count + 1, updated_at = datetime('now') WHERE id = ?").run(category_id);
  const topic = db.prepare("SELECT t.*, u.name as author_name, c.name as category_name FROM forum_topics t LEFT JOIN users u ON t.author_id = u.id LEFT JOIN forum_categories c ON t.category_id = c.id WHERE t.id = ?").get(info.lastInsertRowid);
  res.status(201).json({ topic });
});

// DELETE /api/forum/topics/:id (author or admin)
router.delete('/topics/:id', (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  if (topic.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus topik ini' });
  db.prepare("UPDATE forum_topics SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE forum_categories SET reply_count = MAX(0, reply_count - 1), updated_at = datetime('now') WHERE id = ?").run(topic.category_id);
  res.json({ message: 'Topik dihapus' });
});

// POST /api/forum/topics/:id/replies (flat replies; no parent_id in schema)
router.post('/topics/:id/replies', (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  if (topic.is_locked) return res.status(403).json({ error: 'Topik ini dikunci, tidak dapat menambah balasan' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Konten balasan wajib diisi' });
  const info = db.prepare('INSERT INTO forum_replies (topic_id, author_id, content) VALUES (?, ?, ?)').run(topic.id, req.user.id, content);
  db.prepare("UPDATE forum_topics SET reply_count = reply_count + 1, last_reply_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(topic.id);
  const reply = db.prepare("SELECT r.*, u.name as author_name FROM forum_replies r LEFT JOIN users u ON r.author_id = u.id WHERE r.id = ?").get(info.lastInsertRowid);
  res.status(201).json({ reply });
});

// DELETE /api/forum/replies/:id (author or admin)
router.delete('/replies/:id', (req, res) => {
  const db = getDb();
  const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!reply) return res.status(404).json({ error: 'Balasan tidak ditemukan' });
  if (reply.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus balasan ini' });
  db.prepare("UPDATE forum_replies SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE forum_topics SET reply_count = MAX(0, reply_count - 1), updated_at = datetime('now') WHERE id = ?").run(reply.topic_id);
  res.json({ message: 'Balasan dihapus' });
});

// PATCH /api/forum/topics/:id/lock (admin)
router.patch('/topics/:id/lock', authorize('admin'), (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  const newLocked = topic.is_locked ? 0 : 1;
  db.prepare("UPDATE forum_topics SET is_locked = ?, updated_at = datetime('now') WHERE id = ?").run(newLocked, req.params.id);
  const updated = db.prepare("SELECT t.*, u.name as author_name, c.name as category_name FROM forum_topics t LEFT JOIN users u ON t.author_id = u.id LEFT JOIN forum_categories c ON t.category_id = c.id WHERE t.id = ?").get(req.params.id);
  res.json({ topic: updated });
});

// PATCH /api/forum/topics/:id/pin (admin)
router.patch('/topics/:id/pin', authorize('admin'), (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  const newPinned = topic.is_pinned ? 0 : 1;
  db.prepare("UPDATE forum_topics SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?").run(newPinned, req.params.id);
  const updated = db.prepare("SELECT t.*, u.name as author_name, c.name as category_name FROM forum_topics t LEFT JOIN users u ON t.author_id = u.id LEFT JOIN forum_categories c ON t.category_id = c.id WHERE t.id = ?").get(req.params.id);
  res.json({ topic: updated });
});

export default router;