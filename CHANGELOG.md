# Changelog — Server Access Portal AST

## v2.2.0 — Chat Room Management & Announcement Badge (2026-07-14)

### 💬 Chat Room Management
- **Create chat room** — Admin dan staff bisa buat room chat baru dengan nama custom
- **Room list UI** — "+" button di sidebar channel untuk buat room baru
- **Create room modal** — Input nama room dengan validasi
- **Backend API** — `POST /api/chat/rooms` untuk create, `DELETE /api/chat/rooms/:id` untuk delete
- **Database table** — `chat_rooms` table untuk menyimpan custom rooms

### 🔔 Announcement Notification Badge
- **Badge di sidebar** — Badge merah dengan jumlah pengumuman baru di menu "Pengumuman"
- **Persistent state** — Badge menggunakan `localStorage` untuk track sudah pernah dilihat atau belum
- **Auto-reset** — Badge hilang setelah user buka halaman Pengumuman
- **Session-aware** — Badge muncul lagi saat user logout/login ulang

### 🐛 Bug Fixes
- **Typing indicator username** — Fix `userName` vs `username` mismatch antara backend Socket.IO dan frontend
- **Typing indicator array handling** — Fix TypingIndicator component untuk handle both array dan string input
- **Forum `0` rendering** — Fix `{!!topic.is_locked && ...}` untuk prevent integer `0` appearing as text
- **Forum permissions** — Non-admin users hanya bisa reply, tidak bisa hapus thread/reply
- **403 error for non-admin** — Fix `ServerContext` yang memanggil logs API untuk semua user

### 🎨 UI Improvements
- **Unified Dashboard** — Staff dan admin view sama (stats cards, ping latency, credential reveal)
- **Remove pulse animation** — Hapus animasi kedip-kedip dari server card logos
- **Rounded corners** — Tambah rounded corners di chat page container
- **Dark mode announcements** — AnnouncementCard dengan proper dark mode styling

---

## v2.1.0 — Portal Refactor & Activity Logging (2026-07-05)

### 🔐 Built-in Credential Management
- **Inline credential reveal** — Lock icon di setiap server card untuk lihat credentials
- **Credential modal** — popup dengan username, password (toggle show/hide), copy buttons
- **Activity logging** — setiap buka server atau lihat credentials dicatat di activity_logs
- **AES-256 encryption** — credentials disimpan terenkripsi di database
- **Admin only** — credential reveal hanya untuk admin users

### 📊 Activity Logging System
- **`server_access` logging** — dicatat setiap kali user klik "Buka Server"
- **`credential_access` logging** — dicatat setiap kali user klik Lock icon
- **API endpoint** — `POST /api/logs/activity` untuk frontend logging
- **Frontend integration** — `api.logActivity()` helper di services/api.js

### 🧹 Feature Cleanup
- **Remove Health Monitoring** — hapus health check service, alerts, health history modal
- **Remove Server Notes** — hapus ServerNotesModal, ServerNotesLogModal
- **Remove Connection History** — hapus connection_logs table dan history page
- **Simplified codebase** — kurang lebih 900+ baris kode dihapus

### 🔧 Technical Changes
- **Fix SQLite datetime error** — `datetime("now")` → JavaScript Date format
- **ServerCard component** — unified component dengan credentials modal
- **Role-based sidebar** — staff vs admin navigation yang berbeda
- **Dashboard inline cards** — server cards dirender langsung di Dashboard
- **Remove Resource system** — ResourceCard, ResourceGrid, ResourceContext dihapus
- **Update ActivityLogs page** — support filter untuk action types baru

### ⚠️ Breaking Changes
- **Server Notes & Health features removed** — upgrade memerlukan pengecekan kompatibilitas
- **Connection history tidak tersedia** — data lama tidak bisa diakses

---

## v2.0.0 — Resource Gateway & Full Dashboard Redesign (2026-07-05)

