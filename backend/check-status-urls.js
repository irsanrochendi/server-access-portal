import Database from 'better-sqlite3';
const db = new Database('./portal.db');

const servers = db.prepare(
  `SELECT id, name, ip_address, port, protocol, access_url, status_check_url, status_check_method, status
   FROM servers
   WHERE status != 'online' OR status_check_url IS NULL OR status_check_url = ''
   ORDER BY id`
).all();

console.log('Server yang belum ONLINE atau belum punya status check URL:\n');
servers.forEach(s => {
  console.log(`ID ${s.id}: ${s.name}`);
  console.log(`   IP: ${s.ip_address}:${s.port} | ${s.protocol}`);
  console.log(`   status=${s.status} | check_url=${s.status_check_url || '(KOSONG)'} | method=${s.status_check_method}`);
  console.log('');
});
