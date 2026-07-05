import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-32-chars!!';

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return '';
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const router = Router();

// GET /api/resources — list resources (staff: only assigned, admin: all)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const user = req.user;

  let resources;
  if (user.role === 'admin') {
    resources = db.prepare('SELECT * FROM resources WHERE is_active = 1 ORDER BY category, name').all();
  } else {
    resources = db.prepare(`
      SELECT DISTINCT r.* FROM resources r
      JOIN resource_assignments ra ON r.id = ra.resource_id
      WHERE r.is_active = 1
        AND (ra.user_id = ? OR ra.role = ?)
      ORDER BY r.category, r.name
    `).all(user.id, user.role);
  }

  const result = resources.map(r => ({
    ...r,
    has_password: !!r.shared_password_encrypted,
    shared_password_encrypted: undefined,
  }));
  res.json({ resources: result });
});

// GET /api/resources/:id — get single resource
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const user = req.user;
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);

  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  res.json({ resource });
});

// GET /api/resources/:id/credentials — get credentials (only if auto_login enabled)
router.get('/:id/credentials', authenticate, (req, res) => {
  const db = getDb();
  const user = req.user;
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);

  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  if (user.role !== 'admin' && !resource.auto_login_enabled) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  res.json({
    username: resource.shared_username,
    password: resource.auto_login_enabled ? decrypt(resource.shared_password_encrypted) : '',
    url: resource.url,
  });
});

// POST /api/resources — create resource (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, url, type, category, icon, description, shared_username, shared_password, auto_login_enabled } = req.body;

  if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });

  const encrypted = encrypt(shared_password || '');
  const result = db.prepare(`
    INSERT INTO resources (name, url, type, category, icon, description, shared_username, shared_password_encrypted, auto_login_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, url, type || 'web', category || '', icon || '', description || '', shared_username || '', encrypted, auto_login_enabled ? 1 : 0);

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
  res.json({ resource });
});

// PUT /api/resources/:id — update resource (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, url, type, category, icon, description, shared_username, shared_password, auto_login_enabled, is_active } = req.body;

  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Resource not found' });

  const encrypted = shared_password !== undefined ? encrypt(shared_password) : existing.shared_password_encrypted;

  db.prepare(`
    UPDATE resources SET name=?, url=?, type=?, category=?, icon=?, description=?,
      shared_username=?, shared_password_encrypted=?, auto_login_enabled=?, is_active=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    name || existing.name, url || existing.url, type || existing.type,
    category !== undefined ? category : existing.category,
    icon !== undefined ? icon : existing.icon,
    description !== undefined ? description : existing.description,
    shared_username !== undefined ? shared_username : existing.shared_username,
    encrypted,
    auto_login_enabled !== undefined ? (auto_login_enabled ? 1 : 0) : existing.auto_login_enabled,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    id
  );

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  res.json({ resource });
});

// DELETE /api/resources/:id — delete resource (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/resources/:id/assign — assign resource to user/role (admin only)
router.post('/:id/assign', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { user_id, role } = req.body;

  if (!user_id && !role) return res.status(400).json({ error: 'user_id or role required' });

  db.prepare("DELETE FROM resource_assignments WHERE resource_id = ? AND (user_id = ? OR (role = ? AND role != ''))").run(id, user_id || 0, role || '');

  if (user_id) {
    db.prepare('INSERT INTO resource_assignments (resource_id, user_id) VALUES (?, ?)').run(id, user_id);
  } else if (role) {
    db.prepare('INSERT INTO resource_assignments (resource_id, role) VALUES (?, ?)').run(id, role);
  }

  res.json({ success: true });
});

// DELETE /api/resources/:id/assign/:assignmentId — remove assignment (admin only)
router.delete('/:id/assign/:assignmentId', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM resource_assignments WHERE id = ?').run(req.params.assignmentId);
  res.json({ success: true });
});

// GET /api/resources/:id/assignments — list assignments for a resource (admin only)
router.get('/:id/assignments', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const assignments = db.prepare(`
    SELECT ra.*, u.name as user_name, u.email as user_email
    FROM resource_assignments ra
    LEFT JOIN users u ON ra.user_id = u.id
    WHERE ra.resource_id = ?
  `).all(req.params.id);
  res.json({ assignments });
});

export default router;
