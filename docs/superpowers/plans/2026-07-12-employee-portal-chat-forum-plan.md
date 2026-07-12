# Employee Portal, Internal Chat & Forum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 modules (announcements, real-time chat, threaded forum) to the existing server-access-portal React + Express + SQLite application.

**Architecture:** Monolith extension — new tables in existing SQLite DB, new Express route files, Socket.IO server attached to existing HTTP server, new React pages/components with Socket.IO client context. No new services or databases.

**Tech Stack:** React 19, Vite 8, TailwindCSS 4, React Router DOM 7, Express 4, better-sqlite3, Socket.IO (server + client), lucide-react, jsonwebtoken

## Global Constraints

- All endpoints reuse existing `authenticate` JWT middleware from `backend/middleware/auth.js`
- Admin-only endpoints reuse existing `authorize('admin')` middleware
- New DB tables added via `CREATE TABLE IF NOT EXISTS` in `backend/database.js` `initDb()`
- Frontend UI components reuse existing primitives from `src/components/ui/` (Button, Card, Modal, Input, Select, Badge)
- Sidebar navigation items use lucide-react icons already in the project
- No new dependencies beyond `socket.io` and `socket.io-client`
- Follow existing code patterns: Indonesian error messages, Tailwind dark mode support, gradient card design
- All file paths relative to project root: `C:\Users\Administrator\server-access-portal-main`

---

## File Structure Map

### New Files (22 files)

**Backend (4 files):**
- `backend/routes/announcements.js` — CRUD endpoints for announcements
- `backend/routes/chat.js` — REST endpoints for chat history + file upload
- `backend/routes/forum.js` — CRUD endpoints for forum categories, topics, replies
- `backend/socket/chatHandler.js` — Socket.IO event handlers for real-time chat

**Frontend — Context (1 file):**
- `src/contexts/SocketContext.jsx` — Socket.IO client provider + hook

**Frontend — Pages (4 files):**
- `src/pages/announcements/AnnouncementsPage.jsx` — announcement list with filters + admin create modal
- `src/pages/chat/ChatPage.jsx` — split-pane chat with room list + message window
- `src/pages/forum/ForumPage.jsx` — category filter + topic list
- `src/pages/forum/ForumTopicPage.jsx` — single topic detail with threaded replies

**Frontend — Components (13 files):**
- `src/components/announcements/AnnouncementCard.jsx` — single announcement summary card
- `src/components/announcements/AnnouncementModal.jsx` — create/edit form modal
- `src/components/chat/RoomList.jsx` — sidebar room list
- `src/components/chat/ChatWindow.jsx` — message display area + scroll management
- `src/components/chat/MessageBubble.jsx` — single message (text/file, own/other)
- `src/components/chat/ChatInput.jsx` — text input + file attach + send
- `src/components/chat/TypingIndicator.jsx` — "X is typing..." indicator
- `src/components/forum/TopicCard.jsx` — topic row in list
- `src/components/forum/ReplyCard.jsx` — single reply with nested sub-replies
- `src/components/forum/ReplyForm.jsx` — reply textarea + submit

### Modified Files (6 files)
- `backend/database.js` — add 5 CREATE TABLE statements in initDb()
- `backend/server.js` — wrap with http.createServer, attach Socket.IO, register chat socket handler
- `backend/package.json` — add `socket.io` dependency
- `package.json` — add `socket.io-client` dependency
- `src/services/api.js` — add announcements, chat, forum API methods
- `src/components/layout/Sidebar.jsx` — add 3 nav items with new icons

---

### Task 1: Install Dependencies & Database Migration

**Files:**
- Modify: `backend/package.json`
- Modify: `package.json`
- Modify: `backend/database.js`

**Interfaces:**
- Produces: 5 new tables ready for use by backend routes. Socket.IO available for import.

- [ ] **Step 1: Install socket.io in backend**

```bash
cd C:\Users\Administrator\server-access-portal-main\backend
npm install socket.io
```

- [ ] **Step 2: Install socket.io-client in frontend**

```bash
cd C:\Users\Administrator\server-access-portal-main
npm install socket.io-client
```

- [ ] **Step 3: Add 5 new tables to database.js initDb()**

Open `backend/database.js`. In the `initDb()` function, add these `CREATE TABLE IF NOT EXISTS` statements after the existing `access_tokens` index creation and before the `activity_logs` migration block:

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id INTEGER REFERENCES divisions(id),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES forum_replies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Add indexes after the table creation:

```sql
CREATE INDEX IF NOT EXISTS idx_announcements_division ON announcements(division_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created ON forum_topics(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_parent ON forum_replies(parent_id);
```

- [ ] **Step 4: Seed default forum categories**

In the same `initDb()`, add a seed check after table creation:

```javascript
// Seed default forum categories if empty
const catCount = d.prepare('SELECT COUNT(*) as cnt FROM forum_categories').get().cnt;
if (catCount === 0) {
  d.prepare(`INSERT INTO forum_categories (name, description, sort_order) VALUES
    ('Umum', 'Diskusi umum dan topik bebas', 1),
    ('Teknis', 'Pertanyaan teknis dan troubleshooting', 2),
    ('HR & Administrasi', 'Kepegawaian, cuti, dan administrasi kantor', 3),
    ('Saran & Feedback', 'Saran untuk perbaikan dan feedback', 4)
  `).run();
}
```

- [ ] **Step 5: Verify tables were created**

```bash
cd C:\Users\Administrator\server-access-portal-main\backend
node -e "import { initDb, getDb } from './database.js'; initDb(); const tables = getDb().prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('announcements','chat_messages','forum_categories','forum_topics','forum_replies')\").all(); console.log('New tables:', tables.map(t=>t.name)); const cats = getDb().prepare('SELECT * FROM forum_categories').all(); console.log('Categories:', cats);"
```

Expected: Lists all 5 new tables and 4 default categories.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add backend/package.json backend/package-lock.json package.json package-lock.json backend/database.js
git commit -m "feat: add new DB tables for announcements, chat, and forum

- Add announcements, chat_messages, forum_categories, forum_topics, forum_replies tables
- Add indexes for performance
- Seed 4 default forum categories
- Install socket.io (backend) and socket.io-client (frontend)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Backend — Announcements Routes

**Files:**
- Create: `backend/routes/announcements.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getDb` from `../database.js`, `authenticate`/`authorize` from `../middleware/auth.js`
- Produces: Router with 6 endpoints mounted at `/api/announcements`

- [ ] **Step 1: Write the route file**

Create `backend/routes/announcements.js`:

