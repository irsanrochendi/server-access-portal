# Seamless Token-Based Server Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace credential-in-browser flow with single-use, short-lived access tokens so passwords never reach the browser JavaScript heap.

**Architecture:** Two new backend endpoints (`POST /api/tokens/request`, `GET /api/tokens/:action/:id`) mediate access via SHA256-hashed single-use tokens stored in a new `access_tokens` table. Frontend calls `requestOpenToken` then triggers a download (RDP) or redirect (HTTP/HTTPS). Existing `/api/open` endpoint is preserved as fallback for SSH and manual access.

**Tech Stack:** Express.js, better-sqlite3, crypto (Node.js built-in), React + Vite + Tailwind

## Global Constraints

- Password asli tidak pernah muncul di browser JS heap, DOM, atau storage
- Token: 64-char hex (256-bit entropy), single-use, 30-second TTL
- Hanya RDP dan HTTP/HTTPS yang didukung token flow; SSH tetap manual
- Credential reveal untuk admin tetap ada dengan tambahan reason gate
- Semua endpoint token (kecuali token consumption) menggunakan JWT auth yang sudah ada
- Activity logging tetap berjalan untuk token_request dan server_access
- Tidak ada breaking changes ke API yang sudah ada

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/database.js` | Add `access_tokens` table migration |
| Create | `backend/routes/tokens.js` | Token generation, validation, RDP file generation, HTTP redirect |
| Modify | `backend/server.js` | Register `/api/tokens` routes, start cleanup interval |
| Modify | `src/services/api.js` | Add `requestOpenToken(id, protocol)` client method |
| Modify | `src/components/ServerCard.jsx` | Seamless open flow, credential reason dialog |
| — | `src/components/QuickConnectModal.jsx` | No changes — inherits `openServer` from ServerCard |

---

### Task 1: Database Migration — `access_tokens` Table

**Files:**
- Modify: `backend/database.js:190-212`

**Interfaces:**
- Produces: `access_tokens` table (`id`, `token_hash`, `user_id`, `server_id`, `protocol`, `created_at`, `expires_at`, `used_at`, `revoked`) with indexes on `token_hash`, `expires_at`, `user_id`

- [ ] **Step 1: Add migration block to database.js**

Open `backend/database.js`. The `initDb()` function ends with a migration block around line 190. Add a new migration block after the v1.7.0 comment:

```javascript
  // ─── v2.2.0: Token-Based Server Access ────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      protocol TEXT NOT NULL CHECK(protocol IN ('rdp','http','https','ssh')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used_at TEXT DEFAULT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_access_tokens_hash ON access_tokens(token_hash)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_access_tokens_expiry ON access_tokens(expires_at)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_access_tokens_user ON access_tokens(user_id)`);
```

- [ ] **Step 2: Verify migration runs without error**

```bash
cd backend && node -e "const { initDb } = require('./database.js'); initDb(); console.log('Migration OK');"
```

Expected: `Migration OK` (table created, no duplicate-table error because of `IF NOT EXISTS`)

- [ ] **Step 3: Verify table schema**

```bash
cd backend && node -e "const { getDb, initDb } = require('./database.js'); initDb(); const cols = getDb().prepare('PRAGMA table_info(access_tokens)').all(); console.log(JSON.stringify(cols, null, 2));"
```

Expected: Lists 9 columns with correct names and types.

- [ ] **Step 4: Commit**

```bash
git add backend/database.js
git commit -m "feat: add access_tokens table for token-based server access

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Token Access Routes

**Files:**
- Create: `backend/routes/tokens.js`

**Interfaces:**
- Consumes: `access_tokens` table from Task 1, `encryption.js` `decrypt()`, `middleware/auth.js` `authenticate`
- Produces:
  - `POST /api/tokens/request` — body: `{protocol}`, response: `{token, expires_in, protocol, server_name}`
  - `GET /api/tokens/rdp-file/:id?token=xxx` — response: `.rdp` file download
  - `GET /api/tokens/launch/:id?token=xxx` — response: 302 redirect
  - Helper: `generateToken()`, `hashToken(token)`, `validateAndConsumeToken(hash, userId, serverId)`

- [ ] **Step 1: Create `backend/routes/tokens.js`**

