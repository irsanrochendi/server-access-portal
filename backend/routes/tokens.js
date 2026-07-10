import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import { decrypt } from '../services/encryption.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validateAndConsumeToken(tokenHash, userId, serverId) {
  const db = getDb();
  const record = db.prepare(`
    SELECT * FROM access_tokens
    WHERE token_hash = ? AND user_id = ? AND server_id = ?
  `).get(tokenHash, userId, serverId);

  if (!record) return { valid: false, error: 'Token tidak ditemukan' };
  if (record.revoked) return { valid: false, error: 'Token telah dicabut' };
  if (record.used_at) return { valid: false, error: 'Token sudah digunakan' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, error: 'Token kadaluarsa' };

  // Consume token
  db.prepare(`UPDATE access_tokens SET used_at = datetime('now') WHERE id = ?`).run(record.id);

  return { valid: true, protocol: record.protocol };
}

// ---------------------------------------------------------------------------
// POST /api/tokens/request/:id
// ---------------------------------------------------------------------------

router.post('/request/:id', authenticate, (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { protocol } = req.body;

    if (!protocol || !['rdp', 'http', 'https', 'ssh'].includes(protocol)) {
      return res.status(400).json({ error: 'Protocol tidak didukung' });
    }

    const db = getDb();

    // Check server exists and is active
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });
    if (!server.is_active) return res.status(400).json({ error: 'Server dinonaktifkan' });

    // Check access — admin bypasses checks, staff must be assigned or in division
    if (req.user.role !== 'admin') {
      // Check division visibility
      if (server.visible_to) {
        const divisions = server.visible_to.split(',').map(d => d.trim()).filter(Boolean);
        if (divisions.length > 0 && !divisions.includes(req.user.division || '')) {
          return res.status(403).json({ error: 'Anda tidak memiliki akses ke server ini (divisi)' });
        }
      }

      // Check explicit assignment
      const assignment = db.prepare(`
        SELECT sa.id FROM server_assignments sa
        LEFT JOIN users u ON sa.user_id = u.id
        WHERE sa.server_id = ?
          AND (sa.user_id = ? OR (u.role = ? AND sa.role = ?))
      `).get(serverId, req.user.id, req.user.role, req.user.role);

      if (!assignment) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses ke server ini' });
      }
    }

    // Generate token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30_000).toISOString();

    db.prepare(`
      INSERT INTO access_tokens (token_hash, user_id, server_id, protocol, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenHash, req.user.id, serverId, protocol, expiresAt);

    // Log token request
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      req.user.id,
      'token_request',
      'server',
      `Request token akses untuk server ${server.name}`,
      JSON.stringify({ server_id: serverId, protocol }),
      req.ip
    );

    res.json({
      token,
      expires_in: 30,
      protocol,
      server_name: server.name,
    });

  } catch (err) {
    console.error('Token request error:', err);
    res.status(500).json({ error: 'Gagal membuat token akses' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tokens/rdp-file/:id
// ---------------------------------------------------------------------------

router.get('/rdp-file/:id', (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: 'Token wajib disertakan' });

    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

    // Find matching token record — we need user_id to validate
    // Look up by token_hash across all users for this server (one-time use, user-scoped)
    const tokenHash = hashToken(token);
    const tokenRecord = db.prepare(`
      SELECT * FROM access_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!tokenRecord) return res.status(401).json({ error: 'Token tidak valid' });
    if (tokenRecord.server_id !== serverId) return res.status(401).json({ error: 'Token tidak cocok dengan server' });

    const validation = validateAndConsumeToken(tokenHash, tokenRecord.user_id, serverId);
    if (!validation.valid) {
      return res.status(401).json({ error: validation.error });
    }

    // Get credentials — shared_username is plaintext, shared_password_encrypted needs decrypt
    const username = server.shared_username || '';
    const password = decrypt(server.shared_password_encrypted);

    if (!username && !password) {
      // No stored credentials — generate RDP file without credentials
      const port = server.port || 3389;
      const ip = server.ip_address;
      const rdpContent = [
        `full address:s:${ip}:${port}`,
        `prompt for credentials:i:1`,
        `authentication level:i:2`,
        ``,
      ].join('\r\n');

      res.setHeader('Content-Type', 'application/x-rdp');
      res.setHeader('Content-Disposition', `attachment; filename="${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.rdp"`);
      return res.send(rdpContent);
    }

    // Build RDP file with credentials
    const port = server.port || 3389;
    const ip = server.ip_address;
    const lines = [
      `full address:s:${ip}:${port}`,
      `prompt for credentials:i:0`,
      `authentication level:i:2`,
      `negotiate security layer:i:1`,
    ];

    if (username) lines.push(`username:s:${username}`);
    if (password) lines.push(`password 01:b:${Buffer.from(password).toString('hex')}`);

    const rdpContent = lines.join('\r\n') + '\r\n';

    // Log server access
    try {
      db.prepare(`
        INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        tokenRecord.user_id,
        'server_access',
        'server',
        `Membuka server ${server.name} via RDP (token)`,
        JSON.stringify({ server_id: serverId, protocol: 'rdp', token_id: tokenRecord.id }),
        req.ip
      );
    } catch (logErr) {
      console.error('Failed to log activity:', logErr);
    }

    res.setHeader('Content-Type', 'application/x-rdp');
    res.setHeader('Content-Disposition', `attachment; filename="${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.rdp"`);
    res.send(rdpContent);

  } catch (err) {
    console.error('RDP file generation error:', err);
    res.status(500).json({ error: 'Gagal membuat file RDP' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tokens/launch/:id
// ---------------------------------------------------------------------------

router.get('/launch/:id', (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: 'Token wajib disertakan' });

    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

    const tokenHash = hashToken(token);
    const tokenRecord = db.prepare(`
      SELECT * FROM access_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!tokenRecord) return res.status(401).json({ error: 'Token tidak valid' });
    if (tokenRecord.server_id !== serverId) return res.status(401).json({ error: 'Token tidak cocok dengan server' });

    const validation = validateAndConsumeToken(tokenHash, tokenRecord.user_id, serverId);
    if (!validation.valid) {
      return res.status(401).json({ error: validation.error });
    }

    // Build target URL
    const targetUrl = server.access_url || `http://${server.ip_address}${server.port ? ':' + server.port : ''}`;

    // Log server access
    try {
      db.prepare(`
        INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        tokenRecord.user_id,
        'server_access',
        'server',
        `Membuka server ${server.name} via HTTP (token)`,
        JSON.stringify({ server_id: serverId, protocol: 'http', token_id: tokenRecord.id }),
        req.ip
      );
    } catch (logErr) {
      console.error('Failed to log activity:', logErr);
    }

    res.redirect(302, targetUrl);

  } catch (err) {
    console.error('Launch error:', err);
    res.status(500).json({ error: 'Gagal membuka server' });
  }
});

export default router;
