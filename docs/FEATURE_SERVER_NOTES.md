# Feature Plans — Server Access Portal AST

**Status:** 📝 Design (belum di-implement)
**Target:** v1.2.0 – v1.3.0

Dokumen ini berisi rencana implementasi untuk beberapa fitur. Setiap fitur independen tapi sebagian saling melengkapi (mis. #1 dan #2 sama-sama pakai audit log).

| # | Fitur | Effort | Status |
|---|---|---|---|
| 1 | [Server Notes & Credentials](#1%EF%B8%8F%E2%83%A0-server-notes--credentials) | 4-6 jam | 📝 Design |
| 2 | [Login sebagai User (Admin Impersonation)](#2%EF%B8%8F%E2%83%A0-login-sebagai-user-admin-impersonation) | 4-5 jam | 📝 Design |
| 3 | [List User Online di Admin Panel](#3%EF%B8%8F%E2%83%A0-list-user-online-di-admin-panel) | 2-3 jam | 📝 Design |
| 4 | [Search Bar Global (Ctrl+K)](#4%EF%B8%8F%E2%83%A0-search-bar-global-ctrlk) | 3-4 jam | 📝 Design |
| 5 | [Server Maintenance Mode](#5%EF%B8%8F%E2%83%A0-server-maintenance-mode) | 3-4 jam | 📝 Design |

**Demo:** `../../server-notes-demo/` (static HTML preview untuk fitur #1 — catatan server + modal)

**Fitur #1 confirmed answers:**
- ssh_port=22, vsphere_port=443 ✅
- Auto-hide 30 detik ✅
- Confirm 2-klik ✅
- Retensi log kredensial 7 hari (tabel terpisah `credential_access_logs`) ✅
- Notifikasi Telegram saat admin akses kredensial → ❌ belum perlu (todo future)

---

## 1️⃣ Server Notes & Credentials

### 🎯 Tujuan & Masalah yang Diselesaikan

**Masalah:**
- Admin/password server tersimpan di chat/email/notepad — sulit dicari
- Tidak ada tracking siapa yang pernah akses kredensial sensitif
- Lisensi software lupa expire sampai telat bayar
- Onboarding karyawan baru lambat — harus tanya-tanya
- Tidak ada sentralisasi dokumentasi server (URL dashboard, port, dsb)

**Tujuan:**
- Setiap server punya catatan internal terpusat (kredensial, port, maintenance, lisensi, link)
- Password di-encrypt di database, hanya admin yang bisa akses
- Audit trail lengkap untuk akses/view/copy kredensial
- Auto-hide password (timer) saat ditampilkan di UI
- Onboarding lebih cepat — admin baru tinggal buka catatan

### 👥 Akses Kontrol

| Role | Bisa Lihat? | Bisa Edit? | Bisa Audit? |
|---|---|---|---|
| **Admin** | ✅ Ya (password di-decrypt) | ✅ Ya | ✅ Ya (lihat siapa akses) |
| **Staff** | ❌ Tidak — endpoint return 403 | ❌ Tidak | ❌ Tidak |

Catatan server adalah fitur **admin-only**. Staff tidak boleh tahu kredensial — itu untuk eskalasi ke admin kalau butuh akses.

### 🗄️ Database Schema

#### Tabel baru: `server_notes`

```sql
CREATE TABLE IF NOT EXISTS server_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL UNIQUE REFERENCES servers(id) ON DELETE CASCADE,

  -- Kredensial (password encrypted)
  default_username TEXT DEFAULT '',
  default_password_encrypted TEXT DEFAULT '',  -- format: iv:tag:ciphertext (hex)
  ssh_port INTEGER DEFAULT 22,
  vsphere_port INTEGER DEFAULT 443,

  -- Catatan bebas
  notes TEXT DEFAULT '',

  -- Lisensi & ownership
  license_key TEXT DEFAULT '',
  license_expire TEXT DEFAULT '',  -- ISO date 'YYYY-MM-DD'
  owner TEXT DEFAULT '',

  -- Link dokumentasi (JSON array string)
  documentation_links TEXT DEFAULT '[]',  -- e.g. '["https://...","https://..."]',

  -- Audit timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_server_notes_server_id ON server_notes(server_id);
```

#### Tabel baru: `credential_access_logs`

Log akses kredensial **disimpan terpisah** dari `activity_logs` agar tidak ikut terhapus retensi 7 hari.

```sql
CREATE TABLE IF NOT EXISTS credential_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('view', 'copy')),
  ip_address TEXT,
  user_agent TEXT DEFAULT '',
  accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cred_access_server ON credential_access_logs(server_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cred_access_user ON credential_access_logs(user_id, accessed_at DESC);
```

#### Catatan Penting

- **`UNIQUE(server_id)`** — one-to-one. Tidak ada multiple catatan per server.
- **`ON DELETE CASCADE`** — kalau server dihapus, catatannya hilang.
- **JSON in TEXT** — SQLite tidak punya native JSON, pakai TEXT dengan JSON.stringify/parse di app layer.
- **Encryption format** — `iv:tag:ciphertext` semua hex, dipisah `:`. Self-contained, gak butuh key index.

### 🔐 Enkripsi (AES-256-GCM)

#### File: `backend/services/encryption.js` (baru)

```js
import crypto from 'crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error('ENCRYPTION_KEY env var must be 64 hex chars (32 bytes)');
}
const KEY = Buffer.from(KEY_HEX, 'hex');
const ALG = 'aes-256-gcm';

/**
 * Encrypt plaintext → return string format "iv:tag:ciphertext" (semua hex)
 */
export function encrypt(plaintext) {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/**
 * Decrypt payload "iv:tag:ciphertext" → return plaintext
 */
export function decrypt(payload) {
  if (!payload) return '';
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    if (!ivHex || !tagHex || !encHex) return '';
    const decipher = crypto.createDecipheriv(ALG, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('Decrypt failed:', err.message);
    return '';  // fail-safe: jangan crash, return empty
  }
}
```

#### Setup `ENCRYPTION_KEY`

Generate sekali, simpan di `.env` (jangan commit!):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6... (64 hex chars)
```

Tambah ke `backend/.env`:
```
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

**Penting:**
- Key HARUS sama antara backup & restore (kalau ganti key, password lama gak bisa di-decrypt)
- Simpan backup key di tempat aman (password manager, vault)
- Add ke `.gitignore` (jangan commit `.env`)

#### Migration Path untuk Existing DBs

Server yang sudah ada tanpa `server_notes`:
- ALTER TABLE migration: `CREATE TABLE IF NOT EXISTS server_notes (...)` — idempotent
- Default values untuk semua field, jadi `GET` endpoint selalu return object lengkap
- Tidak perlu backfill — catatan baru dibuat saat admin save

### 📡 Backend API

#### File: `backend/routes/notes.js` (baru)

Disarankan bikin **route baru** agar `servers.js` tetap clean.

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/servers/:id/notes` | admin | — | `{ notes: {...} }` (password decrypted) |
| `GET` | `/api/servers/:id/notes/safe` | admin | — | `{ notes: {...} }` (password MASKED) |
| `PUT` | `/api/servers/:id/notes` | admin | `{ defaultUsername, defaultPassword, sshPort, vspherePort, notes, licenseKey, licenseExpire, owner, docLinks }` | `{ message, notes: {...} }` |
| `POST` | `/api/servers/:id/notes/audit` | admin | `{ action: 'view' \| 'copy' }` | `{ message }` |
| `GET` | `/api/servers/:id/notes/logs` | admin | `?limit=50` | `{ logs: [...] }` |

**Kenapa 2 GET endpoint (`/notes` vs `/notes/safe`)?**
- Default GET → decrypt (untuk modal edit)
- `/notes/safe` → return `defaultPassword: '••••••••'` (untuk overview/list, kalau nanti ada dashboard widget)
- Frontend pilih mana yang dipakai

#### Route handler skeleton:

```js
// backend/routes/notes.js
import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { encrypt, decrypt } from '../services/encryption.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/servers/:id/notes — dengan password decrypted
router.get('/:id/notes', (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT id, name, ip_address FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  let notes = db.prepare('SELECT * FROM server_notes WHERE server_id = ?').get(req.params.id);
  if (!notes) {
    // Return empty default structure
    return res.json({
      notes: {
        serverId: server.id,
        defaultUsername: '',
        defaultPassword: '',
        sshPort: 22,
        vspherePort: 443,
        notes: '',
        licenseKey: '',
        licenseExpire: '',
        owner: '',
        docLinks: [],
      }
    });
  }

  // Decrypt password
  res.json({
    notes: {
      serverId: notes.server_id,
      defaultUsername: notes.default_username,
      defaultPassword: decrypt(notes.default_password_encrypted),
      sshPort: notes.ssh_port,
      vspherePort: notes.vsphere_port,
      notes: notes.notes,
      licenseKey: notes.license_key,
      licenseExpire: notes.license_expire,
      owner: notes.owner,
      docLinks: JSON.parse(notes.documentation_links || '[]'),
      updatedAt: notes.updated_at,
    }
  });
});

// PUT /api/servers/:id/notes — save/update
router.put('/:id/notes', (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const {
    defaultUsername = '',
    defaultPassword = '',
    sshPort = 22,
    vspherePort = 443,
    notes = '',
    licenseKey = '',
    licenseExpire = '',
    owner = '',
    docLinks = [],
  } = req.body;

  const encrypted = defaultPassword ? encrypt(defaultPassword) : '';
  const linksJson = JSON.stringify(Array.isArray(docLinks) ? docLinks : []);

  db.prepare(`
    INSERT INTO server_notes (
      server_id, default_username, default_password_encrypted,
      ssh_port, vsphere_port, notes, license_key, license_expire,
      owner, documentation_links, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(server_id) DO UPDATE SET
      default_username = excluded.default_username,
      default_password_encrypted = CASE WHEN excluded.default_password_encrypted = '' THEN default_password_encrypted ELSE excluded.default_password_encrypted END,
      ssh_port = excluded.ssh_port,
      vsphere_port = excluded.vsphere_port,
      notes = excluded.notes,
      license_key = excluded.license_key,
      license_expire = excluded.license_expire,
      owner = excluded.owner,
      documentation_links = excluded.documentation_links,
      updated_at = datetime('now')
  `).run(
    server.id, defaultUsername, encrypted,
    sshPort, vspherePort, notes, licenseKey, licenseExpire,
    owner, linksJson
  );

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'update', 'server_notes', ?, ?, datetime('now'))`)
    .run(req.user.id, `Update catatan server ID ${server.id}`, req.ip);

  res.json({ message: 'Catatan server disimpan' });
});

// POST /api/servers/:id/notes/audit — log akses kredensial + notifikasi
router.post('/:id/notes/audit', async (req, res) => {
  const { action } = req.body; // 'view' | 'copy'
  if (!['view', 'copy'].includes(action)) {
    return res.status(400).json({ error: 'Action harus view atau copy' });
  }
  const db = getDb();
  const server = db.prepare('SELECT id, name FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  // Simpan ke tabel terpisah agar tidak terhapus retensi 7 hari
  db.prepare(`
    INSERT INTO credential_access_logs (user_id, server_id, action, ip_address, user_agent, accessed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(req.user.id, server.id, action, req.ip, req.headers['user-agent'] || '');

  res.json({ message: 'Akses di-log' });
});

// GET /api/servers/:id/notes/logs — audit trail dari tabel terpisah
router.get('/:id/notes/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const db = getDb();
  const logs = db.prepare(`
    SELECT cal.id, cal.action, cal.ip_address, cal.accessed_at,
           u.name as user_name, u.email as user_email
    FROM credential_access_logs cal
    LEFT JOIN users u ON u.id = cal.user_id
    WHERE cal.server_id = ?
    ORDER BY cal.accessed_at DESC
    LIMIT ?
  `).all(req.params.id, limit);

  res.json({ logs: logs.map(l => ({
    id: l.id,
    user: l.user_name || 'Unknown',
    action: l.action,
    ip: l.ip_address,
    timestamp: l.accessed_at,
  }))});
});

export default router;
```

#### Mount di `server.js`:

```js
import notesRoutes from './routes/notes.js';
app.use('/api/servers', notesRoutes);  // routes mounted under /api/servers/:id/notes
```

### 🎨 Frontend

#### File baru: `src/components/ServerNotesModal.jsx`

Reuse pattern dari `ConfirmModal.jsx` (props: `open`, `onClose`).

**State lokal:**
- `draft` — object catatan yang sedang diedit
- `showPwd` — boolean (toggle reveal)
- `pwdRevealedAt` — timestamp untuk auto-hide timer
- `confirming` — boolean (2-klik konfirmasi save)
- `newLink` — input link baru

**Lifecycle:**
- `useEffect([pwdRevealedAt])` → `setTimeout(30000)` → hide password
- `useEffect` reset state on `server` prop change

**API calls:**
- `api.getServerNotes(serverId)` on open
- `api.updateServerNotes(serverId, draft)` on save
- `api.logServerNoteAccess(serverId, 'view' | 'copy')` on reveal/copy

**Toast notification:**
- Success: "Catatan disimpan"
- View: "Password ditampilkan. Aktivitas di-log di audit trail." (warning)
- Copy: "Password disalin. Aktivitas di-log di audit trail." (warning)

#### File modifikasi: `src/pages/admin/AdminServers.jsx`

- Import `ServerNotesModal`
- Tambah state `showNotesFor` (server object | null)
- Tambah state `showLogsFor`
- Tambah 2 button icon di kolom Actions:
  - `Activity` icon → `setShowLogsFor(server)` (audit log)
  - `Note` icon → `setShowNotesFor(server)` (catatan)
- Tambah 2 modal di akhir component

#### File modifikasi: `src/services/api.js`

```js
// Server Notes
getServerNotes: (id) => request(`/servers/${id}/notes`),
updateServerNotes: (id, data) => request(`/servers/${id}/notes`, { method: 'PUT', body: JSON.stringify(data) }),
logServerNoteAccess: (id, action) => request(`/servers/${id}/notes/audit`, { method: 'POST', body: JSON.stringify({ action }) }),
getServerNoteLogs: (id, limit) => request(`/servers/${id}/notes/logs${limit ? `?limit=${limit}` : ''}`),
```

### 📝 Catatan Teknis

#### Backup & Restore Compatibility

`server_notes` dan `credential_access_logs` table akan ter-include otomatis dalam backup SQLite (file copy). **TAPI** ada concern:

- `default_password_encrypted` di-encrypt dengan `ENCRYPTION_KEY` dari env var
- Kalau restore ke server dengan **key berbeda** → password gak bisa di-decrypt (return empty)
- Solusi: dokumentasikan bahwa `ENCRYPTION_KEY` harus ikut di-backup (via secret manager, encrypted vault, dll)
- `credential_access_logs` tidak ikut retensi 7 hari di server portal, tapi akan ikut ter-backup

#### Performance

- Single SELECT per modal open — fast (indexed by `server_id`)
- Decrypt hanya di-request (bukan default list endpoint)
- Tidak ada N+1 — endpoint khusus per server

#### Security

- `ENCRYPTION_KEY` tidak pernah di-log atau di-return ke client
- Password tidak pernah di-cache di frontend (selama 30 detik reveal saja)
- Clipboard: browser native, auto-clear tidak bisa di-guarantee (warning user)
- `view_credential` dan `copy_credential` di-log ke **tabel terpisah** (`credential_access_logs`) — tidak ikut retensi 7 hari

#### Edge Cases

- Server dihapus → `ON DELETE CASCADE` hapus `server_notes` dan `credential_access_logs`
- User non-admin akses endpoint → 403 (handled by `authorize('admin')`)
- Decrypt gagal (key berubah / corrupt) → return `''`, log error
- Save tanpa password (empty string) → keep existing encrypted value (per UPSERT logic)
- Save dengan password yang sama → di-encrypt ulang (new IV each time, tidak deterministic)
- `credential_access_logs` tidak dihapus oleh retensi 7 hari (tabel terpisah)
- Notifikasi Telegram saat akses kredensial → **belum di-implement** (todo future)

### 📋 Field Reference

| Field | Required | Tipe | Keterangan |
|---|---|---|---|
| `defaultUsername` | optional | string | Username default untuk login |
| `defaultPassword` | optional | string (encrypted) | Password default |
| `sshPort` | optional | int | Port SSH (default 22) |
| `vspherePort` | optional | int | Port HTTPS vSphere (default 443) |
| `notes` | optional | text | Catatan bebas (markdown-friendly) |
| `licenseKey` | optional | string | Software license key |
| `licenseExpire` | optional | date | Tanggal expire lisensi (YYYY-MM-DD) |
| `owner` | optional | string | Nama penanggung jawab |
| `docLinks` | optional | string[] | Array URL dokumentasi |

### ✅ Test Plan

#### Unit Test (manual via API)

1. **Encryption roundtrip:**
   ```bash
   node -e "import('./src/services/encryption.js').then(({encrypt, decrypt}) => {
     const a = encrypt('secret123');
     const b = decrypt(a);
     console.log(b === 'secret123' ? 'OK' : 'FAIL');
   })"
   ```

2. **PUT/GET roundtrip:**
   ```bash
   TOKEN=...
   curl -X PUT http://localhost:4000/api/servers/4/notes -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"defaultUsername":"root","defaultPassword":"Vm@ware2024!","notes":"Test note","docLinks":["https://example.com"]}'
   curl http://localhost:4000/api/servers/4/notes -H "Authorization: Bearer $TOKEN"
   # Harus return password plaintext "Vm@ware2024!"
   ```

3. **Access control:**
   ```bash
   STAFF_TOKEN=...
   curl http://localhost:4000/api/servers/4/notes -H "Authorization: Bearer $STAFF_TOKEN"
   # Harus return 403
   ```

4. **Audit log (tabel terpisah):**
   ```bash
   curl -X POST http://localhost:4000/api/servers/4/notes/audit -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"view"}'
   sqlite3 backend/portal.db "SELECT * FROM credential_access_logs WHERE server_id=4 ORDER BY id DESC LIMIT 1"
   # Harus ada entry baru di credential_access_logs
   # Tidak ada entry baru di activity_logs
   ```

#### Integration Test (UI)

1. Login as admin → buka Server Management → klik 📋 icon di ESXi 77
2. Modal muncul dengan data kosong (atau existing notes)
3. Isi semua field, klik Save → konfirmasi 2-klik → toast success
4. Refresh page → buka modal lagi → data persisted
5. Klik 👁 di password → password reveal + toast warning + auto-hide setelah 30s
6. Klik 📋 di password → password di clipboard + toast + audit log entry baru
7. Buka Activity icon (⚡) → audit log modal muncul dengan entry dari `credential_access_logs` (tabel terpisah dari activity_logs)
8. Login as staff → coba akses endpoint `GET /api/servers/:id/notes` → 403

#### Edge Cases

1. **ENCRYPTION_KEY hilang:** Server start error, return 500
2. **ENCRYPTION_KEY berubah:** Decrypt return empty, password field kosong di UI
3. **Save dengan password kosong:** UPSERT keep existing encrypted value
4. **Server dengan nama special chars (quotes, emoji):** NoSQL injection tidak applicable (prepared statements)

### 🔄 Migration Strategy

Untuk existing deployment dengan data user & server:

1. **Deploy code baru** — `CREATE TABLE IF NOT EXISTS` untuk `server_notes` dan `credential_access_logs` (idempotent)
2. **Set ENCRYPTION_KEY** di `.env` server — generate dulu via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Restart backend** — `server_notes` dan `credential_access_logs` table otomatis dibuat
4. **Communicate ke user:** "Fitur Catatan Server sudah aktif. Buka Server Management → klik icon 📋 untuk mulai."
5. **Notifikasi Telegram saat kredensial diakses** → belum di-implement (todo future)

No data migration needed — fitur ini additive, tidak mengubah schema existing.

**Backup/Restore:**
- `credential_access_logs` ikut ter-backup (bukan di-hapus retensi)
- `ENCRYPTION_KEY` HARUS sama saat restore — kalau beda, password lama tidak bisa di-decrypt

### 📊 Future Enhancements (di luar v1.2.0)

- 🔄 **Password rotation reminder** — cron job cek `updated_at` lebih dari 90 hari → notifikasi
- 📧 **License expiry reminder** — cron 30/7/1 hari sebelum `license_expire` → email/Telegram
- 🔐 **Password generator** — built-in strong password generator saat create notes baru
- 📋 **Password history** — track perubahan password per server (last 5)
- 🏷️ **Tags** — `["critical","prod","backup-weekly"]` untuk filter
- 👥 **Shared credentials** — 1 password untuk multiple servers (DRY)
- 🔁 **Integrasi Bitwarden/Vaultwarden** — push/pull dari password manager
- 📎 **File attachment** — upload PDF lisensi, dokumentasi ke `uploads/`
- 🔍 **Global search** — cari di semua notes (bukan cuma server name)
- 📱 **Mobile-friendly view** — modal responsive untuk HP admin
- 🌐 **Multi-language notes** — kalau perlu i18n untuk tim multi-bahasa

### ❓ Open Questions (untuk dikonfirmasi)

- [x] Default `ssh_port` = 22, `vsphere_port` = 443 — ✅ sesuai
- [x] Auto-hide 30 detik — ✅ cukup
- [x] Confirm modal 2-klik (amber "Klik lagi untuk konfirmasi") — ✅ perlu
- [x] Activity log retention — 7 hari, **kredensial access log disimpan terpisah agar tidak terhapus retensi**
- [x] Apakah perlu notifikasi kalau ada admin baru yang akses kredensial sensitif — ✅ iya

---

## 2️⃣ Login sebagai User (Admin Impersonation)

### 🎯 Tujuan & Masalah

**Masalah:**
- Admin harus tanya password user untuk troubleshoot ("kok user A bilang gak bisa klik tombol X?")
- Tidak bisa verify tampilan/settings user dari perspektif mereka
- Onboarding user baru lambat karena admin tidak bisa "menunjukkan" portal

**Tujuan:**
- Admin bisa login sebagai user lain tanpa password
- Semua aktivitas di-audit dengan jelas
- Auto-revert setelah 1 jam untuk keamanan

### 📋 Use Case
1. User complain "gak bisa akses menu X" → admin impersonate user itu → cek sendiri
2. User baru → admin test experience end-to-end
3. Compliance audit → cek apakah user tertentu abuse akses

### 🛡️ Aturan
- **Hanya admin** yang bisa impersonate
- Impersonate **admin lain** butuh konfirmasi ekstra (typed confirm)
- Impersonation **max 1 jam** (auto-revert)
- Setiap aksi saat impersonation → di-log sebagai `impersonated_action` dengan admin ID asli
- Password asli user **tidak pernah di-expose** ke admin

### 🗄️ Schema Update

Tambah 2 kolom ke tabel `users`:
```sql
ALTER TABLE users ADD COLUMN impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN impersonation_expires_at TEXT;
```

Persistent — gak hilang saat restart.

### 📡 Backend API

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/api/auth/impersonate/:userId` | admin | Login sebagai user lain |
| `POST` | `/api/auth/stop-impersonate` | any (kalau impersonating) | Berhenti, kembali ke admin token |
| `GET` | `/api/auth/impersonation-status` | any | Cek apakah sedang impersonate |

### JWT Modifikasi

Tambah 3 field di payload:
```js
{
  id: 5,                    // user yang sedang "login" (user yang di-impersonate)
  email: 'user-a@...',
  role: 'staff',
  isImpersonating: true,    // ← NEW
  impersonatedBy: 1,        // ← NEW (admin user ID yang asli)
  impersonationExpires: 1234567890,  // ← NEW (unix timestamp, 1 jam dari sekarang)
  iat: ...,
  exp: ...
}
```

**Catatan penting:**
- `req.user.id` di middleware adalah user yang di-impersonate
- `req.user.impersonatedBy` adalah admin asli
- `authorize()` middleware tetap cek role user yang di-impersonate (admin hanya jadi "viewer")

### 🛣️ Route Handlers

#### `POST /api/auth/impersonate/:userId`

```js
router.post('/impersonate/:userId', authorize('admin'), (req, res) => {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Extra confirmation untuk impersonate admin lain
  if (target.role === 'admin' && target.id !== req.user.id) {
    if (!req.body.confirm) {
      return res.status(400).json({
        error: 'Impersonate admin lain butuh konfirmasi',
        requireConfirm: true,
      });
    }
  }

  // Set expiration 1 jam
  const expiresAt = Date.now() + 60 * 60 * 1000;

  // Update DB
  db.prepare(`UPDATE users SET impersonated_by = ?, impersonation_expires_at = ? WHERE id = ?`)
    .run(req.user.id, new Date(expiresAt).toISOString(), target.id);

  // Generate JWT with impersonation claims
  const token = jwt.sign(
    {
      id: target.id,
      email: target.email,
      role: target.role,
      name: target.name,
      isImpersonating: true,
      impersonatedBy: req.user.id,
      impersonationExpires: Math.floor(expiresAt / 1000),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'impersonate_start', 'auth', ?, ?, datetime('now'))`)
    .run(req.user.id, `Mulai impersonate user: ${target.name} (${target.email})`, req.ip);

  res.json({
    token,
    user: { id: target.id, name: target.name, email: target.email, role: target.role, division: target.division },
    impersonatedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
    expiresAt: new Date(expiresAt).toISOString(),
  });
});
```

#### `POST /api/auth/stop-impersonate`

```js
router.post('/stop-impersonate', authenticate, (req, res) => {
  if (!req.user.isImpersonating) {
    return res.status(400).json({ error: 'Tidak sedang impersonate' });
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.impersonatedBy);
  if (!admin) return res.status(404).json({ error: 'Admin asal tidak ditemukan' });

  // Clear impersonation flag
  db.prepare(`UPDATE users SET impersonated_by = NULL, impersonation_expires_at = NULL WHERE id = ?`)
    .run(req.user.id);

  // Generate fresh JWT for admin
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'impersonate_stop', 'auth', ?, ?, datetime('now'))`)
    .run(admin.id, `Berhenti impersonate user: ${req.user.name} (${req.user.email})`, req.ip);

  res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});
```

### 🛡️ Middleware Update

Tambah cek expiration di `authenticate` middleware:
```js
// backend/middleware/auth.js
export function authenticate(req, res, next) {
  // ... existing token verification ...
  req.user = decoded;

  // Cek apakah impersonation sudah expired
  if (req.user.isImpersonating && req.user.impersonationExpires) {
    if (Date.now() / 1000 > req.user.impersonationExpires) {
      return res.status(401).json({
        error: 'Impersonation session expired. Silakan login kembali.',
        code: 'IMPERSONATION_EXPIRED',
      });
    }
  }
  next();
}
```

### 📝 Logging Convention

Setiap `activity_logs` INSERT saat impersonation harus include admin asli:
```js
const logUserId = req.user.impersonatedBy || req.user.id;
const description = req.user.isImpersonating
  ? `[Acting as ${req.user.name}] ${originalDescription}`
  : originalDescription;
```

### 🎨 Frontend

#### File modifikasi: `src/pages/admin/AdminUsers.jsx`

Tambah button impersonate di kolom Actions:
```jsx
<button onClick={() => handleImpersonate(user)}
  className="p-2 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600"
  title="Login sebagai user ini">
  <LogIn className="w-4 h-4" />
</button>
```

#### Confirmation Modal (kalau target admin)

```jsx
<ConfirmModal
  open={!!confirmImpersonate}
  title="Impersonate Admin?"
  message={`Anda akan login sebagai admin lain. Semua aktivitas akan di-log dan di-audit.`}
  confirmText="Saya paham, lanjutkan"
  confirmColor="red"
  loading={impersonating}
  onConfirm={() => doImpersonate(true)}
  onCancel={() => setConfirmImpersonate(null)}
/>
```

#### File baru: `src/components/ImpersonationBanner.jsx`

Banner persistent di top saat impersonating:
```jsx
function ImpersonationBanner({ onStop, expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(expiresAt) - Date.now();
      if (ms <= 0) { clearInterval(interval); window.location.href = '/login'; }
      else {
        const min = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        setTimeLeft(`${min}:${sec.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="w-4 h-4" />
        Anda login sebagai user lain. Auto-revert dalam <span className="font-mono font-semibold">{timeLeft}</span>.
      </div>
      <button onClick={onStop} className="px-3 py-1 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800">
        Kembali ke Admin
      </button>
    </div>
  );
}
```

Mount di `AppLayout.jsx` kalau `auth.isImpersonating`.

### 🧪 Test Plan
1. Admin A impersonate User B → dapat token baru dengan `isImpersonating: true`
2. `GET /api/auth/me` dengan token baru → return data User B
3. Akses admin-only endpoint (e.g. `POST /api/users`) → 403 (role User B = staff)
4. Banner muncul di semua halaman dengan countdown
5. Tunggu 1 jam → token expired → auto-redirect ke login
6. Klik "Kembali ke Admin" → token baru untuk Admin A → banner hilang
7. Cek `activity_logs` → ada 2 entry (impersonate_start, impersonate_stop)
8. Impersonate admin lain tanpa `confirm: true` → 400
9. Impersonate admin lain dengan `confirm: true` → success

---

## 3️⃣ List User Online di Admin Panel

### 🎯 Tujuan & Masalah

**Masalah:**
- Admin tidak tahu siapa yang sedang login
- Tidak bisa force logout user yang lupa logout di PC umum
- Tidak ada awareness user activity

**Tujuan:**
- Real-time list user yang aktif (5 menit terakhir)
- Force logout user dengan 1 klik
- Auto-refresh supaya selalu update

### 🛡️ Definisi "Online"
- User dianggap "online" jika ada aktivitas dalam **5 menit terakhir**
- Tracking via `last_activity_at` di tabel users
- Update setiap ada request dari user (middleware touch, **throttled per menit**)

### 🗄️ Schema Update

```sql
-- Tambah kolom ke users
ALTER TABLE users ADD COLUMN last_activity_at TEXT;

-- Tambah kolom untuk force logout (token versioning)
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

-- Index untuk query
CREATE INDEX idx_users_last_activity ON users(last_activity_at);
```

### 🛡️ Middleware Touch

Di `backend/middleware/auth.js`, tambahkan touch setelah verify token:
```js
// Update last_activity_at (throttled — max 1 update per menit per user)
if (!req.user._lastTouched || Date.now() - req.user._lastTouched > 60000) {
  db.prepare(`UPDATE users SET last_activity_at = datetime('now') WHERE id = ?`).run(req.user.id);
  req.user._lastTouched = Date.now();
}
```

### 📡 Backend API

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/api/users/online` | admin | List user aktif 5 menit terakhir |
| `POST` | `/api/auth/logout-all/:userId` | admin | Force logout (invalidate semua token via token_version++) |

### Route Handlers

```js
// GET /api/users/online
router.get('/online', authorize('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, name, email, role, division, is_active, last_activity_at,
           (SELECT COUNT(*) FROM activity_logs WHERE user_id = users.id AND created_at > datetime('now', '-1 hour')) as recent_actions
    FROM users
    WHERE last_activity_at > datetime('now', '-5 minutes')
    ORDER BY last_activity_at DESC
  `).all();

  res.json({ users, count: users.length, threshold: '5 minutes' });
});