```javascript
import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import { decrypt } from '../services/encryption.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validateAndConsumeToken(tokenHash, userId, serverId) {
  const db = getDb();
  const record = db.prepare(`
    SELECT * FROM access_tokens
    WHERE token_hash = ? AND user_id = ? AND server_id = ?
  `).get(tokenHash, userId, serverId);

  if (!record) return { valid: false, error: 'Token tidak ditemukan' };
  if (record.revoked) return { valid: false, error: 'Token telah dicabut' };
  if (record.used_at) return { valid: false, error: 'Token sudah digunakan' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, error: 'Token kadaluarsa' };

  // Consume token
  db.prepare(`UPDATE access_tokens SET used_at = datetime('now') WHERE id = ?`).run(record.id);

  return { valid: true, protocol: record.protocol };
}

// ─── POST /api/tokens/request ─────────────────────────────────────────────

router.post('/request/:id', authenticate, (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { protocol } = req.body;

    if (!protocol || !['rdp', 'http', 'https', 'ssh'].includes(protocol)) {
      return res.status(400).json({ error: 'Protocol tidak didukung' });
    }

    const db = getDb();

    // Check server exists and is active
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });
    if (!server.is_active) return res.status(400).json({ error: 'Server dinonaktifkan' });

    // Check access — admin bypasses checks, staff must be assigned or in division
    if (req.user.role !== 'admin') {
      // Check division visibility
      if (server.visible_to) {
        const divisions = server.visible_to.split(',').map(d => d.trim()).filter(Boolean);
        if (divisions.length > 0 && !divisions.includes(req.user.division || '')) {
          return res.status(403).json({ error: 'Anda tidak memiliki akses ke server ini (divisi)' });
        }
      }

      // Check explicit assignment
      const assignment = db.prepare(`
        SELECT sa.id FROM server_assignments sa
        LEFT JOIN users u ON sa.user_id = u.id
        WHERE sa.server_id = ?
          AND (sa.user_id = ? OR (u.role = ? AND sa.role = ?))
      `).get(serverId, req.user.id, req.user.role, req.user.role);

      if (!assignment) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses ke server ini' });
      }
    }

    // Generate token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30_000).toISOString();

    db.prepare(`
      INSERT INTO access_tokens (token_hash, user_id, server_id, protocol, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenHash, req.user.id, serverId, protocol, expiresAt);

    // Log token request
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      req.user.id,
      'token_request',
      'server',
      `Request token akses untuk server ${server.name}`,
      JSON.stringify({ server_id: serverId, protocol }),
      req.ip
    );

    res.json({
      token,
      expires_in: 30,
      protocol,
      server_name: server.name,
    });

  } catch (err) {
    console.error('Token request error:', err);
    res.status(500).json({ error: 'Gagal membuat token akses' });
  }
});

// ─── GET /api/tokens/rdp-file/:id ──────────────────────────────────────────