```javascript
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/announcements — list with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { division, pinned, page = 1, limit = 20 } = req.query;
  const conditions = [];
  const params = [];

  if (division) {
    conditions.push('(a.division_id = ? OR a.division_id IS NULL)');
    params.push(Number(division));
  }
  if (pinned === '1') {
    conditions.push('a.is_pinned = 1');
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM announcements a ${whereClause}`).get(...params).cnt;

  const announcements = db.prepare(`
    SELECT a.*, u.name as author_name, d.name as division_name
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN divisions d ON a.division_id = d.id
    ${whereClause}
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ announcements, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

// GET /api/announcements/:id — detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name, d.name as division_name
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN divisions d ON a.division_id = d.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!announcement) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
  res.json({ announcement });
});

// POST /api/announcements — create (admin only)
router.post('/', authorize('admin'), (req, res) => {
  const db = getDb();
  const { title, content, division_id } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Judul dan konten wajib diisi' });

  const result = db.prepare(
    'INSERT INTO announcements (title, content, author_id, division_id) VALUES (?, ?, ?, ?)'
  ).run(title, content, req.user.id, division_id || null);

  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name, d.name as division_name
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN divisions d ON a.division_id = d.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ announcement });
});

// PUT /api/announcements/:id — update (admin only)
router.put('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });

  const { title, content, division_id } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Judul dan konten wajib diisi' });

  db.prepare(
    'UPDATE announcements SET title = ?, content = ?, division_id = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(title, content, division_id || null, req.params.id);

  const announcement = db.prepare(`
    SELECT a.*, u.name as author_name, d.name as division_name
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN divisions d ON a.division_id = d.id
    WHERE a.id = ?
  `).get(req.params.id);

  res.json({ announcement });
});

// DELETE /api/announcements/:id — delete (admin only)
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });

  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ message: 'Pengumuman dihapus' });
});

// PATCH /api/announcements/:id/pin — toggle pin (admin only)
router.patch('/:id/pin', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });

  db.prepare('UPDATE announcements SET is_pinned = ? WHERE id = ?').run(existing.is_pinned ? 0 : 1, req.params.id);
  res.json({ is_pinned: existing.is_pinned ? 0 : 1 });
});

export default router;
```

- [ ] **Step 2: Register route in server.js**

Open `backend/server.js`. Add after the existing route registrations:

```javascript
import announcementRoutes from './routes/announcements.js';
// ... (add with other imports)
```

And after `app.use('/api/tokens', tokensRoutes);`:

```javascript
app.use('/api/announcements', announcementRoutes);
```

- [ ] **Step 3: Test endpoints manually**

Start the backend:
```bash
cd C:\Users\Administrator\server-access-portal-main\backend
node server.js
```

Test with curl (first login to get a token, then test):
```bash
# Login to get token
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"

# Create announcement (use token from login)
curl -X POST http://localhost:4000/api/announcements -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{\"title\":\"Test Pengumuman\",\"content\":\"Isi pengumuman test\"}"

# List announcements
curl http://localhost:4000/api/announcements -H "Authorization: Bearer <TOKEN>"
```

Expected: 201 on create, 200 on list with announcement data.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add backend/routes/announcements.js backend/server.js
git commit -m "feat: add announcements CRUD API endpoints

- GET /api/announcements — list with division, pinned, page filters
- GET /api/announcements/:id — detail
- POST /api/announcements — create (admin)
- PUT /api/announcements/:id — update (admin)
- DELETE /api/announcements/:id — delete (admin)
- PATCH /api/announcements/:id/pin — toggle pin (admin)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Backend — Forum Routes

**Files:**
- Create: `backend/routes/forum.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getDb` from `../database.js`, `authenticate`/`authorize` from `../middleware/auth.js`
- Produces: Router with 12 endpoints mounted at `/api/forum`

- [ ] **Step 1: Write the route file**

Create `backend/routes/forum.js`:

```javascript
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── Categories ────────────────────────────────────────────────────────────

// GET /api/forum/categories
router.get('/categories', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM forum_categories ORDER BY sort_order ASC').all();
  res.json({ categories });
});

// POST /api/forum/categories (admin only)
router.post('/categories', authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, description, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });

  const result = db.prepare(
    'INSERT INTO forum_categories (name, description, sort_order) VALUES (?, ?, ?)'
  ).run(name, description || null, sort_order || 0);

  const category = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category });
});

// PUT /api/forum/categories/:id (admin only)
router.put('/categories/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kategori tidak ditemukan' });

  const { name, description, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });

  db.prepare(
    'UPDATE forum_categories SET name = ?, description = ?, sort_order = ? WHERE id = ?'
  ).run(name, description || null, sort_order || 0, req.params.id);

  const category = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
  res.json({ category });
});

// DELETE /api/forum/categories/:id (admin only)
router.delete('/categories/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kategori tidak ditemukan' });

  const topicsCount = db.prepare('SELECT COUNT(*) as cnt FROM forum_topics WHERE category_id = ?').get(req.params.id).cnt;
  if (topicsCount > 0) {
    return res.status(400).json({ error: `Kategori masih memiliki ${topicsCount} topik. Pindahkan atau hapus terlebih dahulu.` });
  }

  db.prepare('DELETE FROM forum_categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kategori dihapus' });
});

// ─── Topics ────────────────────────────────────────────────────────────────

// GET /api/forum/topics — list with filters
router.get('/topics', (req, res) => {
  const db = getDb();
  const { category, page = 1, limit = 20, sort = 'latest' } = req.query;
  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('t.category_id = ?');
    params.push(Number(category));
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (Number(page) - 1) * Number(limit);
  const orderBy = sort === 'popular' ? 't.reply_count DESC, t.created_at DESC' : 't.is_pinned DESC, t.created_at DESC';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM forum_topics t ${whereClause}`).get(...params).cnt;

  const topics = db.prepare(`
    SELECT t.*, u.name as author_name, fc.name as category_name,
      (SELECT u2.name FROM forum_replies fr JOIN users u2 ON fr.author_id = u2.id WHERE fr.topic_id = t.id ORDER BY fr.created_at DESC LIMIT 1) as last_reply_author,
      (SELECT fr.created_at FROM forum_replies fr WHERE fr.topic_id = t.id ORDER BY fr.created_at DESC LIMIT 1) as last_reply_at
    FROM forum_topics t
    JOIN users u ON t.author_id = u.id
    JOIN forum_categories fc ON t.category_id = fc.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ topics, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

// GET /api/forum/topics/:id — detail with replies
router.get('/topics/:id', (req, res) => {
  const db = getDb();
  const topic = db.prepare(`
    SELECT t.*, u.name as author_name, fc.name as category_name
    FROM forum_topics t
    JOIN users u ON t.author_id = u.id
    JOIN forum_categories fc ON t.category_id = fc.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });

  const replies = db.prepare(`
    SELECT r.*, u.name as author_name
    FROM forum_replies r
    JOIN users u ON r.author_id = u.id
    WHERE r.topic_id = ?
    ORDER BY r.created_at ASC
  `).all(req.params.id);

  res.json({ topic, replies });
});