### 🧹 Feature Cleanup (Task 1-3)
- **Hapus Health Monitoring & Alerts** — hapus `routes/health.js`, `routes/alerts.js`, `AlertBell.jsx`, `HealthHistoryModal.jsx`, tabel `server_uptime_history` & `alerts` dari DB
- **Hapus Server Notes** — hapus `ServerNotesModal.jsx`, `ServerNotesLogModal.jsx`, `routes/notes.js`
- **Hapus Connection History** — hapus `ConnectionHistory.jsx`, `routes/connections.js`, tabel `connection_logs`

### 🔐 Resource Gateway — Merge ke Server
- **Tambah kolom credential** — `shared_username`, `shared_password_encrypted`, `auto_login_enabled` di tabel `servers`
- **Tabel baru `server_assignments`** — untuk assign server ke user/role
- **Hapus Resource concept** — hapus `ResourceContext`, `ResourceCard`, `ResourceGrid`, `ResourceManager`, `routes/resources.js`
- **Credential endpoints** — `GET /api/servers/:id/credentials`, assignment CRUD
- **AES-256 encryption** — password server terenkripsi di database
- **Auto-login helper** — inject credentials ke URL/RDP saat buka server

### 🚀 Dashboard Dual-Mode + Card Redesign
- **Staff view** — grid server cards dengan credential reveal, copy, dan ping
- **Admin view** — server cards modern dengan gradient glow, ping badge, credential lock
- **Ping latency** — auto-fetch ping tiap server dengan warna: hijau <100ms, kuning 100–300ms, merah >300ms
- **Filter dropdowns** — filter by category & status langsung di dashboard
- **Logo upload** — upload file gambar untuk logo per server (preview di form + card)
- **Loading/skeleton** — animated placeholder saat loading data
- **Responsive grid** — 1/2/3 column sesuai viewport

### 📊 Activity Logs Enhancement
- **Server access logging** — setiap klik "Buka Server" tercatat di `activity_logs`
- **Credential access logging** — setiap reveal credentials tercatat dengan action `credential_access`
- **Logging via backend** — `/api/open` endpoint auto-log ke database
- **Filter baru** — filter `server_access` dan `credential_access` di Activity Logs page
- **Color codes** — purple untuk server_access, orange untuk credential_access
- **Kolom `metadata`** — tambah kolom metadata ke `activity_logs` untuk data tambahan

### 🧭 Role-Based Sidebar Navigation
- **Split navItems** — general nav (Dashboard, Online Users) vs admin nav (Servers, Users, Activity Logs, Settings)
- **Admin section** — hanya muncul jika `isAdmin === true`
- **Section label** — "Admin" dengan visual separator
- **Hapus Sidebar lama** — hapus `src/components/Sidebar.jsx`, layout pake yang di `layout/`

### 🖥️ AdminServers Enhancement
- **Credential form** — username + password fields + auto-login toggle di form modal
- **File upload logo** — base64 preview langsung di form
- **Assign button + modal** — assign server ke user (diganti dengan visible_to per divisi)
- **Hapus unused toggles** — remove assign, notes, log buttons dari table actions

### 🕐 Online Users — Compact Mode
- **Compact mode** — avatar + name + time, max 5 users
- **Fix NaN error** — proper timestamp validation di `formatLastActivity`
- **Auto-refresh** — every 30 detik di kedua mode

### 🔧 Teknis
- **Backend** — `requireAdmin` middleware, endpoint credentials/assignments di `servers.js`
- **Database** — migrations otomatis untuk kolom baru, tabel `server_assignments`
- **Build clean** — 0 error production build (Vite)
- **CHANGELOG** — dokumentasi lengkap semua perubahan

---

## v1.7.0 — Server Grouping (2026-07-04)

### 📁 Server Groups
- **Group management** — organize servers into logical groups
- **Group properties** — name, description, color, icon
- **Many-to-many relationships** — servers can belong to multiple groups
- **Group API endpoints**:
  - `GET /api/groups` — list all groups with server counts
  - `GET /api/groups/:id` — get group with members
  - `POST /api/groups` — create new group
  - `PATCH /api/groups/:id` — update group
  - `DELETE /api/groups/:id` — delete group (cascade removes members)
  - `POST /api/groups/:id/members` — add server to group
  - `DELETE /api/groups/:id/members/:serverId` — remove server from group
  - `GET /api/groups/server/:serverId` — get all groups a server belongs to

