import Database from 'better-sqlite3';

const db = new Database('./portal.db');

console.log('=== TABLES ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log('  ' + t.name));

console.log('\n=== SERVERS ===');
const servers = db.prepare('SELECT id, name, ip_address, access_url, status, browser_pref FROM servers').all();
servers.forEach(s => console.log(`  ${s.id}: ${s.name} | ${s.access_url} | ${s.status} | browser=${s.browser_pref}`));

console.log('\n=== USERS ===');
const users = db.prepare('SELECT id, name, email, role FROM users').all();
users.forEach(u => console.log(`  ${u.id}: ${u.name} (${u.email}) - ${u.role}`));

console.log('\n=== ROLES ===');
const roles = db.prepare('SELECT id, name, permissions FROM roles').all();
roles.forEach(r => console.log(`  ${r.id}: ${r.name} - ${r.permissions}`));

console.log('\n=== CATEGORIES (custom fields) ===');
const cats = db.prepare("SELECT * FROM custom_fields WHERE field_type='category'").all();
cats.forEach(c => console.log(`  ${c.id}: ${c.value}`));

console.log('\n=== SETTINGS ===');
const settings = db.prepare('SELECT key, value FROM settings').all();
settings.forEach(s => console.log(`  ${s.key} = ${s.value}`));

console.log('\n=== ACTIVITY LOGS (last 10) ===');
const logs = db.prepare('SELECT al.*, u.name as user_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 10').all();
logs.forEach(l => console.log(`  ${l.created_at}: ${l.user_name} - ${l.action} ${l.module} - ${l.description}`));
