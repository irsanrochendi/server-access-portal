import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

router.use(authenticate);

const uploadsDir = join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.rar'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Tipe file tidak diizinkan'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/chat/rooms
router.get('/rooms', (req, res) => {
  const db = getDb();
  const user = req.user;

  const rooms = [{ id: 'general', name: 'General', type: 'public' }];

  // Get custom rooms (created by users)
  const customRooms = db.prepare(`
    SELECT cr.*,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room = cr.id AND cm.is_deleted = 0) as message_count
    FROM chat_rooms cr
    WHERE cr.is_active = 1 AND (cr.created_by = ? OR cr.type = 'public')
    ORDER BY cr.created_at DESC
  `).all(user.id);

  for (const room of customRooms) {
    rooms.push({
      id: String(room.id),
      name: room.name,
      type: room.type,
      description: room.description || '',
      created_at: room.created_at,
    });
  }

  // Division rooms
  if (user.division) {
    const divisionRoom = db.prepare(
      'SELECT * FROM divisions WHERE name = ? AND is_active = 1'
    ).get(user.division);

    if (divisionRoom) {
      rooms.push({
        id: `division-${divisionRoom.id}`,
        name: `Divisi ${divisionRoom.name}`,
        type: 'division',
        divisionId: divisionRoom.id,
      });
    }
  }

  res.json({ rooms });
});

// POST /api/chat/rooms - Create new chat room
router.post('/rooms', (req, res) => {
  const db = getDb();
  const user = req.user;
  const { name, type = 'public', description = '' } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nama room minimal 2 karakter' });
  }

  if (name.length > 50) {
    return res.status(400).json({ error: 'Nama room maksimal 50 karakter' });
  }

  // Create room
  const result = db.prepare(`
    INSERT INTO chat_rooms (name, description, type, created_by)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), description, type, user.id);

  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ room: { id: String(room.id), name: room.name, description: room.description, type: room.type } });
});

// DELETE /api/chat/rooms/:id - Delete chat room (admin or creator)
router.delete('/rooms/:id', (req, res) => {
  const db = getDb();
  const user = req.user;
  const roomId = parseInt(req.params.id);

  if (isNaN(roomId)) {
    return res.status(400).json({ error: 'Room ID tidak valid' });
  }

  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ? AND is_active = 1').get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room tidak ditemukan' });
  }

  if (user.role !== 'admin' && room.created_by !== user.id) {
    return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus room ini' });
  }

  // Soft delete
  db.prepare('UPDATE chat_rooms SET is_active = 0 WHERE id = ?').run(roomId);

  res.json({ message: 'Room berhasil dihapus' });
});

// GET /api/chat/rooms/:room/messages
router.get('/rooms/:room/messages', (req, res) => {
  const db = getDb();
  const { room } = req.params;
  const { before, limit = 50 } = req.query;

  if (room !== 'general') {
    const user = req.user;
    if (room.startsWith('division-')) {
      const divisionId = parseInt(room.replace('division-', ''), 10);
      if (isNaN(divisionId)) {
        return res.status(400).json({ error: 'Room tidak valid' });
      }
      const division = db.prepare('SELECT * FROM divisions WHERE id = ? AND is_active = 1').get(divisionId);
      if (!division) {
        return res.status(404).json({ error: 'Room tidak ditemukan' });
      }
      if (user.division !== division.name) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses ke room ini' });
      }
    } else {
      return res.status(400).json({ error: 'Room tidak valid' });
    }
  }

  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

  let sql = `
    SELECT m.*, u.name as sender_name, u.email as sender_email
    FROM chat_messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.room = ? AND m.is_deleted = 0
  `;
  const params = [room];

  if (before) {
    sql += ` AND m.created_at < ?`;
    params.push(before);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(limitNum);

  const messages = db.prepare(sql).all(...params);

  const messagesWithReplies = messages.map((msg) => {
    if (msg.reply_to) {
      const reply = db.prepare(
        `SELECT m.*, u.name as sender_name
         FROM chat_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.id = ? AND m.is_deleted = 0`
      ).get(msg.reply_to);
      return { ...msg, reply };
    }
    return msg;
  });

  res.json({ messages: messagesWithReplies.reverse() });
});

// POST /api/chat/rooms/:room/upload
router.post('/rooms/:room/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File terlalu besar. Maksimal 10MB' });
      }
      if (err.message === 'Tipe file tidak diizinkan') {
        return res.status(400).json({ error: 'Tipe file tidak diizinkan. Gunakan: PDF, DOC, TXT, PNG, JPG, GIF, ZIP, RAR' });
      }
      return res.status(400).json({ error: err.message || 'Gagal upload file' });
    }
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ file_url: fileUrl, file_name: req.file.originalname });
  });
});

// DELETE /api/chat/messages/:id
router.delete('/messages/:id', (req, res) => {
  const db = getDb();
  const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ? AND is_deleted = 0').get(req.params.id);

  if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan' });

  if (msg.sender_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Anda tidak dapat menghapus pesan orang lain' });
  }

  db.prepare("UPDATE chat_messages SET is_deleted = 1, content = '[pesan dihapus]', attachment_url = NULL, attachment_name = NULL WHERE id = ?").run(req.params.id);

  res.json({ message: 'Pesan dihapus' });
});

export default router;
