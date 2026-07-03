# Changelog — Server Access Portal AST

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