### 🎨 Server Groups UI
- **Groups page** (`/groups`) — grid view of all groups with server counts
- **Create/Edit modal** — form with name, description, color picker
- **Group details modal** — shows all servers in group
- **Remove servers** — from group details modal
- **Color-coded cards** — custom color for each group icon
- **Sidebar navigation** — new "Groups" link with folder icon

### 🗄️ Database Schema
- **`server_groups` table** — stores group metadata
- **`server_group_members` table** — junction table for many-to-many relationship
- **Indexes** — optimized queries on `group_id`, `server_id`
- **Cascade deletes** — removing group deletes memberships, not servers

---

## v1.6.0 — Quick Connect & Connection History (2026-07-04)

### ⚡ Quick Connect
- **Keyboard shortcut** — Ctrl+K / Cmd+K opens quick connect modal
- **Recent servers** — shows last 10 accessed servers with frecency scoring
- **Frecency algorithm** — frequency + recency weighted by exponential decay
- **Search filter** — search by name, IP, category
- **One-click connect** — select server to connect immediately
- **Connection logging** — tracks every server access with timestamp
- **Connection stats** — shows connection count & last connected time

### 📜 Connection History
- **History page** (`/connection-history`) — full chronological log of connections
- **Stats cards**:
  - Total connections count
  - Unique servers count
  - Current page count
- **History table** — shows time, server, IP, environment, category, status
- **Pagination** — 50 entries per page with prev/next controls
- **Time formatting** — human-readable timestamps (MMM DD, YYYY HH:MM)
- **Sidebar navigation** — new "History" link with clock icon

### 🗄️ Database Schema
- **`connection_logs` table** — stores connection events
- **Indexes** — optimized queries on `user_id + server_id + connected_at`
- **Auto-logging** — every `openServer()` call logs to backend

### 🔌 API Endpoints
- **`POST /api/connections/log`** — log connection event
- **`GET /api/connections/recent`** — get recent servers with frecency score (limit param)
- **`GET /api/connections/history`** — get full history with pagination (limit, offset params)

---

## v1.5.0 — Health Monitoring & Alerts (2026-07-04)

### 🏥 Health Monitoring System
- **Background health checker** — auto-check all active servers every 2 minutes
- **Uptime history tracking** — stores status, latency, errors in `server_uptime_history` table
- **Server state tracking** — `last_checked_at`, `latency_ms` columns added to servers table
- **Health API endpoints**:
  - `GET /api/health/history` — fetch check history (filterable by server, time range)
  - `GET /api/health/uptime` — uptime percentage, avg/min/max latency stats
  - `POST /api/health/check/:serverId` — trigger immediate health check

### 🔔 Alert System
- **Automated alerts** — detects server down, recovery, high latency events
- **Alert types**: `down` (server unreachable), `recovery` (back online), `latency` (>1000ms)
- **Alert persistence** — `alerts` table with read/resolved status tracking
- **Alert API endpoints**:
  - `GET /api/alerts` — fetch alerts (filter by unread, server)
  - `PATCH /api/alerts/:id/read` — mark as read
  - `PATCH /api/alerts/:id/resolve` — mark as resolved
  - `POST /api/alerts/mark-all-read` — bulk mark all as read
  - `DELETE /api/alerts/:id` — delete alert

### 🔔 Alert Bell Component
- **Real-time notification bell** in header with unread count badge
- **Auto-refresh** every 30 seconds
- **Dropdown panel** — shows recent alerts with icons (down/recovery/latency)
- **Actions** — mark as read, delete, mark all as read
- **Time formatting** — relative timestamps (e.g., "5m ago", "2h ago")

### 📊 Health History Modal
- **Per-server health dashboard** — accessible via Activity icon in ServerCard
- **Time range selector** — 7, 14, 30 days
- **Stats cards**:
  - Uptime percentage
  - Total checks performed
  - Average latency
  - Offline count