// POST /api/forum/topics — create topic
router.post('/topics', (req, res) => {
  const db = getDb();
  const { category_id, title, content } = req.body;
  if (!category_id || !title || !content) {
    return res.status(400).json({ error: 'Kategori, judul, dan konten wajib diisi' });
  }

  const category = db.prepare('SELECT id FROM forum_categories WHERE id = ?').get(category_id);
  if (!category) return res.status(404).json({ error: 'Kategori tidak ditemukan' });

  const result = db.prepare(
    'INSERT INTO forum_topics (category_id, title, content, author_id) VALUES (?, ?, ?, ?)'
  ).run(category_id, title, content, req.user.id);

  const topic = db.prepare(`
    SELECT t.*, u.name as author_name, fc.name as category_name
    FROM forum_topics t
    JOIN users u ON t.author_id = u.id
    JOIN forum_categories fc ON t.category_id = fc.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ topic });
});

// DELETE /api/forum/topics/:id — delete (author or admin)
router.delete('/topics/:id', (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });

  if (topic.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus topik ini' });
  }

  db.prepare('DELETE FROM forum_topics WHERE id = ?').run(req.params.id);
  res.json({ message: 'Topik dihapus' });
});

// ─── Replies ───────────────────────────────────────────────────────────────

// POST /api/forum/topics/:id/replies — create reply
router.post('/topics/:id/replies', (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });
  if (topic.is_locked) return res.status(403).json({ error: 'Topik ini dikunci, tidak dapat menambah balasan' });

  const { content, parent_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Konten balasan wajib diisi' });

  // Validate parent_id if provided (max 2 level: reply to topic = NULL, reply to reply = parent_id)
  if (parent_id) {
    const parent = db.prepare('SELECT * FROM forum_replies WHERE id = ? AND topic_id = ?').get(parent_id, req.params.id);
    if (!parent) return res.status(404).json({ error: 'Balasan induk tidak ditemukan' });
    // If parent already has a parent_id, it's level 2 — new reply would be level 3 (not allowed)
    if (parent.parent_id) {
      return res.status(400).json({ error: 'Balasan hanya bisa 2 level. Balas langsung ke topik atau ke balasan level 1.' });
    }
  }

  const result = db.prepare(
    'INSERT INTO forum_replies (topic_id, content, author_id, parent_id) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, content, req.user.id, parent_id || null);

  // Update reply_count cache
  db.prepare('UPDATE forum_topics SET reply_count = (SELECT COUNT(*) FROM forum_replies WHERE topic_id = ?), updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id, req.params.id);

  const reply = db.prepare(`
    SELECT r.*, u.name as author_name
    FROM forum_replies r
    JOIN users u ON r.author_id = u.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ reply });
});

// DELETE /api/forum/replies/:id — delete reply (author or admin)
router.delete('/replies/:id', (req, res) => {
  const db = getDb();
  const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(req.params.id);
  if (!reply) return res.status(404).json({ error: 'Balasan tidak ditemukan' });

  if (reply.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus balasan ini' });
  }

  const topicId = reply.topic_id;
  db.prepare('DELETE FROM forum_replies WHERE id = ?').run(req.params.id);

  // Update reply_count cache
  db.prepare('UPDATE forum_topics SET reply_count = (SELECT COUNT(*) FROM forum_replies WHERE topic_id = ?) WHERE id = ?').run(topicId, topicId);

  res.json({ message: 'Balasan dihapus' });
});

// ─── Moderation (admin only) ────────────────────────────────────────────────

// PATCH /api/forum/topics/:id/lock — toggle lock
router.patch('/topics/:id/lock', authorize('admin'), (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });

  db.prepare('UPDATE forum_topics SET is_locked = ? WHERE id = ?').run(topic.is_locked ? 0 : 1, req.params.id);
  res.json({ is_locked: topic.is_locked ? 0 : 1 });
});

// PATCH /api/forum/topics/:id/pin — toggle pin
router.patch('/topics/:id/pin', authorize('admin'), (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topik tidak ditemukan' });

  db.prepare('UPDATE forum_topics SET is_pinned = ? WHERE id = ?').run(topic.is_pinned ? 0 : 1, req.params.id);
  res.json({ is_pinned: topic.is_pinned ? 0 : 1 });
});

export default router;
```

- [ ] **Step 2: Register route in server.js**

Open `backend/server.js`. Add import:

```javascript
import forumRoutes from './routes/forum.js';
```

Add route registration after the announcements line:

```javascript
app.use('/api/forum', forumRoutes);
```

- [ ] **Step 3: Test forum endpoints**

```bash
# List categories
curl http://localhost:4000/api/forum/categories -H "Authorization: Bearer <TOKEN>"

# Create topic
curl -X POST http://localhost:4000/api/forum/topics -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{\"category_id\":1,\"title\":\"Test Topik\",\"content\":\"Isi topik pertama\"}"

# Create reply
curl -X POST http://localhost:4000/api/forum/topics/1/replies -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{\"content\":\"Balasan pertama\"}"
```

Expected: 200 on list, 201 on create, replies visible under topic detail.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add backend/routes/forum.js backend/server.js
git commit -m "feat: add forum CRUD API endpoints

- Categories: GET/POST/PUT/DELETE
- Topics: GET list, GET detail, POST create, DELETE (author/admin)
- Replies: POST create (max 2-level nesting), DELETE (author/admin)
- Moderation: PATCH lock/pin toggle (admin)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Backend — Chat REST Routes

**Files:**
- Create: `backend/routes/chat.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getDb` from `../database.js`, `authenticate` from `../middleware/auth.js`
- Produces: Router with 4 endpoints mounted at `/api/chat`

- [ ] **Step 1: Write the route file**

Create `backend/routes/chat.js`:

```javascript
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(authenticate);

// File upload setup (reuse existing uploads directory)
const storage = multer.diskStorage({
  destination: join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'chat-' + unique + '-' + file.originalname);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// GET /api/chat/rooms — list available rooms
router.get('/rooms', (req, res) => {
  const db = getDb();

  // Always include general room
  const rooms = [{ id: 'general', name: 'General', type: 'general' }];

  // Add division rooms the user belongs to
  if (req.user.role === 'admin') {
    // Admins see all divisions
    const divisions = db.prepare('SELECT id, name FROM divisions ORDER BY name ASC').all();
    divisions.forEach(d => {
      rooms.push({ id: `division-${d.id}`, name: d.name, type: 'division' });
    });
  } else if (req.user.division) {
    // Staff only see their own division
    const division = db.prepare('SELECT id, name FROM divisions WHERE id = ?').get(req.user.division);
    if (division) {
      rooms.push({ id: `division-${division.id}`, name: division.name, type: 'division' });
    }
  }

  res.json({ rooms });
});

// GET /api/chat/rooms/:room/messages — history
router.get('/rooms/:room/messages', (req, res) => {
  const db = getDb();
  const { limit = 50, before } = req.query;

  let query = `
    SELECT m.*, u.name as sender_name
    FROM chat_messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.room = ?
  `;
  const params = [req.params.room];

  if (before) {
    query += ' AND m.id < ?';
    params.push(Number(before));
  }

  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const messages = db.prepare(query).all(...params);
  // Return oldest-first for display
  messages.reverse();

  res.json({ messages });
});

// POST /api/chat/rooms/:room/upload — upload file
router.post('/rooms/:room/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ file_url: fileUrl, file_name: req.file.originalname });
});

// DELETE /api/chat/messages/:id — delete message (own, or any if admin)
router.delete('/messages/:id', (req, res) => {
  const db = getDb();
  const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan' });

  if (msg.sender_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Anda tidak dapat menghapus pesan orang lain' });
  }

  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
  res.json({ message: 'Pesan dihapus' });
});

export default router;
```

- [ ] **Step 2: Register route in server.js**

Add import:
```javascript
import chatRoutes from './routes/chat.js';
```

Add route registration:
```javascript
app.use('/api/chat', chatRoutes);
```

- [ ] **Step 3: Test chat REST endpoints**

```bash
# List rooms
curl http://localhost:4000/api/chat/rooms -H "Authorization: Bearer <TOKEN>"

# Get message history (empty initially)
curl http://localhost:4000/api/chat/rooms/general/messages -H "Authorization: Bearer <TOKEN>"
```

Expected: 200 with rooms array containing "general" and any division rooms.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add backend/routes/chat.js backend/server.js
git commit -m "feat: add chat REST API endpoints

- GET /api/chat/rooms — list rooms (general + user divisions)
- GET /api/chat/rooms/:room/messages — paginated history
- POST /api/chat/rooms/:room/upload — file upload (10MB limit)
- DELETE /api/chat/messages/:id — delete own message (admin: any)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Backend — Socket.IO Chat Handler

**Files:**
- Create: `backend/socket/chatHandler.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: Socket.IO `Server` instance, `getDb` from `../database.js`, JWT `verifyToken` from `../services/auth.js`
- Produces: Real-time chat event handlers (chat:join, chat:leave, chat:message → chat:new-message broadcast, chat:typing → chat:user-typing broadcast)

