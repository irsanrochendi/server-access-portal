# Marketing & Sales Hub — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace switcher + Lead Tracker + Marketing Dashboard — foundation untuk Marketing Hub.

**Architecture:** Backend Express.js + better-sqlite3: tambah field `workspace_access` di `users`, 3 tabel baru (`leads`, `content_calendar`, `campaigns`), REST routes baru. Frontend React 19 + Tailwind 4: `WorkspaceLayout` component, conditional sidebar, `LeadTracker` page, `MarketingDashboard` page.

**Tech Stack:** Express.js, better-sqlite3, React 19, Tailwind CSS 4, lucide-react, react-router-dom v7.

---

## Global Constraints

- Tailwind 4 — utility classes, dark mode via `useTheme()`
- Icons: `lucide-react`
- Reuse: `ui/Button.jsx`, `ui/Input.jsx`, `ui/Badge.jsx`, `ui/Modal.jsx` (if exists) atau inline modal pattern dari `ConfirmModal.jsx`
- Toast: `useToast()` dari `contexts/ToastContext.jsx`
- Auth: JWT via `authenticate` middleware, user object di `req.user`
- API pattern: `api.getLeads()`, `api.createLead()`, dll — full CRUD
- No breaking changes: jangan modifikasi atau hapus kode Infrastructure yang sudah ada
- Responsive: minimal tablet (768px)
- Dark mode: semua komponen baru harus support `dark:` variant

---

## File Structure

```
backend/
├── database.js                    # MODIFY: add workspace_access column + 3 tables
├── routes/
│   └── marketing.js               # NEW: leads CRUD, content calendar CRUD, campaigns CRUD, stats aggregate
├── server.js                      # MODIFY: register /api/leads, /api/content-calendar, /api/campaigns, /api/marketing
├── middleware/
│   └── auth.js                   # MODIFY: add workspaceAccess middleware

src/
├── App.jsx                        # MODIFY: add marketing routes
├── contexts/
│   └── MarketingContext.jsx      # NEW: leads + content + campaigns state
├── workspaces/
│   ├── infrastructure/
│   │   └── navigation.js         # MODIFY: rename/relocate existing nav config
│   └── marketing/
│       └── navigation.js         # NEW: marketing sidebar config
├── components/
│   └── workspace/
│       ├── WorkspaceLayout.jsx   # NEW: header with tab switcher + conditional sidebar
│       └── WorkspaceSwitcher.jsx # NEW: tab component
├── pages/
│   └── marketing/
│       ├── LeadTracker.jsx        # NEW: lead table + form modal
│       └── MarketingDashboard.jsx # NEW: stat cards + chart
├── services/
│   └── api.js                    # MODIFY: add marketing API methods
```

---

## Task 1: Database Schema — Workspace Access + Marketing Tables

**Files:**
- Modify: `backend/database.js` (add column + 3 CREATE TABLE statements)

**Interfaces:**
- Produces: Tabel `users` kolom `workspace_access`, tabel `leads`, `content_calendar`, `campaigns` tersedia untuk semua task lain.

- [ ] **Step 1: Read current database.js to find the right insertion point**

```javascript
// Read backend/database.js and identify:
// 1. Where users table is defined (find "CREATE TABLE users")
// 2. The line number of the closing `);` of the users table definition
// Insert the ALTER TABLE statement after the users table closes
```

- [ ] **Step 2: Read the full database.js to find where to insert tables**

Find the line after all existing CREATE TABLE statements and before `export function getDb()`.

- [ ] **Step 3: Add `workspace_access` column to users table**

After the users table definition (before the closing `);`), add:

```sql
ALTER TABLE users ADD COLUMN workspace_access TEXT NOT NULL DEFAULT 'all';
```

This column allows values: `'all'` (admin can switch), `'infrastructure'` (IT only), `'marketing'` (marketing only).

Note: Use `db.exec()` separately after the main schema — ALTER TABLE must be in its own `exec()` call in SQLite.

```javascript
// In initDb(), after the main schema.exec() block, add:
try {
  db.exec("ALTER TABLE users ADD COLUMN workspace_access TEXT NOT NULL DEFAULT 'all'");
} catch (e) {
  if (!e.message.includes('duplicate column')) {
    // column already exists — ignore
  } else throw e;
}
```

- [ ] **Step 4: Add leads table**

After the `ALTER TABLE` block, add:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  source TEXT NOT NULL CHECK(source IN ('LinkedIn','Website','Referral','Event','Cold Email','Other')),
  status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','Contacted','Qualified','Demo','Proposal','Negotiation','Won','Lost')),
  value REAL DEFAULT 0,
  assigned_to INTEGER REFERENCES users(id),
  notes TEXT DEFAULT '',
  next_follow_up TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 5: Add content_calendar table**

