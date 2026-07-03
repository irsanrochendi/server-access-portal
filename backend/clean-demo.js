import Database from 'better-sqlite3';

const db = new Database('./portal.db');

// Hapus SEMUA server demo bawaan seed
const demoIds = db.prepare(
  "SELECT id, name FROM servers WHERE name IN ('HRIS Server','Database MySQL','Monitoring Server','File Server','Staging App','Development Server','Git Server','FTP Server')"
).all();

demoIds.forEach(s => {
  db.prepare('DELETE FROM servers WHERE id = ?').run(s.id);
  console.log('Deleted: ' + s.name);
});

// Tampilkan yang tersisa
const remaining = db.prepare('SELECT id, name, access_url FROM servers ORDER BY id').all();
console.log('\nTersisa:');
remaining.forEach(s => console.log(s.id + ': ' + s.name + ' → ' + s.access_url));
