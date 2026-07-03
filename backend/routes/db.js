import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/db/:table — List rows
router.get('/:table', (req, res) => {
  const allowed = ['users', 'servers', 'activity_logs', 'roles', 'settings', 'custom_fields', 'user_roles'];
  const table = req.params.table;
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });

  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 200`).all();
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get().cnt;
  res.json({ table, columns, total, rows });
});

// PUT /api/db/:table/:id — Update a row
router.put('/:table/:id', (req, res) => {
  const allowed = ['users', 'servers', 'activity_logs', 'roles', 'settings', 'custom_fields', 'user_roles'];
  const table = req.params.table;
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });

  const db = getDb();
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Row not found' });

  const updates = [];
  const params = [];
  for (const [key, value] of Object.entries(req.body)) {
    if (key === 'id') continue;
    if (row.hasOwnProperty(key)) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (updates.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
  res.json({ row: updated });
});

// DELETE /api/db/:table/:id
router.delete('/:table/:id', (req, res) => {
  const allowed = ['users', 'servers', 'activity_logs', 'roles', 'custom_fields', 'user_roles'];
  const table = req.params.table;
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });
  if (table === 'settings') return res.status(400).json({ error: 'Settings cannot be deleted' });

  const db = getDb();
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  res.json({ message: `${table}/${req.params.id} deleted` });
});

// POST /api/db/:table — Insert
router.post('/:table', (req, res) => {
  const allowed = ['servers', 'custom_fields'];
  const table = req.params.table;
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });

  const db = getDb();
  const keys = Object.keys(req.body);
  const vals = Object.values(req.body);
  const placeholders = keys.map(() => '?').join(', ');

  const result = db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...vals);
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ row });
});

export default router;
