import { Router } from 'express';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { authenticate } from '../middleware/auth.js';
import { getDb } from '../database.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';

function decrypt(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return '';
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const router = Router();
router.use(authenticate);

// POST /api/open — Buka server di browser/app langsung tanpa download file
router.post('/', (req, res) => {
  const { url, protocol, browser, serverId } = req.body;
  if (!url) return res.status(400).json({ error: 'URL wajib' });

  let normalized = url.match(/^https?:\/\//) ? url : `http://${url}`;
  let command;

  if (protocol === 'SSH') {
    const ip = normalized.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    command = `start ssh ${ip}`;

  } else if (protocol === 'RDP') {
    const cleaned = normalized.replace(/^https?:\/\//, '').split('/')[0];
    const [ip, port] = cleaned.split(':');
    const rdpPort = port && parseInt(port) !== 3389 ? `:${port}` : '';

    // Check for auto-login credentials
    let username = '';
    let password = '';
    if (serverId) {
      const db = getDb();
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      if (server && server.auto_login_enabled && server.shared_username && server.shared_password_encrypted) {
        username = server.shared_username;
        password = decrypt(server.shared_password_encrypted);
      }
    }

    const rdpContent = [
      `full address:s:${ip}${rdpPort}`,
      username ? `username:s:${username}` : '',
      username ? 'prompt for credentials:i:0' : 'prompt for credentials:i:1',
      'authentication level:i:2',
    ].filter(Boolean).join('\r\n');

    const tmpPath = join(tmpdir(), `portal_rdp_${Date.now()}.rdp`);
    writeFileSync(tmpPath, rdpContent);

    // If password exists, store it temporarily for RDP to pick up (Windows credential manager would be ideal)
    command = `start mstsc "${tmpPath}"`;

  } else {
    // HTTP/HTTPS - check for auto-login
    let finalUrl = normalized;
    if (serverId) {
      const db = getDb();
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      if (server && server.auto_login_enabled && server.shared_username && server.shared_password_encrypted) {
        const username = server.shared_username;
        const password = decrypt(server.shared_password_encrypted);
        // Append credentials as URL params (basic approach - would need custom per-service)
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }
    }

    switch (browser) {
      case 'firefox': command = `start firefox "${finalUrl}"`; break;
      case 'chrome':  command = `start chrome "${finalUrl}"`; break;
      case 'edge':    command = `start msedge "${finalUrl}"`; break;
      default:        command = `start "" "${finalUrl}"`; break;
    }
  }

  exec(command, (err) => {
    if (err) {
      return res.status(500).json({ error: `Gagal membuka: ${err.message}` });
    }

    // Log server access
    if (serverId) {
      try {
        const db = getDb();
        const server = db.prepare('SELECT name FROM servers WHERE id = ?').get(serverId);
        db.prepare(
          'INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
        ).run(
          req.user.id,
          'server_access',
          'server',
          `Membuka server ${server?.name || serverId}`,
          JSON.stringify({ server_id: serverId, protocol: protocol || 'HTTP' }),
          req.ip
        );
      } catch (logErr) {
        console.error('Failed to log activity:', logErr);
      }
    }

    res.json({ success: true, message: `Membuka ${normalized}`, command });
  });
});

export default router;