- **History table** — chronological list of all checks with status, latency, errors
- **Glassmorphism design** — matches v1.4.0 UI style

### 🗄️ Database Migrations
- **`server_uptime_history` table** — stores historical health checks
- **`alerts` table** — stores notifications with read/resolved tracking
- **`servers` columns** — added `last_checked_at`, `latency_ms`
- **Indexes** — optimized queries on `server_id + checked_at`, `is_read + is_resolved`

### 🔧 Backend Services
- **`healthCheck.js`** — background service with 2-min interval
- **Auto-start** — health checker starts with backend server
- **Smart alerting** — only creates alerts on state transitions (online→offline, recovery, latency spikes)

### 🎨 UI Enhancements
- **ServerCard** — added Activity button for health history modal
- **Header** — integrated AlertBell component between theme toggle and user dropdown
- **Responsive design** — modal works on mobile/tablet

---

## v1.4.0 — UI Redesign (Glassmorphism & Modernization)

### 🎨 UI Redesign — Full Visual Overhaul
- **Glassmorphism theme** — backdrop-blur, translucent backgrounds di sidebar, header, cards, login
- **Gradient accents** — indigo→purple→pink gradients pada buttons, icons, avatar badges
- **Micro-interactions** — glow, float, scale animations pada hover/active states
- **Bolder typography** — font-black/font-bold vs font-medium, tighter tracking
- **Enhanced shadows** — colored shadows (indigo, emerald, red), larger blur radius

### 📊 Dashboard
- **KPI cards** — glass-card style, gradient icon backgrounds, hover lift + shadow
- **Health bar** — larger sizing, gradient progress fill
- **Search & filters** — solid bg (no glass on form elements), custom chevron arrow, better focus states
- **Header** — larger gradient text, enhanced online badge with ping animation

### 🖥️ ServerCard
- **Glass card** — backdrop-blur, gradient top accent animated on hover
- **Gradient icon backgrounds** — glow shadows, bolder CTAs
- **Connection info** — gradient backgrounds, enhanced latency badges

### 🔑 Login
- **Animated floating orbs** — gradient background decorations
- **Glass card form** — thicker borders, gradient submit button
- **Enhanced inputs** — ring focus states, glass effect

### 📋 Sidebar
- **Glass sidebar** — rounded-3xl, glass-card with backdrop-blur
- **Gradient logo** — glow animation, centered when collapsed
- **Nav items** — gradient backgrounds (indigo→purple) on active, centered icons when collapsed
- **User profile** — centered avatar when collapsed, gradient background
- **Online indicator** — gradient + glow badge

### 🏠 Header
- **Glassmorphism** — backdrop-blur, translucent background
- **Colored hover** — indigo refresh, amber theme toggle
- **User dropdown** — gradient header section, glass-card menu

### 🐛 Bug Fixes
- **Filter dropdowns** — replaced broken `glass` class on `<select>`/`<input>` with solid `bg-white dark:bg-white/10`
- **Sidebar collision** — fixed layout margin overlap (sidebar ↔ header) with proper gap (20px expanded, 16px collapsed)
- **Nav icons** — centered in background when sidebar collapsed (justify-center + px-2)
- **User avatar** — centered in background when sidebar collapsed (justify-center + p-2)
- **Logo icon** — centered in sidebar when collapsed (ml-1 offset adjustment)

### 🔧 Layout
- **Layout spacing** — `lg:ml-[272px]` expanded, `lg:ml-[100px]` collapsed (20px/16px gap from sidebar)
- **Main padding** — `pb-12` for better bottom spacing

---

## v1.3.0 — Online Users Indicator

### 👥 Online Users (Fitur Baru)
- **Real-time online users counter** di sidebar (semua user)
- **Auto-refresh 30 detik** — indikator jumlah user yang aktif
- **Click to view details** — indikator di-click untuk ke halaman detail
- **Sidebar indicator** — hijau, pulsing, langsung kelihatan
- **Akses berbeda per role:**
  - Admin → `/admin/online-users` (dengan Force Logout)
  - Staff → `/online-users` (view only, tanpa Force Logout)

