import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

/**
 * POST /api/connections/log
 * Log a connection event when user opens a server.
 */
router.post('/log', (req, res) => {
  const { serverId } = req.body;
  const userId = req.user?.id;

  if (!serverId || !userId) {
    return res.status(400).json({ error: 'serverId and userId required' });
  }

  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO connection_logs (server_id, user_id, connected_at)
      VALUES (?, ?, datetime('now'))
    `).run(serverId, userId);

    res.json({ success: true });
  } catch (err) {
    console.error('[connections] POST log error:', err.message);
    res.status(500).json({ error: 'Failed to log connection' });
  }
});

/**
 * GET /api/connections/recent
 * Get recent servers with frecency score (frequency + recency).
 * Returns top 10 most frequently/recently accessed servers.
 */
router.get('/recent', (req, res) => {
  const userId = req.user?.id;
  const { limit = 10 } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDb();

  try {
    // Frecency algorithm: weighted by recency (exponential decay)
    // Score = SUM(1 / (days_ago + 1)^1.5) for each connection in last 30 days
    const recent = db.prepare(`
      SELECT
        s.*,
        COUNT(cl.id) AS connection_count,
        MAX(cl.connected_at) AS last_connected_at,
        SUM(
          1.0 / POWER(
            (julianday('now') - julianday(cl.connected_at)) + 1,
            1.5
          )
        ) AS frecency_score
      FROM servers s
      JOIN connection_logs cl ON cl.server_id = s.id
      WHERE cl.user_id = ?
        AND cl.connected_at >= datetime('now', '-30 days')
      GROUP BY s.id
      ORDER BY frecency_score DESC
      LIMIT ?
    `).all(userId, parseInt(limit, 10));

    res.json({ data: recent });
  } catch (err) {
    console.error('[connections] GET recent error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recent servers' });
  }
});

/**
 * GET /api/connections/history
 * Get full connection history (chronological).
 */
router.get('/history', (req, res) => {
  const userId = req.user?.id;
  const { limit = 50, offset = 0 } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDb();

  try {
    const history = db.prepare(`
      SELECT
        cl.*,
        s.name AS server_name,
        s.ip_address,
        s.status,
        s.environment,
        s.category
      FROM connection_logs cl
      JOIN servers s ON s.id = cl.server_id
      WHERE cl.user_id = ?
      ORDER BY cl.connected_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, parseInt(limit, 10), parseInt(offset, 10));

    const total = db.prepare(`
      SELECT COUNT(*) AS count
      FROM connection_logs
      WHERE user_id = ?
    `).get(userId).count;

    res.json({ data: history, total });
  } catch (err) {
    console.error('[connections] GET history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch connection history' });
  }
});

export default router;