```sql
CREATE TABLE IF NOT EXISTS content_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('Blog','LinkedIn','Instagram','Twitter','Email','YouTube','Other')),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Review','Scheduled','Published')),
  scheduled_date TEXT,
  published_date TEXT,
  author INTEGER REFERENCES users(id),
  content_url TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 6: Add campaigns table**

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('Email','Social','PPC','Event','Content','Other')),
  start_date TEXT,
  end_date TEXT,
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  roi_percent REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK(status IN ('Planning','Active','Paused','Completed')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 7: Add indexes for performance**

```sql
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_channel ON content_calendar(channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
```

- [ ] **Step 8: Verify database migration**

Run:
```bash
cd backend && node -e "const {getDb} = require('./database.js'); const db = getDb(); const cols = db.prepare('PRAGMA table_info(users)').all(); console.log(cols.find(c=>c.name==='workspace_access') ? 'PASS: workspace_access column exists' : 'FAIL: workspace_access missing'); const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(r=>r.name); ['leads','content_calendar','campaigns'].forEach(t=>console.log(tables.includes(t) ? 'PASS: '+t+' table exists' : 'FAIL: '+t+' missing'));"
```

Expected: `PASS: workspace_access column exists`, `PASS: leads table exists`, `PASS: content_calendar table exists`, `PASS: campaigns table exists`

- [ ] **Step 9: Commit**

```bash
git add backend/database.js
git commit -m "feat: add workspace_access column and marketing tables (leads, content_calendar, campaigns)"
```

---

## Task 2: Backend Routes — Marketing API

**Files:**
- Create: `backend/routes/marketing.js`
- Modify: `backend/server.js` (register routes)
- Modify: `backend/middleware/auth.js` (workspaceAccess middleware)

**Interfaces:**
- Consumes: `authenticate` middleware, `getDb()` from `../database.js`
- Produces: REST endpoints: `GET/POST /api/leads`, `GET/PATCH/DELETE /api/leads/:id`, `GET /api/leads/overdue`, `GET/POST/PATCH/DELETE /api/content-calendar`, `GET/POST/PATCH/DELETE /api/campaigns`, `GET /api/marketing/stats`

- [ ] **Step 1: Create marketing routes file**

Create `backend/routes/marketing.js` with all routes:

```javascript
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── LEADS ──────────────────────────────────────────────

// GET /api/leads — list with optional filters
router.get('/', (req, res) => {
  const db = getDb();
  const { status, source, search, assigned_to } = req.query;

  let sql = 'SELECT l.*, u.name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND l.status = ?'; params.push(status); }
  if (source) { sql += ' AND l.source = ?'; params.push(source); }
  if (search) { sql += ' AND (l.company_name LIKE ? OR l.contact_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (assigned_to) { sql += ' AND l.assigned_to = ?'; params.push(assigned_to); }

  sql += ' ORDER BY l.updated_at DESC';

  const leads = db.prepare(sql).all(...params);
  res.json({ leads });
});

// GET /api/leads/overdue — leads past next_follow_up date
router.get('/overdue', (req, res) => {
  const db = getDb();
  const leads = db.prepare(`
    SELECT l.*, u.name as assigned_name
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    WHERE l.next_follow_up IS NOT NULL
      AND l.next_follow_up < datetime('now')
      AND l.status NOT IN ('Won','Lost')
    ORDER BY l.next_follow_up ASC
  `).all();
  res.json({ leads });
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, u.name as assigned_name
    FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead tidak ditemukan' });
  res.json({ lead });
});

// POST /api/leads
router.post('/', (req, res) => {
  const db = getDb();
  const { company_name, contact_name, contact_email, contact_phone, source, status, value, assigned_to, notes, next_follow_up } = req.body;

  if (!company_name || !contact_name || !source) {
    return res.status(400).json({ error: 'company_name, contact_name, dan source wajib diisi' });
  }

  const validSources = ['LinkedIn','Website','Referral','Event','Cold Email','Other'];
  if (!validSources.includes(source)) {
    return res.status(400).json({ error: 'Source tidak valid' });
  }

  const result = db.prepare(`
    INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, source, status, value, assigned_to, notes, next_follow_up)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company_name, contact_name, contact_email || null, contact_phone || null, source, status || 'New', value || 0, assigned_to || null, notes || '', next_follow_up || null);

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ lead });
});

// PATCH /api/leads/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lead tidak ditemukan' });

  const allowed = ['company_name','contact_name','contact_email','contact_phone','source','status','value','assigned_to','notes','next_follow_up'];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json({ lead });
});

// DELETE /api/leads/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lead tidak ditemukan' });

  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── CONTENT CALENDAR ─────────────────────────────────────

router.get('/content-calendar', (req, res) => {
  const db = getDb();
  const { channel, status } = req.query;

  let sql = 'SELECT cc.*, u.name as author_name FROM content_calendar cc LEFT JOIN users u ON cc.author = u.id WHERE 1=1';
  const params = [];
  if (channel) { sql += ' AND cc.channel = ?'; params.push(channel); }
  if (status) { sql += ' AND cc.status = ?'; params.push(status); }
  sql += ' ORDER BY cc.scheduled_date ASC';

  const items = db.prepare(sql).all(...params);
  res.json({ items });
});

router.post('/content-calendar', (req, res) => {
  const db = getDb();
  const { title, channel, status, scheduled_date, content_url, notes } = req.body;

  if (!title || !channel) {
    return res.status(400).json({ error: 'title dan channel wajib diisi' });
  }

  const result = db.prepare(`
    INSERT INTO content_calendar (title, channel, status, scheduled_date, author, content_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, channel, status || 'Draft', scheduled_date || null, req.user.id, content_url || null, notes || '');

  const item = db.prepare('SELECT * FROM content_calendar WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ item });
});

router.patch('/content-calendar/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM content_calendar WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item tidak ditemukan' });

  const allowed = ['title','channel','status','scheduled_date','published_date','content_url','notes'];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE content_calendar SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const item = db.prepare('SELECT * FROM content_calendar WHERE id = ?').get(req.params.id);
  res.json({ item });
});

