import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Pastikan folder backups ada
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Jalankan backup database — copy file SQLite + metadata
 */
export function runBackup(label = 'manual') {
  const db = getDb();
  const dbPath = path.join(__dirname, '..', 'portal.db');

  // Pastikan WAL checkpoint dulu agar semua data ter-flush ke file utama
  db.pragma('wal_checkpoint(TRUNCATE)');

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${dateStr}${label !== 'manual' ? '-' + label : ''}.sqlite`;

  // Copy file database
  fs.copyFileSync(dbPath, path.join(BACKUP_DIR, filename));

  // Dapatkan statistik
  const tables = ['users', 'servers', 'activity_logs', 'roles', 'custom_fields', 'settings', 'user_roles'];
  const stats = {};
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    stats[table] = row.count;
  }

  // Tulis file metadata JSON
  const metaFilename = filename.replace('.sqlite', '.json');
  fs.writeFileSync(path.join(BACKUP_DIR, metaFilename), JSON.stringify({
    filename,
    timestamp: timestamp.toISOString(),
    label,
    database: 'portal.db',
    stats,
    fileSize: fs.statSync(path.join(BACKUP_DIR, filename)).size,
  }, null, 2));

  console.log(`📦 Backup selesai: ${filename}`);
  return { filename, timestamp: timestamp.toISOString(), ...stats, label };
}

/**
 * List semua file backup
 */
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => {
      const filePath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(filePath);
      const metaPath = filePath.replace('.sqlite', '.json');
      let meta = { label: 'manual', stats: {} };
      try {
        if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (_) {}

      // Parse timestamp dari filename: backup-YYYY-MM-DDTHH-mm-ss-*.sqlite
      const tsMatch = f.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      const timestamp = tsMatch ? tsMatch[1].replace(/-/g, ':').replace('T', ' ').slice(0, 19) : stat.mtime.toISOString();

      return {
        filename: f,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        timestamp,
        label: meta.label || 'manual',
        stats: meta.stats || {},
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return files;
}

/**
 * Hapus file backup tertentu
 */
export function deleteBackup(filename) {
  // Cegah path traversal
  const safe = path.basename(filename);
  const filePath = path.join(BACKUP_DIR, safe);
  const metaPath = filePath.replace('.sqlite', '.json');

  if (!fs.existsSync(filePath)) {
    throw new Error('File backup tidak ditemukan');
  }
  fs.unlinkSync(filePath);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  return { deleted: safe };
}

/**
 * Restore database dari file backup
 * - Backup dulu DB saat ini ke file safety-net
 * - Replace portal.db dengan file backup
 * - Tutup DB, swap file, re-init DB otomatis saat request berikutnya
 */
export function restoreBackup(filename) {
  // Cegah path traversal
  const safe = path.basename(filename);
  const backupPath = path.join(BACKUP_DIR, safe);

  if (!fs.existsSync(backupPath)) {
    throw new Error('File backup tidak ditemukan');
  }

  const db = getDb();
  const dbPath = path.join(__dirname, '..', 'portal.db');

  // Safety net: backup DB live saat ini dulu sebelum overwrite
  const safetyName = `pre-restore-${Date.now()}.sqlite`;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, path.join(BACKUP_DIR, safetyName));
    console.log(`🛡️  Safety backup: ${safetyName}`);
  } catch (e) {
    console.warn('Tidak bisa membuat safety backup:', e.message);
  }

  // Tutup koneksi DB agar file bisa di-overwrite di Windows
  closeDb();

  // Bersihkan file WAL/SHM dari live DB
  for (const ext of ['-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(dbPath + ext); } catch (_) {}
  }

  // Copy backup ke lokasi DB
  fs.copyFileSync(backupPath, dbPath);

  // Re-init DB (getDb() akan membuat koneksi baru)
  getDb();

  console.log(`♻️  Database direstore dari: ${safe}`);
  return {
    restoredFrom: safe,
    safetyBackup: safetyName,
    note: 'Database telah di-restore dan DB di-reconnect otomatis',
  };
}

/**
 * Hapus backup yang lebih lama dari N hari
 */
export function cleanOldBackups(retentionDays = 30) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sqlite'));
  let deleted = 0;
  for (const f of files) {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    if (stat.mtimeMs < cutoff) {
      deleteBackup(f);
      deleted++;
    }
  }
  console.log(`🧹 Cleanup backup: ${deleted} file lama dihapus (retensi ${retentionDays} hari)`);
  return { deleted };
}

/**
 * Dapatkan path absolut ke file backup
 */
export function getBackupPath(filename) {
  const safe = path.basename(filename);
  return path.join(BACKUP_DIR, safe);
}

/**
 * Baca pengaturan backup dari tabel settings
 */
export function getBackupSettings() {
  const db = getDb();
  const keys = ['backup_auto_enabled', 'backup_frequency', 'backup_retention_days', 'backup_time'];
  const stmt = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)');
  const rows = stmt.all(...keys);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    autoEnabled: map.backup_auto_enabled === 'true',
    frequency: map.backup_frequency || 'daily',
    retentionDays: parseInt(map.backup_retention_days || '30', 10),
    time: map.backup_time || '02:00',
  };
}

/**
 * Simpan pengaturan backup ke tabel settings
 */
export function saveBackupSettings({ autoEnabled, frequency, retentionDays, time }) {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO settings (key, value, type) VALUES (?, ?, 'string')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    upsert.run('backup_auto_enabled', String(autoEnabled));
    upsert.run('backup_frequency', String(frequency));
    upsert.run('backup_retention_days', String(retentionDays));
    upsert.run('backup_time', String(time));
  });
  tx();
}

/**
 * Inisialisasi default backup settings jika belum ada
 */
export function initBackupSettings() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key = 'backup_auto_enabled'").get();
  if (count.cnt === 0) {
    saveBackupSettings({
      autoEnabled: false,
      frequency: 'daily',
      retentionDays: 30,
      time: '02:00',
    });
  }
}
