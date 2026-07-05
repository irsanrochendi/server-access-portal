import { getDb } from './database.js';
import crypto from 'crypto';

const db = getDb();

// AES-256 encryption (sama dengan di routes/resources.js)
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef', 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Seed sample resources
const sampleResources = [
  {
    name: 'Google Drive',
    url: 'https://drive.google.com',
    type: 'web',
    username: 'admin@company.com',
    password: 'admin123',
    category: 'Productivity',
    description: 'Company shared drive'
  },
  {
    name: 'Dev Server RDP',
    url: '192.168.1.100',
    type: 'rdp',
    username: 'Administrator',
    password: 'DevPass2024',
    category: 'Servers',
    description: 'Development RDP server'
  },
  {
    name: 'SSH Production',
    url: '10.0.0.50',
    type: 'ssh',
    username: 'root',
    password: 'Prod#2024',
    category: 'Servers',
    description: 'Production SSH access'
  }
];

console.log('Seeding resources...');

const stmt = db.prepare(`
  INSERT INTO resources (name, url, type, username, password_encrypted, category, description)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const r of sampleResources) {
  const encrypted = encrypt(r.password);
  stmt.run(r.name, r.url, r.type, r.username, encrypted, r.category, r.description);
  console.log(`✓ ${r.name}`);
}

console.log('\n✅ Seeded', sampleResources.length, 'resources');