router.delete('/content-calendar/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM content_calendar WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item tidak ditemukan' });

  db.prepare('DELETE FROM content_calendar WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── CAMPAIGNS ───────────────────────────────────────────

router.get('/campaigns', (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let sql = 'SELECT * FROM campaigns WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';

  const campaigns = db.prepare(sql).all(...params);
  res.json({ campaigns });
});

router.post('/campaigns', (req, res) => {
  const db = getDb();
  const { name, type, start_date, end_date, budget, notes } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name dan type wajib diisi' });
  }

  const result = db.prepare(`
    INSERT INTO campaigns (name, type, start_date, end_date, budget, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, type, start_date || null, end_date || null, budget || 0, notes || '');

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ campaign });
});

router.patch('/campaigns/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaign tidak ditemukan' });

  const allowed = ['name','type','start_date','end_date','budget','spent','leads_generated','conversions','roi_percent','status','notes'];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json({ campaign });
});

router.delete('/campaigns/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaign tidak ditemukan' });

  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── MARKETING STATS ─────────────────────────────────────

router.get('/stats', (req, res) => {
  const db = getDb();

  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const pipelineValue = db.prepare("SELECT COALESCE(SUM(value), 0) as total FROM leads WHERE status NOT IN ('Won','Lost')").get().total;
  const wonCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'Won'").get().count;
  const wonValue = db.prepare("SELECT COALESCE(SUM(value), 0) as total FROM leads WHERE status = 'Won'").get().total;
  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100 * 10) / 10 : 0;

  const leadsBySource = db.prepare(`
    SELECT source, COUNT(*) as count
    FROM leads GROUP BY source ORDER BY count DESC
  `).all();

  const leadsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM leads GROUP BY status ORDER BY count DESC
  `).all();

  const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'Active'").get().count;
  const totalBudget = db.prepare('SELECT COALESCE(SUM(budget), 0) as total FROM campaigns').get().total;
  const totalSpent = db.prepare('SELECT COALESCE(SUM(spent), 0) as total FROM campaigns').get().total;

  res.json({
    totalLeads,
    pipelineValue,
    wonCount,
    wonValue,
    conversionRate,
    leadsBySource,
    leadsByStatus,
    activeCampaigns,
    totalBudget,
    totalSpent,
  });
});