// POST /api/auth/logout-all/:userId
router.post('/auth/logout-all/:userId', authorize('admin'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  db.prepare(`UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?`)
    .run(req.params.userId);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'force_logout', 'auth', ?, ?, datetime('now'))`)
    .run(req.user.id, `Force logout user: ${user.name} (ID ${req.params.userId})`, req.ip);

  res.json({ message: 'User akan di-logout pada request berikutnya' });
});
```

### 🛡️ Token Version Check (authenticate middleware)

```js
// Di authenticate middleware, setelah token verify:
const db = getDb();
const currentUser = db.prepare('SELECT token_version FROM users WHERE id = ?').get(req.user.id);
if (currentUser && req.user.token_version !== currentUser.token_version) {
  return res.status(401).json({
    error: 'Sesi Anda telah diakhiri oleh admin',
    code: 'FORCE_LOGOUT',
  });
}
```

JWT payload harus include `token_version` saat sign:
```js
jwt.sign({ id, email, role, name, token_version: 1 }, JWT_SECRET, { expiresIn: '1h' });
```

### 🎨 Frontend

#### File baru: `src/pages/admin/OnlineUsers.jsx`

Tab baru di User Management atau halaman terpisah. Auto-refresh setiap 30 detik.

#### Tampilan:
```
┌──────────────────────────────────────────────────────────┐
│ User Online (3) — refresh setiap 30 detik                │
├──────────────────────────────────────────────────────────┤
│ 🟢 Irsan Rochendi    | irsan@...    | Admin    | 2 min │
│ 🟢 Wahyu Angga       | wahyu@...    | Staff    | 1 min │
│ 🟢 Asep Suandi       | asep@...     | Admin    | 30s   │
│ [Force Logout] (per user)                                │
└──────────────────────────────────────────────────────────┘
```

### 🧪 Test Plan
1. Login User A di Chrome, User B di Firefox
2. Admin buka User Management → tab "Online"
3. Lihat User A dan B muncul di list
4. Tunggu 5 menit idle (atau force-touch via API) → user hilang dari list
5. Klik "Force Logout" di User A → User A auto-redirect ke login
6. Activity log ada entry `force_logout`
7. Test token_version: A login → admin force logout → A refresh → 401

---

## 4️⃣ Search Bar Global (Ctrl+K)

### 🎯 Tujuan & Masalah

**Masalah:**
- Admin harus klik-klik untuk navigasi ke halaman yang sering dikunjungi
- Pencarian server/user saat ini hanya via filter di masing-masing halaman
- Butuh quick action (Backup Now, Sync AD) tanpa buka Settings

**Tujuan:**
- Command palette kayak GitHub/Linear
- Trigger: `Ctrl+K` atau `/` (slash)
- Cari apa saja: navigasi, server, user, action cepat

### 🎨 Tampilan UI

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 [Type to search...]                            ESC  │
├─────────────────────────────────────────────────────────┤
│ NAVIGATION                                              │
│  → Dashboard          Go to /dashboard                  │
│  → Server Management  Go to /admin/servers              │
│  → User Management    Go to /admin/users                │
│                                                         │
│ SERVERS (4 online)                                      │
│  🟢 ESXi 77                  Open  /servers/4           │
│  🟢 Nextcloud Web            Open  /servers/1           │
│                                                         │
│ USERS                                                   │
│  👤 Wahyu Angga  | Staff    View Profile                │
│  👤 Asep Suandi | Admin    View Profile                │
│                                                         │
│ ACTIONS                                                 │
│  ▶ Run Backup Now          /api/backup/run              │
│  ▶ Sync AD Users           /api/ad/users                │
│                                                         │
│ SETTINGS                                                │
│  ⚙ Portal Name             /admin/settings#umum         │
└─────────────────────────────────────────────────────────┘
```

### 📡 Backend (search API)

Pakai endpoint existing:
- `GET /api/servers?search=...` (filter by name/ip)
- `GET /api/users` (filter client-side by name/email)
- Static list untuk navigation & actions (gak perlu API call)

### 🎨 Frontend

#### File baru: `src/components/GlobalSearch.jsx`

```jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const STATIC_NAV = [
  { id: 'dashboard',    label: 'Dashboard',         path: '/dashboard',        group: 'Navigation' },
  { id: 'servers',      label: 'Server Management', path: '/admin/servers',   group: 'Navigation' },
  { id: 'users',        label: 'User Management',   path: '/admin/users',     group: 'Navigation' },
  { id: 'roles',        label: 'Roles',             path: '/admin/roles',     group: 'Navigation' },
  { id: 'settings',     label: 'Settings',          path: '/admin/settings',  group: 'Navigation' },
  { id: 'activity',     label: 'Activity Logs',     path: '/admin/logs',      group: 'Navigation' },
];

const STATIC_ACTIONS = [
  { id: 'backup',       label: 'Run Backup Now',          action: () => api.runBackup('manual'),    group: 'Actions' },
  { id: 'sync-ad',      label: 'Sync AD Users',           action: () => api.listAdUsers(),         group: 'Actions' },
  { id: 'check-status', label: 'Check All Server Status', action: () => api.checkAllStatus(),      group: 'Actions' },
];

function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ nav: [], servers: [], users: [], actions: [] });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  // Focus input on open
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Reset on close
  useEffect(() => { if (!open) { setQuery(''); setSelectedIdx(0); } }, [open]);

  // Search (debounced 200ms)
  useEffect(() => {
    if (!query) {
      setResults({ nav: [], servers: [], users: [], actions: [] });
      return;
    }
    const q = query.toLowerCase();
    const timer = setTimeout(async () => {
      // Local filter
      const nav = STATIC_NAV.filter(n => n.label.toLowerCase().includes(q));
      const actions = STATIC_ACTIONS.filter(a => a.label.toLowerCase().includes(q));

      // API filter
      let servers = [], users = [];
      try {
        const [sRes, uRes] = await Promise.all([
          api.getServers({ search: query }),
          api.getUsers(),
        ]);
        servers = (sRes.servers || []).slice(0, 5);
        users = (uRes.users || [])
          .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
          .slice(0, 5);
      } catch (_) {}

      setResults({ nav, servers, users, actions });
      setSelectedIdx(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Flatten for keyboard navigation
  const flat = [
    ...results.nav.map(r => ({ ...r, type: 'nav' })),
    ...results.servers.map(r => ({ ...r, type: 'server', label: r.name, path: `/servers/${r.id}` })),
    ...results.users.map(r => ({ ...r, type: 'user', label: `${r.name} (${r.email})`, path: `/admin/users` })),
    ...results.actions.map(r => ({ ...r, type: 'action' })),
  ];

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); executeFlat(flat[selectedIdx]); }
      if (e.key === 'Escape')    { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedIdx, flat]);

  const executeFlat = (item) => {
    if (!item) return;
    if (item.type === 'action') item.action();
    else navigate(item.path);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm fade-in"
      onClick={onClose}>
      <div className="bg-white dark:bg-[#0d1321] w-full max-w-xl mx-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <Search className="w-5 h-5 text-slate-400" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cari server, user, halaman, atau aksi..."
            className="flex-1 bg-transparent text-sm focus:outline-none" />
          <kbd className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {flat.length === 0 && query && (
            <div className="text-center py-8 text-sm text-slate-500">Tidak ada hasil untuk "{query}"</div>
          )}
          {!query && (
            <div className="text-center py-8 text-sm text-slate-500">
              Mulai ketik untuk mencari...
            </div>
          )}

          {/* Render grouped */}
          {results.nav.length > 0 && <Group title="Navigation" items={results.nav} selectedIdx={selectedIdx} flatStart={0} onClick={(item) => { navigate(item.path); onClose(); }} icon={ArrowRight} />}
          {results.servers.length > 0 && <Group title="Servers" items={results.servers.map(s => ({ ...s, label: s.name, path: `/servers/${s.id}` }))} selectedIdx={selectedIdx} flatStart={results.nav.length} onClick={(item) => { navigate(item.path); onClose(); }} icon={Server} />}
          {/* ... dst untuk users & actions */}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-400">
          <span><kbd className="px-1 bg-slate-100 dark:bg-white/10 rounded">↑↓</kbd> Navigasi</span>
          <span><kbd className="px-1 bg-slate-100 dark:bg-white/10 rounded">↵</kbd> Pilih</span>
          <span><kbd className="px-1 bg-slate-100 dark:bg-white/10 rounded">ESC</kbd> Tutup</span>
        </div>
      </div>
    </div>
  );
}
```

#### Global Keyboard Listener

Di `AppLayout.jsx`:
```jsx
useEffect(() => {
  const handler = (e) => {
    // Ctrl+K atau Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
    // Slash (/)
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) {
      e.preventDefault();
      setSearchOpen(true);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

#### Shortcut Hint di Header

Tambah button search di header dengan shortcut hint:
```jsx
<button onClick={() => setSearchOpen(true)}
  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10">
  <Search className="w-4 h-4" />
  <span>Search...</span>
  <kbd className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded ml-2">Ctrl+K</kbd>
</button>
```

### 🧪 Test Plan
1. Tekan `Ctrl+K` → modal muncul, input auto-focus
2. Ketik "esxi" → muncul ESXi 77, ESXi 78
3. Tekan `↓` → navigasi ke item berikutnya
4. Tekan `Enter` → navigasi ke server
5. Ketik "admin" → muncul admin pages + admin users
6. Ketik "backup" → muncul "Run Backup Now" action
7. Enter di action → trigger backup, modal close
8. Tekan `ESC` → modal tutup
9. Tekan `/` di luar input → modal muncul
10. Ketik tidak ada yang match → "Tidak ada hasil"

---

## 5️⃣ Server Maintenance Mode

### 🎯 Tujuan & Masalah

**Masalah:**
- Server harus di-set offline manual (delete/hide) saat maintenance
- User bingung kenapa server gak bisa diakses
- Tidak ada info kapan maintenance selesai
- Admin harus jawab pertanyaan "kapan server normal lagi?"

**Tujuan:**
- Tandai server "Under Maintenance" tanpa hapus dari list
- Pesan custom untuk user (misal: "Hardware upgrade sampai 15:00 WIB")
- Schedule end-time, auto-revert
- Open Server button disabled, overlay di card

### 🗄️ Schema Update

Tambah 4 kolom ke tabel `servers`:
```sql
ALTER TABLE servers ADD COLUMN maintenance_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN maintenance_message TEXT DEFAULT '';
ALTER TABLE servers ADD COLUMN maintenance_start TEXT;
ALTER TABLE servers ADD COLUMN maintenance_end TEXT;
```

### 📡 Backend API

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/api/servers/:id/maintenance` | admin | Enable maintenance mode |
| `DELETE` | `/api/servers/:id/maintenance` | admin | Disable maintenance mode |

### Route Handlers

```js
// POST /api/servers/:id/maintenance
router.post('/:id/maintenance', authorize('admin'), (req, res) => {
  const { message = '', endAt = null } = req.body;
  const db = getDb();

  const server = db.prepare('SELECT id, name FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  db.prepare(`
    UPDATE servers SET
      maintenance_mode = 1,
      maintenance_message = ?,
      maintenance_start = datetime('now'),
      maintenance_end = ?
    WHERE id = ?
  `).run(message, endAt, req.params.id);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'maintenance_on', 'server', ?, ?, datetime('now'))`)
    .run(req.user.id, `Set maintenance: ${server.name} - ${message || '(no message)'}${endAt ? ` sampai ${endAt}` : ''}`, req.ip);

  res.json({ message: 'Server di-set ke maintenance mode' });
});

// DELETE /api/servers/:id/maintenance
router.delete('/:id/maintenance', authorize('admin'), (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT name FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  db.prepare(`
    UPDATE servers SET
      maintenance_mode = 0,
      maintenance_message = '',
      maintenance_start = NULL,
      maintenance_end = NULL
    WHERE id = ?
  `).run(req.params.id);

  // Log
  db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
    VALUES (?, 'maintenance_off', 'server', ?, ?, datetime('now'))`)
    .run(req.user.id, `Disable maintenance: ${server.name}`, req.ip);

  res.json({ message: 'Maintenance mode dinonaktifkan' });
});
```

### ⏰ Auto-revert Cron Job

Tambah di `backend/server.js` (interval 60 detik):
```js
// Auto-revert maintenance jika end time sudah lewat
setInterval(() => {
  try {
    const db = getDb();
    const expired = db.prepare(`
      SELECT id, name, maintenance_end FROM servers
      WHERE maintenance_mode = 1
        AND maintenance_end IS NOT NULL
        AND maintenance_end < datetime('now')
    `).all();

    if (expired.length > 0) {
      const tx = db.transaction(() => {
        for (const s of expired) {
          db.prepare(`UPDATE servers SET maintenance_mode = 0, maintenance_message = 'Auto-reverted: scheduled end time reached' WHERE id = ?`)
            .run(s.id);
          db.prepare(`INSERT INTO activity_logs (user_id, action, module, description, ip_address, created_at)
            VALUES (1, 'maintenance_auto_off', 'server', ?, 'system', datetime('now'))`)
            .run(`Auto-revert maintenance: ${s.name} (end: ${s.maintenance_end})`);
        }
      });
      tx();
      console.log(`⏰ Auto-reverted ${expired.length} server(s) from maintenance`);
    }
  } catch (err) {
    console.error('Maintenance auto-revert error:', err);
  }
}, 60_000);
```

**Catatan:** Cron ini pakai `user_id = 1` (asumsi admin pertama) sebagai system. Atau bisa pakai NULL + log khusus "system".

### 🎨 Frontend

#### Tampilan di Server Card (overlay)

```jsx
{server.maintenance_mode === 1 && (
  <div className="absolute inset-0 bg-amber-50/90 dark:bg-amber-900/40 backdrop-blur-sm z-10 rounded-2xl flex items-center justify-center p-4">
    <div className="text-center">
      <Wrench className="w-8 h-8 text-amber-600 mx-auto mb-2" />
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Under Maintenance</p>
      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-[200px]">
        {server.maintenance_message || 'Server sedang dalam pemeliharaan'}
      </p>
      {server.maintenance_end && (
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
          Selesai: {new Date(server.maintenance_end).toLocaleString('id-ID')}
        </p>
      )}
    </div>
  </div>
)}
```

#### Button "Open Server" Disabled

```jsx
<button
  disabled={server.maintenance_mode === 1}
  className={`... ${server.maintenance_mode === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  {server.maintenance_mode === 1 ? 'Tidak bisa diakses' : 'Buka Server'}
</button>
```

#### Admin: Toggle di Server Management

Di `AdminServers.jsx`, tambah button per server:
```jsx
<button onClick={() => server.maintenance_mode
  ? api.disableMaintenance(server.id).then(refresh)
  : setShowMaintenanceModal(server)}
  className={server.maintenance_mode === 1
    ? "p-2 rounded-lg bg-amber-100 text-amber-600"
    : "p-2 rounded-lg hover:bg-amber-50 text-slate-400"
  }
  title={server.maintenance_mode === 1 ? 'Disable maintenance' : 'Set maintenance'}>
  <Wrench className="w-4 h-4" />
</button>
```

#### File baru: `src/components/MaintenanceModal.jsx`

```jsx
function MaintenanceModal({ server, onClose, onSave }) {
  const [message, setMessage] = useState(server.maintenance_message || '');
  const [endAt, setEndAt] = useState(server.maintenance_end || '');
  const [hasEndTime, setHasEndTime] = useState(!!server.maintenance_end);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.enableMaintenance(server.id, { message, endAt: hasEndTime ? endAt : null });
      toast.success('Server di-set ke maintenance mode');
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d1321] rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-500" />
          Set Maintenance Mode
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Server</p>
            <p className="font-medium">{server.name} · {server.ip_address}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pesan untuk User</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="misal: Hardware upgrade, migrasi data, dll"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasEndTime} onChange={e => setHasEndTime(e.target.checked)} />
              Auto-revert pada waktu tertentu
            </label>
            {hasEndTime && (
              <input
                type="datetime-local"
                value={endAt ? new Date(endAt).toISOString().slice(0, 16) : ''}
                onChange={e => setEndAt(e.target.value)}
                className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-white/10">Batal</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? 'Menyimpan...' : 'Aktifkan Maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 🧪 Test Plan
1. Admin buka Server Management → klik icon wrench di ESXi 77
2. Set maintenance on: message "Hardware upgrade", end time = 2 menit dari sekarang
3. User lain (staff) buka Dashboard → lihat ESXi 77 card ada overlay amber
4. Klik "Buka Server" → disabled
5. Tunggu 2 menit → auto-revert
6. Server kembali normal, button aktif lagi
7. Cek `activity_logs` → ada `maintenance_on` dan `maintenance_auto_off`
8. Test manual disable: klik wrench → langsung off, tanpa modal

---

## 📁 File yang Akan Diubah/Dibuat (Semua Fitur)

| File | Aksi | Fitur |
|---|---|---|
| `backend/middleware/auth.js` | Modify — touch activity, impersonation check, token version | 1, 2 |
| `backend/routes/auth.js` | Modify — 3 endpoint impersonation, logout-all | 1, 2 |
| `backend/routes/users.js` | Modify — list online | 2 |
| `backend/routes/servers.js` | Modify — 2 endpoint maintenance | 7 |
| `backend/server.js` | Modify — auto-revert cron | 7 |
| `backend/database.js` | Modify — ALTER TABLE 8x (impersonation, last_activity, token_version, maintenance) | 1, 2, 7 |
| `src/components/ImpersonationBanner.jsx` | **Create** | 1 |
| `src/components/GlobalSearch.jsx` | **Create** | 4 |
| `src/components/MaintenanceModal.jsx` | **Create** | 7 |
| `src/components/ServerCard.jsx` | Modify — maintenance overlay, disabled state | 7 |
| `src/layouts/AppLayout.jsx` | Modify — banner + global keyboard | 1, 4 |
| `src/pages/admin/AdminUsers.jsx` | Modify — impersonate button | 1 |
| `src/pages/admin/OnlineUsers.jsx` | **Create** | 2 |
| `src/pages/admin/AdminServers.jsx` | Modify — maintenance toggle | 7 |
| `src/services/api.js` | Modify — ~10 method baru | All |
| `CHANGELOG.md` | Modify — v1.3.0 entry | All |

**Total:** ~1100 baris kode baru, 16 file disentuh, 0 breaking changes

---

## 🔄 Migration Strategy

Semua fitur additive. Untuk ALTER TABLE pada existing DB:
```js
// Di initDb() — tambahkan defensive ALTER
const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('last_activity_at')) db.exec(`ALTER TABLE users ADD COLUMN last_activity_at TEXT`);
if (!userCols.includes('impersonated_by'))    db.exec(`ALTER TABLE users ADD COLUMN impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
// ... dst

const serverCols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
if (!serverCols.includes('maintenance_mode')) db.exec(`ALTER TABLE servers ADD COLUMN maintenance_mode INTEGER NOT NULL DEFAULT 0`);
// ... dst

// Index
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at)`);
```

Idempotent — bisa dijalankan berulang tanpa error.

---

## 📋 Test Plan Per Fitur

| Fitur | Smoke Test | Edge Cases |
|---|---|---|
| 1 Impersonation | Login as admin → klik user → confirm → token baru → banner muncul → aksi → audit log | Impersonate admin lain butuh confirm · timeout 1 jam · logout normal · impersonation chain diblok? |
| 2 Online Users | 2 user login → admin refresh → list muncul → force logout → auto-redirect | 5 min threshold · token_version invalidation · throttle update last_activity |
| 4 Global Search | Ctrl+K → ketik → navigasi keyboard | Debounce 200ms · empty result · ESC · keyboard shortcuts tidak bentrok dengan input |
| 7 Maintenance | Set maintenance → user lihat overlay → tunggu end time → auto-revert | Modal disabled state · visual indicator · concurrent disable · message template |

---

## ❓ Open Questions (untuk dikonfirmasi)

- [ ] Impersonation timeout: 1 jam cukup? (atau 30 menit / 2 jam)
- [ ] Online threshold: 5 menit? (atau 10 menit / 3 menit)
- [ ] Global search: include admin actions (Backup Now) atau cuma navigation?
- [ ] Maintenance: pesan default apa kalau kosong? ("Sedang dalam pemeliharaan" sudah oke?)
- [ ] Maintenance end time: pakai format `datetime-local` HTML atau custom datepicker?
- [ ] Impersonation bisa chain? (admin A impersonate B, B impersonate C) — atau block?

---

**Last updated:** 2026-07-03
**Author:** Claude + User
**Status:** 📝 Design — siap untuk implementasi setelah konfirmasi
