import ldap from 'ldapjs';
import Database from 'better-sqlite3';

const db = new Database('./portal.db');

async function main() {
  const client = ldap.createClient({ url: 'ldap://10.78.78.61:389', connectTimeout: 8000 });
  await new Promise((res, rej) => {
    client.bind('access.server@ad.ast.com', 'K@limalang12345', (err) => {
      if (err) return rej(err); res();
    });
  });

  // Approach: ambil semua user satu per satu dengan scope 'base'
  // lalu baca objek raw untuk lihat apa yg ada
  const testUsers = ['irsan@ad.ast.com', 'agung@ad.ast.com', 'backup@ad.ast.com', 'admin@ad.ast.com'];

  for (const upn of testUsers) {
    // Cari DN user
    const entries = await new Promise((res) => {
      const r = [];
      client.search('DC=ad,DC=ast,DC=com', {
        filter: `(userPrincipalName=${upn})`,
        scope: 'sub',
      }, (err, s) => {
        if (err) { res(r); return; }
        s.on('searchEntry', (e) => r.push(e));
        s.on('end', () => res(r));
      });
    });
    if (entries.length === 0) {
      console.log(`${upn}: NOT FOUND`);
      continue;
    }
    const entry = entries[0];
    // Inspect the raw entry
    console.log(`\n=== ${upn} ===`);
    console.log(`  dn: ${entry.dn || entry._dn || 'none'}`);
    console.log(`  objectName: ${entry.objectName}`);

    // Access attributes
    if (entry.attributes) {
      for (const attr of entry.attributes) {
        const vals = attr.values || attr._vals || [];
        if (attr.type === 'memberOf') {
          console.log(`  memberOf (${vals.length} entries):`);
          vals.slice(0, 10).forEach(v => console.log(`    - ${v}`));
        }
      }
    }

    // Also try entry.object
    const obj = entry.object || {};
    const keys = Object.keys(obj).filter(k => !k.startsWith('_') && k !== 'objectClass');
    console.log(`  keys: ${keys.join(', ')}`);
    const memberOf = obj.memberOf || [];
    if (Array.isArray(memberOf) && memberOf.length > 0) {
      console.log(`  obj.memberOf (${memberOf.length}):`);
      memberOf.slice(0, 10).forEach(v => console.log(`    - ${v}`));
    }
  }

  client.destroy();
}

main().catch(e => console.error('ERROR:', e.message));
