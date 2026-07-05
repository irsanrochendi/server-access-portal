# Server Access Portal — Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Server Access Portal into a dual-mode resource gateway — simple one-click access for staff, full admin panel for IT.

**Architecture:** React 19 frontend (Vite + Tailwind CSS) + Node.js/Express backend (SQLite). Dual-mode dashboard detected via user role (`admin` or `staff`). Staff see only assigned resources + online users; admins see full server management.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, React Router 7, Lucide React, Node.js/Express, SQLite (better-sqlite3), JWT auth.

## Global Constraints

- All credential storage must use AES-256 encryption
- Role-based access enforced at both route and API level
- Staff role can only see resources assigned to them
- No new npm dependencies unless absolutely necessary
- Follow existing code patterns (JSX, not TSX)
- All text in Indonesian for UI labels and messages

---

### Task 1: Hapus Health Monitoring & Alerts

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/database.js`
- Modify: `frontend/src/App.jsx`
- Delete: `backend/routes/health.js`
- Delete: `backend/routes/alerts.js`
- Delete: `frontend/src/components/AlertBell.jsx`
- Delete: `frontend/src/components/HealthHistoryModal.jsx`
- Delete: `frontend/src/components/ServerCard.jsx` (remove HealthHistoryModal import & usage)

- [ ] **Step 1: Hapus file backend routes health & alerts**

Hapus file:
```bash
rm /c/Users/Administrator/server-access-portal-main/backend/routes/health.js
rm /c/Users/Administrator/server-access-portal-main/backend/routes/alerts.js
```

- [ ] **Step 2: Hapus file frontend AlertBell & HealthHistoryModal**

Hapus file:
```bash
rm /c/Users/Administrator/server-access-portal-main/src/components/AlertBell.jsx
rm /c/Users/Administrator/server-access-portal-main/src/components/HealthHistoryModal.jsx
```

- [ ] **Step 3: Edit server.js — hapus import & route health/alert**

Buka `backend/server.js` dan hapus 2 baris import ini:
```js
import healthRoutes from './routes/health.js';
import alertRoutes from './routes/alerts.js';
```

Hapus juga 2 baris route berikut:
```js
app.use('/api/health', healthRoutes);
app.use('/api/alerts', alertRoutes);
```

Dan hapus baris `startHealthChecker();` serta importnya:
```js
import { startHealthChecker } from './services/healthCheck.js';
```

- [ ] **Step 4: Edit database.js — hapus tabel alerts**

Buka `backend/database.js` dan hapus blok `CREATE TABLE IF NOT EXISTS alerts (...)` beserta index `idx_alerts_unread` dan `idx_alerts_server`.

- [ ] **Step 5: Edit ServerCard.jsx — hapus HealthHistoryModal import & usage**

Buka `frontend/src/components/ServerCard.jsx`:
1. Hapus baris: `import HealthHistoryModal from './HealthHistoryModal';`
2. Hapus baris: `import { Activity, ... }` — hapus `Activity` dari import lucide-react
3. Hapus bagian Health History button (cari `showHealthModal` dan hapus)
4. Hapus referensi `useState` untuk `showHealthModal`

- [ ] **Step 6: Edit App.jsx — hapus AlertBell import**

Buka `frontend/src/App.jsx`. Cek apakah ada import `AlertBell` — jika ada, hapus.

---

### Task 2: Hapus Server Notes

**Files:**
- Delete: `frontend/src/components/ServerNotesModal.jsx`
- Delete: `frontend/src/components/ServerNotesLogModal.jsx`
- Delete: `backend/routes/notes.js`
- Modify: `backend/server.js`
- Modify: `frontend/src/pages/admin/AdminServers.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 7: Hapus file Server Notes**

```bash
rm /c/Users/Administrator/server-access-portal-main/src/components/ServerNotesModal.jsx
rm /c/Users/Administrator/server-access-portal-main/src/components/ServerNotesLogModal.jsx
rm /c/Users/Administrator/server-access-portal-main/backend/routes/notes.js
```

- [ ] **Step 8: Edit server.js — hapus route notes**

Buka `backend/server.js` dan hapus:
```js
import notesRoutes from './routes/notes.js';
```
dan:
```js
app.use('/api/server-notes', notesRoutes);
```

- [ ] **Step 9: Edit Dashboard.jsx — hapus ServerNotes import & state**