router.get('/rdp-file/:id', (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: 'Token wajib disertakan' });

    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

    // Find matching token record — we need user_id to validate
    // Look up by token_hash across all users for this server (one-time use, user-scoped)
    const tokenHash = hashToken(token);
    const tokenRecord = db.prepare(`
      SELECT * FROM access_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!tokenRecord) return res.status(401).json({ error: 'Token tidak valid' });
    if (tokenRecord.server_id !== serverId) return res.status(401).json({ error: 'Token tidak cocok dengan server' });

    const validation = validateAndConsumeToken(tokenHash, tokenRecord.user_id, serverId);
    if (!validation.valid) {
      return res.status(401).json({ error: validation.error });
    }

    // Decrypt credentials
    const username = decrypt(server.shared_username_encrypted);
    const password = decrypt(server.shared_password_encrypted);

    if (!username && !password) {
      // No stored credentials — generate RDP file without credentials
      const port = server.port || 3389;
      const ip = server.ip_address;
      const rdpContent = [
        `full address:s:${ip}:${port}`,
        `prompt for credentials:i:1`,
        `authentication level:i:2`,
        ``,
      ].join('\r\n');

      res.setHeader('Content-Type', 'application/x-rdp');
      res.setHeader('Content-Disposition', `attachment; filename="${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.rdp"`);
      return res.send(rdpContent);
    }

    // Build RDP file with credentials
    const port = server.port || 3389;
    const ip = server.ip_address;
    const lines = [
      `full address:s:${ip}:${port}`,
      `prompt for credentials:i:0`,
      `authentication level:i:2`,
      `negotiate security layer:i:1`,
    ];

    if (username) lines.push(`username:s:${username}`);
    if (password) lines.push(`password 01:b:${Buffer.from(password).toString('hex')}`);

    const rdpContent = lines.join('\r\n') + '\r\n';

    // Log server access
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      tokenRecord.user_id,
      'server_access',
      'server',
      `Membuka server ${server.name} via RDP (token)`,
      JSON.stringify({ server_id: serverId, protocol: 'rdp', token_id: tokenRecord.id }),
      req.ip
    );

    res.setHeader('Content-Type', 'application/x-rdp');
    res.setHeader('Content-Disposition', `attachment; filename="${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.rdp"`);
    res.send(rdpContent);

  } catch (err) {
    console.error('RDP file generation error:', err);
    res.status(500).json({ error: 'Gagal membuat file RDP' });
  }
});

// ─── GET /api/tokens/launch/:id ─────────────────────────────────────────────

router.get('/launch/:id', (req, res) => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: 'Token wajib disertakan' });

    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

    const tokenHash = hashToken(token);
    const tokenRecord = db.prepare(`SELECT * FROM access_tokens WHERE token_hash = ?`).get(tokenHash);

    if (!tokenRecord) return res.status(401).json({ error: 'Token tidak valid' });
    if (tokenRecord.server_id !== serverId) return res.status(401).json({ error: 'Token tidak cocok dengan server' });

    const validation = validateAndConsumeToken(tokenHash, tokenRecord.user_id, serverId);
    if (!validation.valid) {
      return res.status(401).json({ error: validation.error });
    }

    // Build target URL
    let targetUrl = server.access_url || `http://${server.ip_address}${server.port ? ':' + server.port : ''}`;

    // If auto-login enabled and credentials exist, embed in URL
    const username = decrypt(server.shared_username_encrypted);
    const password = decrypt(server.shared_password_encrypted);

    if (server.auto_login_enabled && username && password) {
      try {
        const urlObj = new URL(targetUrl);
        urlObj.username = encodeURIComponent(username);
        urlObj.password = encodeURIComponent(password);
        targetUrl = urlObj.toString();
      } catch (e) {
        // URL parse failed — leave as-is
      }
    }

    // Log server access
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, module, description, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      tokenRecord.user_id,
      'server_access',
      'server',
      `Membuka server ${server.name} via HTTP (token)`,
      JSON.stringify({ server_id: serverId, protocol: 'http', token_id: tokenRecord.id }),
      req.ip
    );

    res.redirect(302, targetUrl);

  } catch (err) {
    console.error('Launch error:', err);
    res.status(500).json({ error: 'Gagal membuka server' });
  }
});

export default router;
```

- [ ] **Step 2: Verify the file parses without syntax errors**

```bash
cd backend && node --check routes/tokens.js
```

Expected: No output (successful parse).

- [ ] **Step 3: Commit**

```bash
git add backend/routes/tokens.js
git commit -m "feat: add token-based server access routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Register Routes & Cleanup Job

**Files:**
- Modify: `backend/server.js:1-30` (imports area), `backend/server.js:44-59` (routes area), `backend/server.js:60+` (startup area)

**Interfaces:**
- Consumes: `backend/routes/tokens.js` default export from Task 2, `access_tokens` table from Task 1

- [ ] **Step 1: Add import for token routes**

Open `backend/server.js`. Add the import near the other route imports (around line 25):

```javascript
import tokenRoutes from './routes/tokens.js';
```

- [ ] **Step 2: Register token routes**

After the existing route registrations (around line 58, after `app.use('/api/backup', backupRoutes)`), add:

```javascript
app.use('/api/tokens', tokenRoutes);
```

- [ ] **Step 3: Add cleanup job in startup block**

In the server startup block at the bottom of `server.js` (where `app.listen` is called), add token cleanup before or after the existing backup initialization. If there's no explicit startup block after `app.listen`, add it right before:

```javascript
// Token cleanup — delete expired unused tokens every 5 minutes
function cleanupExpiredTokens() {
  try {
    const { getDb } = await import('./database.js');
    const result = getDb().prepare(`DELETE FROM access_tokens WHERE expires_at < datetime('now') AND used_at IS NULL`).run();
    if (result.changes > 0) {
      console.log(`Token cleanup: removed ${result.changes} expired tokens`);
    }
  } catch (err) {
    // getDb may throw during startup race; ignore
  }
}

// Run once at startup
setTimeout(cleanupExpiredTokens, 30_000); // 30s delay to ensure DB is ready

// Run every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60_000);
```

Wait — the `cleanupExpiredTokens` function uses `await import` but the module is ESM so dynamic import works. However, we already have `getDb` imported at the top. Let me check what imports are at the top of `server.js`.

