import { Router } from 'express';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// POST /api/open — Buka server di browser/app langsung tanpa download file
router.post('/', (req, res) => {
  const { url, protocol, browser } = req.body;
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
    const rdpContent = [
      `full address:s:${ip}${rdpPort}`,
      'prompt for credentials:i:1',
      'authentication level:i:2',
    ].join('\r\n');

    const tmpPath = join(tmpdir(), `portal_rdp_${Date.now()}.rdp`);
    writeFileSync(tmpPath, rdpContent);
    command = `start mstsc "${tmpPath}"`;

  } else {
    switch (browser) {
      case 'firefox': command = `start firefox "${normalized}"`; break;
      case 'chrome':  command = `start chrome "${normalized}"`; break;
      case 'edge':    command = `start msedge "${normalized}"`; break;
      default:        command = `start "" "${normalized}"`; break;
    }
  }

  exec(command, (err) => {
    if (err) {
      return res.status(500).json({ error: `Gagal membuka: ${err.message}` });
    }
    res.json({ success: true, message: `Membuka ${normalized}`, command });
  });
});

export default router;
