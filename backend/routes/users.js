import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/users/online — accessible by ALL authenticated users
router.get('/online', (req, res) => {
  const db = getDb();
  const thresholdMinutes = parseInt(req.query.minutes) || 5;

  const users = db.prepare(`
    SELECT id, name, email, role, division, is_active, last_activity_at
    FROM users
    WHERE last_activity_at > datetime('now', '-' || ? || ' minutes')
    ORDER BY last_activity_at DESC
  `).all(thresholdMinutes);

  res.json({ users, count: users.length, threshold: `${thresholdMinutes} minutes` });
});

// Admin-only routes below
router.use(authorize('admin'));

// GET /api/users — List all
router.get('/', (req, res) => {
  const users = getDb().prepare('SELECT id, name, username, email, division, role, is_active, theme_preference, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = getDb().prepare('SELECT id, name, username, email, division, role, is_active, theme_preference, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ user });
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email, password, role, division, username } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nama, email, dan password wajib' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });
  if (username) {
    const dupUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (dupUser) return res.status(409).json({ error: 'Username sudah terdaftar' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, username, email, password_hash, role, division) VALUES (?, ?, ?, ?, ?, ?)').run(name, username || '', email, hash, role || 'staff', division || '');

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'create', 'user', ?, ?, datetime('now'))`)
    .run(req.user.id, `User '${name}' dibuat`, req.ip);

  const user = db.prepare('SELECT id, name, username, email, division, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ user });
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan' });

  const { name, email, password, role, division, username, is_active } = req.body;
  const db = getDb();

  // Guard: last admin cannot be deactivated or demoted
  if (existing.role === 'admin') {
    if ((role && role !== 'admin') || is_active === false) {
      const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?").get(req.params.id).cnt;
      if (adminCount === 0) return res.status(400).json({ error: 'Tidak dapat menurunkan/menonaktifkan admin terakhir' });
    }
  }

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (username !== undefined) {
    const dup = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?').get(username, req.params.id);
    if (dup) return res.status(409).json({ error: 'Username sudah terdaftar' });
    updates.push('username = ?'); params.push(username);
  }
  if (email) {
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
    if (dup) return res.status(409).json({ error: 'Email sudah terdaftar' });
    updates.push('email = ?'); params.push(email);
  }
  if (password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }
  if (role) { updates.push('role = ?'); params.push(role); }
  if (division !== undefined) { updates.push('division = ?'); params.push(division); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Log
    db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
      VALUES (?, 'update', 'user', ?, ?, datetime('now'))`)
      .run(req.user.id, `User '${name || existing.name}' diupdate`, req.ip);
  }

  const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json({ user });
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Tidak dapat menghapus diri sendiri' });

  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  if (user.role === 'admin') {
    const adminCount = getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?").get(req.params.id).cnt;
    if (adminCount === 0) return res.status(400).json({ error: 'Tidak dapat menghapus admin terakhir' });
  }

  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'delete', 'user', ?, ?, datetime('now'))`)
    .run(req.user.id, `User '${user.name}' dihapus`, req.ip);

  res.json({ message: 'User dihapus' });
});

// POST /api/users/:id/force-logout — invalidate all tokens for user
router.post('/:id/force-logout', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Increment token_version to invalidate all existing tokens
  db.prepare(`UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?`)
    .run(req.params.id);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'force_logout', 'auth', ?, ?, datetime('now'))`)
    .run(req.user.id, `Force logout: ${user.name} (ID ${req.params.id})`, req.ip);

  res.json({ message: `User '${user.name}' akan di-logout pada request berikutnya` });
});

export default router;