Looking at the existing `server.js`, it imports `getDb` is NOT at the top; it's imported in `database.js` and used via routes. The `server.js` only imports `initDb`. Let me adjust — we can just import `getDb` directly:

Actually, looking at the `server.js` imports:
```javascript
import { initDb } from './database.js';
```

I need to also import `getDb`:

```javascript
import { initDb, getDb } from './database.js';
```

Then the cleanup function:

```javascript
// Token cleanup — delete expired unused tokens every 5 minutes
function cleanupExpiredTokens() {
  try {
    const result = getDb().prepare(`DELETE FROM access_tokens WHERE expires_at < datetime('now') AND used_at IS NULL`).run();
    if (result.changes > 0) {
      console.log(`Token cleanup: removed ${result.changes} expired tokens`);
    }
  } catch (err) {
    // DB may not be ready yet during startup
  }
}

// Run once at startup + every 5 minutes
setTimeout(cleanupExpiredTokens, 30_000);
setInterval(cleanupExpiredTokens, 5 * 60_000);
```

Place this right before `app.listen`.

- [ ] **Step 2 (revised): Full set of changes to `backend/server.js`**

**Change 1 — Import (line 10):**
```javascript
import { initDb, getDb } from './database.js';
```

**Change 2 — Route import (after line 25):**
```javascript
import tokenRoutes from './routes/tokens.js';
```

**Change 3 — Route registration (after the backup route):**
```javascript
app.use('/api/tokens', tokenRoutes);
```

**Change 4 — Cleanup job (before app.listen):**
```javascript
// ─── Token cleanup ─────────────────────────────────────────────────────
function cleanupExpiredTokens() {
  try {
    const result = getDb().prepare(
      `DELETE FROM access_tokens WHERE expires_at < datetime('now') AND used_at IS NULL`
    ).run();
    if (result.changes > 0) {
      console.log(`Token cleanup: removed ${result.changes} expired tokens`);
    }
  } catch (err) { /* DB may not be ready yet at startup */ }
}
setTimeout(cleanupExpiredTokens, 30_000);
setInterval(cleanupExpiredTokens, 5 * 60_000);
```

- [ ] **Step 3: Verify server starts without errors**

```bash
cd backend && timeout 5 node server.js 2>&1 || true
```

Expected: Server starts, no syntax/import errors.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: register token routes and cleanup job

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Frontend API — `requestOpenToken`

**Files:**
- Modify: `src/services/api.js:106-112` (after logActivity)

**Interfaces:**
- Produces: `api.requestOpenToken(id, protocol)` → Promise<{token, expires_in, protocol, server_name}>

- [ ] **Step 1: Add method to `api` object**

Open `src/services/api.js`. Add after line 111 (`logActivity`):

```javascript
  // Token-based access
  requestOpenToken: (id, protocol) =>
    request(`/tokens/request/${id}`, { method: 'POST', body: JSON.stringify({ protocol }) }),
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd src && node --check services/api.js 2>&1 || npx oxlint services/api.js
```

Expected: No errors reported.

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js
git commit -m "feat: add requestOpenToken to frontend API client

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: ServerCard — Seamless Open Flow + Credential Reason Dialog

**Files:**
- Modify: `src/components/ServerCard.jsx:1-305`

**Interfaces:**
- Consumes: `api.requestOpenToken(id, protocol)` from Task 4
- Produces: Modified `openServer(server)` that uses token flow; credential reason dialog for admin reveal

- [ ] **Step 1: Replace the `openServer` function with token-based flow**

Replace the existing `openServer` function (lines 16-36) with:

