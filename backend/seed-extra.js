import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'portal.db'));

// Nextcloud Web
db.prepare(`INSERT INTO servers (name, ip_address, port, protocol, access_url, description, category, environment, status_check_url, status_check_method, status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  .run('Nextcloud Web', '10.78.78.159', 443, 'HTTPS', 'https://aldimana.duckdns.org', 'Nextcloud file sharing', 'Storage', 'Production', 'https://aldimana.duckdns.org/status.php', 'http', 'unknown');

// Nextcloud SSH
db.prepare(`INSERT INTO servers (name, ip_address, port, protocol, access_url, description, category, environment, status_check_method, status)
  VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run('Nextcloud SSH', '10.78.78.159', 22, 'SSH', '10.78.78.159:22', 'Nextcloud server SSH', 'Storage', 'Production', 'none', 'unknown');

// Console Kaseya Lokal — di-set Firefox
db.prepare(`INSERT INTO servers (name, ip_address, port, protocol, access_url, description, category, environment, status_check_url, status_check_method, browser_pref, status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run('Console Kaseya Lokal', '10.78.78.178', 443, 'HTTPS', 'https://10.78.78.178', 'Kaseya VSA Console', 'Monitoring', 'Production', 'https://10.78.78.178', 'http', 'firefox', 'unknown');

console.log('✅ 3 servers added: Nextcloud Web, Nextcloud SSH, Console Kaseya Lokal (Firefox)');
