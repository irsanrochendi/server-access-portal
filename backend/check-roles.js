import Database from 'better-sqlite3';
const db = new Database('./portal.db');

const admins = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' ORDER BY id").all();
const staff = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'staff' ORDER BY id").all();

console.log('ADMIN (' + admins.length + '):');
admins.forEach(u => console.log('  ' + u.name + ' - ' + u.email));
console.log('\nSTAFF (' + staff.length + '):');
staff.forEach(u => console.log('  ' + u.name + ' - ' + u.email));
