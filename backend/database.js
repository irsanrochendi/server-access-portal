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

  return d;
}
