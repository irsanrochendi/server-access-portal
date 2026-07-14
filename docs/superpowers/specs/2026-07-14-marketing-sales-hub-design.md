# Marketing & Sales Hub — PRD

**Date:** 2026-07-14
**Status:** Draft
**Version:** v1.0

---

## 1. Goal

Bangun **Marketing & Sales Hub** — workspace kedua di Server Access Portal untuk tim marketing dan sales SaaS company. Tim IT tetap dapat akses Infrastructure (existing), tim marketing/sales dapat akses Marketing Hub (new).

**Satu codebase, satu login, satu database.** Backend Node.js/Express + SQLite, Frontend React 19 + Tailwind 4.

---

## 2. Architecture

### Workspace Switcher

Header bar menampilkan tab workspace. Sidebar berubah sesuai workspace aktif.

```
┌──────────────────────────────────────────────────┐
│  ◆ Server Access  [Infrastructure]  [Marketing & Sales] │
├──────────────┬─────────────────────────────────────┤
│  Sidebar    │  Konten utama workspace aktif       │
│  (dinamis)  │                                     │
└──────────────┴─────────────────────────────────────┘
```

### Database

Tambah field di tabel `users` existing + 3 tabel baru:

```sql
-- Extend users
ALTER TABLE users ADD COLUMN workspace_access TEXT NOT NULL DEFAULT 'all';
-- 'all' | 'infrastructure' | 'marketing'

-- Leads
CREATE TABLE leads (
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

-- Content Calendar
CREATE TABLE content_calendar (
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

-- Campaigns
CREATE TABLE campaigns (
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

### API Routes (Backend)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/leads` | List leads (filter: status, source, search) |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/:id` | Get lead detail |
| PATCH | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| GET | `/api/leads/overdue` | Leads dengan follow-up overdue |
| GET | `/api/content-calendar` | List content items |
| POST | `/api/content-calendar` | Create content item |
| PATCH | `/api/content-calendar/:id` | Update content item |
| DELETE | `/api/content-calendar/:id` | Delete content item |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| PATCH | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |
| GET | `/api/marketing/stats` | Aggregate stats (total leads, pipeline value, conversion rate) |

### File Structure (Frontend)

```
src/
├── workspaces/
│   ├── infrastructure/
│   │   └── navigation.js      # existing — keep as-is
│   └── marketing/
│       └── navigation.js      # NEW — sidebar config untuk marketing
├── components/workspace/
│   ├── WorkspaceLayout.jsx   # NEW — layout dengan tab switcher + conditional sidebar
│   └── WorkspaceSwitcher.jsx # NEW — tab component
├── pages/marketing/
│   ├── LeadTracker.jsx       # NEW — tabel lead + form modal
│   ├── ContentCalendar.jsx   # NEW — calendar view
│   ├── Campaigns.jsx         # NEW — campaign tracker
│   └── MarketingDashboard.jsx # NEW — stat cards + charts (aggregate)
```

---

## 3. Fitur per Phase

### Phase 1 — Foundation *(ini yang pertama di-build)*

| Fitur | Deskripsi |
|---|---|
| **Workspace Switcher** | Tab di header, sidebar dinamis, route `/marketing/*` |
| **Workspace Access Middleware** | Cek `workspace_access` field, redirect kalau tidak punya akses |
| **Lead Tracker** | Tabel CRUD, filter/search, status badge, form modal |
| **Marketing Dashboard** | Stat cards (Total Leads, Pipeline Value, Conversion Rate), Leads by Source chart |

### Phase 2 — Sales Pipeline

| Fitur | Deskripsi |
|---|---|
| **Pipeline Kanban** | Drag-drop board per status, kartu lead, total value per kolom |
| **Follow-up Reminder** | Badge overdue di sidebar, daftar lead yang perlu di-follow-up |
| **Quote Generator** | Form items → PDF download |

### Phase 3 — Content & Campaign

| Fitur | Deskripsi |
|---|---|
| **Content Calendar** | Monthly calendar view, filter channel, add/edit modal |
| **Campaign Tracker** | Tabel campaign, budget vs spent, status |
| **Email Templates** | CRUD template, HTML preview |

### Phase 4 — Enablement & Analytics

| Fitur | Deskripsi |
|---|---|
| **ROI Calculator** | Form interaktif, kalkulasi real-time, download PDF (public, no auth) |
| **Battle Cards** | Grid kartu kompetitor, expand detail |
| **Short Links** | Generate short link + UTM, click tracking |

### Phase 5 — Team Ops

| Fitur | Deskripsi |
|---|---|
| **Team Task Board** | Kanban 4 kolom (Todo → Done), assignee, priority |
| **Asset Library** | Upload/download file, thumbnail grid, filter |

---

## 4. Design Language

**Ikuti existing codebase** — Tailwind 4, dark mode via `useTheme()`, lucide-react icons, pattern yang sudah ada di `Sidebar.jsx` dan `ServerCard.jsx`.

- Font: system font (existing)
- Color: gunakan CSS variable existing (`--primary`, dsb) — jangan bikin warna baru
- Component pattern: reuse `Modal.jsx`, `Button.jsx`, `Input.jsx`, `Badge.jsx` yang sudah ada
- No bare-minimum CSS — kalau perlu style baru, apply Tailwind class yang konsisten

---

## 5. Constraints

- **No breaking changes** ke fitur Infrastructure existing
- **Backward compatible** — existing user tetap bisa login dan pakai seperti biasa
- **Mobile responsive** — layout harus usable di tablet (768px+)
- **Dark mode** — semua halaman baru harus support dark/light theme

---

## 6. Out of Scope (Phase 1-5)

- Approval workflow
- AI content generation
- Email sending integration (kirim email beneran)
- Public ROI calculator embed
- Finance / HR workspace
- Notification system (Telegram/Discord)

---

## 7. Acceptance Criteria

### Workspace Switcher
- [ ] Tab "Infrastructure" dan "Marketing & Sales" tampil di header
- [ ] Klik tab = sidebar berubah sesuai workspace
- [ ] User tanpa akses marketing di-redirect kalau coba akses `/marketing/*`
- [ ] Admin (`role=admin`) bisa switch ke kedua workspace

### Lead Tracker
- [ ] Tabel menampilkan semua leads dengan column: Company, Contact, Source, Status, Value, Last Update
- [ ] Filter by status dan source berfungsi
- [ ] Search by company name berfungsi
- [ ] Add lead via modal → data tersimpan di DB
- [ ] Edit lead via modal → data ter-update
- [ ] Delete lead → data dihapus dari DB
- [ ] Status badge color-coded (New=blue, Won=green, Lost=red, dll)
- [ ] Sort by column berfungsi

### Marketing Dashboard
- [ ] 3 stat cards: Total Leads, Pipeline Value (sum of lead values), Conversion Rate (Won/Total)
- [ ] Donut/bar chart: Leads by Source
- [ ] Data update real-time saat lead berubah

### General
- [ ] Dark mode toggle berfungsi di semua halaman baru
- [ ] Semua API return proper HTTP status (200, 201, 400, 404)
- [ ] Error handling: toast notification kalau API error
- [ ] Loading state saat fetch data
- [ ] Empty state kalau belum ada data
