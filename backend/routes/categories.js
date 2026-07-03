import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/categories
router.get('/', (req, res) => {
  const cats = getDb().prepare('SELECT * FROM custom_fields WHERE field_type = ? ORDER BY value ASC').all('category');
  res.json({ categories: cats });
});

// POST /api/categories
router.post('/', (req, res) => {
  const { value, label } = req.body;
  if (!value) return res.status(400).json({ error: 'Value wajib' });

  const db = getDb();
  const dup = db.prepare('SELECT id FROM custom_fields WHERE field_type = ? AND value = ?').get('category', value);
  if (dup) return res.status(409).json({ error: 'Kategori sudah ada' });

  const result = db.prepare('INSERT INTO custom_fields (field_type, value, label) VALUES (?, ?, ?)')
    .run('category', value, label || value);
  const cat = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category: cat });
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Kategori tidak ditemukan' });

  // Cek apakah dipakai server
  const used = db.prepare('SELECT COUNT(*) as cnt FROM servers WHERE category = ?').get(cat.value).cnt;
  if (used > 0) return res.status(400).json({ error: `Kategori "${cat.value}" masih dipakai oleh ${used} server` });

  db.prepare('DELETE FROM custom_fields WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kategori dihapus' });
});

export default router;
