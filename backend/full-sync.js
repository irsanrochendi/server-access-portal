import ldap from 'ldapjs';

async function main() {
  const client = ldap.createClient({ url: 'ldap://10.78.78.61:389', connectTimeout: 8000 });
  await new Promise((res, rej) => {
    client.bind('access.server@ad.ast.com', 'K@limalang12345', (err) => {
      if (err) return rej(err); res();
    });
  });

  // Ambil SEMUA user yang punya UPN (langsung, no filter group)
  const allUsers = [];
  // Paging LDAP
  for (const base of [
    'DC=ad,DC=ast,DC=com',
    'CN=Users,DC=ad,DC=ast,DC=com',
    'OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com',
  ]) {
    await new Promise((res) => {
      client.search(base, {
        filter: '(&(objectClass=person)(userPrincipalName=*))',
        scope: 'sub',
        timeLimit: 10,
        paged: { pageSize: 500 },
      }, (err, r) => {
        if (err) { res(); return; }
        r.on('searchEntry', (e) => {
          const obj = {};
          if (e.attributes) {
            for (const attr of e.attributes) {
              obj[attr.type] = attr.values?.length === 1 ? attr.values[0] : (attr.values || []);
            }
          }
          allUsers.push(obj);
        });
        r.on('error', () => {});
        r.on('end', () => res());
      });
    });
  }

  // Deduplicate by UPN
  const seen = new Set();
  const unique = [];
  for (const u of allUsers) {
    const upn = typeof u.userPrincipalName === 'string' ? u.userPrincipalName : Array.isArray(u.userPrincipalName) ? u.userPrincipalName[0] : '';
    if (!upn || seen.has(upn)) continue;
    seen.add(upn);
    unique.push(u);
  }
  allUsers.length = 0;
  unique.forEach(u => allUsers.push(u));

  console.log(`Total unique AD users with UPN: ${allUsers.length}\n`);

  // Count by group
  const adminGroups = ['IT-Team', 'Administrators', 'BOD'];
  let adminCount = 0, staffCount = 0, noGroup = 0;

  for (const u of allUsers) {
    const upn = typeof u.userPrincipalName === 'string' ? u.userPrincipalName : '';
    const name = typeof u.displayName === 'string' ? u.displayName : (typeof u.cn === 'string' ? u.cn : '');
    const memberOf = Array.isArray(u.memberOf) ? u.memberOf : (typeof u.memberOf === 'string' ? [u.memberOf] : []);

    // Map CN from memberOf DNs
    const groups = memberOf.map(dn => {
      const m = dn.match(/^CN=([^,]+)/i);
      return m ? m[1] : '';
    }).filter(Boolean);

    const isAdmin = groups.some(g => adminGroups.includes(g));
    if (isAdmin) adminCount++;
    else if (groups.length === 0) { noGroup++; staffCount++; }
    else staffCount++;

    // Print sample
    if (allUsers.indexOf(u) < 5 || isAdmin) {
      console.log(`${isAdmin ? 'ADMIN' : 'staff'} | ${name || upn} | ${upn} | groups: ${groups.join(', ') || '(none)'}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Admin: ${adminCount} | Staff: ${staffCount} | No groups: ${noGroup}`);
  client.destroy();
}

main().catch(e => console.error('ERROR:', e.message));
