import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `icon${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.ico', '.png', '.svg', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error('Format file: ico, png, svg, jpg'));
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const router = Router();

// GET /api/upload/icon — PUBLIC (dipakai login page, header, sidebar, favicon)
router.get('/icon', (req, res) => {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'custom_icon'").get();
  const filename = setting?.value || 'favicon.svg';
  res.json({ url: `/uploads/${filename}`, filename });
});

router.use(authenticate);
router.use(authorize('admin'));

// POST /api/upload/icon
router.post('/icon', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const name = `custom-icon${ext}`;
    const oldPath = req.file.path;
    const newPath = path.join(uploadsDir, name);
    if (oldPath !== newPath) fs.renameSync(oldPath, newPath);

    const db = getDb();
    const setting = db.prepare("SELECT id FROM settings WHERE key = 'custom_icon'").get();
    if (setting) {
      db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'custom_icon'").run(name);
    } else {
      db.prepare("INSERT INTO settings (key, value, type) VALUES ('custom_icon', ?, 'string')").run(name);
    }

    db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
      VALUES (?, 'update', 'settings', 'Custom icon diupdate', ?, datetime('now'))`)
      .run(req.user.id, req.ip);

    res.json({ success: true, filename: name, url: `/uploads/${name}` });
  });
});

// GET /api/upload/icon — admin only (detail)
router.get('/detail', (req, res) => {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'custom_icon'").get();
  const filename = setting?.value || 'favicon.svg';
  res.json({ url: `/uploads/${filename}`, filename });
});

export default router;
