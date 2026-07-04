import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

/**
 * GET /api/alerts
 * Get all alerts (filtered by unread/unresolved by default).
 */
router.get('/', (req, res) => {
  const { unread, serverId, limit = 50 } = req.query;
  const db = getDb();

  try {
    let query = `
      SELECT a.*, s.name AS server_name, s.ip_address
      FROM alerts a
      JOIN servers s ON s.id = a.server_id
      WHERE 1=1
    `;
    const params = [];

    if (unread === 'true') {
      query += ` AND a.is_read = 0`;
    }

    if (serverId) {
      query += ` AND a.server_id = ?`;
      params.push(serverId);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const alerts = db.prepare(query).all(...params);

    // Unread count
    const unreadCount = db.prepare(`
      SELECT COUNT(*) AS count FROM alerts WHERE is_read = 0 AND is_resolved = 0
    `).get().count;

    res.json({ data: alerts, unreadCount });
  } catch (err) {
    console.error('[alerts] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * PATCH /api/alerts/:id/read
 * Mark alert as read.
 */
router.patch('/:id/read', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.prepare(`UPDATE alerts SET is_read = 1 WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[alerts] PATCH read error:', err.message);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * PATCH /api/alerts/:id/resolve
 * Mark alert as resolved.
 */
router.patch('/:id/resolve', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.prepare(`
      UPDATE alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?
    `).run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[alerts] PATCH resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * POST /api/alerts/mark-all-read
 * Mark all unread alerts as read.
 */
router.post('/mark-all-read', (req, res) => {
  const db = getDb();

  try {
    const result = db.prepare(`UPDATE alerts SET is_read = 1 WHERE is_read = 0`).run();
    res.json({ success: true, updated: result.changes });
  } catch (err) {
    console.error('[alerts] POST mark-all-read error:', err.message);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert.
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.prepare(`DELETE FROM alerts WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[alerts] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