### 📊 Online Users Page
- **Halaman detail** — list semua user online
- **User cards** — nama, email, role, divisi, last activity
- **Force logout** (admin only) — invalidasi token user dengan 1 klik
- **Auto-revert** — user otomatis offline setelah 5 menit tidak ada aktivitas

### 🛡️ Activity Tracking
- **Last activity tracking** — kolom `last_activity_at` di tabel users
- **Unix timestamp (ms)** — akurat timezone, tidak ambiguity
- **Token versioning** — force logout invalidate semua token lama
- **Throttled touch** — update aktivitas max 1x per menit per user
- **Impersonation support** — kolom `impersonated_by`, `impersonation_expires_at`

### 🎨 UI Updates
- **Hapus status indicator di header** — tidak perlu info server online di header
- **Sidebar online indicator** — hijau, pulsing, langsung kelihatan

### 🗄️ Database
- Kolom baru `last_activity_at` (Unix ms) — timestamp aktivitas terakhir
- Kolom baru `token_version` (INTEGER) — untuk force logout
- Kolom baru `impersonated_by` (INTEGER) — untuk impersonation
- Kolom baru `impersonation_expires_at` (TEXT) — expiry impersonation
- Index `idx_users_last_activity` — untuk query online users

### ⚙️ Teknis
- `GET /api/users/online` — accessible by all authenticated users
- `POST /api/users/:id/force-logout` — admin only
- `middleware/auth.js` — activity touch + token version check
- `services/auth.js` — token_version di JWT payload
- Fix route order untuk `/online` vs `/:id`
- Lazy-load ENCRYPTION_KEY untuk avoid ES module import error
- Fix duplicate `/online` route yang ngeblok admin routes
- Fix timestamp timezone dengan Unix ms

---

## v1.2.0 — Server Notes & Credentials, Auth Fixes

### 🔐 Server Notes & Credentials (Fitur Baru)
- **Catatan per-server** — kredensial, port, lisensi, owner, link dokumentasi terpusat
- **Enkripsi AES-256-GCM** — password di-encrypt di DB, hanya admin yang bisa akses
- **Auto-hide password 30 detik** — saat reveal password, otomatis hidden setelah 30s
- **Confirm 2-klik** — tombol simpan perlu 2 klik untuk mencegah kesalahan
- **Multi-select user dropdown** — admin bisa atur user non-admin siapa saja yang boleh lihat catatan
- **Audit trail terpisah** — `credential_access_logs` (tidak ikut retensi 7 hari)
- **ServerNotesModal** — UI modal editor catatan dengan show/hide/copy password
- **ServerNotesLogModal** — audit log viewer per server

### 👥 Akses Kontrol Catatan
- **Admin** — bisa lihat + edit semua catatan
- **Staff di `visible_to`** — bisa lihat (read-only) kalau email tercantum
- **Staff lain** — dapet "Access Denied! Contact Your Administrator."
- **Tombol Lock di ServerCard** — semua user bisa lihat 🔒, tapi akses di-filter backend

### 🛡️ Perbaikan Auth & Login
- **Fix login crash** — try/catch di route login, gak crash walau AD timeout
- **Role tidak di-override** — role user AD gak diubah tiap login (hanya lewat Sync AD)
- **Fix staff login** — user `staff@portal.local` sudah ada di DB

### 🗄️ Database
- Tabel baru `server_notes` — catatan + kredensial terenkripsi per server
- Tabel baru `credential_access_logs` — audit trail akses kredensial
- Kolom `visible_to` di `server_notes` — atur siapa yang boleh lihat
- Migration otomatis untuk existing DB (ADD COLUMN if not exists)

### ⚙️ Teknis
- `backend/services/encryption.js` — AES-256-GCM encrypt/decrypt
- `backend/routes/notes.js` — 5 endpoint API (GET/PUT notes, audit, logs)
- `backend/.env.example` — template untuk ENCRYPTION_KEY
- `dotenv` — load .env otomatis di server.js
- Fix port 81 CORS — tambah origin di cors config

---

