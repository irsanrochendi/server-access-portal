import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { encrypt, decrypt } from '../services/encryption.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/server-notes/:id/notes — dengan password decrypted
router.get('/:id/notes', (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT id, name, ip_address FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  let notes = db.prepare('SELECT * FROM server_notes WHERE server_id = ?').get(req.params.id);
  if (!notes) {
    return res.json({
      notes: {
        serverId: server.id,
        defaultUsername: '',
        defaultPassword: '',
        sshPort: 22,
        vspherePort: 443,
        notes: '',
        licenseKey: '',
        licenseExpire: '',
        owner: '',
        docLinks: [],
      },
    });
  }

  res.json({
    notes: {
      serverId: notes.server_id,
      defaultUsername: notes.default_username,
      defaultPassword: decrypt(notes.default_password_encrypted),
      sshPort: notes.ssh_port,
      vspherePort: notes.vsphere_port,
      notes: notes.notes,
      licenseKey: notes.license_key,
      licenseExpire: notes.license_expire,
      owner: notes.owner,
      docLinks: JSON.parse(notes.documentation_links || '[]'),
      updatedAt: notes.updated_at,
    },
  });
});

// PUT /api/servers/:id/notes — save/update
router.put('/:id/notes', (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const {
    defaultUsername = '',
    defaultPassword = '',
    sshPort = 22,
    vspherePort = 443,
    notes = '',
    licenseKey = '',
    licenseExpire = '',
    owner = '',
    docLinks = [],
  } = req.body;

  // Encrypt password if provided; if empty string, keep existing encrypted value
  const existing = db.prepare('SELECT default_password_encrypted FROM server_notes WHERE server_id = ?').get(req.params.id);
  let encrypted = '';
  if (defaultPassword) {
    encrypted = encrypt(defaultPassword);
  } else if (existing) {
    encrypted = existing.default_password_encrypted;
  }

  const linksJson = JSON.stringify(Array.isArray(docLinks) ? docLinks : []);

  db.prepare(`
    INSERT INTO server_notes (
      server_id, default_username, default_password_encrypted,
      ssh_port, vsphere_port, notes, license_key, license_expire,
      owner, documentation_links, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(server_id) DO UPDATE SET
      default_username = excluded.default_username,
      default_password_encrypted = CASE WHEN excluded.default_password_encrypted = '' THEN default_password_encrypted ELSE excluded.default_password_encrypted END,
      ssh_port = excluded.ssh_port,
      vsphere_port = excluded.vsphere_port,
      notes = excluded.notes,
      license_key = excluded.license_key,
      license_expire = excluded.license_expire,
      owner = excluded.owner,
      documentation_links = excluded.documentation_links,
      updated_at = datetime('now')
  `).run(
    server.id, defaultUsername, encrypted,
    sshPort, vspherePort, notes, licenseKey, licenseExpire,
    owner, linksJson,
  );

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'update', 'server_notes', ?, ?, datetime('now'))`)
    .run(req.user.id, `Update catatan server ID ${server.id}`, req.ip);

  res.json({ message: 'Catatan server disimpan' });
});

// POST /api/servers/:id/notes/audit — log akses kredensial
router.post('/:id/notes/audit', (req, res) => {
  const { action } = req.body;
  if (!['view', 'copy'].includes(action)) {
    return res.status(400).json({ error: 'Action harus view atau copy' });
  }

  const db = getDb();
  const server = db.prepare('SELECT id, name FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  db.prepare(`
    INSERT INTO credential_access_logs (user_id, server_id, action, ip_address, user_agent, accessed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(req.user.id, server.id, action, req.ip, req.headers['user-agent'] || '');

  res.json({ message: 'Akses di-log' });
});

// GET /api/servers/:id/notes/logs — audit trail
router.get('/:id/notes/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const db = getDb();
  const logs = db.prepare(`
    SELECT cal.id, cal.action, cal.ip_address, cal.accessed_at,
           u.name as user_name, u.email as user_email
    FROM credential_access_logs cal
    LEFT JOIN users u ON u.id = cal.user_id
    WHERE cal.server_id = ?
    ORDER BY cal.accessed_at DESC
    LIMIT ?
  `).all(req.params.id, limit);

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      user: l.user_name || 'Unknown',
      action: l.action,
      ip: l.ip_address,
      timestamp: l.accessed_at,
    })),
  });
});

export default router;