```javascript
async function openServer(server) {
  const proto = field(server, 'protocol', 'protocol')?.toUpperCase();
  const name = field(server, 'name', 'name');

  // SSH stays on the old manual flow
  if (proto === 'SSH') {
    const ip = field(server, 'ip_address', 'ipAddress');
    const port = field(server, 'port', 'port');
    const url = `ssh://${ip}${port && port !== 22 ? ':' + port : ''}`;
    try {
      const token = localStorage.getItem('portal_token');
      const r = await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ protocol: 'SSH', url, serverId: server.id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Gagal');
      await logActivity('server_access', 'server', `Membuka server ${name} via SSH`, { server_id: server.id, protocol: 'SSH' });
    } catch (e) {
      alert('Gagal: ' + e.message);
    }
    return;
  }

  // RDP / HTTP / HTTPS: token-based seamless flow
  const protoLower = proto.toLowerCase();
  try {
    const result = await api.requestOpenToken(server.id, protoLower);

    if (proto === 'RDP') {
      // Auto-download RDP file via token
      const link = document.createElement('a');
      link.href = `/api/tokens/rdp-file/${server.id}?token=${encodeURIComponent(result.token)}`;
      link.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.rdp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // HTTP/HTTPS — redirect via token
      window.open(`/api/tokens/launch/${server.id}?token=${encodeURIComponent(result.token)}`, '_blank');
    }

    // Activity logged by backend — no need for client-side log here
  } catch (e) {
    alert('Gagal membuka server: ' + e.message);
  }
}
```

- [ ] **Step 2: Add credential reason dialog state and handler**

Add state variables near the top of the ServerCard component (after `const [showPassword, setShowPassword] = useState(false);` around line 45):

```javascript
  const [credReason, setCredReason] = useState('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
```

- [ ] **Step 3: Replace the `handleRevealCreds` function**

Replace the existing `handleRevealCreds` function (lines 74-90):

```javascript
  const handleRevealCreds = async () => {
    if (creds) {
      setShowCredsModal(true);
      return;
    }
    // Show reason dialog first (admin accountability)
    setShowReasonDialog(true);
  };

  const confirmRevealCreds = async () => {
    setShowReasonDialog(false);
    setLoadingCreds(true);
    try {
      const res = await api.getServerCredentials(server.id);
      setCreds(res);
      setShowCredsModal(true);
      await logActivity('credential_access', 'server',
        `Mengakses kredensial server ${server.name}`,
        { server_id: server.id, reason: credReason }
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingCreds(false);
      setCredReason('');
    }
  };
```

- [ ] **Step 4: Add the reason dialog JSX**

Insert the reason dialog right before the existing credentials modal (before `{showCredsModal && ( ... )}` around line 251):

```jsx
      {/* Credential Reason Dialog */}
      {showReasonDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Alasan Akses Kredensial</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Akses ini akan dicatat di audit log</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={credReason}
                onChange={(e) => setCredReason(e.target.value)}
                placeholder="Tulis alasan mengapa Anda perlu melihat kredensial server ini..."
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowReasonDialog(false); setCredReason(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={confirmRevealCreds}
                  disabled={!credReason.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Update the Lock button to show loading spinner during reason dialog flow**

The existing button at line 221-231 is fine as-is (`handleRevealCreds` now opens the reason dialog instead of directly loading). No change needed here unless we want to track the reason dialog open state. The `loadingCreds` state still applies after reason is confirmed.

- [ ] **Step 6: Verify frontend compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ServerCard.jsx
git commit -m "feat: seamless token-based open + credential reason dialog

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: QuickConnect — Verification (No Code Changes Needed)

**Files:**
- No files modified (QuickConnectModal already imports `openServer` from `./ServerCard`)

**Rationale:** [QuickConnectModal.jsx](src/components/QuickConnectModal.jsx) line 3 imports `{ openServer } from './ServerCard'`. After Task 5 updates `openServer` to use the token flow, QuickConnect automatically gets seamless access — no additional code changes needed.

- [ ] **Step 1: Verify QuickConnectModal imports openServer**

Open [QuickConnectModal.jsx](src/components/QuickConnectModal.jsx), confirm line 3:

```javascript
import { openServer } from './ServerCard';
```

This means all QuickConnect calls go through the same `openServer` function updated in Task 5.

- [ ] **Step 2: Verify full build compiles after all changes**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 3: Commit (empty commit confirming verification)**

```bash
git commit --allow-empty -m "verify: QuickConnect inherits token flow from ServerCard

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Implementation Order

```
Task 1 (DB) ──► Task 2 (Routes) ──► Task 3 (Server) ──► Task 4 (API client)
                                                            │
                                                            ▼
                                              Task 5 (ServerCard) ──► Task 6 (QuickConnect)
```

Each task is self-contained and testable independently within its layer.

## Verification Checklist

After all tasks complete, verify end-to-end:

1. Start backend: `cd backend && node server.js`
2. Start frontend: `npm run dev`
3. Login as admin → Dashboard → Klik "Buka Server" pada server RDP → File .rdp terdownload
4. Cek `access_tokens` table: token sudah marked `used_at`
5. Cek `activity_logs`: ada entry `token_request` dan `server_access`
6. Klik Lock icon → Reason dialog muncul → Isi alasan → Kredensial tampil
7. Login sebagai staff → Hanya bisa akses server yang diassign
8. Token expired: tunggu >30 detik → reuse token → error 401
9. Token replay: gunakan token yang sudah dipakai → error 401