Buka `frontend/src/pages/Dashboard.jsx`:
1. Hapus: `import ServerNotesModal from '../components/ServerNotesModal';`
2. Hapus state `const [notesServer, setNotesServer] = useState(null);`
3. Hapus bagian `<ServerNotesModal>` di JSX

- [ ] **Step 10: Edit AdminServers.jsx — hapus ServerNotes & ServerNotesLog**

Buka `frontend/src/pages/admin/AdminServers.jsx`:
1. Hapus: `import ServerNotesModal from '../../components/ServerNotesModal';`
2. Hapus: `import ServerNotesLogModal from '../../components/ServerNotesLogModal';`
3. Hapus state `showNotesFor` dan `showLogsFor`
4. Hapus JSX `<ServerNotesModal>` dan `<ServerNotesLogModal>`

---

### Task 3: Hapus Connection History

**Files:**
- Delete: `frontend/src/pages/ConnectionHistory.jsx`
- Delete: `backend/routes/connections.js`
- Modify: `backend/server.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Sidebar.jsx`

- [ ] **Step 11: Hapus file Connection History**

```bash
rm /c/Users/Administrator/server-access-portal-main/src/pages/ConnectionHistory.jsx
rm /c/Users/Administrator/server-access-portal-main/backend/routes/connections.js
```

- [ ] **Step 12: Edit server.js — hapus route connections**

Buka `backend/server.js` dan hapus:
```js
import connectionRoutes from './routes/connections.js';
```
dan:
```js
app.use('/api/connections', connectionRoutes);
```

- [ ] **Step 13: Edit App.jsx — hapus route ConnectionHistory**

Buka `frontend/src/App.jsx` dan hapus:
```jsx
import ConnectionHistory from './pages/ConnectionHistory';
```
dan:
```jsx
<Route path="/connection-history" element={<ConnectionHistory />} />
```

- [ ] **Step 14: Edit Sidebar — hapus link History**

Buka `frontend/src/components/layout/Sidebar.jsx` dan hapus item nav untuk History/ConnectionHistory:
```js
{ to: '/connection-history', icon: Clock, label: 'History', role: ['admin', 'staff'] },
```
Hapus juga import `Clock` dari lucide-react jika tidak dipakai lagi.

---

### Task 4: Role-Based Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx`

- [ ] **Step 15: Edit Sidebar — filter menu berdasarkan role**

Buka `frontend/src/components/layout/Sidebar.jsx`.

Ubah daftar navItems menjadi:

```jsx
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/online-users', icon: Users, label: 'Online Users' },
];

const adminNavItems = [
  { separator: 'Management' },
  { to: '/admin/servers', icon: Server, label: 'Servers', adminOnly: true },
  { to: '/admin/users', icon: Users, label: 'Users', adminOnly: true },
  { to: '/admin/activity-logs', icon: ClipboardList, label: 'Activity Logs', adminOnly: true },
  { to: '/admin/settings', icon: Settings, label: 'Settings', adminOnly: true },
];
```

Di dalam komponen Sidebar, render navItems untuk semua user, lalu render adminNavItems hanya jika `user.role === 'admin'`:

```jsx
{/* Main nav */}
{navItems.map((item) => (
  <NavLink key={item.to} to={item.to} ...>{item.label}</NavLink>
))}

{/* Admin nav - only for admin */}
{isAdmin && (
  <>
    <div className="px-4 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Admin</p>
    </div>
    {adminNavItems.filter(i => i.to).map((item) => (
      <NavLink key={item.to} to={item.to} ...>{item.label}</NavLink>
    ))}
  </>
)}
```

Gunakan `isAdmin` dari `useAuth()`:
```js
const { user, isAdmin } = useAuth();
```

---

### Task 5: Database Migration — Tabel Resources

**Files:**
- Modify: `backend/database.js`

- [ ] **Step 16: Tambah tabel resources & resource_assignments**

Buka `backend/database.js`. Di dalam function `initDb()`, tambahkan sebelum `return d;`:

```js
// ─── v2.0.0: Resource Gateway ──────────────────────────────────────────
d.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'web' CHECK(type IN ('web','rdp','ssh')),
    category TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    description TEXT DEFAULT '',
    shared_username TEXT DEFAULT '',
    shared_password_encrypted TEXT DEFAULT '',
    auto_login_enabled INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

d.exec(`
  CREATE TABLE IF NOT EXISTS resource_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
