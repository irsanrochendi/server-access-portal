import Database from 'better-sqlite3';
const db = new Database('./portal.db');

// Set divisi untuk staff user
db.prepare("UPDATE users SET division = 'Engineer' WHERE email = 'staff@portal.local'").run();

// Verifikasi
const users = db.prepare('SELECT id, name, email, division FROM users').all();
users.forEach(u => console.log(u.id + ': ' + u.name + ' | ' + u.email + ' | division=' + (u.division || '(kosong)')));
