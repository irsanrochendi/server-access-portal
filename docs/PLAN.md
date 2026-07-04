# Plan: Feature Roadmap v1.5.0 — v2.0.0

## Overview

Four features, built incrementally from highest to lowest priority. Each is shipped as a standalone feature branch and merged before moving to the next.

---

## Phase 1 — Health Monitoring (v1.5.0)

**Goal:** Replace manual refresh with automated background health checks and proactive alerting.

### Backend

| Task | Detail |
|---|---|
| `Background health checker` | `setInterval` setiap 2 menit, ping semua server aktif, update `status` + `latency` |
| `GET /api/servers/:id/health` | Ping single server on-demand |
| `Uptime tracking` | Tabel baru `server_uptime_history (server_id, status, checked_at)`, hitung uptime % per hari |
| `Alert thresholds` | Configurable: offline count > N, latency > X ms |
| `Alert log` | Tabel `alerts (id, server_id, type, message, created_at)` |

### Frontend

| Task | Detail |
|---|---|
| `Health history chart` | Chart.js / Recharts — uptime % 7d/30d per server di ServerCard atau modal detail |
| `Alert bell icon` | Header badge counter, click → dropdown list alerts |
| `Dashboard widget` | Mini uptime chart atau badge per server |

### Database

```sql
CREATE TABLE server_uptime_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER REFERENCES servers(id),
  status TEXT CHECK(status IN ('online','offline','unknown')),
  latency_ms INTEGER,
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_uptime_server_time ON server_uptime_history(server_id, checked_at);
```

---

## Phase 2 — Server Grouping / Tags (v1.6.0)

**Goal:** Organize servers beyond just environment — by team, project, location.

### Backend

| Task | Detail |
|---|---|
| `Tag CRUD API` | `GET/POST/PUT/DELETE /api/tags` |
| `Server-Tag relation` | Tabel `server_tags (server_id, tag_id)` |
| `GET /api/servers` with tags | Include array of tag objects |
| `Filter by tag` | Query param `?tags=backend,production` |

### Frontend

| Task | Detail |
|---|---|
| `Tag management page` | `/admin/tags` — create/edit/delete tags (name, color) |
| `Tag selector in ServerCard / ServerForm` | Multi-select tag picker |
| `Filter by tag` | Add tag filter di Dashboard |
| `Tag pills` | Color-coded pills per server di card |
| `Bulk tag assignment` | Admin — select multiple servers → assign tag |

### Database

```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE server_tags (
  server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, tag_id)
);
```

---

## Phase 3 — Quick Connect (v1.7.0)

**Goal:** One-click actions to connect, copy, or launch without friction.

### Backend

| Task | Detail |
|---|---|
| `GET /api/servers/:id/connect-info` | Return full connection string — user, ip, port, protocol, prefilled command |
| `SSH/RDP command generator` | Return ready-to-paste commands |

### Frontend

| Task | Detail |
|---|---|
| `Quick action dropdown` | ServerCard — click icon → menu: SSH, RDP, HTTP, copy user, copy port |
| `Copy all button` | Copy `ssh admin@10.0.0.1 -p 22` in one click |
| `Launch in new tab` | Open access_url directly |
| `Toast confirmation` | "Command copied to clipboard!" |

### UX Details

- `SSH` → copy `ssh {user}@{ip} -p {port}` atau generate config
- `RDP` → copy `.rdp` file content atau `mstsc /v:{ip}:{port}`
- `HTTP/HTTPS` → open new tab ke access_url
- Show protocol badge: SSH (cyan), RDP (blue), HTTP (purple)

---

## Phase 4 — Connection History / Audit Log (v1.8.0)

**Goal:** Full audit trail of who accessed which server and when.

### Backend

| Task | Detail |
|---|---|
| `Log connection events` | Tabel `connection_logs (user_id, server_id, action, protocol, ip_address, created_at)` |
| `Log on open` | `POST /api/open` → insert log |
| `Log on credential view` | Existing `credential_access_logs` tetap, tapi unify format |
| `GET /api/logs/connections` | Filter by user, server, date range, export CSV |
| `GET /api/logs/connections/export` | Generate CSV download |

### Frontend

| Task | Detail |
|---|---|
| `Audit log page` | `/admin/audit-logs` — table dengan filter: user, server, action, date |
| `Log timeline` | Per server — modal atau tab "History" di ServerNotesModal |
| `Export button` | Download CSV |
| `Pagination` | Paginate large log tables |

### Database

```sql
CREATE TABLE connection_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  server_id INTEGER REFERENCES servers(id),
  action TEXT CHECK(action IN ('open','view_credentials','copy_ip')),
  protocol TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_connection_logs_user ON connection_logs(user_id, created_at);
CREATE INDEX idx_connection_logs_server ON connection_logs(server_id, created_at);
```

---

## Implementation Order

```
v1.5.0  → Health Monitoring
v1.6.0  → Server Grouping / Tags
v1.7.0  → Quick Connect
v1.8.0  → Connection History / Audit Log
v2.0.0  → (Future: stats, favorites, notifications)
```

## Technical Notes

- Each version is a feature branch: `feat/health-monitoring`, `feat/server-grouping`, etc.
- Merge to `main` after review + test per feature
- Update CHANGELOG.md per release
- All features maintain existing auth/permission model (admin vs staff)
- Database migrations in `backend/migrations/` with timestamp prefix

---

## Future Considerations (Post v2.0.0)

- Real-time WebSocket updates (vs polling)
- CPU/RAM/Disk stats per server
- User favorites / pinned servers
- Email/Slack notifications for alerts
- Bulk server operations
