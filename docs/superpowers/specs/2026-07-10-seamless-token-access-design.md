# Design: Seamless Token-Based Server Access (SSO Side B)

**Date:** 2026-07-10
**Status:** Approved
**Version:** v2.2.0

---

## Overview

Enhance server access security by replacing credential-in-browser flow with time-limited, single-use tokens. Passwords never reach the browser JavaScript heap — they are decrypted and consumed only at the backend, right before launching the target application (RDP client or browser).

This is **Side B** of the SSO vision: seamless access to target servers. Side A (portal login via Kerberos/SPNEGO) is deferred to a future release.

---

## Motivation

**Current problem:**
- When admin clicks the lock icon, server credentials are decrypted and displayed in the browser
- Credentials pass through the JavaScript heap and DOM — susceptible to XSS, malicious browser extensions, or shoulder-surfing
- RDP files are generated client-side with raw credentials embedded

**Desired outcome:**
- Credentials are never exposed to the browser
- One-click access: user clicks "Buka Server" → directly connected (no credential modal)
- Each access is mediated by a single-use, short-lived token
- Full audit trail of every token generation and consumption

---

## Design

### Approach: Token-Mediated Credential Delivery

Single-use cryptographically random tokens delivered via HTTPS, resolved at the backend. The token is consumed (marked used) before the credential is decrypted and delivered to the target protocol handler.

Credentials never appear in:
- Browser JavaScript heap
- DOM
- Local storage / session storage
- URL query strings (for RDP; URL-based auto-login for HTTP uses server-side redirect)

### Token Lifecycle

```
Generate ──► Deliver to Client ──► Consume ──► Delete
  (POST)       (HTTPS body)       (GET)       (mark used_at)
    │                                │
    │  30s expiry                    │  Single-use
    │  per-user binding              │  Hash verification
    │                                │
    ▼                                ▼
  stored as                    credential decrypted
  SHA256(token)                 at the last moment
```

---

## API Specification

### 1. Request Token

```
POST /api/open/:id/request
Authorization: Bearer <jwt>
Content-Type: application/json

Body:
{
  "protocol": "rdp" | "http" | "https"
}

Response 200:
{
  "token": "<64-char hex>",
  "expires_in": 30,
  "protocol": "rdp",
  "server_name": "DC-Prod-01"
}

Errors:
  403 — User tidak memiliki akses ke server ini
  404 — Server tidak ditemukan
  400 — Protocol tidak didukung
```

**Backend logic:**
1. Authenticate via JWT
2. Check server exists and user has access (own division, assigned, or admin)
3. Generate `token = crypto.randomBytes(32).toString('hex')`
4. Store `SHA256(token)` in `access_tokens` table with user_id, server_id, protocol, created_at, expires_at (now + 30s)
5. Return plaintext token to client (only travels over HTTPS response body)
6. Log to `activity_logs`: action=`token_request`

### 2. Download RDP File (via Token)

```
GET /api/open/:id/rdp-file?token=<token>

Response 200:
Content-Type: application/x-rdp
Content-Disposition: attachment; filename="server-name.rdp"

<generated .rdp file with embedded credentials>

Errors:
  401 — Token invalid, expired, or already used
  404 — Server tidak ditemukan
```

**Backend logic:**
1. Hash(token) → look up in `access_tokens`
2. Validate: `used_at IS NULL AND expires_at > now() AND revoked = 0`
3. Mark `used_at = datetime('now')`
4. Decrypt server credentials (AES-256)
5. Generate .rdp file with `full address:s:<ip>:<port>`, `username:s:<username>`, `password 01:b:<encrypted_password>` (RDP file obfuscation, not true encryption)
6. Log to `activity_logs`: action=`server_access`, metadata contains token_id
7. Return .rdp file as attachment

### 3. Launch HTTP/HTTPS (via Token)

```
GET /api/open/:id/launch?token=<token>

Response:
  302 Redirect to target URL with credentials applied

Errors:
  401 — Token invalid, expired, or already used
```

**Backend logic:**
1. Hash(token) → look up → validate (same as RDP)
2. Mark `used_at = datetime('now')`
3. Decrypt credentials
4. For `auto_login_enabled` servers: construct URL with credentials embedded (varies by target — e.g., basic auth in URL, or query params)
5. For servers without auto_login: redirect to target URL directly (no credentials)
6. Log to `activity_logs`: action=`server_access`
7. Return 302 redirect

---

## Database Schema

### New Table: `access_tokens`

