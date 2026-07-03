import ldap from 'ldapjs';

async function main() {
  const client = ldap.createClient({ url: 'ldap://10.78.78.61:389', connectTimeout: 8000 });
  await new Promise((res, rej) => {
    client.bind('access.server@ad.ast.com', 'K@limalang12345', (err) => {
      if (err) return rej(err); res();
    });
  });

  // Search with NO filter — get everything
  const all = [];
  for (const base of ['DC=ad,DC=ast,DC=com', 'CN=Users,DC=ad,DC=ast,DC=com', 'OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com']) {
    await new Promise((res) => {
      client.search(base, {
        filter: '(userPrincipalName=*)',
        scope: 'sub',
        attributes: ['userPrincipalName', 'displayName', 'cn', 'memberOf', 'primaryGroupID', 'distinguishedName'],
        timeLimit: 8,
      }, (err, r) => {
        if (err) { res(); return; }
        r.on('searchEntry', (e) => {
          all.push({ upn: e.object?.userPrincipalName, name: e.object?.displayName || e.object?.cn, dn: e.object?.distinguishedName, memberOf: e.object?.memberOf || [], pgid: e.object?.primaryGroupID });
        });
        r.on('error', () => {});
        r.on('end', () => res());
      });
    });
  }

  console.log(`Total users: ${all.length}\n`);

  // Print 5 samples + specific users
  const keyNames = ['backup', 'nextcloud', 'vpn', 'angel', 'agung', 'irsan', 'aceng', 'access server'];
  const seen = new Set();
  for (const u of all) {
    const name = (u.name || u.upn || '').toLowerCase();
    const isKey = keyNames.some(k => name.includes(k));
    if (!isKey && seen.size < 5 && u.memberOf.length > 0) {
      console.log(`\n>>> ${u.name || u.upn} (${u.upn}) <<<`);
      console.log(`  memberOf: ${u.memberOf.length} | primaryGroupID: ${u.pgid}`);
      u.memberOf.slice(0, 8).forEach(m => {
        const cn = typeof m === 'string' ? m.split(',')[0].replace('CN=', '') : JSON.stringify(m);
        console.log(`    ${cn}`);
      });
      seen.add(u.upn);
    } else if (isKey) {
      console.log(`\n★★★ ${u.name || u.upn} (${u.upn}) ★★★`);
      console.log(`  memberOf: ${u.memberOf.length} | primaryGroupID: ${u.pgid}`);
      u.memberOf.forEach(m => {
        const cn = typeof m === 'string' ? m.split(',')[0].replace('CN=', '') : JSON.stringify(m);
        console.log(`    ${cn}`);
      });
    }
  }

  // Search groups with CN filter
  const groups = await new Promise((res, rej) => {
    const results = [];
    client.search('DC=ad,DC=ast,DC=com', {
      filter: '(|(cn=IT-Team)(cn=Administrators)(cn=BOD)(cn=Purchase-Marketing-Team)(cn=Finance-HR-Team)(cn=Domain Users)(cn=AST-RADIUS-Auth)(cn=Users))',
      scope: 'sub',
      attributes: ['cn', 'distinguishedName', 'groupType', 'sAMAccountType'],
    }, (err, r) => {
      if (err) return rej(err);
      r.on('searchEntry', (e) => {
        results.push({ cn: e.object?.cn, dn: e.object?.distinguishedName, type: e.object?.groupType, samType: e.object?.sAMAccountType });
      });
      r.on('error', rej);
      r.on('end', () => res(results));
    });
  });
  console.log(`\n\n=== GROUPS (filtered) ===`);
  groups.forEach(g => console.log(`  ${g.cn} | DN: ${g.dn} | groupType: ${g.type}`));

  // Count all unique groups
  const groupCounts = {};
  for (const u of all) {
    for (const m of u.memberOf) {
      if (typeof m !== 'string') continue;
      const cn = m.split(',')[0].replace('CN=', '');
      groupCounts[cn] = (groupCounts[cn] || 0) + 1;
    }
  }
  const sorted = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== TOP 20 GROUP DISTRIBUTION ===`);
  sorted.slice(0, 20).forEach(([cn, count]) => console.log(`  ${cn}: ${count} users`));

  client.destroy();
}

main().catch(e => console.error('ERROR:', e.message));