## v1.1.0 — Restore Database, Role Count Fix & Division Preservation

### ♻️ Database Restore (Baru!)
- **Restore via Settings UI** — tombol Restore (↺) di setiap item backup di Settings → Backup
- **Konfirmasi destruktif** — modal konfirmasi dengan peringatan data akan ditimpa
- **Safety backup otomatis** — sebelum restore, DB saat ini di-backup ke `backups/pre-restore-*.sqlite`
- **Endpoint API** — `POST /api/backup/restore` dengan autentikasi admin
- **DB reconnect otomatis** — tanpa perlu restart manual server

### 🔧 Perbaikan Hitungan Role
- **Fix role count** — jumlah user per role di halaman Admin → Roles sekarang akurat
- Sebelumnya: Staff=0, Admin=1 (hitung dari tabel `user_roles` yang sudah lama tidak diisi)
- Sekarang: hitung langsung dari `users.role` — sumber kebenaran yang sebenarnya
- **Fix hapus role** — proteksi hapus role juga diperbaiki (cek dari `users.role`)

### 🛡️ Division Preservation
- **Division tidak hilang setelah Sync AD** — divisi yang sudah diatur manual tetap dipertahankan saat re-sync AD
- User AD baru yang belum pernah diset divisinya tetap kosong (default)
- Fix di `backend/routes/ad.js` — simpan division sebelum DELETE, pulihkan saat INSERT

---

## v1.0.0 — Backup, Ping & Settings Overhaul

### 🗄️ Database Backup
- **Manual Backup** — klik "Backup Sekarang" untuk backup database SQLite
- **Auto Backup** — backup otomatis dengan jadwal (hourly/daily/weekly)
- **Retensi Backup** — hapus otomatis backup lebih dari N hari
- **History Backup** — lihat daftar, download, dan hapus file backup
- **Backup via API** — endpoint `/api/backup/*` dengan autentikasi admin
- Backup disimpan di `backend/backups/` dalam format `.sqlite` + metadata `.json`

### 📡 Server Ping / Latency
- **ICMP Ping** — ping ke IP server untuk cek latency (fallback TCP jika ICMP diblokir)
- **Auto-refresh 10 detik** — latency ter-update otomatis tiap 10 detik
- **Latency Indicator** — warna indikator: 🟢 <30ms, 🟡 <80ms, 🔴 >=80ms
- **Endpoint API** — `POST /api/status/latency/:id` untuk ping per-server

### ⚙️ Settings Page — Tab-based Layout
- **6 Tab Navigasi**: Umum, Data, Monitoring, Integrasi, Backup, Keamanan
- **Umum** — Portal name, Icon/Logo, Appearance (theme, items/page)
- **Data** — Kategori Server & Divisi management
- **Monitoring** — Status Check toggle & interval
- **Integrasi** — Active Directory config (URL, Base DN, Service Account, LDAP filters)
- **Backup** — Manual backup, auto backup schedule, backup history
- **Keamanan** — Session timeout, Max login attempts

### 🐞 Fixes
- Dropdown select option text color fix untuk dark mode readability
- Session timeout diubah ke 5 menit (default 120)
- missing export checkServerHttp/checkServerTcp di statusCheck.js

---

## v0.9.0 — AD User & Group Query Settings

### 🛠️ Features
- **Configurable AD User Filter** - edit LDAP query untuk filter user yang boleh login
- **Configurable AD Group Filter** - edit LDAP query untuk menentukan role user
- **Settings UI Enhancement** - section "Advanced: User & Group Query" yang collapsible
- **Backend API Update** - `/api/ad/config` sekarang support `userFilter` dan `groupFilter`

### 🎨 UI Improvements
- Consistent dark mode styling di Settings page
- Toggle switch untuk Enable AD
- Collapsible advanced section dengan info tooltip
- Modern card-based layout

---

## v0.8.0 — Modern UI Redesign

