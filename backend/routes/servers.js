import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/servers — All users (filter by divisi untuk staff)
router.get('/', (req, res) => {
  const { search, category, environment, status, active } = req.query;
  const db = getDb();
  let sql = 'SELECT * FROM servers WHERE 1=1';
  const params = [];

  // Scope: staff hanya lihat server yang visible ke divisinya
  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT division FROM users WHERE id = ?').get(req.user.id);
    const division = user?.division || '';
    sql += " AND (visible_to = '' OR visible_to IS NULL OR visible_to LIKE ?)";
    params.push(`%${division}%`);
  }

  if (active === '1') { sql += ' AND is_active = 1'; }
  if (search) { sql += ' AND (name LIKE ? OR ip_address LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (environment) { sql += ' AND environment = ?'; params.push(environment); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';

  const servers = db.prepare(sql).all(...params);
  res.json({ servers });
});

// GET /api/servers/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
    SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown
    FROM servers WHERE is_active = 1`).get();
  res.json(stats);
});

// GET /api/servers/:id
router.get('/:id', (req, res) => {
  const server = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });
  res.json({ server });
});

// POST /api/servers — Admin only
router.post('/', authorize('admin'), (req, res) => {
  const { name, ip_address, port, protocol, access_url, description, category, environment, status_check_url, status_check_method, browser_pref, visible_to, is_active } = req.body;
  if (!name || !ip_address || !access_url) return res.status(400).json({ error: 'Nama, IP, dan URL wajib' });

  const db = getDb();
  const result = db.prepare(`INSERT INTO servers (name, ip_address, port, protocol, access_url, description, category, environment, status_check_url, status_check_method, browser_pref, visible_to, is_active, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown')`)
    .run(name, ip_address, port || null, protocol || 'HTTP', access_url, description || null, category || null, environment || 'Production', status_check_url || null, status_check_method || 'none', browser_pref || '', (visible_to || '').toString(), is_active !== false ? 1 : 0);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'create', 'server', ?, ?, datetime('now'))`)
    .run(req.user.id, `Server '${name}' dibuat`, req.ip);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ server });
});

// PUT /api/servers/:id — Admin only
router.put('/:id', authorize('admin'), (req, res) => {
  const existing = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const { name, ip_address, port, protocol, access_url, description, category, environment, status_check_url, status_check_method, browser_pref, visible_to, is_active } = req.body;
  const db = getDb();
  db.prepare(`UPDATE servers SET name=?, ip_address=?, port=?, protocol=?, access_url=?, description=?, category=?, environment=?, status_check_url=?, status_check_method=?, browser_pref=?, visible_to=?, is_active=?, updated_at=datetime('now') WHERE id=?`)
    .run(name || existing.name, ip_address || existing.ip_address, port ?? existing.port, protocol || existing.protocol, access_url || existing.access_url, description ?? existing.description, category ?? existing.category, environment || existing.environment, status_check_url ?? existing.status_check_url, status_check_method || existing.status_check_method, browser_pref ?? existing.browser_pref, visible_to ?? existing.visible_to, is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'update', 'server', ?, ?, datetime('now'))`)
    .run(req.user.id, `Server '${name || existing.name}' diupdate`, req.ip);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  res.json({ server });
});

// DELETE /api/servers/:id — Admin only
router.delete('/:id', authorize('admin'), (req, res) => {
  const server = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const db = getDb();
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'delete', 'server', ?, ?, datetime('now'))`)
    .run(req.user.id, `Server '${server.name}' dihapus`, req.ip);

  res.json({ message: 'Server dihapus' });
});

// POST /api/servers/:id/toggle-active
router.post('/:id/toggle-active', authorize('admin'), (req, res) => {
  const server = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const newState = server.is_active ? 0 : 1;
  getDb().prepare('UPDATE servers SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newState, req.params.id);
  res.json({ is_active: !!newState });
});

export default router;