export default router;
```

- [ ] **Step 2: Add workspaceAccess middleware to auth.js**

In `backend/middleware/auth.js`, after the `authenticate` export, add:

```javascript
export function workspaceAccess(requiredWorkspace) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const access = user.workspace_access || 'all';
    // 'all' = admin, can access everything
    if (access === 'all') return next();

    // Check if user's workspace matches required
    if (access !== requiredWorkspace) {
      return res.status(403).json({ error: `Akses ditolak. Anda tidak memiliki akses ke workspace ini.` });
    }

    next();
  };
}
```

- [ ] **Step 3: Register routes in server.js**

Add to the imports section of `backend/server.js`:

```javascript
import marketingRoutes from './routes/marketing.js';
```

Add to the routes section (after other `app.use('/api/...'` lines):

```javascript
app.use('/api/leads', marketingRoutes);
app.use('/api/content-calendar', marketingRoutes);
app.use('/api/campaigns', marketingRoutes);
app.use('/api/marketing', marketingRoutes);
```

- [ ] **Step 4: Verify routes work**

Start backend server:
```bash
cd backend && node server.js
```

In another terminal:
```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:4000/api/leads | python -c "import sys,json; d=json.load(sys.stdin); print('PASS: leads endpoint works, count:', len(d.get('leads',[]))) if 'leads' in d else print('FAIL:', d)"
curl -s -H "Authorization: Bearer <token>" http://localhost:4000/api/marketing/stats | python -c "import sys,json; d=json.load(sys.stdin); print('PASS: stats endpoint works' if 'totalLeads' in d else 'FAIL:', d)"
```

Expected: `PASS: leads endpoint works, count: 0`, `PASS: stats endpoint works`

- [ ] **Step 5: Commit**

```bash
git add backend/routes/marketing.js backend/middleware/auth.js backend/server.js
git commit -m "feat: add marketing routes (leads CRUD, content calendar, campaigns, stats)"
```

---

## Task 3: Workspace Layout — Frontend Structure

**Files:**
- Create: `src/workspaces/marketing/navigation.js`
- Modify: `src/workspaces/infrastructure/navigation.js` (move existing nav here)
- Create: `src/components/workspace/WorkspaceSwitcher.jsx`
- Create: `src/components/workspace/WorkspaceLayout.jsx`
- Create: `src/contexts/MarketingContext.jsx`

**Interfaces:**
- Consumes: `useAuth()` from `AuthContext`, `useTheme()` from `ThemeContext`
- Produces: `WorkspaceLayout` component wraps page content; `MarketingContext` provides `leads`, `campaigns`, `contentCalendar` state with CRUD methods

- [ ] **Step 1: Create infrastructure navigation config**

Create directory `src/workspaces/infrastructure/` and file `src/workspaces/infrastructure/navigation.js`:

```javascript
// Navigation items for Infrastructure workspace — matches existing Sidebar.jsx items
export const infrastructureNav = [
  { to: '/dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/announcements', icon: 'Megaphone', label: 'Pengumuman' },
  { to: '/forum', icon: 'MessagesSquare', label: 'Forum' },
  { to: '/online-users', icon: 'Users', label: 'Online Users' },
];

export const infrastructureAdminNav = [
  { to: '/admin/servers', icon: 'Server', label: 'Servers' },
  { to: '/admin/users', icon: 'Users', label: 'Users' },
  { to: '/admin/activity-logs', icon: 'ClipboardList', label: 'Activity Logs' },
  { to: '/admin/settings', icon: 'Settings', label: 'Settings' },
];
```

- [ ] **Step 2: Create marketing navigation config**

Create directory `src/workspaces/marketing/` and file `src/workspaces/marketing/navigation.js`:

```javascript
// Navigation items for Marketing & Sales workspace
export const marketingNav = [
  { to: '/marketing', icon: 'LayoutDashboard', label: 'Dashboard', exact: true },
  { to: '/marketing/leads', icon: 'Users', label: 'Lead Tracker' },
  { to: '/marketing/content', icon: 'Calendar', label: 'Content Calendar' },
  { to: '/marketing/campaigns', icon: 'Megaphone', label: 'Campaigns' },
];
```

- [ ] **Step 3: Create WorkspaceSwitcher component**

Create `src/components/workspace/WorkspaceSwitcher.jsx`:

```javascript
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'marketing', label: 'Marketing & Sales', badge: 'NEW' },
];

