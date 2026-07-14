# Marketing & Sales Hub — Phase 5 Implementation Plan

> Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Team Task Board (Kanban) + Asset Library (upload/download).

**Prerequisites:** Phase 1-4 completed. dnd-kit already installed. multer for file uploads.

**Tech Stack:** React 19, Tailwind 4, lucide-react, @dnd-kit (installed in Phase 2), Express + better-sqlite3 + multer.

---

## Global Constraints
- Reuse: All Phase 1-4 components, Modal, Card, Button, Input, Select, Badge, ConfirmModal, KanbanBoard pattern
- Dark mode, Toast, auth middleware
- File upload via multer, store in `backend/uploads/assets/`
- No breaking changes

---

## File Structure
```
backend/
├── database.js         # MODIFY: add tasks, assets tables
├── routes/
│   ├── marketing.js    # MODIFY: add tasks CRUD + bulk status
│   └── assets.js       # NEW: file upload/download routes
├── uploads/
│   └── assets/         # NEW: uploaded asset files directory

src/
├── App.jsx             # MODIFY: add task board + asset library routes
├── contexts/
│   └── MarketingContext.jsx  # MODIFY: add tasks + assets state
├── components/
│   └── marketing/
│       ├── TaskBoard.jsx       # NEW: drag-drop task kanban (reuse Kanban pattern)
│       ├── TaskColumn.jsx      # NEW: task kanban column
│       ├── TaskCard.jsx        # NEW: draggable task card
│       └── AssetCard.jsx       # NEW: asset thumbnail card
├── pages/
│   └── marketing/
│       ├── TaskBoard.jsx       # NEW: team task kanban page
│       └── AssetLibrary.jsx    # NEW: asset grid + upload
├── services/
│   └── api.js           # MODIFY: add tasks + assets API
```

---

## Task 1: Database — Tasks + Assets Tables

- [ ] **Step 1: Add tables to database.js**

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assignee INTEGER REFERENCES users(id),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Urgent')),
  status TEXT NOT NULL DEFAULT 'Todo' CHECK(status IN ('Todo','In Progress','Review','Done')),
  due_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  category TEXT DEFAULT 'Other' CHECK(category IN ('Image','Document','Video','Presentation','Other')),
  tags TEXT DEFAULT '[]',
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
```

- [ ] **Step 2: Add tasks routes to marketing.js**

```javascript
// GET /api/tasks — with optional filters
router.get('/tasks', (req, res) => {
  const db = getDb();
  const { status, assignee, priority } = req.query;
  let sql = 'SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee = u.id WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (assignee) { sql += ' AND t.assignee = ?'; params.push(assignee); }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
  sql += ' ORDER BY t.sort_order ASC, t.created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

// POST /api/tasks
router.post('/tasks', (req, res) => {
  const db = getDb();
  const { title, description, assignee, priority, status, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title wajib diisi' });
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM tasks WHERE status = ?").get(status || 'Todo').next;
  const result = db.prepare('INSERT INTO tasks (title, description, assignee, priority, status, due_date, sort_order) VALUES (?,?,?,?,?,?,?)').run(title, description || '', assignee || null, priority || 'Medium', status || 'Todo', due_date || null, maxOrder);
  res.status(201).json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) });
});

// PATCH /api/tasks/:id
router.patch('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task tidak ditemukan' });
  const allowed = ['title','description','assignee','priority','status','due_date','sort_order'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = ?`); params.push(req.body[key]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Tidak ada field' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) });
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task tidak ditemukan' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/tasks/bulk-status
router.patch('/tasks/bulk-status', (req, res) => {
  const { ids, status, sortOrders } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array wajib' });
  const db = getDb();
  const updateStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?');
  ids.forEach(id => updateStmt.run(status, id));
  // If sortOrders provided, update order
  if (sortOrders && Array.isArray(sortOrders)) {
    const orderStmt = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?');
    sortOrders.forEach((order, i) => { if (order !== undefined) orderStmt.run(i, ids[i]); });
  }
  res.json({ success: true });
});
```

- [ ] **Step 3: Create assets routes file** `backend/routes/assets.js`

Uses multer for file upload. Endpoints: GET `/api/assets` (list with category filter), POST `/api/assets/upload`, GET `/api/assets/:id/download`, DELETE `/api/assets/:id`.

```javascript
import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import path from 'path';

const router = Router();
router.use(authenticate);

const UPLOAD_DIR = path.resolve('uploads/assets');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
      'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4','video/webm','text/plain','application/zip'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} tidak diizinkan`));
  },
});

const mimeCategory = (mime) => {
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime === 'text/plain') return 'Document';
  if (mime.includes('presentation')) return 'Presentation';
  return 'Other';
};

router.get('/', (req, res) => {
  const db = getDb();
  const { category } = req.query;
  let sql = 'SELECT * FROM assets WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC';
  res.json({ assets: db.prepare(sql).all(...params) });
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });
  const db = getDb();
  const { tags } = req.body;
  const result = db.prepare('INSERT INTO assets (filename, original_name, mime_type, size, category, tags, uploaded_by) VALUES (?,?,?,?,?,?,?)')
    .run(req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, mimeCategory(req.file.mimetype), tags || '[]', req.user.id);
  res.status(201).json({ asset: db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid) });
});

