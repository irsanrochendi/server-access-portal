import ldap from 'ldapjs';

const AD_CONFIG = {
  url: 'ldap://10.78.78.61:389',
  baseDN: 'DC=ad,DC=ast,DC=com',
  username: 'access.server@ad.ast.com',
  password: 'K@limalang12345',
  enabled: true,
  userFilter: '(&(objectclass=person)(|(memberof=CN=Purchase-Marketing-Team,OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com)(primaryGroupID=1105)(memberof=CN=IT-Team,OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com)(primaryGroupID=1103)(memberof=CN=Domain Users,CN=Users,DC=ad,DC=ast,DC=com)(primaryGroupID=513)(memberof=CN=BOD,OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com)(primaryGroupID=1126)(memberof=CN=Administrators,CN=Builtin,DC=ad,DC=ast,DC=com)(primaryGroupID=544)(memberof=CN=AST-RADIUS-Auth,CN=Users,DC=ad,DC=ast,DC=com)(primaryGroupID=1107)(memberof=CN=Finance-HR-Team,OU=AST-DC-NETWORK,DC=ad,DC=ast,DC=com)(primaryGroupID=1104)))',
  groupFilter: '(|(cn=Purchase-Marketing-Team)(cn=IT-Team)(cn=Finance-HR-Team)(cn=Administrators)(cn=BOD)(cn=AST-RADIUS-Auth)(cn=Users)(cn=Domain Users))',
};

const EXCLUDED_EMAILS = ['access.server@ad.ast.com', 'nextcloud@ad.ast.com'];

const ROLE_MAP = {
  'administrators': 'admin', 'bod': 'admin',
  'it-team': 'staff', 'ast-radius-auth': 'staff', 'purchase-marketing-team': 'staff',
  'finance-hr-team': 'staff', 'users': 'staff', 'domain users': 'staff',
};

let cachedConfig = { ...AD_CONFIG };

export function getAdConfig() { return { ...cachedConfig }; }
export function updateAdConfig(updates) { cachedConfig = { ...cachedConfig, ...updates }; }

/** Parse raw LDAP entry object into a normal JS object */
function parseEntry(entry) {
  const obj = {};
  if (entry.attributes) {
    for (const attr of entry.attributes) {
      const key = attr.type || attr.type;
      const vals = attr.values || attr._vals || attr.vals || [];
      if (key) obj[key] = vals.length === 1 ? vals[0] : vals;
    }
  }
  // Also try direct .pojo or .object
  const src = entry.pojo || entry.object || entry;
  for (const [k, v] of Object.entries(src)) {
    if (!obj[k]) obj[k] = v;
  }
  return obj;
}

async function createClient(cfg) {
  const config = cfg || cachedConfig;
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: config.url, connectTimeout: 8000 });
    client.on('connectError', reject);
    client.on('error', reject);
    client.bind(config.username, config.password, (err) => {
      if (err) return reject(err);
      resolve(client);
    });
  });
}

function searchLdap(client, base, filter) {
  return new Promise((resolve, reject) => {
    const results = [];
    client.search(base, { filter, scope: 'sub', timeLimit: 10 }, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => { results.push(parseEntry(entry)); });
      res.on('error', reject);
      res.on('end', (result) => { if (result?.status !== 0) reject(new Error(`LDAP result code ${result?.status}`)); else resolve(results); });
    });
  });
}

async function bindUser(userDN, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: cachedConfig.url, connectTimeout: 5000 });
    client.on('error', () => { client.destroy(); reject(new Error('Connection error')); });
    client.bind(userDN, password, (err) => {
      client.destroy();
      if (err) return reject(err);
      resolve();
    });
  });
}

// ══════════════════════════════════════════════════════════
// AUTHENTICATE
// ══════════════════════════════════════════════════════════
export async function authenticateAD(email, password) {
  if (!cachedConfig.enabled) return { success: false, error: 'AD login disabled' };

  const upn = email.includes('@') ? email : `${email}@ad.ast.com`;
  const sam = upn.split('@')[0];

  let client;
  try {
    client = await createClient();

    // Cari user: coba userPrincipalName dulu, lalu sAMAccountName
    let userEntry;
    try {
      const results = await searchLdap(client, cachedConfig.baseDN,
        `(&${cachedConfig.userFilter}(userPrincipalName=${upn}))`);
      userEntry = results[0];
    } catch (e) { /* lanjut */ }

    if (!userEntry) {
      try {
        const results = await searchLdap(client, cachedConfig.baseDN,
          `(&${cachedConfig.userFilter}(sAMAccountName=${sam}))`);
        userEntry = results[0];
      } catch (e) { /* lanjut */ }
    }

    if (!userEntry) {
      client.destroy();
      return { success: false, error: 'User tidak ditemukan di AD atau tidak memiliki akses portal. Cek UPN: ' + upn };
    }

    if (EXCLUDED_EMAILS.includes(upn.toLowerCase())) {
      client.destroy();
      return { success: false, error: 'Akun ini tidak diizinkan login ke portal' };
    }

    const userDN = userEntry.dn || userEntry.distinguishedName;
    if (!userDN) { client.destroy(); return { success: false, error: 'User entry tidak memiliki DN' }; }

    // Verifikasi password via bind sebagai user
    try {
      await bindUser(userDN, password);
    } catch (e) {
      client.destroy();
      return { success: false, error: `Password AD salah (${e.message})` };
    }

    // Ambil groups
    let groups = [];
    try {
      const groupResults = await searchLdap(client, cachedConfig.baseDN,
        `(&${cachedConfig.groupFilter}(member=${userDN}))`);
      groups = groupResults.map(g => g.cn || g.sAMAccountName || '').map(v =>
        typeof v === 'string' ? v : Array.isArray(v) ? v[0] : ''
      );
    } catch (e) { /* non-critical */ }

    client.destroy();

    // Mapping group → role
    let role = 'staff';
    for (const g of groups) {
      const mapped = ROLE_MAP[g.toLowerCase()];
      if (mapped === 'admin') { role = 'admin'; break; }
      if (mapped === 'staff') role = 'staff';
    }

    const displayName = userEntry.displayName || userEntry.cn || sam;
    return {
      success: true,
      user: {
        email: upn,
        name: typeof displayName === 'string' ? displayName : Array.isArray(displayName) ? displayName[0] : sam,
        role,
        dn: userDN,
        groups,
      },
    };
  } catch (err) {
    if (client) try { client.destroy(); } catch (e) {}
    return { success: false, error: `Koneksi AD gagal: ${err.message}` };
  }
}

