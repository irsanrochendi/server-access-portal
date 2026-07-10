import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './database.js';
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import logRoutes from './routes/logs.js';
import settingsRoutes from './routes/settings.js';
import statusRoutes from './routes/status.js';
import openRoutes from './routes/open.js';
import categoryRoutes from './routes/categories.js';
import dbRoutes from './routes/db.js';
import divisionRoutes from './routes/divisions.js';
import exportRoutes from './routes/export.js';
import adRoutes from './routes/ad.js';
import backupRoutes from './routes/backup.js';
import tokensRoutes from './routes/tokens.js';

import uploadRoutes from './routes/upload.js';
import { initBackupSettings } from './services/backup.js';
import { startAutoBackup } from './services/autoBackupScheduler.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Init DB
initDb();

// Hanya seed pertama kali (DB kosong). Setelah itu tidak auto-seed lagi.
// Jalankan manual: node seed.js && node seed-extra.js

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:80', 'http://localhost:81'] }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/open', openRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/divisions', divisionRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ad', adRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/uploads', express.static(join(__dirname, 'uploads')));
app.use('/api/db', dbRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/tokens', tokensRoutes);

// Init backup settings & auto-backup scheduler
initBackupSettings();
startAutoBackup();

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Token cleanup ─────────────────────────────────────────────────────
function cleanupExpiredTokens() {
  try {
    const result = getDb().prepare(
      `DELETE FROM access_tokens WHERE expires_at < datetime('now') AND used_at IS NULL`
    ).run();
    if (result.changes > 0) {
      console.log(`Token cleanup: removed ${result.changes} expired tokens`);
    }
  } catch (err) {
      if (!err.message?.includes('no such table')) {
        console.error('Token cleanup error:', err.message);
      }
    }
}
setTimeout(cleanupExpiredTokens, 30_000);
setInterval(cleanupExpiredTokens, 5 * 60_000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
  console.log('📋 API endpoints:');
  console.log('   POST /api/auth/login    — Login');
  console.log('   GET  /api/servers       — List servers');
  console.log('   GET  /api/servers/stats — Stats');
  console.log('   POST /api/servers       — Create (admin)');
  console.log('   GET  /api/users         — List (admin)');
  console.log('   GET  /api/roles         — List (admin)');
  console.log('   GET  /api/logs          — Activity logs (admin)');
  console.log('   GET  /api/settings      — Settings (admin)');
  console.log('   POST /api/status/check-all — Check all servers');
});