d.exec(`CREATE INDEX IF NOT EXISTS idx_resource_assignments_resource ON resource_assignments(resource_id)`);
d.exec(`CREATE INDEX IF NOT EXISTS idx_resource_assignments_user ON resource_assignments(user_id)`);
```

---

### Task 6: Backend API — Resource Routes

**Files:**
- Create: `backend/routes/resources.js`
- Modify: `backend/server.js`
- Modify: `backend/services/api.js` (frontend)

- [ ] **Step 17: Buat file routes/resources.js**

Buat file baru `backend/routes/resources.js`:

```js
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-32-chars!!'; // Ganti di production!

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return '';
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const router = Router();

// GET /api/resources — list resources (staff: only assigned, admin: all)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const user = req.user;
  
  let resources;
  if (user.role === 'admin') {
    resources = db.prepare('SELECT * FROM resources WHERE is_active = 1 ORDER BY category, name').all();
  } else {
    resources = db.prepare(`
      SELECT DISTINCT r.* FROM resources r
      JOIN resource_assignments ra ON r.id = ra.resource_id
      WHERE r.is_active = 1
        AND (ra.user_id = ? OR ra.role = ?)
      ORDER BY r.category, r.name
    `).all(user.id, user.role);
  }

  // Decrypt password for display (only if auto_login enabled)
  const result = resources.map(r => ({
    ...r,
    has_password: !!r.shared_password_encrypted,
    shared_password_encrypted: undefined,
  }));

  res.json({ resources: result });
});

// GET /api/resources/:id/credentials — get credentials for auto-login (authenticated)
router.get('/:id/credentials', authenticate, (req, res) => {
  const db = getDb();
  const user = req.user;
  const { id } = req.params;

  // Check access
  let resource;
  if (user.role === 'admin') {
    resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  } else {
    resource = db.prepare(`
      SELECT r.* FROM resources r
      JOIN resource_assignments ra ON r.id = ra.resource_id
      WHERE r.id = ? AND r.is_active = 1
        AND (ra.user_id = ? OR ra.role = ?)
    `).get(id, user.id, user.role);
  }

  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  const password = decrypt(resource.shared_password_encrypted);
  res.json({
    username: resource.shared_username || '',
    password: password,
    auto_login_enabled: resource.auto_login_enabled,
  });
});

// POST /api/resources — create resource (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, url, type, category, icon, description, shared_username, shared_password, auto_login_enabled } = req.body;

  if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });

  const encrypted = encrypt(shared_password || '');
  const result = db.prepare(`
    INSERT INTO resources (name, url, type, category, icon, description, shared_username, shared_password_encrypted, auto_login_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, url, type || 'web', category || '', icon || '', description || '', shared_username || '', encrypted, auto_login_enabled ? 1 : 0);

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
  res.json({ resource });
});

// PUT /api/resources/:id — update resource (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, url, type, category, icon, description, shared_username, shared_password, auto_login_enabled, is_active } = req.body;

  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Resource not found' });

  const encrypted = shared_password !== undefined ? encrypt(shared_password) : existing.shared_password_encrypted;

  db.prepare(`
    UPDATE resources SET name=?, url=?, type=?, category=?, icon=?, description=?,
      shared_username=?, shared_password_encrypted=?, auto_login_enabled=?, is_active=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    name || existing.name, url || existing.url, type || existing.type,
    category !== undefined ? category : existing.category,
    icon !== undefined ? icon : existing.icon,
    description !== undefined ? description : existing.description,
    shared_username !== undefined ? shared_username : existing.shared_username,
    encrypted,
    auto_login_enabled !== undefined ? (auto_login_enabled ? 1 : 0) : existing.auto_login_enabled,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    id
  );

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  res.json({ resource });
});

// DELETE /api/resources/:id — delete resource (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/resources/:id/assign — assign resource to user/role (admin only)
router.post('/:id/assign', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { user_id, role } = req.body;

  if (!user_id && !role) return res.status(400).json({ error: 'user_id or role required' });

  db.prepare('DELETE FROM resource_assignments WHERE resource_id = ? AND (user_id = ? OR (role = ? AND role != \'\'))').run(id, user_id || 0, role || '');

  if (user_id) {
    db.prepare('INSERT INTO resource_assignments (resource_id, user_id) VALUES (?, ?)').run(id, user_id);
  } else if (role) {
    db.prepare('INSERT INTO resource_assignments (resource_id, role) VALUES (?, ?)').run(id, role);
  }

  res.json({ success: true });
});

