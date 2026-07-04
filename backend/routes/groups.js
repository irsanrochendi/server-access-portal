import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

/**
 * GET /api/groups
 * List all server groups
 */
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const groups = db.prepare(`
      SELECT
        g.*,
        COUNT(m.server_id) AS server_count
      FROM server_groups g
      LEFT JOIN server_group_members m ON m.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `).all();

    res.json({ data: groups });
  } catch (err) {
    console.error('[groups] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * GET /api/groups/:id
 * Get group with members
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const group = db.prepare(`SELECT * FROM server_groups WHERE id = ?`).get(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const members = db.prepare(`
      SELECT s.*
      FROM servers s
      JOIN server_group_members m ON m.server_id = s.id
      WHERE m.group_id = ?
      ORDER BY s.name ASC
    `).all(id);

    res.json({ data: { ...group, members } });
  } catch (err) {
    console.error('[groups] GET :id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

/**
 * POST /api/groups
 * Create new group
 */
router.post('/', (req, res) => {
  const { name, description, color, icon } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name required' });
  }

  const db = getDb();

  try {
    const result = db.prepare(`
      INSERT INTO server_groups (name, description, color, icon)
      VALUES (?, ?, ?, ?)
    `).run(name, description || null, color || '#6366f1', icon || 'folder');

    const group = db.prepare(`SELECT * FROM server_groups WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: group });
  } catch (err) {
    console.error('[groups] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * PATCH /api/groups/:id
 * Update group
 */
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, color, icon } = req.body;
  const db = getDb();

  try {
    db.prepare(`
      UPDATE server_groups
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon)
      WHERE id = ?
    `).run(name, description, color, icon, id);

    const group = db.prepare(`SELECT * FROM server_groups WHERE id = ?`).get(id);
    res.json({ data: group });
  } catch (err) {
    console.error('[groups] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

/**
 * DELETE /api/groups/:id
 * Delete group (cascade removes members)
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.prepare(`DELETE FROM server_groups WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[groups] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

/**
 * POST /api/groups/:id/members
 * Add server to group
 */
router.post('/:id/members', (req, res) => {
  const { id } = req.params;
  const { serverId } = req.body;

  if (!serverId) {
    return res.status(400).json({ error: 'serverId required' });
  }

  const db = getDb();

  try {
    db.prepare(`
      INSERT OR IGNORE INTO server_group_members (group_id, server_id)
      VALUES (?, ?)
    `).run(id, serverId);

    res.json({ success: true });
  } catch (err) {
    console.error('[groups] POST members error:', err.message);
    res.status(500).json({ error: 'Failed to add server to group' });
  }
});

/**
 * DELETE /api/groups/:id/members/:serverId
 * Remove server from group
 */
router.delete('/:id/members/:serverId', (req, res) => {
  const { id, serverId } = req.params;
  const db = getDb();

  try {
    db.prepare(`
      DELETE FROM server_group_members
      WHERE group_id = ? AND server_id = ?
    `).run(id, serverId);

    res.json({ success: true });
  } catch (err) {
    console.error('[groups] DELETE member error:', err.message);
    res.status(500).json({ error: 'Failed to remove server from group' });
  }
});

/**
 * GET /api/groups/server/:serverId
 * Get all groups a server belongs to
 */
router.get('/server/:serverId', (req, res) => {
  const { serverId } = req.params;
  const db = getDb();

  try {
    const groups = db.prepare(`
      SELECT g.*
      FROM server_groups g
      JOIN server_group_members m ON m.group_id = g.id
      WHERE m.server_id = ?
      ORDER BY g.name ASC
    `).all(serverId);

    res.json({ data: groups });
  } catch (err) {
    console.error('[groups] GET server groups error:', err.message);
    res.status(500).json({ error: 'Failed to fetch server groups' });
  }
});

export default router;
