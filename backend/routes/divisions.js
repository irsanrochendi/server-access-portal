import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/divisions — semua user bisa lihat
router.get('/', (req, res) => {
  const db = getDb();
  const divisions = db.prepare("SELECT * FROM custom_fields WHERE field_type = 'division' ORDER BY value ASC").all();
  // Juga return default bawaan
  const defaults = ['Direktur', 'Engineer', 'HR/Finance'];
  const all = [...new Set([...defaults, ...divisions.map(d => d.value)])];
  res.json({ divisions: all, records: divisions });
});

export default router;