- [ ] **Step 1: Write the Socket.IO handler**

Create `backend/socket/chatHandler.js`:

```javascript
import { getDb } from '../database.js';
import { verifyToken } from '../services/auth.js';

export function initChatSocket(io) {
  // Auth middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token tidak ditemukan'));

    try {
      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Chat: user ${socket.user.name} connected (socket ${socket.id})`);

    // Join room
    socket.on('chat:join', ({ room }) => {
      if (!room) return;

      // Leave previous rooms first (except socket.id room)
      const rooms = Array.from(socket.rooms);
      rooms.forEach(r => {
        if (r !== socket.id) socket.leave(r);
      });

      socket.join(room);
      console.log(`Chat: ${socket.user.name} joined ${room}`);
    });

    // Leave room
    socket.on('chat:leave', ({ room }) => {
      socket.leave(room);
    });

    // Send message
    socket.on('chat:message', ({ room, message, file_url, file_name }) => {
      if (!room || (!message && !file_url)) return;

      const db = getDb();
      try {
        const result = db.prepare(
          'INSERT INTO chat_messages (room, sender_id, message, file_url, file_name) VALUES (?, ?, ?, ?, ?)'
        ).run(room, socket.user.id, message || null, file_url || null, file_name || null);

        const msgData = {
          id: result.lastInsertRowid,
          room,
          sender: { id: socket.user.id, name: socket.user.name },
          message: message || null,
          file_url: file_url || null,
          file_name: file_name || null,
          created_at: new Date().toISOString(),
        };

        // Broadcast to room (including sender for consistency)
        io.to(room).emit('chat:new-message', msgData);
      } catch (err) {
        console.error('Chat save error:', err);
        socket.emit('chat:error', { message: 'Gagal mengirim pesan' });
      }
    });

    // Typing indicator
    socket.on('chat:typing', ({ room }) => {
      socket.to(room).emit('chat:user-typing', {
        room,
        user_name: socket.user.name,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Chat: user ${socket.user.name} disconnected`);
    });
  });
}
```

- [ ] **Step 2: Modify server.js to attach Socket.IO**

In `backend/server.js`, wrap the Express app with an HTTP server and attach Socket.IO.

Replace the existing imports and PORT/init section. The key changes:

At the top, add imports:
```javascript
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
```

After `const app = express();` and before middleware, add:
```javascript
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:80', 'http://localhost:81'],
    methods: ['GET', 'POST'],
  },
});
```

After all routes are registered, import and init chat socket handler:
```javascript
import { initChatSocket } from './socket/chatHandler.js';
initChatSocket(io);
```

Change the final `app.listen(...)` to:
```javascript
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
  console.log('💬 Chat WebSocket ready');
  console.log('📋 API endpoints:');
  // ... rest of existing log lines
});
```

- [ ] **Step 3: Test Socket.IO connection**

Restart the backend and test with a quick script:

```bash
cd C:\Users\Administrator\server-access-portal-main\backend
node -e "
import { io } from 'socket.io-client';
// Login first to get token
import fetch from 'node-fetch'; // may not work; manual test better
console.log('Socket.IO handler registered. Test from browser at http://localhost:80/chat');
"
```

Manual smoke test: start backend, log in from browser, navigate to http://localhost/chat (after frontend is built).

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add backend/socket/chatHandler.js backend/server.js
git commit -m "feat: add Socket.IO chat handler with JWT auth

- Socket.IO auth middleware validates JWT token on handshake
- chat:join/leave — room management
- chat:message → persist + broadcast chat:new-message
- chat:typing → broadcast chat:user-typing
- chat:error emitted to sender on save failure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Frontend — SocketContext Provider

**Files:**
- Create: `src/contexts/SocketContext.jsx`
- Modify: `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `useAuth` from `../contexts/AuthContext`, `io` from `socket.io-client`
- Produces: `SocketProvider` component (wraps children), `useSocket()` hook returning `{ socket, messages, sendMessage, typingUsers }`

- [ ] **Step 1: Write SocketContext**

Create `src/contexts/SocketContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

const SOCKET_URL = window.location.origin;

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [messages, setMessages] = useState({}); // { room: [msg, msg, ...] }
  const [typingUsers, setTypingUsers] = useState({}); // { room: userName }
  const typingTimers = useRef({}); // { room: setTimeout }

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('portal_token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('chat:new-message', (msg) => {
      setMessages(prev => ({
        ...prev,
        [msg.room]: [...(prev[msg.room] || []), msg],
      }));
    });

    socket.on('chat:user-typing', ({ room, user_name }) => {
      setTypingUsers(prev => ({ ...prev, [room]: user_name }));
      // Auto-clear typing after 3 seconds
      if (typingTimers.current[room]) {
        clearTimeout(typingTimers.current[room]);
      }
      typingTimers.current[room] = setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[room];
          return next;
        });
      }, 3000);
    });

    socket.on('chat:error', ({ message }) => {
      console.error('Chat error:', message);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      // Clear typing timers
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [user]);

  const sendMessage = useCallback((room, messageText, fileUrl, fileName) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('chat:message', {
      room,
      message: messageText || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
    });
  }, []);

  const joinRoom = useCallback((room) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('chat:join', { room });
  }, []);

  const emitTyping = useCallback((room) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('chat:typing', { room });
  }, []);

  const clearMessages = useCallback((room) => {
    setMessages(prev => {
      const next = { ...prev };
      delete next[room];
      return next;
    });
  }, []);

  const value = {
    socket: socketRef.current,
    messages,
    typingUsers,
    sendMessage,
    joinRoom,
    emitTyping,
    clearMessages,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap Layout with SocketProvider**

Open `src/components/Layout.jsx`. Modify the component to wrap content with `SocketProvider`:

Add import at top:
```jsx
import { SocketProvider } from '../contexts/SocketContext';
```

Modify the return statement to wrap everything:

```jsx
export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:bg-gradient-to-br dark:from-[#0a0e1a] dark:via-[#0f1729] dark:to-[#0a0e1a]">
        {/* ... rest unchanged ... */}
      </div>
    </SocketProvider>
  );
}
```

- [ ] **Step 3: Verify context is available**

Start the frontend dev server and check the browser console:
```bash
cd C:\Users\Administrator\server-access-portal-main
npm run dev
```

After login, the SocketContext should connect. Check browser console for "Socket connected: ..." message.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/contexts/SocketContext.jsx src/components/Layout.jsx
git commit -m "feat: add SocketContext provider for real-time chat

- Socket.IO client connection managed by auth state
- chat:new-message → updates messages state by room
- chat:user-typing → typing indicator state with 3s auto-clear
- joinRoom, sendMessage, emitTyping helper functions
- Wraps Layout component via SocketProvider

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Frontend — API Service Extensions

**Files:**
- Modify: `src/services/api.js`

**Interfaces:**
- Consumes: existing `request` helper, `API_BASE`
- Produces: `api.announcements.*`, `api.chat.*`, `api.forum.*` methods

- [ ] **Step 1: Add API methods to api.js**

Open `src/services/api.js`. Add these methods to the `api` export object, after the existing `requestOpenToken` method:

```javascript
// Announcements
getAnnouncements: (params = {}) => {
  const q = new URLSearchParams();
  if (params.division) q.set('division', params.division);
  if (params.pinned) q.set('pinned', params.pinned);
  if (params.page) q.set('page', params.page);
  const qs = q.toString();
  return request(`/announcements${qs ? '?' + qs : ''}`);
},
getAnnouncement: (id) => request(`/announcements/${id}`),
createAnnouncement: (data) => request('/announcements', { method: 'POST', body: JSON.stringify(data) }),
updateAnnouncement: (id, data) => request(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
deleteAnnouncement: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
togglePinAnnouncement: (id) => request(`/announcements/${id}/pin`, { method: 'PATCH' }),

// Chat
getChatRooms: () => request('/chat/rooms'),
getChatMessages: (room, params = {}) => {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', params.limit);
  if (params.before) q.set('before', params.before);
  const qs = q.toString();
  return request(`/chat/rooms/${encodeURIComponent(room)}/messages${qs ? '?' + qs : ''}`);
},
deleteChatMessage: (id) => request(`/chat/messages/${id}`, { method: 'DELETE' }),

// Forum
getForumCategories: () => request('/forum/categories'),
createForumCategory: (data) => request('/forum/categories', { method: 'POST', body: JSON.stringify(data) }),
updateForumCategory: (id, data) => request(`/forum/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
deleteForumCategory: (id) => request(`/forum/categories/${id}`, { method: 'DELETE' }),
getForumTopics: (params = {}) => {
  const q = new URLSearchParams();
  if (params.category) q.set('category', params.category);
  if (params.page) q.set('page', params.page);
  if (params.sort) q.set('sort', params.sort);
  const qs = q.toString();
  return request(`/forum/topics${qs ? '?' + qs : ''}`);
},
getForumTopic: (id) => request(`/forum/topics/${id}`),
createForumTopic: (data) => request('/forum/topics', { method: 'POST', body: JSON.stringify(data) }),
deleteForumTopic: (id) => request(`/forum/topics/${id}`, { method: 'DELETE' }),
createForumReply: (topicId, data) => request(`/forum/topics/${topicId}/replies`, { method: 'POST', body: JSON.stringify(data) }),
deleteForumReply: (id) => request(`/forum/replies/${id}`, { method: 'DELETE' }),
toggleLockTopic: (id) => request(`/forum/topics/${id}/lock`, { method: 'PATCH' }),
togglePinTopic: (id) => request(`/forum/topics/${id}/pin`, { method: 'PATCH' }),
```

- [ ] **Step 2: Verify API methods compile**

```bash
cd C:\Users\Administrator\server-access-portal-main
npx vite build --mode development 2>&1 | tail -5
```

Expected: Build succeeds (pages won't exist yet so there may be import errors if App.jsx references pages that don't exist yet — that's ok at this stage as we haven't added them to the router).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/services/api.js
git commit -m "feat: add API methods for announcements, chat, and forum

- announcements: getAnnouncements, getAnnouncement, create/update/delete, togglePin
- chat: getChatRooms, getChatMessages, deleteChatMessage
- forum: categories CRUD, topics CRUD, replies CRUD, lock/pin toggle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Frontend — Sidebar Navigation Update

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`

**Interfaces:**
- Produces: 3 new sidebar nav items for announcements, chat, forum

- [ ] **Step 1: Add new nav items to Sidebar**

Open `src/components/layout/Sidebar.jsx`. Add the new icons to the lucide-react import:

```jsx
import {
  LayoutDashboard,
  Server,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Megaphone,
  MessageCircle,
  MessagesSquare,
} from 'lucide-react';
```

Add new items to the `navItems` array (general nav — visible to all users):

```jsx
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/announcements', icon: Megaphone, label: 'Pengumuman' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/forum', icon: MessagesSquare, label: 'Forum' },
  { to: '/online-users', icon: Users, label: 'Online Users' },
];
```

- [ ] **Step 2: Verify sidebar renders new items**

Run the dev server and check that 3 new items appear in the sidebar after login:
```bash
cd C:\Users\Administrator\server-access-portal-main
npm run dev
```

Navigate to http://localhost and log in. Expected: Sidebar shows Dashboard, Pengumuman, Chat, Forum, Online Users.

(Clicking will 404 until pages are created — that's expected.)

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/components/layout/Sidebar.jsx
git commit -m "feat: add sidebar navigation for Pengumuman, Chat, and Forum

- Add Megaphone, MessageCircle, MessagesSquare icons
- Add 3 nav items accessible to all authenticated users
- Items placed between Dashboard and Online Users

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Frontend — Announcements Page & Components

**Files:**
- Create: `src/components/announcements/AnnouncementCard.jsx`
- Create: `src/components/announcements/AnnouncementModal.jsx`
- Create: `src/pages/announcements/AnnouncementsPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `api` from `../services/api`, `useAuth` from `../contexts/AuthContext`, `Modal`/`Button`/`Input`/`Select`/`Badge` from UI primitives
- Produces: AnnouncementsPage at `/announcements` route

- [ ] **Step 1: Write AnnouncementCard component**

Create `src/components/announcements/AnnouncementCard.jsx`:

```jsx
import { Megaphone, Pin, ChevronRight } from 'lucide-react';
import Badge from '../ui/Badge';

export default function AnnouncementCard({ announcement, onClick }) {
  const timeAgo = getTimeAgo(announcement.created_at);

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {announcement.title}
            </h3>
            {announcement.is_pinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Pin className="w-3 h-3" /> Dipin
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
            {announcement.content}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span>{announcement.author_name}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {announcement.division_name && (
              <>
                <span>·</span>
                <Badge variant="default">{announcement.division_name}</Badge>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-2" />
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID');
}
```

- [ ] **Step 2: Write AnnouncementModal component**

Create `src/components/announcements/AnnouncementModal.jsx`:

```jsx
import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function AnnouncementModal({ isOpen, onClose, onSubmit, divisions, initialData }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContent(initialData.content || '');
      setDivisionId(initialData.division_id ? String(initialData.division_id) : '');
    } else {
      setTitle('');
      setContent('');
      setDivisionId('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        division_id: divisionId ? Number(divisionId) : null,
      });
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Pengumuman' : 'Buat Pengumuman'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konten</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Isi pengumuman... (Markdown didukung)"
            rows={6}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Divisi</label>
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Divisi</option>
            {divisions.map(d => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={submitting || !title.trim() || !content.trim()}>
            {submitting ? 'Menyimpan...' : initialData ? 'Simpan' : 'Buat Pengumuman'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Write AnnouncementsPage**

Create `src/pages/announcements/AnnouncementsPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import AnnouncementModal from '../../components/announcements/AnnouncementModal';
import Button from '../../components/ui/Button';
import { Megaphone, Search, Plus, Filter } from 'lucide-react';

export default function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [divisions, setDivisions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    loadDivisions();
  }, [page, filterDivision]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const params = { page };
      if (filterDivision) params.division = filterDivision;
      const res = await api.getAnnouncements(params);
      setAnnouncements(res.announcements || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Load announcements error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDivisions = async () => {
    try {
      const res = await api.getOnlineUsers(); // reuse existing divisions data
      // Get divisions from the server categories endpoint
      const catRes = await api.getCategories();
      // Actually let's fetch divisions from a direct query — use the settings or server endpoint
      // For now we'll hardcode: divisions come from the same data as filters
    } catch (err) {
      // Silently fail; divisions optional
    }
  };

  // Fetch divisions from the /api/divisions endpoint
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await fetch('/api/divisions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDivisions(data.divisions || []);
        }
      } catch (err) {
        console.error('Failed to load divisions:', err);
      }
    };
    fetchDivisions();
  }, []);

  const handleCreate = async (data) => {
    await api.createAnnouncement(data);
    loadAnnouncements();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    await api.deleteAnnouncement(id);
    loadAnnouncements();
  };

  const handleTogglePin = async (id) => {
    await api.togglePinAnnouncement(id);
    loadAnnouncements();
  };

  const filtered = announcements.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengumuman</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Informasi dan pengumuman perusahaan
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Buat Pengumuman
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pengumuman..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterDivision}
          onChange={(e) => { setFilterDivision(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Divisi</option>
          {divisions.map(d => (
            <option key={d.id} value={String(d.id)}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada pengumuman</p>
          {isAdmin && <p className="text-sm mt-1">Klik "Buat Pengumuman" untuk membuat yang pertama</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className="relative group/card">
              <AnnouncementCard
                announcement={a}
                onClick={() => { setSelectedAnnouncement(a); setShowDetailModal(true); }}
              />
              {isAdmin && (
                <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTogglePin(a.id); }}
                    className={`p-1.5 rounded-lg text-xs ${a.is_pinned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-amber-500'}`}
                    title={a.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    📌
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20"
                    title="Hapus"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnnouncementModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        divisions={divisions}
      />

      {/* Detail Modal */}
      {selectedAnnouncement && (
        <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={selectedAnnouncement.title} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{selectedAnnouncement.author_name}</span>
              <span>·</span>
              <span>{new Date(selectedAnnouncement.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {selectedAnnouncement.division_name && (
                <>
                  <span>·</span>
                  <Badge variant="default">{selectedAnnouncement.division_name}</Badge>
                </>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

Note: The `Badge` component from `src/components/ui/Badge.jsx` may be imported as default. Verify the import path matches the actual export. The existing `Badge` component at `src/components/ui/Badge.jsx` exports both named and default — use the default import.

- [ ] **Step 4: Register route in App.jsx**

Open `src/App.jsx`. Add import:
```jsx
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
```

Add route inside the `<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>` block, after the `/dashboard` route:
```jsx
<Route path="/announcements" element={<AnnouncementsPage />} />
```

- [ ] **Step 5: Verify page loads**

Start dev server, log in, navigate to /announcements. Expected: Page loads with empty state, admin sees "Buat Pengumuman" button.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/components/announcements/ src/pages/announcements/ src/App.jsx
git commit -m "feat: add announcements page with CRUD UI

- AnnouncementCard: title, excerpt, author, time ago, division badge, pin indicator
- AnnouncementModal: create/edit form with division selector
- AnnouncementsPage: list with search, division filter, pagination, admin actions
- Route registered at /announcements

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Frontend — Chat Page & Components

**Files:**
- Create: `src/components/chat/RoomList.jsx`
- Create: `src/components/chat/MessageBubble.jsx`
- Create: `src/components/chat/ChatInput.jsx`
- Create: `src/components/chat/TypingIndicator.jsx`
- Create: `src/components/chat/ChatWindow.jsx`
- Create: `src/pages/chat/ChatPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useSocket` from `../../contexts/SocketContext`, `useAuth` from `../../contexts/AuthContext`, `api` from `../../services/api`
- Produces: ChatPage at `/chat` route with real-time messaging

- [ ] **Step 1: Write RoomList component**

Create `src/components/chat/RoomList.jsx`:

```jsx
import { Hash } from 'lucide-react';

export default function RoomList({ rooms, activeRoom, onSelect }) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] overflow-y-auto">
      <div className="p-3">
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          Channels
        </h2>
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              activeRoom?.id === room.id
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Hash className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{room.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write MessageBubble component**

Create `src/components/chat/MessageBubble.jsx`:

```jsx
import { FileText, Download } from 'lucide-react';

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Sender name (others only) */}
        {!isOwn && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">
            {message.sender?.name || message.sender_name}
          </p>
        )}

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-white/5'
        }`}>
          {message.file_url ? (
            <a
              href={message.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 ${isOwn ? 'text-white hover:text-blue-100' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">{message.file_name || 'File'}</span>
              <Download className="w-3.5 h-3.5 ml-1" />
            </a>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
          )}
        </div>

        {/* Time */}
        <p className={`text-[10px] text-slate-400 dark:text-slate-500 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
          {time}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write ChatInput component**

Create `src/components/chat/ChatInput.jsx`:

```jsx
import { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';

export default function ChatInput({ onSend, onTyping, room }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const handleTyping = () => {
    onTyping(room);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!text.trim() && !file) return;

    let fileUrl = null;
    let fileName = null;

    if (file) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('portal_token');
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(room)}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        fileUrl = data.file_url;
        fileName = data.file_name;
      } catch (err) {
        console.error('Upload error:', err);
        alert('Gagal upload file');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(text.trim() || null, fileUrl, fileName);
    setText('');
    removeFile();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/[0.02]">
      {/* File preview */}
      {file && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
            📎 {file.name}
            <button onClick={removeFile} className="ml-1 text-slate-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          title="Lampirkan file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pesan..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={uploading || (!text.trim() && !file)}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white transition-colors flex-shrink-0 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write TypingIndicator component**

Create `src/components/chat/TypingIndicator.jsx`:

```jsx
export default function TypingIndicator({ userName }) {
  if (!userName) return null;

  return (
    <div className="px-4 py-1">
      <p className="text-xs text-slate-400 dark:text-slate-500 italic animate-pulse">
        {userName} sedang mengetik...
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Write ChatWindow component**

Create `src/components/chat/ChatWindow.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle } from 'lucide-react';

export default function ChatWindow({ room, messages, typingUser, onSend, onTyping, loading }) {
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Pilih channel untuk mulai chat</p>
        </div>
      </div>
    );
  }

  const roomMessages = messages[room.id] || [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Room header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
        <h3 className="font-semibold text-slate-900 dark:text-white"># {room.name}</h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && roomMessages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">Memuat pesan...</div>
        ) : roomMessages.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-16">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada pesan. Kirim pesan pertama!</p>
          </div>
        ) : (
          roomMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id || i}
              message={msg}
              isOwn={msg.sender?.id === user?.id || msg.sender_id === user?.id}
            />
          ))
        )}
        <TypingIndicator userName={typingUser} />
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(text, fileUrl, fileName) => onSend(room.id, text, fileUrl, fileName)} onTyping={onTyping} room={room.id} />
    </div>
  );
}
```

- [ ] **Step 6: Write ChatPage**

Create `src/pages/chat/ChatPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import RoomList from '../../components/chat/RoomList';
import ChatWindow from '../../components/chat/ChatWindow';

export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { messages, typingUsers, sendMessage, joinRoom, emitTyping, clearMessages } = useSocket();

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const res = await api.getChatRooms();
        setRooms(res.rooms || []);
        if (res.rooms?.length > 0 && !activeRoom) {
          setActiveRoom(res.rooms[0]);
        }
      } catch (err) {
        console.error('Load rooms error:', err);
      }
    };
    loadRooms();
  }, []);

  // Join room on selection
  useEffect(() => {
    if (activeRoom) {
      joinRoom(activeRoom.id);
      // Load history
      loadHistory(activeRoom.id);
    }
  }, [activeRoom]);

  const loadHistory = async (roomId) => {
    try {
      setLoadingHistory(true);
      clearMessages(roomId);
      const res = await api.getChatMessages(roomId, { limit: 50 });
      // Messages are loaded; they won't appear in socket messages state automatically
      // We need to merge history into the messages state
      if (res.messages?.length > 0) {
        // History is loaded via REST; the SocketContext doesn't auto-merge
        // We'll add them via a workaround: set them directly via sendMessage for history
        // Actually, we just display history + live messages in ChatWindow
        // Store history in local state
        setHistoryMessages(prev => ({ ...prev, [roomId]: res.messages }));
      }
    } catch (err) {
      console.error('Load history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const [historyMessages, setHistoryMessages] = useState({});

  // Merge history + live messages for display
  const mergedMessages = { ...historyMessages };
  Object.keys(messages).forEach(roomId => {
    mergedMessages[roomId] = [...(historyMessages[roomId] || []), ...(messages[roomId] || [])];
  });

  const handleSend = useCallback((roomId, text, fileUrl, fileName) => {
    sendMessage(roomId, text, fileUrl, fileName);
  }, [sendMessage]);

  const handleTyping = useCallback((roomId) => {
    emitTyping(roomId);
  }, [emitTyping]);

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden -m-4 lg:-m-8">
      <RoomList rooms={rooms} activeRoom={activeRoom} onSelect={setActiveRoom} />
      <ChatWindow
        room={activeRoom}
        messages={mergedMessages}
        typingUser={activeRoom ? typingUsers[activeRoom.id] : null}
        onSend={handleSend}
        onTyping={handleTyping}
        loading={loadingHistory}
      />
    </div>
  );
}
```

- [ ] **Step 7: Register route in App.jsx**

Add import:
```jsx
import ChatPage from './pages/chat/ChatPage';
```

Add route after announcements route:
```jsx
<Route path="/chat" element={<ChatPage />} />
```

- [ ] **Step 8: Verify chat works**

Start dev server, log in with two different browser tabs. Navigate to /chat in both. Type a message in one — should appear in real-time in the other.

- [ ] **Step 9: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/components/chat/ src/pages/chat/ src/App.jsx
git commit -m "feat: add real-time chat page with Socket.IO

- RoomList: channel sidebar with active highlight
- MessageBubble: text and file display, own/other styling
- ChatInput: text input, file upload, Enter to send
- TypingIndicator: animated typing status
- ChatWindow: message list auto-scroll, room header
- ChatPage: split-pane layout, history + live merge
- Route registered at /chat

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Frontend — Forum Pages & Components

**Files:**
- Create: `src/components/forum/TopicCard.jsx`
- Create: `src/components/forum/ReplyCard.jsx`
- Create: `src/components/forum/ReplyForm.jsx`
- Create: `src/pages/forum/ForumPage.jsx`
- Create: `src/pages/forum/ForumTopicPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `api` from `../../services/api`, `useAuth` from `../../contexts/AuthContext`
- Produces: ForumPage at `/forum`, ForumTopicPage at `/forum/topics/:id`

- [ ] **Step 1: Write TopicCard component**

Create `src/components/forum/TopicCard.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Pin, Lock, User } from 'lucide-react';
import Badge from '../ui/Badge';

export default function TopicCard({ topic }) {
  const navigate = useNavigate();
  const timeAgo = getTimeAgo(topic.created_at);

  return (
    <div
      onClick={() => navigate(`/forum/topics/${topic.id}`)}
      className="group bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {topic.title}
            </h3>
            {topic.is_pinned ? <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : null}
            {topic.is_locked ? <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> : null}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">{topic.content}</p>
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {topic.author_name}
            </span>
            <span>{timeAgo}</span>
            <Badge variant="secondary">{topic.category_name}</Badge>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {topic.reply_count} balasan
            </span>
            {topic.last_reply_author && (
              <span className="text-slate-400 dark:text-slate-500 truncate">
                Terakhir: {topic.last_reply_author}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID');
}
```

- [ ] **Step 2: Write ReplyCard component**

Create `src/components/forum/ReplyCard.jsx`:

```jsx
import { useState } from 'react';
import { User, CornerDownRight } from 'lucide-react';
import ReplyForm from './ReplyForm';

export default function ReplyCard({ reply, subReplies = [], topicId, onReplyAdded, isAdmin, authorId, onDelete }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const time = new Date(reply.created_at + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-3">
      {/* This reply */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-900 dark:text-white">{reply.author_name}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Balas
            </button>
            {(reply.author_id === authorId || isAdmin) && (
              <button
                onClick={() => onDelete(reply.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{reply.content}</p>
      </div>

      {/* Reply form for this reply */}
      {showReplyForm && (
        <div className="ml-6">
          <ReplyForm
            topicId={topicId}
            parentId={reply.id}
            onSubmit={() => { setShowReplyForm(false); onReplyAdded(); }}
          />
        </div>
      )}

      {/* Sub-replies (level 2) */}
      {subReplies.length > 0 && (
        <div className="ml-6 space-y-3 border-l-2 border-slate-200 dark:border-white/10 pl-4">
          {subReplies.map(sr => (
            <div key={sr.id} className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-white">{sr.author_name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(sr.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {(sr.author_id === authorId || isAdmin) && (
                  <button onClick={() => onDelete(sr.id)} className="text-xs text-red-500 hover:underline">Hapus</button>
                )}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{sr.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write ReplyForm component**

Create `src/components/forum/ReplyForm.jsx`:

```jsx
import { useState } from 'react';
import { api } from '../../services/api';
import Button from '../ui/Button';
import { Send } from 'lucide-react';

export default function ReplyForm({ topicId, parentId, onSubmit }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.createForumReply(topicId, { content: content.trim(), parent_id: parentId || null });
      setContent('');
      onSubmit();
    } catch (err) {
      console.error('Reply error:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Tulis balasan..."
        rows={2}
        required
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting || !content.trim()} size="sm">
          <Send className="w-3.5 h-3.5 mr-1" />
          {submitting ? 'Mengirim...' : 'Kirim'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write ForumPage**

Create `src/pages/forum/ForumPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import TopicCard from '../../components/forum/TopicCard';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { MessagesSquare, Plus, Filter } from 'lucide-react';

export default function ForumPage() {
  const { isAdmin } = useAuth();
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [sort, setSort] = useState('latest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [page, filterCategory, sort]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [topicsRes, catsRes] = await Promise.all([
        api.getForumTopics({ page, category: filterCategory || undefined, sort }),
        api.getForumCategories(),
      ]);
      setTopics(topicsRes.topics || []);
      setTotalPages(topicsRes.totalPages || 1);
      setCategories(catsRes.categories || []);
    } catch (err) {
      console.error('Forum load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newCategory) return;
    setSubmitting(true);
    try {
      await api.createForumTopic({
        category_id: Number(newCategory),
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      setNewCategory('');
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forum</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Diskusi dan tanya jawab</p>
        </div>
        <Button onClick={() => { setNewCategory(categories[0]?.id?.toString() || ''); setShowCreateModal(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Buat Topik
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
        >
          <option value="latest">Terbaru</option>
          <option value="popular">Terpopuler</option>
        </select>
      </div>

      {/* Topic list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <MessagesSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada topik</p>
          <p className="text-sm mt-1">Jadilah yang pertama membuat topik diskusi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(t => <TopicCard key={t.id} topic={t} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create Topic Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Buat Topik Baru" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
            >
              <option value="">Pilih kategori</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Judul topik..."
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konten</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Isi topik..."
              rows={6}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Batal</Button>
            <Button type="submit" disabled={submitting || !newTitle.trim() || !newContent.trim() || !newCategory}>
              {submitting ? 'Membuat...' : 'Buat Topik'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 5: Write ForumTopicPage**

Create `src/pages/forum/ForumTopicPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ReplyCard from '../../components/forum/ReplyCard';
import ReplyForm from '../../components/forum/ReplyForm';
import Button from '../../components/ui/Button';
import { ArrowLeft, Pin, Lock, MessageSquare, User } from 'lucide-react';

export default function ForumTopicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTopic = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getForumTopic(id);
      setTopic(res.topic);
      setReplies(res.replies || []);
    } catch (err) {
      console.error('Load topic error:', err);
      alert('Topik tidak ditemukan');
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadTopic(); }, [loadTopic]);

  const handleDeleteReply = async (replyId) => {
    if (!confirm('Hapus balasan ini?')) return;
    try {
      await api.deleteForumReply(replyId);
      loadTopic();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTopic = async () => {
    if (!confirm('Hapus topik ini beserta semua balasannya?')) return;
    try {
      await api.deleteForumTopic(id);
      navigate('/forum');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleLock = async () => {
    await api.toggleLockTopic(id);
    loadTopic();
  };

  const handleTogglePin = async () => {
    await api.togglePinTopic(id);
    loadTopic();
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!topic) return null;

  // Build reply tree: level 1 = replies with parent_id=NULL, level 2 = replies whose parent_id points to level 1
  const topLevelReplies = replies.filter(r => !r.parent_id);
  const getSubReplies = (parentId) => replies.filter(r => r.parent_id === parentId);

  const topicTime = new Date(topic.created_at + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/forum')}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Forum
      </button>

      {/* Topic */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{topic.title}</h1>
              {topic.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
              {topic.is_locked && <Lock className="w-4 h-4 text-red-400" />}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {topic.author_name}</span>
              <span>{topicTime}</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {topic.category_name}
              </span>
            </div>
          </div>

          {/* Admin/mod actions */}
          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                <button onClick={handleTogglePin} className={`p-1.5 rounded-lg text-sm ${topic.is_pinned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/5'}`} title="Toggle pin">
                  <Pin className="w-4 h-4" />
                </button>
                <button onClick={handleToggleLock} className={`p-1.5 rounded-lg text-sm ${topic.is_locked ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5'}`} title="Toggle lock">
                  <Lock className="w-4 h-4" />
                </button>
              </>
            )}
            {(topic.author_id === user?.id || isAdmin) && (
              <button onClick={handleDeleteTopic} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Hapus topik">
                🗑️
              </button>
            )}
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {topic.content}
        </div>
      </div>

      {/* Replies */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {topic.reply_count} Balasan
        </h2>

        <div className="space-y-4">
          {topLevelReplies.map(reply => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              subReplies={getSubReplies(reply.id)}
              topicId={topic.id}
              onReplyAdded={loadTopic}
              isAdmin={isAdmin}
              authorId={user?.id}
              onDelete={handleDeleteReply}
            />
          ))}

          {topLevelReplies.length === 0 && (
            <p className="text-center text-slate-400 dark:text-slate-500 py-8">
              Belum ada balasan. Jadilah yang pertama membalas!
            </p>
          )}
        </div>
      </div>

      {/* Reply form (if not locked) */}
      {!topic.is_locked && (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Tulis Balasan</h3>
          <ReplyForm topicId={topic.id} parentId={null} onSubmit={loadTopic} />
        </div>
      )}

      {topic.is_locked && (
        <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500 bg-red-50 dark:bg-red-500/5 rounded-xl border border-red-200 dark:border-red-500/10">
          🔒 Topik ini dikunci. Tidak dapat menambah balasan baru.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Register routes in App.jsx**

Add imports:
```jsx
import ForumPage from './pages/forum/ForumPage';
import ForumTopicPage from './pages/forum/ForumTopicPage';
```

Add routes after chat route:
```jsx
<Route path="/forum" element={<ForumPage />} />
<Route path="/forum/topics/:id" element={<ForumTopicPage />} />
```

- [ ] **Step 7: Verify forum works**

Start dev server, log in, navigate to /forum. Create a topic, then open it. Add replies. Test nested replies.

- [ ] **Step 8: Commit**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add src/components/forum/ src/pages/forum/ src/App.jsx
git commit -m "feat: add forum pages with threaded discussion

- ForumPage: category filter, topic list, create topic modal
- ForumTopicPage: topic detail, 2-level threaded replies, reply form
- TopicCard: title, category, reply count, last activity
- ReplyCard: nested replies, admin/author delete
- ReplyForm: inline reply input
- Admin: pin/lock/delete on topics, delete on replies
- Routes: /forum, /forum/topics/:id

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Integration Testing & Polish

**Files:**
- No specific files; verify end-to-end flow across all 3 modules

**Interfaces:**
- Consumes: All previous task outputs
- Produces: Verified working system

- [ ] **Step 1: Full restart and smoke test**

Restart backend and frontend:
```bash
# Terminal 1: Backend
cd C:\Users\Administrator\server-access-portal-main\backend
node server.js

# Terminal 2: Frontend
cd C:\Users\Administrator\server-access-portal-main
npm run dev
```

Navigate through each flow:
1. Login as admin
2. Create an announcement → verify it appears in list → pin it → delete it
3. Open Chat → verify rooms load → send a message → verify it appears
4. Open Forum → create a topic → open it → reply → reply to reply → verify 2-level nesting
5. Login as staff user → verify announcement visibility → verify chat rooms limited to division → verify forum access

- [ ] **Step 2: Cross-browser chat test**

Open two different browser windows (or incognito + normal), log in as two different users, and verify real-time chat messages appear in both windows simultaneously.

- [ ] **Step 3: File upload test**

In chat, attach a file (< 10MB) and send. Verify:
- File appears as a clickable link in the message bubble
- Clicking opens the file in a new tab
- File is served from `/uploads/chat-*.pdf`

- [ ] **Step 4: Fix any issues found**

Address any issues discovered during smoke testing. Common potential issues:
- Import path mismatches (verify `../ui/Button` vs `../../components/ui/Button` depending on file depth)
- Socket.IO CORS configuration for the actual host:port being used
- Division-based room filtering edge case for users with no division
- Timezone handling for `created_at` strings (backend uses UTC, frontend parses as UTC+Z)

- [ ] **Step 5: Commit any fixes**

```bash
cd C:\Users\Administrator\server-access-portal-main
git add -A
git commit -m "fix: integration polish for announcements, chat, and forum

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Plan Summary

| Task | Files Created | Files Modified | Description |
|------|--------------|----------------|-------------|
| 1 | 0 | 4 | Dependencies + DB schema |
| 2 | 1 | 1 | Announcements API (6 endpoints) |
| 3 | 1 | 1 | Forum API (12 endpoints) |
| 4 | 1 | 1 | Chat REST API (4 endpoints) |
| 5 | 1 | 1 | Socket.IO chat handler |
| 6 | 1 | 1 | SocketContext provider |
| 7 | 0 | 1 | API client methods |
| 8 | 0 | 1 | Sidebar nav items |
| 9 | 3 | 1 | Announcements page + components |
| 10 | 6 | 1 | Chat page + components |
| 11 | 5 | 1 | Forum pages + components |
| 12 | 0 | 0 | Integration testing |

**Total: 19 new files, 7 modified files, 12 tasks**
