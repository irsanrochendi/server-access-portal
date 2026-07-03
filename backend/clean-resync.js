import Database from 'better-sqlite3';
const db = new Database('./portal.db');

// Hapus semua user AD
db.prepare("DELETE FROM users WHERE password_hash = 'AD_USER'").run();

// Hapus user yang emailnya ga valid (service accounts dll)
db.prepare("DELETE FROM users WHERE email NOT LIKE '%@%' AND id > 3").run();

// Hapus user yg password_hash null/empty tapi bukan local
db.prepare("DELETE FROM users WHERE password_hash IS NULL AND id > 3").run();

const remaining = db.prepare('SELECT count(*) as c FROM users').get().c;
console.log(remaining + ' users remaining. Now click Sync AD.');