router.get('/:id/download', (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset tidak ditemukan' });
  const filepath = path.join(UPLOAD_DIR, asset.filename);
  res.download(filepath, asset.original_name);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset tidak ditemukan' });
  // Delete file from disk
  import('fs').then(fs => {
    const filepath = path.join(UPLOAD_DIR, asset.filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  });
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 4: Register routes in server.js**

```javascript
app.use('/api/tasks', marketingRoutes);
import assetsRoutes from './routes/assets.js';
app.use('/api/assets', assetsRoutes);
```

- [ ] **Step 5: Install multer**

```bash
cd C:\Users\Administrator\server-access-portal-main
npm install multer
```

- [ ] **Step 6: Commit**

```bash
git add backend/ package.json
git commit -m "feat: add tasks, assets tables + routes with multer upload (Phase 5)"
```

---

## Task 2: API Methods + Context Update

- [ ] **Step 1: Add to api.js**

```javascript
getTasks: (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.assignee) q.set('assignee', params.assignee);
  if (params.priority) q.set('priority', params.priority);
  const qs = q.toString();
  return request(`/tasks${qs ? `?${qs}` : ''}`);
},
createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
bulkUpdateTasks: (ids, status) => request('/tasks/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) }),

getAssets: (params = {}) => {
  const q = new URLSearchParams();
  if (params.category) q.set('category', params.category);
  const qs = q.toString();
  return request(`/assets${qs ? `?${qs}` : ''}`);
},
uploadAsset: (file, tags) => {
  const form = new FormData();
  form.append('file', file);
  if (tags) form.append('tags', JSON.stringify(tags));
  // Use fetch directly since request() adds Content-Type: application/json
  const token = localStorage.getItem('token');
  return fetch('/api/assets/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then(r => r.json());
},
deleteAsset: (id) => request(`/assets/${id}`, { method: 'DELETE' }),
getAssetDownloadUrl: (id) => `/api/assets/${id}/download`,
```

- [ ] **Step 2: Update MarketingContext**

```javascript
const [tasks, setTasks] = useState([]);
const [assets, setAssets] = useState([]);
// fetchTasks(filters), createTask, updateTask, deleteTask, bulkUpdateTasks
// fetchAssets(category), uploadAsset, deleteAsset
// Add to provider value + useEffect
```

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js src/contexts/MarketingContext.jsx
git commit -m "feat: add tasks and assets API methods + context state (Phase 5)"
```

---

## Task 3: Task Board Page

Reuse KanbanBoard pattern from Phase 2. 4 columns: Todo → In Progress → Review → Done.

- [ ] **Step 1: Create TaskCard.jsx, TaskColumn.jsx, TaskBoard.jsx** — same pattern as KanbanCard/KanbanColumn/KanbanBoard using @dnd-kit

- [ ] **Step 2: TaskCard shows: title, description (truncated), priority badge (Low=gray, Medium=amber, High=orange, Urgent=red), assignee avatar/name, due date**

- [ ] **Step 3: Create TaskBoard.jsx page wrapper**

- [ ] **Step 4: Update App.jsx**

```javascript
<Route path="/marketing/tasks" element={<TaskBoard />} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/Task*.jsx src/pages/marketing/TaskBoard.jsx src/App.jsx
git commit -m "feat: add Team Task Board kanban page (Phase 5)"
```

---

## Task 4: Asset Library Page

- [ ] **Step 1: Create AssetCard.jsx**

Shows: thumbnail (image/video) or file type icon (PDF, DOC, etc.), filename (truncated), size, upload date. Download button. Delete button.

- [ ] **Step 2: Create AssetLibrary.jsx**

Layout: upload area at top (drag-drop zone + file input), category filter chips (All, Image, Document, Video, Presentation, Other), grid of AssetCards. Upload modal or inline upload with progress indication.

- [ ] **Step 3: Update App.jsx**

```javascript
<Route path="/marketing/assets" element={<AssetLibrary />} />
```

- [ ] **Step 4: Update marketing navigation**

```javascript
{ to: '/marketing/tasks', icon: 'Kanban', label: 'Task Board' },
{ to: '/marketing/assets', icon: 'FolderOpen', label: 'Assets' },
```

- [ ] **Step 5: Build + test**

```bash
npm run build 2>&1
# Test: /marketing/tasks, /marketing/assets (upload, download, delete)
```

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/AssetCard.jsx src/pages/marketing/AssetLibrary.jsx src/App.jsx src/workspaces/marketing/
git commit -m "feat: add Asset Library page with upload/download (Phase 5)"
```

---

## Self-Review Checklist

| Acceptance Criterion | Task |
|---|---|
| Task board kanban 4 kolom (Todo→Done) | Task 3 (TaskBoard) |
| Drag-drop task antar kolom | Task 3 (reuse dnd-kit pattern) |
| Priority badge color-coded | Task 3 (TaskCard priority colors) |
| Assignee + due date di card | Task 3 (TaskCard) |
| Upload file via drag-drop | Task 4 (AssetLibrary upload zone) |
| Thumbnail grid | Task 4 (AssetCard image thumbs) |
| Category filter | Task 4 (filter chips) |
| Download file | Task 1 (GET /assets/:id/download → res.download) |
| Delete asset | Task 1 (DELETE /assets/:id + remove file from disk) |
| Sidebar nav items | Task 4 Step 4 |
