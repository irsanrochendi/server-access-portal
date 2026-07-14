import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'portal.db');

// Set timezone to Jakarta (WIB, UTC+7)
process.env.TZ = 'Asia/Jakarta';

let db;

/**
 * Get current timestamp in Jakarta timezone as ISO string for SQLite.
 * Use this for INSERT/UPDATE operations that need consistent timestamps.
 */
export function now() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
}

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

  // ─── v2.0.0: Merge Resource → Server ─────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS server_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_server_assignments_server ON server_assignments(server_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_server_assignments_user ON server_assignments(user_id)`);

  // Migration: add credential columns to servers
  const sCols = d.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
  if (!sCols.includes('shared_username')) {
    d.exec(`ALTER TABLE servers ADD COLUMN shared_username TEXT DEFAULT ''`);
  }
  if (!sCols.includes('shared_password_encrypted')) {
    d.exec(`ALTER TABLE servers ADD COLUMN shared_password_encrypted TEXT DEFAULT ''`);
  }
  if (!sCols.includes('auto_login_enabled')) {
    d.exec(`ALTER TABLE servers ADD COLUMN auto_login_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!sCols.includes('logo_url')) {
    d.exec(`ALTER TABLE servers ADD COLUMN logo_url TEXT DEFAULT NULL`);
  }

  // ─── v1.6.0: Quick Connect & Connection History ──────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS connection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_connection_logs_user_server ON connection_logs(user_id, server_id, connected_at DESC)`);

  // ─── v1.7.0: Server Grouping ──────────────────────────────────────────────

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

  // Migration: add metadata column to activity_logs (used by open.js, logs.js, tokens.js)
  const aCols = d.prepare("PRAGMA table_info(activity_logs)").all().map(c => c.name);
  if (!aCols.includes('metadata')) {
    d.exec(`ALTER TABLE activity_logs ADD COLUMN metadata TEXT`);
  }

  // divisions: organizational divisions for chat rooms
  d.exec(`
    CREATE TABLE IF NOT EXISTS divisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed default divisions if none exist
  const divCount = d.prepare('SELECT COUNT(*) as cnt FROM divisions').get();
  if (divCount.cnt === 0) {
    const insertDiv = d.prepare('INSERT INTO divisions (name, description) VALUES (?, ?)');
    insertDiv.run('IT', 'Divisi Teknologi Informasi');
    insertDiv.run('HRD', 'Divisi Human Resource Development');
    insertDiv.run('Finance', 'Divisi Keuangan');
    insertDiv.run('Marketing', 'Divisi Marketing');
  }

  // === TASK 1: New tables for announcements, chat, and forum ===

  // announcements: company-wide announcements
  d.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT DEFAULT NULL
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements(author_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC)`);

  // chat_rooms: custom chat rooms
  d.exec(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'public' CHECK(type IN ('public', 'private')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // chat_messages: real-time chat messages
  d.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT 'general',
      reply_to INTEGER DEFAULT NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
      attachment_url TEXT DEFAULT NULL,
      attachment_name TEXT DEFAULT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room, created_at DESC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_chat_reply ON chat_messages(reply_to)`);

  // forum_categories: forum category definitions
  d.exec(`
    CREATE TABLE IF NOT EXISTS forum_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT DEFAULT 'message-circle',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      topic_count INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_cat_sort ON forum_categories(sort_order)`);

  // forum_topics: forum topics within categories
  d.exec(`
    CREATE TABLE IF NOT EXISTS forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      last_reply_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_topic_cat ON forum_topics(category_id, created_at DESC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_topic_author ON forum_topics(author_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_topic_pinned ON forum_topics(is_pinned, updated_at DESC)`);

  // forum_replies: replies to forum topics
  d.exec(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_reply_topic ON forum_replies(topic_id, created_at ASC)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_reply_author ON forum_replies(author_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_forum_reply_parent ON forum_replies(parent_id)`);

  // Seed default forum categories if none exist
  const catCount = d.prepare('SELECT COUNT(*) as cnt FROM forum_categories').get();
  if (catCount.cnt === 0) {
    const insertCat = d.prepare('INSERT INTO forum_categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)');
    const defaultCats = [
      ['Umum', 'Diskusi dan pertanyaan umum', 'message-circle', 1],
      ['Teknis', 'Topik teknis dan solusi', 'code', 2],
      ['Pengumuman', 'Pengumuman dan informasi penting', 'megaphone', 3],
      ['Lainnya', 'Topik lainnya', 'folder', 4]
    ];
    const seedInsert = d.transaction((cats) => {
      for (const cat of cats) {
        insertCat.run(...cat);
      }
    });
    seedInsert(defaultCats);
  }

  return d;
}
