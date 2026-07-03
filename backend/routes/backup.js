import { Router } from 'express';
import fs from 'fs';
import { authenticate, authorize } from '../middleware/auth.js';
import { getDb } from '../database.js';
import {
  runBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
  getBackupPath,
  getBackupSettings,
  saveBackupSettings,
} from '../services/backup.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/backup — List semua backup
router.get('/', (req, res) => {
  const backups = listBackups();
  res.json({ backups });
});

// GET /api/backup/settings — Baca pengaturan backup
router.get('/settings', (req, res) => {
  const settings = getBackupSettings();
  res.json({ settings });
});

// PUT /api/backup/settings — Simpan pengaturan backup
router.put('/settings', (req, res) => {
  const { autoEnabled, frequency, retentionDays, time } = req.body;
  saveBackupSettings({ autoEnabled, frequency, retentionDays, time });
  res.json({ message: 'Pengaturan backup disimpan' });
});

// POST /api/backup/run — Jalankan backup manual
router.post('/run', (req, res) => {
  const label = req.body.label || 'manual';
  const result = runBackup(label);
  res.json({ message: 'Backup berhasil', backup: result });
});

// GET /api/backup/download/:filename — Download file backup
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = getBackupPath(filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }
  res.download(filePath, filename, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
});

// POST /api/backup/restore — Restore database dari file backup
router.post('/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename wajib diisi' });

    // Log activity sebelum restore (data activity_logs akan ikut di-restore dari backup)
    const db = getDb();
    db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
      VALUES (?, 'restore', 'backup', ?, ?, datetime('now'))`)
      .run(req.user.id, `Database direstore dari ${filename}`, req.ip);

    const result = restoreBackup(filename);

    res.json({ message: 'Database berhasil direstore', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/backup/:filename — Hapus backup
router.delete('/:filename', (req, res) => {
  try {
    const result = deleteBackup(req.params.filename);
    res.json({ message: 'Backup dihapus', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