// DELETE /api/resources/:id/assign/:assignmentId — remove assignment (admin only)
router.delete('/:id/assign/:assignmentId', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM resource_assignments WHERE id = ?').run(req.params.assignmentId);
  res.json({ success: true });
});

// GET /api/resources/:id/assignments — list assignments for a resource (admin only)
router.get('/:id/assignments', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const assignments = db.prepare(`
    SELECT ra.*, u.name as user_name, u.email as user_email
    FROM resource_assignments ra
    LEFT JOIN users u ON ra.user_id = u.id
    WHERE ra.resource_id = ?
  `).all(req.params.id);
  res.json({ assignments });
});

export default router;
```

- [ ] **Step 18: Edit server.js — tambah route resources**

Buka `backend/server.js` dan tambahkan import:
```js
import resourceRoutes from './routes/resources.js';
```

Tambahkan route:
```js
app.use('/api/resources', resourceRoutes);
```

- [ ] **Step 19: Tambah API call resources di frontend**

Buka `frontend/src/services/api.js` dan tambahkan di dalam object `api`:
```js
// Resources
getResources: () => request('/resources'),
getResourceCredentials: (id) => request(`/resources/${id}/credentials`),
createResource: (data) => request('/resources', { method: 'POST', body: JSON.stringify(data) }),
updateResource: (id, data) => request(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
deleteResource: (id) => request(`/resources/${id}`, { method: 'DELETE' }),
assignResource: (id, data) => request(`/resources/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
removeAssignment: (resourceId, assignmentId) => request(`/resources/${resourceId}/assign/${assignmentId}`, { method: 'DELETE' }),
getAssignments: (id) => request(`/resources/${id}/assignments`),
```

---

### Task 7: Resource Context Provider

**Files:**
- Create: `frontend/src/contexts/ResourceContext.jsx`

- [ ] **Step 20: Buat ResourceContext.jsx**

Buat file baru `frontend/src/contexts/ResourceContext.jsx`:

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const ResourceContext = createContext();

export function ResourceProvider({ children }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchResources = useCallback(() => {
    return api.getResources()
      .then(data => setResources(data.resources))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      fetchResources().finally(() => setLoading(false));
    } else {
      setResources([]);
      setLoading(false);
    }
  }, [user, fetchResources]);

  const value = {
    resources,
    loading,
    fetchResources,
  };

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
}

export const useResources = () => {
  const ctx = useContext(ResourceContext);
  if (!ctx) throw new Error('useResources must be used within ResourceProvider');
  return ctx;
};
```

- [ ] **Step 21: Register ResourceProvider di App**

Buka `frontend/src/App.jsx` dan tambahkan import:
```jsx
import { ResourceProvider } from './contexts/ResourceContext';
```

Bungkus bagian routes dengan ResourceProvider (di dalam AuthProvider):
```jsx
<ResourceProvider>
  <Routes>
    ...
  </Routes>
</ResourceProvider>
```

---

### Task 8: Staff Dashboard — Resource Grid

**Files:**
- Create: `frontend/src/components/ResourceCard.jsx`
- Create: `frontend/src/components/ResourceGrid.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 22: Buat ResourceCard component**

Buat file `frontend/src/components/ResourceCard.jsx`:

```jsx
import { useState } from 'react';
import { Globe, Terminal, Monitor, ExternalLink, Copy, Check, Lock, Key } from 'lucide-react';
import { api } from '../services/api';

const typeIcons = {
  web: Globe,
  rdp: Monitor,
  ssh: Terminal,
};

const typeColors = {
  web: 'from-blue-500 to-cyan-500',
  rdp: 'from-purple-500 to-pink-500',
  ssh: 'from-emerald-500 to-teal-500',
};

export default function ResourceCard({ resource }) {
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = typeIcons[resource.type] || Globe;

  const handleClick = async () => {
    if (resource.type === 'web') {
      if (resource.auto_login_enabled) {
        setLoading(true);
        try {
          const creds = await api.getResourceCredentials(resource.id);
          setCredentials(creds);
          setShowPassword(true);
        } catch (e) {
          window.open(resource.url, '_blank');
        }
        setLoading(false);
      } else {
        window.open(resource.url, '_blank');
      }
    } else {
      // RDP or SSH - show connection modal
      setLoading(true);
      try {
        const creds = await api.getResourceCredentials(resource.id);
        setCredentials(creds);
        setShowPassword(true);
      } catch (e) {
        setShowPassword(true);
      }
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryColors = {
    'Internal Apps': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Dev Servers': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'Client Portals': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'Monitoring': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <div className="group relative bg-white dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-300">
      <button onClick={handleClick} className="w-full text-left p-5" disabled={loading}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeColors[resource.type]} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {resource.has_password && (
            <Lock className="w-4 h-4 text-amber-500" />
          )}
        </div>

        {/* Name & URL */}
        <h3 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">{resource.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{resource.url}</p>

        {/* Category badge */}
        {resource.category && (
          <span className={`inline-block mt-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColors[resource.category] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {resource.category}
          </span>
        )}
      </button>

      {/* Connection Modal */}
      {showPassword && credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPassword(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">{resource.name}</h3>
            
            {resource.type === 'web' && (
              <a href={resource.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors mb-4">
                <ExternalLink className="w-4 h-4" />
                Buka {resource.url}
              </a>
            )}

            {resource.type === 'rdp' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">Koneksi Remote Desktop:</p>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 font-mono text-sm">
                  <p>Server: {resource.url}</p>
                  {credentials.username && <p>User: {credentials.username}</p>}
                </div>
                <button onClick={() => {
                  const rdpContent = `full address:s:${resource.url}\nusername:s:${credentials.username || ''}\n`;
                  const blob = new Blob([rdpContent], { type: 'application/octet-stream' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${resource.name}.rdp`;
                  a.click();
                  URL.revokeObjectURL(url);
                }} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
                  Download .RDP File
                </button>
              </div>
            )}

            {resource.type === 'ssh' && (
              <div className="space-y-3">
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 font-mono text-sm">
                  <code>ssh {credentials.username}@{resource.url}</code>
                </div>
                <button onClick={() => handleCopy(`ssh ${credentials.username}@${resource.url}`)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Tersalin!' : 'Copy SSH Command'}
                </button>
              </div>
            )}

            {credentials.password && (
              <div className="mt-3 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-mono text-amber-800 dark:text-amber-200">
                    {credentials.password}
                  </span>
                </div>
                <button onClick={() => handleCopy(credentials.password)}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-amber-600" />}
                </button>
              </div>
            )}

            <button onClick={() => setShowPassword(false)}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 23: Buat ResourceGrid component**

Buat file `frontend/src/components/ResourceGrid.jsx`:

```jsx
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import ResourceCard from './ResourceCard';
import EmptyState from './EmptyState';

export default function ResourceGrid({ resources, loading }) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = resources.filter(r =>
      !q || r.name?.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    );

    const groups = {};
    filtered.forEach(r => {
      const cat = r.category || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }, [resources, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari resource..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white"
        />
      </div>

      {/* Resource Groups */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState
          title="Tidak ada resource"
          description={search ? `Tidak ditemukan "${search}"` : 'Belum ada resource yang ditugaskan'}
        />
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(r => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 24: Edit Dashboard — dual mode (staff vs admin)**

Buka `frontend/src/pages/Dashboard.jsx`. Ubah seluruh isi menjadi:

```jsx
import { useAuth } from '../contexts/AuthContext';
import { useResources } from '../contexts/ResourceContext';
import ResourceGrid from '../components/ResourceGrid';
import OnlineUsers from './OnlineUsers';
import { Users } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { resources, loading } = useResources();

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Selamat Datang, {user?.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Akses resource perusahaan Anda
          </p>
        </div>

        {/* Online Users Widget */}
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Online Users</h2>
          </div>
          <OnlineUsers compact />
        </div>

        {/* Resource Grid */}
        <ResourceGrid resources={resources} loading={loading} />
      </div>
    );
  }

  // Admin view — konten admin yang sudah ada (servers, statistik, dll)
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Admin Dashboard
      </h1>
      {/* Konten admin dashboard existing — bisa pindah dari AdminServers atau buat overview */}
      <p className="text-slate-500 dark:text-slate-400">
        Selamat datang di panel admin. Gunakan menu sidebar untuk mengelola server, user, dan resource.
      </p>
    </div>
  );
}
```

---

### Task 9: Online Users — Compact Mode for Staff Dashboard

**Files:**
- Modify: `frontend/src/pages/OnlineUsers.jsx`

- [ ] **Step 25: Edit OnlineUsers — tambah compact mode**

Buka `frontend/src/pages/OnlineUsers.jsx` dan tambahkan props `compact`:

Di awal komponen, tambahkan:
```jsx
export default function OnlineUsers({ compact = false }) {
```

Sesuaikan tampilan agar compact mode menampilkan daftar user tanpa header/page title:
```jsx
// Jika compact, render list sederhana
if (compact) {
  return (
    <div className="space-y-2">
      {onlineUsers.map(u => (
        <div key={u.id} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-700 dark:text-slate-300">{u.name}</span>
          <span className="text-xs text-slate-400">({u.role})</span>
        </div>
      ))}
      {onlineUsers.length === 0 && (
        <p className="text-sm text-slate-400">Tidak ada user online</p>
      )}
    </div>
  );
}
```

---

### Task 10: Admin Resource Manager Page

**Files:**
- Create: `frontend/src/pages/admin/ResourceManager.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Sidebar.jsx`

- [ ] **Step 26: Buat ResourceManager page**

Buat file `frontend/src/pages/admin/ResourceManager.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Globe, Terminal, Monitor, X, Users, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useResources } from '../../contexts/ResourceContext';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

const emptyForm = {
  name: '', url: '', type: 'web', category: '', icon: '',
  description: '', shared_username: '', shared_password: '',
  auto_login_enabled: false,
};

const TYPE_OPTIONS = [
  { value: 'web', label: 'Website', icon: Globe },
  { value: 'rdp', label: 'Remote Desktop', icon: Monitor },
  { value: 'ssh', label: 'SSH', icon: Terminal },
];

export default function ResourceManager() {
  const { resources, fetchResources } = useResources();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAssign, setShowAssign] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    if (showAssign) {
      api.getUsers().then(d => setUsers(d.users || [])).catch(() => {});
      api.getAssignments(showAssign.id).then(d => setAssignments(d.assignments || [])).catch(() => {});
    }
  }, [showAssign]);

  const handleSave = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateResource(editing.id, form);
      } else {
        await api.createResource(form);
      }
      await fetchResources();
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteResource(deleteTarget.id);
      await fetchResources();
    } catch (e) {
      alert(e.message);
    }
    setDeleteTarget(null);
  };

  const handleAssign = async (userId) => {
    try {
      await api.assignResource(showAssign.id, { user_id: userId });
      const updated = await api.getAssignments(showAssign.id);
      setAssignments(updated.assignments || []);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRemoveAssign = async (assignmentId) => {
    try {
      await api.removeAssignment(showAssign.id, assignmentId);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (e) {
      alert(e.message);
    }
  };

  const editResource = (r) => {
    setForm({
      name: r.name, url: r.url, type: r.type, category: r.category,
      icon: r.icon, description: r.description,
      shared_username: r.shared_username || '', shared_password: '',
      auto_login_enabled: r.auto_login_enabled,
    });
    setEditing(r);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resource Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola resource untuk staff</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Tambah Resource
        </button>
      </div>

      {/* Resource List */}
      {resources.length === 0 ? (
        <EmptyState title="Belum ada resource" description="Tambahkan resource pertama untuk staff" />
      ) : (
        <div className="grid gap-4">
          {resources.map(r => (
            <div key={r.id} className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                  r.type === 'web' ? 'from-blue-500 to-cyan-500' :
                  r.type === 'rdp' ? 'from-purple-500 to-pink-500' : 'from-emerald-500 to-teal-500'
                } flex items-center justify-center`}>
                  {React.createElement(
                    r.type === 'web' ? Globe : r.type === 'rdp' ? Monitor : Terminal,
                    { className: 'w-5 h-5 text-white' }
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.url} {r.category && `• ${r.category}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAssign(r)} className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Assign ke user">
                  <Users className="w-4 h-4" />
                </button>
                <button onClick={() => editResource(r)} className="p-2 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(r)} className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Resource' : 'Tambah Resource'}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Resource</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL / IP Address</label>
                <input value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipe</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white">
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    placeholder="Internal Apps, Dev Servers..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deskripsi (opsional)</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <hr className="dark:border-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kredensial (opsional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                  <input value={form.shared_username} onChange={e => setForm({...form, shared_username: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <input type="password" value={form.shared_password} onChange={e => setForm({...form, shared_password: e.target.value})}
                    placeholder={editing ? '(biarkan kosong jika tidak diubah)' : ''}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_login_enabled} onChange={e => setForm({...form, auto_login_enabled: e.target.checked})}
                  className="rounded border-slate-300" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Aktifkan auto-login</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !form.name || !form.url}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-6 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Assign: {showAssign.name}</h3>
              <button onClick={() => setShowAssign(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Assigned ke user:</p>
            <div className="space-y-2 mb-4">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{a.user_name || a.role || 'Unknown'}</span>
                  <button onClick={() => handleRemoveAssign(a.id)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {assignments.length === 0 && (
                <p className="text-sm text-slate-400">Belum ada assignment</p>
              )}
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Tambah user:</p>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white mb-3"
              value="" onChange={e => { handleAssign(parseInt(e.target.value)); e.target.value = ''; }}>
              <option value="">-- Pilih user --</option>
              {users.filter(u => u.is_active).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button onClick={() => setShowAssign(null)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Tutup</button>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Hapus Resource" message={`Yakin ingin menghapus resource "${deleteTarget?.name}"?`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
```

- [ ] **Step 27: Tambah route ResourceManager di App.jsx**

Buka `frontend/src/App.jsx` dan tambahkan import:
```jsx
import ResourceManager from './pages/admin/ResourceManager';
```

Tambahkan route di dalam bagian admin route:
```jsx
<Route path="/admin/resources" element={
  <ProtectedRoute roles={['admin']}>
    <ResourceManager />
  </ProtectedRoute>
} />
```

- [ ] **Step 28: Tambah nav item ResourceManager di Sidebar**

Buka `frontend/src/components/layout/Sidebar.jsx` dan tambahkan di adminNavItems:
```jsx
{ to: '/admin/resources', icon: Folder, label: 'Resources', adminOnly: true },
```

Tambahkan `Folder` ke import lucide-react:
```jsx
import { ..., Folder } from 'lucide-react';
```

---

### Task 11: Update Online Users Page

**Files:**
- Modify: `frontend/src/pages/OnlineUsers.jsx`

- [ ] **Step 29: Edit OnlineUsers — tambah compact prop + refresh**

Buka `frontend/src/pages/OnlineUsers.jsx`. Pastikan ada polling/refresh periodik agar data online user selalu up-to-date. Jika belum ada, tambahkan:

```jsx
const [onlineUsers, setOnlineUsers] = useState([]);

useEffect(() => {
  const fetch = () => {
    api.getOnlineUsers()
      .then(data => setOnlineUsers(data.users || []))
      .catch(() => {});
  };
  fetch();
  const interval = setInterval(fetch, 30000); // refresh setiap 30 detik
  return () => clearInterval(interval);
}, []);
```

---

### Task 12: Final Cleanup & Testing

**Files:**
- Verify all changes

- [ ] **Step 30: Jalankan backend & test**

```bash
cd /c/Users/Administrator/server-access-portal-main/backend
node server.js
```

Cek bahwa server berjalan tanpa error (tidak ada import yang broken setelah hapus health/alert/notes/connections).

- [ ] **Step 31: Jalankan frontend & test**

```bash
cd /c/Users/Administrator/server-access-portal-main
npm run dev
```

Cek:
1. Login sebagai admin — lihat sidebar dengan menu Resources
2. Login sebagai staff — lihat dashboard dengan ResourceGrid + Online Users
3. Admin bisa buat resource baru
4. Admin bisa assign resource ke user
5. Staff hanya melihat resource yang di-assign

- [ ] **Step 32: Commit perubahan**

```bash
cd /c/Users/Administrator/server-access-portal-main
git add -A
git commit -m "feat: v2.0.0 — Resource Gateway refactor

- Hapus Health Monitoring & Alerts
- Hapus Server Notes
- Hapus Connection History
- Role-based sidebar navigation
- Resource management (CRUD + assignments)
- Staff dashboard with resource grid + online users
- Dual-mode: staff view vs admin view
- Credential encryption & auto-login helper
- Online Users widget with compact mode"
```