export default function WorkspaceSwitcher() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const workspace = location.pathname.startsWith('/marketing') ? 'marketing' : 'infrastructure';

  const handleSwitch = (tabId) => {
    if (tabId === workspace) return;
    if (tabId === 'marketing') {
      navigate('/marketing');
    } else {
      navigate('/dashboard');
    }
  };

  // Only show tabs for users with 'all' workspace access (admin)
  // or users with both workspace access
  if (user?.workspace_access && user.workspace_access !== 'all') {
    return null; // User can only see one workspace — no switcher needed
  }

  return (
    <div className="flex items-center gap-0 ml-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleSwitch(tab.id)}
          className={`
            px-4 py-3 text-sm font-medium transition-all duration-150 border-b-2
            ${workspace === tab.id
              ? 'text-gray-900 dark:text-gray-100 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          {tab.label}
          {tab.badge && (
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create WorkspaceLayout component**

Create `src/components/workspace/WorkspaceLayout.jsx`. This wraps the existing sidebar + header pattern but with conditional navigation based on the active workspace.

```javascript
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Server, Users, ClipboardList, Settings, LogOut,
  ChevronLeft, ChevronRight, Sun, Moon, Megaphone, MessagesSquare,
  Calendar, CalendarDays,
} from 'lucide-react';
import WorkspaceSwitcher from './WorkspaceSwitcher';

// Icon map
const iconMap = {
  LayoutDashboard, Server, Users, ClipboardList, Settings, LogOut,
  Sun, Moon, Megaphone, MessagesSquare, Calendar, CalendarDays,
};

const infrastructureNav = [
  { to: '/dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/announcements', icon: 'Megaphone', label: 'Pengumuman' },
  { to: '/forum', icon: 'MessagesSquare', label: 'Forum' },
  { to: '/online-users', icon: 'Users', label: 'Online Users' },
];

const infrastructureAdminNav = [
  { to: '/admin/servers', icon: 'Server', label: 'Servers' },
  { to: '/admin/users', icon: 'Users', label: 'Users' },
  { to: '/admin/activity-logs', icon: 'ClipboardList', label: 'Activity Logs' },
  { to: '/admin/settings', icon: 'Settings', label: 'Settings' },
];

const marketingNav = [
  { to: '/marketing', icon: 'LayoutDashboard', label: 'Dashboard', exact: true },
  { to: '/marketing/leads', icon: 'Users', label: 'Lead Tracker' },
  { to: '/marketing/content', icon: 'Calendar', label: 'Content Calendar' },
  { to: '/marketing/campaigns', icon: 'Megaphone', label: 'Campaigns' },
];

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  const Icon = iconMap[item.icon] || LayoutDashboard;

  return (
    <NavLink
      to={item.to}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-colors duration-150 group relative overflow-visible
        ${isActive
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
        }
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {item.label}
        </div>
      )}
    </NavLink>
  );
}