### 🎨 UI/UX Overhaul
- **Modern Design System** dengan color palette baru (Indigo/Purple accent)
- **Consistent Light & Dark Mode** - semua komponen support dual-mode dengan styling yang proper
- **Enhanced Animations** - fade-in, stagger, hover effects yang smooth
- **Improved Card Design** - gradient accents, hover glow, top accent lines
- **Status Badge Redesign** - animated pulse untuk online status, consistent sizing
- **Modern Form Components** - better spacing, rounded-xl, focus states
- **Professional Login Page** - cleaner layout dengan icon indicators
- **Enhanced User Management Modal** - proper form layout dengan custom toggle switch

### 🎯 Component Updates
- **Sidebar** - clean dual-mode support, active state indicator
- **Header** - glass morphism effect, status badge styling
- **Dashboard** - KPI cards dengan accent lines, health bar, better visual hierarchy
- **ServerCard** - hover effects, gradient borders, connection status styling
- **Login** - modern form dengan icon prefix, gradient button
- **AdminUsers** - professional modal dengan header, toggle switch, proper spacing

### 📱 Design Improvements
- Consistent border-radius (`rounded-xl`, `rounded-2xl`)
- Proper spacing system dengan `space-y-*` dan padding
- Better shadow/elevation hierarchy
- Color consistency dengan CSS variables-like approach
- Responsive breakpoints yang lebih clean

---

## v0.7.0 — UI Redesign & Filter Overhaul

### 🎨 UI/UX Overhaul
- Dark SaaS modern theme (charcoal base, glassmorphism)
- Light/dark mode fix &mdash; semua komponen support `dark:` prefix
- Header title + online badge center
- Logo custom di halaman login, header, sidebar, dan favicon
- Dropdown filter di dashboard jadi inline row (search bar + select)
- Halaman Roles jadi panel kiri-kanan (daftar role + detail permission)
- Buttons & tables hover fix di dark mode
- Login page tanpa auto-fill credentials
- Animasi & micro-interactions (fade-in, pulse online dot)

### 🛠️ Features
- Username support untuk login (pakai email atau username)
- Kolom Divisi di Profile (read-only oleh admin)
- Edit username sendiri di Profile
- Auto-logout setelah 5 menit idle (dengan warning 30 detik)
- `visible_to` scoping — server per divisi
- Favicon & logo upload via Settings

### 🔧 Backend
- AD/LDAP login dengan group filter + sync
- AD user auto-create & auto-remove (sync)
- Route public `/api/upload/icon` untuk favicon
- Fix TLS bypass untuk status check intranet
- No auto-seed demo servers

### 📦 Deployment
- `SETUP.md` — panduan instalasi, rollback, ubah port, akses jaringan
- `CHANGELOG.md` — riwayat perubahan

---

## v0.6.0 — Active Directory + Custom Fields
- Login via AD/LDAP dengan group role mapping
- Sync AD users ke tabel users
- Exclude service accounts (access.server, nextcloud)
- Custom fields: Divisi (dropdown), Kategori (dropdown)
- Export CSV dengan token JWT
- Status check untuk ESXi 77 & 78, Nextcloud, Kaseya

## v0.5.0 — User Management & Profile
- CRUD Users dengan dropdown Divisi & Role langsung
- Upload custom icon/browser favicon
- Ganti password sendiri di Profile
- Open SSH langsung, RDP via .rdp, HTTP via browser (Firefox support)
- Auto idle logout 5 menit

## v0.4.0 — Status & Sync
- Status check service (HTTP/TCP/health endpoint)
- Artisan-style checker via API
- Sync AD users dari Active Directory
- Divisi per user + visible_to per server

## v0.3.0 — Roles & Settings
- Role CRUD + permission management
- Settings page (Appearance, Security, Status Check)
- DB Browser via web UI

## v0.2.0 — Dashboard & Servers
- Dashboard dengan card server, search, filter
- Server CRUD (admin)
- Status badge (online/offline/unknown)
- Dark mode toggle
- Open Server + Copy IP
- RDP, SSH, HTTP/HTTPS protocol support

## v0.1.0 — Foundation
- React + Vite + Tailwind frontend
- Express + SQLite + JWT backend
- Login/logout + role-based access
- Dashboard + Admin panels
- Seed database users & settings
