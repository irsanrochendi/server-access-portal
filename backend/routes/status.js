import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { checkServerHttp, checkServerTcp, checkLatency } from '../services/statusCheck.js';

const router = Router();

// GET /api/status/latency/:id — Ping latency untuk satu server
router.post('/latency/:id', async (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const latency = await checkLatency(server);
  res.json({ server_id: server.id, ...latency });
});

// GET /api/status/check-all — Admin + all users (manual trigger di dashboard)
router.post('/check-all', async (req, res) => {
  const db = getDb();
  const servers = db.prepare("SELECT * FROM servers WHERE is_active = 1 AND status_check_method != 'none'").all();

  let checked = 0, online = 0, offline = 0;
  const latencyResults = {};

  for (const server of servers) {
    let result;
    if (server.status_check_method === 'http' || server.status_check_method === 'health_endpoint') {
      result = await checkServerHttp(server.status_check_url || server.access_url);
    } else if (server.status_check_method === 'tcp') {
      result = await checkServerTcp(server.ip_address, server.port);
    } else {
      continue;
    }
    checked++;
    if (result.online) online++; else offline++;
    db.prepare("UPDATE servers SET status = ?, last_checked_at = datetime('now') WHERE id = ?")
      .run(result.online ? 'online' : 'offline', server.id);

    // Coba dapatkan latency juga
    const lat = await checkLatency(server);
    if (lat.latency !== null) latencyResults[server.id] = lat.latency;
  }

  res.json({ checked, online, offline, latency: latencyResults });
});

// POST /api/status/check/:id — Check single server
router.post('/check/:id', async (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  let result = { online: false, error: 'No method' };
  if (server.status_check_method === 'http' || server.status_check_method === 'health_endpoint') {
    result = await checkServerHttp(server.status_check_url || server.access_url);
  } else if (server.status_check_method === 'tcp') {
    result = await checkServerTcp(server.ip_address, server.port);
  }

  db.prepare("UPDATE servers SET status = ?, last_checked_at = datetime('now') WHERE id = ?")
    .run(result.online ? 'online' : 'offline', server.id);

  // Dapatkan latency
  const lat = await checkLatency(server);

  res.json({ server: db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id), ...result, latency: lat.latency });
});

export default router;