export default function WorkspaceLayout({ children, onLogout }) {
  const { isAdmin, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isMarketing = location.pathname.startsWith('/marketing');
  const navItems = isMarketing ? marketingNav : infrastructureNav;
  const adminNavItems = isMarketing ? [] : infrastructureAdminNav;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        hidden md:flex flex-col fixed left-0 top-0 h-full z-30
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Server className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                Server Access
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Portal AST</p>
            </div>
          )}
        </div>

        {/* Workspace Switcher */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} />)}

          {adminNavItems.length > 0 && isAdmin && (
            <>
              <div className="pt-4 pb-1">
                <p className={`px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${collapsed ? 'text-center' : ''}`}>
                  {collapsed ? '⚙' : 'Admin'}
                </p>
              </div>
              {adminNavItems.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300">{user.name}</p>
              <p className="capitalize">{user.role}</p>
            </div>
          )}
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!collapsed && <span className="truncate">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="truncate">Logout</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex w-full items-center justify-center px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create MarketingContext**

Create `src/contexts/MarketingContext.jsx`:

```javascript
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const MarketingContext = createContext();

export function MarketingProvider({ children }) {
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [contentCalendar, setContentCalendar] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async (params = {}) => {
    const { leads: data } = await api.getLeads(params);
    setLeads(data);
    return data;
  }, []);

  const createLead = useCallback(async (data) => {
    const { lead } = await api.createLead(data);
    setLeads(prev => [lead, ...prev]);
    return lead;
  }, []);

  const updateLead = useCallback(async (id, data) => {
    const { lead } = await api.updateLead(id, data);
    setLeads(prev => prev.map(l => l.id === id ? lead : l));
    return lead;
  }, []);

  const deleteLead = useCallback(async (id) => {
    await api.deleteLead(id);
    setLeads(prev => prev.filter(l => l.id !== id));
  }, []);

  const fetchCampaigns = useCallback(async (params = {}) => {
    const { campaigns: data } = await api.getCampaigns(params);
    setCampaigns(data);
    return data;
  }, []);

  const createCampaign = useCallback(async (data) => {
    const { campaign } = await api.createCampaign(data);
    setCampaigns(prev => [campaign, ...prev]);
    return campaign;
  }, []);

  const updateCampaign = useCallback(async (id, data) => {
    const { campaign } = await api.updateCampaign(id, data);
    setCampaigns(prev => prev.map(c => c.id === id ? campaign : c));
    return campaign;
  }, []);

  const deleteCampaign = useCallback(async (id) => {
    await api.deleteCampaign(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }, []);

  const fetchContentCalendar = useCallback(async (params = {}) => {
    const { items } = await api.getContentCalendar(params);
    setContentCalendar(items);
    return items;
  }, []);

  const createContentItem = useCallback(async (data) => {
    const { item } = await api.createContentItem(data);
    setContentCalendar(prev => [...prev, item]);
    return item;
  }, []);

  const updateContentItem = useCallback(async (id, data) => {
    const { item } = await api.updateContentItem(id, data);
    setContentCalendar(prev => prev.map(i => i.id === id ? item : i));
    return item;
  }, []);

  const deleteContentItem = useCallback(async (id) => {
    await api.deleteContentItem(id);
    setContentCalendar(prev => prev.filter(i => i.id !== id));
  }, []);

  const fetchStats = useCallback(async () => {
    const data = await api.getMarketingStats();
    setStats(data);
    return data;
  }, []);

  useEffect(() => {
    Promise.all([
      fetchLeads(),
      fetchCampaigns(),
      fetchContentCalendar(),
      fetchStats(),
    ]).finally(() => setLoading(false));
  }, [fetchLeads, fetchCampaigns, fetchContentCalendar, fetchStats]);

  return (
    <MarketingContext.Provider value={{
      leads, setLeads, fetchLeads, createLead, updateLead, deleteLead,
      campaigns, setCampaigns, fetchCampaigns, createCampaign, updateCampaign, deleteCampaign,
      contentCalendar, setContentCalendar, fetchContentCalendar, createContentItem, updateContentItem, deleteContentItem,
      stats, fetchStats,
      loading,
    }}>
      {children}
    </MarketingContext.Provider>
  );
}

export const useMarketing = () => useContext(MarketingContext);
```

- [ ] **Step 6: Add marketing API methods to api.js**

Add to `src/services/api.js` (after existing methods, before the closing `}`):

```javascript
// Marketing
getLeads: (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.source) q.set('source', params.source);
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return request(`/leads${qs ? `?${qs}` : ''}`);
},
getLead: (id) => request(`/leads/${id}`),
createLead: (data) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
updateLead: (id, data) => request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
getLeadsOverdue: () => request('/leads/overdue'),

getContentCalendar: (params = {}) => {
  const q = new URLSearchParams();
  if (params.channel) q.set('channel', params.channel);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return request(`/content-calendar${qs ? `?${qs}` : ''}`);
},
createContentItem: (data) => request('/content-calendar', { method: 'POST', body: JSON.stringify(data) }),
updateContentItem: (id, data) => request(`/content-calendar/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteContentItem: (id) => request(`/content-calendar/${id}`, { method: 'DELETE' }),

getCampaigns: (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return request(`/campaigns${qs ? `?${qs}` : ''}`);
},
createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),

