import { Router } from 'express';
import { getDb } from '../database.js';
import { checkServerHealth } from '../services/healthCheck.js';

const router = Router();

/**
 * GET /api/health/history?serverId=&days=
 * Returns uptime history for a server (or all if no serverId).
 */
router.get('/history', (req, res) => {
  const { serverId, days = 7 } = req.query;
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    let rows;
    if (serverId) {
      rows = db.prepare(`
        SELECT h.id, h.server_id, h.status, h.latency_ms, h.error, h.checked_at,
               s.name AS server_name
        FROM server_uptime_history h
        JOIN servers s ON s.id = h.server_id
        WHERE h.server_id = ? AND h.checked_at >= ?
        ORDER BY h.checked_at DESC
      `).all(serverId, since);
    } else {
      rows = db.prepare(`
        SELECT h.id, h.server_id, h.status, h.latency_ms, h.error, h.checked_at,
               s.name AS server_name
        FROM server_uptime_history h
        JOIN servers s ON s.id = h.server_id
        WHERE h.checked_at >= ?
        ORDER BY h.checked_at DESC
        LIMIT 1000
      `).all(since);
    }

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('[health/history]', err.message);
    res.status(500).json({ error: 'Failed to fetch health history' });
  }
});

/**
 * GET /api/health/uptime?serverId=&days=
 * Returns uptime percentage per server.
 */
router.get('/uptime', (req, res) => {
  const { serverId, days = 7 } = req.query;
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    let rows;
    if (serverId) {
      rows = db.prepare(`
        SELECT
          s.id AS server_id,
          s.name,
          s.status AS current_status,
          s.latency_ms AS current_latency,
          COUNT(h.id) AS total_checks,
          SUM(CASE WHEN h.status = 'online' THEN 1 ELSE 0 END) AS online_checks,
          SUM(CASE WHEN h.status = 'offline' THEN 1 ELSE 0 END) AS offline_checks,
          AVG(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS avg_latency,
          MIN(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS min_latency,
          MAX(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS max_latency
        FROM servers s
        LEFT JOIN server_uptime_history h ON h.server_id = s.id AND h.checked_at >= ?
        WHERE s.id = ? AND s.is_active = 1
        GROUP BY s.id
      `).all(since, serverId);
    } else {
      rows = db.prepare(`
        SELECT
          s.id AS server_id,
          s.name,
          s.status AS current_status,
          s.latency_ms AS current_latency,
          COUNT(h.id) AS total_checks,
          SUM(CASE WHEN h.status = 'online' THEN 1 ELSE 0 END) AS online_checks,
          SUM(CASE WHEN h.status = 'offline' THEN 1 ELSE 0 END) AS offline_checks,
          AVG(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS avg_latency,
          MIN(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS min_latency,
          MAX(CASE WHEN h.status = 'online' THEN h.latency_ms END) AS max_latency
        FROM servers s
        LEFT JOIN server_uptime_history h ON h.server_id = s.id AND h.checked_at >= ?
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY s.name
      `).all(since);
    }

    // Calculate uptime percentage
    const result = rows.map(row => ({
      ...row,
      uptime_percent: row.total_checks > 0
        ? Math.round((row.online_checks / row.total_checks) * 10000) / 100
        : null,
    }));

    res.json({ data: result });
  } catch (err) {
    console.error('[health/uptime]', err.message);
    res.status(500).json({ error: 'Failed to fetch uptime' });
  }
});

/**
 * POST /api/health/check/:serverId
 * Trigger immediate check for a single server.
 */
router.post('/check/:serverId', async (req, res) => {
  const { serverId } = req.params;
  const db = getDb();

  try {
    const server = db.prepare(`
      SELECT id, name, ip_address, port, protocol, access_url, status
      FROM servers WHERE id = ? AND is_active = 1
    `).get(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const result = await checkServerHealth(server);
    res.json(result);
  } catch (err) {
    console.error('[health/check]', err.message);
    res.status(500).json({ error: 'Check failed' });
  }
});

export default router;
