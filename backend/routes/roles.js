import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/roles
router.get('/', (req, res) => {
  const roles = getDb().prepare(`SELECT r.*, (SELECT COUNT(*) FROM users u WHERE LOWER(u.role) = LOWER(r.name)) as users_count
    FROM roles r ORDER BY r.created_at ASC`).all();
  const parsed = roles.map(r => ({
    ...r,
    permissions: JSON.parse(r.permissions),
    usersCount: r.users_count,
  }));
  res.json({ roles: parsed });
});

// POST /api/roles
router.post('/', (req, res) => {
  const { name, description, permissions, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama role wajib' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Nama role sudah ada' });

  const result = db.prepare('INSERT INTO roles (name, description, permissions, color, is_builtin) VALUES (?, ?, ?, ?, 0)')
    .run(name, description || null, JSON.stringify(permissions || []), color || 'blue');

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(result.lastInsertRowid);
  role.permissions = JSON.parse(role.permissions);
  res.status(201).json({ role });
});

// PUT /api/roles/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Role tidak ditemukan' });
  if (existing.is_builtin) return res.status(400).json({ error: 'Role built-in tidak dapat diedit' });

  const { name, description, permissions, color } = req.body;
  db.prepare("UPDATE roles SET name = ?, description = ?, permissions = ?, color = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name || existing.name, description ?? existing.description, JSON.stringify(permissions ?? JSON.parse(existing.permissions)), color || existing.color, req.params.id);

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  role.permissions = JSON.parse(role.permissions);
  res.json({ role });
});

// DELETE /api/roles/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role tidak ditemukan' });
  if (role.is_builtin) return res.status(400).json({ error: 'Role built-in tidak dapat dihapus' });

  const usersCount = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE LOWER(role) = LOWER(?)').get(role.name).cnt;
  if (usersCount > 0) return res.status(400).json({ error: `Role masih dipakai oleh ${usersCount} user` });

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Role dihapus' });
});

export default router;