```sql
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
);

CREATE INDEX idx_access_tokens_hash ON access_tokens(token_hash);
CREATE INDEX idx_access_tokens_expiry ON access_tokens(expires_at);
CREATE INDEX idx_access_tokens_user ON access_tokens(user_id);
```

### Token Cleanup

Background job runs every 5 minutes:
```sql
DELETE FROM access_tokens WHERE expires_at < datetime('now') AND used_at IS NULL;
```

Also runs on server startup.

---

## Frontend Changes

### Modified Components

| Component | Changes |
|-----------|---------|
| `ServerCard.jsx` | "Buka Server" button → seamless flow: POST request token → download RDP / open URL. Loading spinner during token request. Error fallback to modal. |
| `QuickConnectModal.jsx` | Same seamless flow as ServerCard |
| `services/api.js` | Add: `requestOpenToken(id, protocol)`, download helpers |

### Modified Behavior

**Before:** Click "Buka Server" → Modal with protocol choice → Click → Open server
**After:** Click "Buka Server" → Loading state (0.5-1s) → Auto-download RDP file or open browser tab

**Before:** Click Lock icon → View credentials in modal
**After:** Click Lock icon → Reason dialog → View credentials (admin only, still available for emergency/manual use)

### Credential Reveal (Admin Emergency Access)

Admin credential reveal tetap dipertahankan dengan tambahan **reason gate**:
- Admin klik lock icon → modal minta alasan → submit → credentials ditampilkan
- Reason dicatat di `activity_logs` dengan action=`credential_access` dan metadata berisi reason
- Ini mencegah kebiasaan buruk (reveal credential tanpa alasan jelas)

### Error Handling

| Scenario | UI Response |
|----------|------------|
| Token expired (rare, 30s window) | Toast: "Token kadaluarsa, silakan coba lagi" |
| Token already used (replay attempt) | Toast: "Akses sudah digunakan" + log security event |
| No access to server | Toast: "Anda tidak memiliki akses ke server ini" |
| Network error | Toast: "Gagal menghubungi server" + retry button |
| Backend down | Toast: "Layanan sedang tidak tersedia" |

---

## Security Considerations

### Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| XSS credential theft | Credentials never in JS heap or DOM |
| Token replay | Single-use (used_at check) + 30s TTL |
| Token enumeration | 64-char hex = 256-bit entropy, infeasible to brute-force |
| Token theft via browser history | Token in query string only for the GET redirect; RDP file is downloaded, not rendered |
| Man-in-the-middle | All token traffic over HTTPS; token in Authorization header for POST, query string for GET (TLS-encrypted) |
| Database compromise | Only SHA256 hashes stored, not raw tokens |

### Limitations (Accepted Risk)

- RDP file on disk: `.rdp` file contains obfuscated credentials (Remote Desktop's built-in encryption — NOT true encryption). Mitigated by: auto-delete RDP file after use (can be added later), file is in temp directory.
- Token in query string for GET endpoints: visible in server logs. Mitigated by: single-use + 30s TTL + HTTPS in transit.
- No refresh token: each "Buka Server" click requires a fresh token request. Acceptable UX trade-off.

---

## Testing Strategy

### Backend

| Test | Scope |
|------|-------|
| POST /api/open/:id/request returns token | Unit + integration |
| GET /api/open/:id/rdp-file with valid token returns .rdp file | Integration |
| GET /api/open/:id/rdp-file with used token returns 401 | Integration |
| GET /api/open/:id/rdp-file with expired token returns 401 | Integration |
| GET /api/open/:id/rdp-file with wrong user's token returns 401 | Integration |
| Token cleanup job removes stale tokens | Unit |
| Non-admin cannot request token for unassigned server | Integration |
| Admin can request token for any server | Integration |
| Activity log entries created for token_request and server_access | Integration |

### Frontend

| Test | Scope |
|------|-------|
| Click "Buka Server" → loading state → RDP file downloaded | E2E or manual |
| Error state when token expired | Manual |
| Credential reveal reason dialog | Manual |

---

## Migration & Rollout

- **No breaking changes** to existing API endpoints
- New `access_tokens` table is additive (no migration of existing data needed)
- Old credential reveal flow remains as admin-only fallback
- Existing `activity_logs` and `server_assignments` unaffected

---

## Future Considerations

- **Kerberos/SPNEGO SSO (Side A):** Login portal via Windows Integrated Authentication
- **SSH token support:** Extend token flow to SSH (currently manual flow)
- **Auto-delete RDP file after disconnect:** Clean up temp directory
- **Session recording:** Track duration of server access sessions
- **Local thin agent (Approach 2):** Eliminate credential in RDP file entirely
- **Approval workflow:** Require manager approval before token generation for sensitive servers