// ══════════════════════════════════════════════════════════
// LIST ALL AD USERS (untuk sync ke portal)
// ══════════════════════════════════════════════════════════
export async function listAdUsers() {
  const client = await createClient();

  // Semua user yang lolos userFilter
  const users = await searchLdap(client, cachedConfig.baseDN,
    `(&${cachedConfig.userFilter}(userPrincipalName=*))`);

  // Ambil groups untuk semua user
  const allGroups = await searchLdap(client, cachedConfig.baseDN, cachedConfig.groupFilter);

  client.destroy();

  // Map DN→groups via memberOf pada user entry itu sendiri
  const result = [];
  for (const rawEntry of users) {
    // memberOf di ldapjs ada di rawEntry.attributes[], bukan di rawEntry.object[]
    let upn = '', name = '', dn = '', memberOfList = [];

    // Coba dari rawEntry.object
    const obj = rawEntry.object || rawEntry;
    upn = obj.userPrincipalName || '';
    name = obj.displayName || obj.cn || obj.name || '';
    dn = obj.distinguishedName || rawEntry.dn || '';

    // Coba dari rawEntry.attributes (ldapjs style)
    if (rawEntry.attributes && Array.isArray(rawEntry.attributes)) {
      for (const attr of rawEntry.attributes) {
        const vals = attr.values || [];
        if (attr.type === 'userPrincipalName') upn = typeof vals[0] === 'string' ? vals[0] : upn;
        if (attr.type === 'displayName') name = typeof vals[0] === 'string' ? vals[0] : name;
        if (attr.type === 'cn' && !name) name = typeof vals[0] === 'string' ? vals[0] : name;
        if (attr.type === 'distinguishedName') dn = typeof vals[0] === 'string' ? vals[0] : dn;
        if (attr.type === 'memberOf') memberOfList = vals.filter(v => typeof v === 'string');
      }
    }

    const email = typeof upn === 'string' ? upn : Array.isArray(upn) ? upn[0] : '';

    // Parse groups dari memberOf DN
    const groups = [];
    for (const ldapDN of memberOfList) {
      const match = ldapDN.match(/^CN=([^,]+)/i);
      if (match) {
        const cn = match[1];
        const filterList = ['Purchase-Marketing-Team','IT-Team','Finance-HR-Team','Administrators','BOD','AST-RADIUS-Auth','Users','Domain Users'];
        if (filterList.some(f => cn.toLowerCase() === f.toLowerCase())) {
          groups.push(cn);
        }
      }
    }

    // Mapping role
    let role = 'staff';
    for (const g of groups) {
      const mapped = ROLE_MAP[g.toLowerCase()];
      if (mapped === 'admin') { role = 'admin'; break; }
      if (mapped === 'staff') role = 'staff';
    }

    if (email && !EXCLUDED_EMAILS.includes(email.toLowerCase())) {
      result.push({
        email,
        name: typeof name === 'string' && name ? name : email.split('@')[0],
        role,
        groups,
        dn,
      });
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════
export async function testAdConnection(config) {
  const tempConfig = { ...cachedConfig, ...config };
  try {
    const client = await createClient(tempConfig);
    let userCount = 0, groupCount = 0;
    try {
      const users = await searchLdap(client, tempConfig.baseDN, `(&${tempConfig.userFilter}(userPrincipalName=*))`);
      userCount = users.length;
    } catch (e) {}
    try {
      const groups = await searchLdap(client, tempConfig.baseDN, tempConfig.groupFilter);
      groupCount = groups.length;
    } catch (e) {}
    client.destroy();
    return { success: true, message: `Connected: ${userCount} users, ${groupCount} groups found`, userCount, groupCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