getMarketingStats: () => request('/marketing/stats'),
```

- [ ] **Step 7: Commit**

```bash
git add src/workspaces/infrastructure/navigation.js src/workspaces/marketing/navigation.js src/components/workspace/ src/contexts/MarketingContext.jsx src/services/api.js
git commit -m "feat: add workspace layout components and MarketingContext"
```

---

## Task 4: Lead Tracker + Marketing Dashboard Pages

**Files:**
- Create: `src/pages/marketing/LeadTracker.jsx`
- Create: `src/pages/marketing/MarketingDashboard.jsx`
- Modify: `src/App.jsx` (add marketing routes, use WorkspaceLayout)

**Interfaces:**
- Consumes: `MarketingContext` for leads state and CRUD methods
- Produces: Full LeadTracker page with table, filters, add/edit/delete modal; MarketingDashboard with stat cards and chart

- [ ] **Step 1: Create MarketingDashboard.jsx**

Create `src/pages/marketing/MarketingDashboard.jsx`. This page shows aggregate stats and a chart of leads by source.

```javascript
import { useMarketing } from '../../contexts/MarketingContext';
import { TrendingUp, Users, Target, Megaphone } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    purple: 'border-l-purple-500',
    green: 'border-l-green-500',
    blue: 'border-l-blue-500',
    amber: 'border-l-amber-500',
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 border-l-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function MarketingDashboard() {
  const { stats, loading } = useMarketing();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Memuat...</div>
      </div>
    );
  }

  const formatCurrency = (val) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(1)}K`;
    return `Rp ${val}`;
  };

  const maxSourceCount = stats?.leadsBySource?.[0]?.count || 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing & Sales</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview performa tim marketing dan sales</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={stats?.totalLeads || 0} sub={`${stats?.wonCount || 0} won`} color="purple" />
        <StatCard icon={TrendingUp} label="Pipeline Value" value={formatCurrency(stats?.pipelineValue || 0)} sub="Total nilai pipeline" color="green" />
        <StatCard icon={Target} label="Conversion Rate" value={`${stats?.conversionRate || 0}%`} sub={`${stats?.wonCount || 0} dari ${stats?.totalLeads || 0} leads`} color="blue" />
        <StatCard icon={Megaphone} label="Active Campaigns" value={stats?.activeCampaigns || 0} sub={`Budget: ${formatCurrency(stats?.totalBudget || 0)}`} color="amber" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Source Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Leads by Source</h3>
          {(!stats?.leadsBySource || stats.leadsBySource.length === 0) ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Belum ada data leads</div>
          ) : (
            <div className="space-y-3">
              {stats.leadsBySource.map((item) => {
                const pct = Math.round((item.count / maxSourceCount) * 100);
                return (
                  <div key={item.source}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{item.source}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leads by Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Leads by Status</h3>
          {(!stats?.leadsByStatus || stats.leadsByStatus.length === 0) ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Belum ada data leads</div>
          ) : (
            <div className="space-y-3">
              {stats.leadsByStatus.map((item) => {
                const total = stats.totalLeads || 1;
                const pct = Math.round((item.count / total) * 100);
                const statusColors = {
                  New: 'bg-blue-500', Contacted: 'bg-amber-500', Qualified: 'bg-purple-500',
                  Demo: 'bg-pink-500', Proposal: 'bg-fuchsia-500', Negotiation: 'bg-orange-500',
                  Won: 'bg-green-500', Lost: 'bg-red-500',
                };
                return (
                  <div key={item.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{item.status}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{item.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className={`${statusColors[item.status] || 'bg-gray-500'} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create LeadTracker.jsx**

Create `src/pages/marketing/LeadTracker.jsx`. Full CRUD page with table, filters, and modal form.

