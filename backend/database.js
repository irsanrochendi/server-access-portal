import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'portal.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Tutup koneksi database dan reset state.
 * Dipakai oleh fungsi restore yang perlu overwrite file DB.
 */
export function closeDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

export function initDb() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff')),
      division TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      theme_preference TEXT NOT NULL DEFAULT 'light',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      port INTEGER,
      protocol TEXT NOT NULL DEFAULT 'HTTP',
      access_url TEXT NOT NULL,
      description TEXT,
      category TEXT,
      environment TEXT NOT NULL DEFAULT 'Production' CHECK(environment IN ('Production','Staging','Development','Internal')),
      status_check_url TEXT,
      status_check_method TEXT DEFAULT 'http' CHECK(status_check_method IN ('http','tcp','health_endpoint','none')),
      browser_pref TEXT DEFAULT '' CHECK(browser_pref IN ('','firefox','chrome','edge')),
      visible_to TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online','offline','unknown')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT 'blue',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_type TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(field_type, value)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      type TEXT NOT NULL DEFAULT 'string',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS server_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE REFERENCES servers(id) ON DELETE CASCADE,
      default_username TEXT DEFAULT '',
      default_password_encrypted TEXT DEFAULT '',
      ssh_port INTEGER DEFAULT 22,
      vsphere_port INTEGER DEFAULT 443,
      notes TEXT DEFAULT '',
      license_key TEXT DEFAULT '',
      license_expire TEXT DEFAULT '',
      owner TEXT DEFAULT '',
      documentation_links TEXT DEFAULT '[]',
      visible_to TEXT DEFAULT '',  -- email users yang boleh lihat, kosong = admin only
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credential_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('view', 'copy')),
      ip_address TEXT,
      user_agent TEXT DEFAULT '',
      accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_server_notes_server_id ON server_notes(server_id);
    CREATE INDEX IF NOT EXISTS idx_cred_access_server ON credential_access_logs(server_id, accessed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cred_access_user ON credential_access_logs(user_id, accessed_at DESC);
  `);

  // Migrations for existing databases — add columns if missing
  const serverNotesCols = d.prepare("PRAGMA table_info(server_notes)").all().map(c => c.name);
  if (!serverNotesCols.includes('visible_to')) {
    d.exec(`ALTER TABLE server_notes ADD COLUMN visible_to TEXT DEFAULT ''`);
  }

  // Migration: add last_activity_at and token_version for Online Users feature
  const userCols = d.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('last_activity_at')) {
    d.exec(`ALTER TABLE users ADD COLUMN last_activity_at TEXT`);
  }
  if (!userCols.includes('token_version')) {
    d.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1`);
  }
  if (!userCols.includes('impersonated_by')) {
    d.exec(`ALTER TABLE users ADD COLUMN impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  }
  if (!userCols.includes('impersonation_expires_at')) {
    d.exec(`ALTER TABLE users ADD COLUMN impersonation_expires_at TEXT`);
  }

  // Index for online users query
  d.exec(`CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at)`);

  // ─── v1.5.0: Health Monitoring ───────────────────────────────────────────
  // server_uptime_history: stores each health check result over time
  d.exec(`
    CREATE TABLE IF NOT EXISTS server_uptime_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('online','offline','unknown')),
      latency_ms INTEGER,
      error TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_uptime_server_time ON server_uptime_history(server_id, checked_at)`);

  // alerts: server-down and recovery notifications
  d.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('down','recovery','latency')),
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read, is_resolved, created_at DESC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_server ON alerts(server_id, created_at DESC)`);

  // Migration: add last_checked_at if missing
  const serverCols = d.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
  if (!serverCols.includes('last_checked_at')) {
    d.exec(`ALTER TABLE servers ADD COLUMN last_checked_at TEXT`);
  }
  if (!serverCols.includes('latency_ms')) {
    d.exec(`ALTER TABLE servers ADD COLUMN latency_ms INTEGER`);
  }

  return d;
}
