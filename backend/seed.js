import { initDb, getDb } from './database.js';
import bcrypt from 'bcryptjs';

const db = initDb();

// Seed Roles (built-in, selalu diperlukan)
const builtinRoles = [
  {
    name: 'Admin',
    description: 'Full access ke seluruh fitur portal',
    color: 'purple',
    is_builtin: 1,
    permissions: JSON.stringify(['manage-servers', 'manage-users', 'manage-roles', 'manage-settings', 'view-logs', 'export-data']),
  },
  {
    name: 'Staff',
    description: 'Hanya bisa melihat dashboard dan mengakses server',
    color: 'gray',
    is_builtin: 1,
    permissions: JSON.stringify([]),
  },
];

for (const r of builtinRoles) {
  db.prepare(`INSERT OR IGNORE INTO roles (name, description, color, is_builtin, permissions) VALUES (?, ?, ?, ?, ?)`)
    .run(r.name, r.description, r.color, r.is_builtin, r.permissions);
}

// Seed Users (selalu diperlukan untuk login)
const hash = bcrypt.hashSync('admin123', 10);
const hash2 = bcrypt.hashSync('staff123', 10);

const stmtUser = db.prepare(`INSERT OR IGNORE INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`);
stmtUser.run('Administrator', 'admin', 'admin@portal.local', hash, 'admin');
stmtUser.run('Staff User', 'staff', 'staff@portal.local', hash2, 'staff');

// Assign Admin role ke user 1
const adminRole = db.prepare(`SELECT id FROM roles WHERE name = 'Admin'`).get();
const staffRole = db.prepare(`SELECT id FROM roles WHERE name = 'Staff'`).get();
db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(1, adminRole.id);
db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(2, staffRole.id);

// Seed Settings (konfigurasi dasar)
const settings = [
  ['portal_name', 'Server Access Portal AST', 'string'],
  ['status_check_interval', '60', 'integer'],
  ['status_check_enabled', 'true', 'boolean'],
  ['default_theme', 'light', 'string'],
  ['items_per_page', '12', 'integer'],
  ['session_timeout', '120', 'integer'],
  ['max_login_attempts', '5', 'integer'],
  ['chat_upload_whitelist', '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.zip,.rar,.exe,.msi,.7z', 'string'],
];

const stmtSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value, type) VALUES (?, ?, ?)`);
for (const s of settings) {
  stmtSetting.run(...s);
}

console.log('✅ Seed selesai: 2 roles, 2 users, 7 settings (NO demo servers)');