```javascript
import { useState, useMemo } from 'react';
import { useMarketing } from '../../contexts/MarketingContext';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';

const SOURCES = ['LinkedIn', 'Website', 'Referral', 'Event', 'Cold Email', 'Other'];
const STATUSES = ['New', 'Contacted', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const statusColors = {
  New: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Contacted: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Qualified: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Demo: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  Proposal: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
  Negotiation: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Won: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Lost: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const emptyForm = {
  company_name: '', contact_name: '', contact_email: '', contact_phone: '',
  source: 'LinkedIn', status: 'New', value: '', assigned_to: '', notes: '', next_follow_up: '',
};

export default function LeadTracker() {
  const { leads, loading, createLead, updateLead, deleteLead, fetchLeads } = useMarketing();
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterSource && l.source !== filterSource) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.company_name?.toLowerCase().includes(q) && !l.contact_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leads, filterStatus, filterSource, search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (lead) => {
    setEditingId(lead.id);
    setForm({
      company_name: lead.company_name, contact_name: lead.contact_name,
      contact_email: lead.contact_email || '', contact_phone: lead.contact_phone || '',
      source: lead.source, status: lead.status, value: lead.value?.toString() || '',
      assigned_to: lead.assigned_to?.toString() || '', notes: lead.notes || '',
      next_follow_up: lead.next_follow_up ? lead.next_follow_up.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        ...form,
        value: form.value ? parseFloat(form.value) : 0,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
      };
      if (editingId) {
        await updateLead(editingId, data);
        toast.success('Lead berhasil diupdate');
      } else {
        await createLead(data);
        toast.success('Lead baru berhasil ditambahkan');
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLead(deleteTarget.id);
      toast.success('Lead dihapus');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatValue = (v) => {
    if (!v) return '—';
    return `Rp ${v.toLocaleString('id-ID')}`;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Memuat leads...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} leads</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Tambah Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari company atau contact..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">Semua Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">Semua Source</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Update</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">Belum ada leads. Klik "Tambah Lead" untuk mulai.</td>
                </tr>
              ) : filtered.map(lead => (
                <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lead.company_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div>{lead.contact_name}</div>
                    {lead.contact_email && <div className="text-xs text-gray-400">{lead.contact_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{lead.source}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColors[lead.status] || ''}`}>{lead.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{formatValue(lead.value)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(lead.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(lead)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(lead)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Lead' : 'Tambah Lead Baru'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
                  <input name="company_name" value={form.company_name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name *</label>
                  <input name="contact_name" value={form.contact_name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" name="contact_email" value={form.contact_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input name="contact_phone" value={form.contact_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source *</label>
                  <select name="source" value={form.source} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500">
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value (IDR)</label>
                  <input type="number" name="value" value={form.value} onChange={handleChange} placeholder="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Follow-up</label>
                  <input type="date" name="next_follow_up" value={form.next_follow_up} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
                  {submitting ? '...' : editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hapus Lead?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Lead <strong>{deleteTarget.company_name}</strong> akan dihapus permanen.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg">Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">{deleting ? '...' : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update App.jsx to add marketing routes with WorkspaceLayout**

Read `src/App.jsx` first, then modify it to:
1. Import the new pages and `MarketingProvider`, `WorkspaceLayout`
2. Wrap marketing routes with `WorkspaceLayout`
3. Add route for `/marketing` → `MarketingDashboard`, `/marketing/leads` → `LeadTracker`

```javascript
// Add to imports
import MarketingDashboard from './pages/marketing/MarketingDashboard';
import LeadTracker from './pages/marketing/LeadTracker';
import { MarketingProvider } from './contexts/MarketingContext';
import WorkspaceLayout from './components/workspace/WorkspaceLayout';
import { useAuth } from './contexts/AuthContext';

// Add a component that wraps marketing routes with WorkspaceLayout
function MarketingRoutes() {
  const { logout } = useAuth();
  return (
    <WorkspaceLayout onLogout={logout}>
      <Routes>
        <Route path="/marketing" element={<MarketingDashboard />} />
        <Route path="/marketing/leads" element={<LeadTracker />} />
      </Routes>
    </WorkspaceLayout>
  );
}

// Add inside <Routes> — after the infrastructure routes:
<Route path="/marketing/*" element={
  <MarketingProvider>
    <MarketingRoutes />
  </MarketingProvider>
} />
```

- [ ] **Step 4: Build and verify**

Run the frontend build:
```bash
cd C:\Users\Administrator\server-access-portal-main
npm run build 2>&1
```

Expected: Build completes with no errors. If there are errors, fix them before proceeding.

- [ ] **Step 5: Manual integration test**

Start backend: `cd backend && node server.js`
Start frontend: `npm run dev -- --port 5173 --host`
Visit: http://localhost:5173/marketing
Expected:
- [ ] Workspace tabs visible in header (Infrastructure / Marketing & Sales)
- [ ] Marketing sidebar shows: Dashboard, Lead Tracker, Content Calendar, Campaigns
- [ ] MarketingDashboard shows 4 stat cards (all 0 or with data)
- [ ] Navigate to /marketing/leads → empty state with "Tambah Lead" button
- [ ] Click "Tambah Lead" → modal opens
- [ ] Fill form and submit → lead appears in table
- [ ] Edit lead → modal opens with data pre-filled
- [ ] Delete lead → confirm dialog → lead removed
- [ ] Filter by status/source works
- [ ] Search works
- [ ] Dark mode toggle works
- [ ] Switch to Infrastructure tab → normal sidebar restored

- [ ] **Step 6: Commit**

```bash
git add src/pages/marketing/ src/App.jsx
git commit -m "feat: add LeadTracker and MarketingDashboard pages with workspace layout"
```

---

## Self-Review Checklist

**Spec coverage — can you point to a task that implements each acceptance criterion?**

| Acceptance Criterion | Task |
|---|---|
| Tab "Infrastructure" dan "Marketing & Sales" tampil di header | Task 3, Step 3 (WorkspaceSwitcher) |
| Klik tab = sidebar berubah | Task 3, Step 4 (WorkspaceLayout) |
| Lead Tracker CRUD + table + modal | Task 4, Steps 1-2 |
| Filter by status/source | Task 4, Step 2 (filterState) |
| Search works | Task 4, Step 2 (search state) |
| Status badge color-coded | Task 4, Step 2 (statusColors map) |
| Marketing Dashboard stat cards | Task 4, Step 1 (StatCard) |
| Dark mode support | Task 3, Step 4 (dark: classes) |
| Loading + empty state | Task 4, Steps 1-2 |

**Placeholder scan:**
- No "TBD" found
- No "TODO" found  
- All code is complete inline

**Type consistency:**
- `api.getLeads(params)` — params object with status/source/search keys ✓
- `api.createLead(data)` — object matching backend expected fields ✓
- `api.updateLead(id, data)` — id + object ✓
- `api.deleteLead(id)` — id integer ✓
- `api.getMarketingStats()` — returns stats object ✓

---

## Plan Complete

**Saved to:** `docs/superpowers/plans/2026-07-14-marketing-hub-phase1.md`

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
