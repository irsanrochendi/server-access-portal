import Database from 'better-sqlite3';
const db = new Database('./portal.db');

// Hapus semua user AD yang sudah di-import
const result = db.prepare("DELETE FROM users WHERE password_hash = 'AD_USER'").run();

console.log(result.changes + ' AD users deleted. Now click Sync AD to re-import with correct roles.');
