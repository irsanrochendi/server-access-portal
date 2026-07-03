import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/export/servers?format=csv|json
router.get('/servers', (req, res) => {
  const db = getDb();
  const servers = db.prepare(`SELECT name, ip_address, port, protocol, access_url, description, category, environment,
    status, is_active, last_checked_at, created_at FROM servers ORDER BY name ASC`).all();

  const format = req.query.format || 'csv';

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename=servers.json');
    res.json(servers);
    return;
  }

  // CSV
  const headers = ['Nama Server', 'IP Address', 'Port', 'Protocol', 'URL Akses', 'Deskripsi', 'Kategori', 'Environment', 'Status', 'Aktif', 'Terakhir Dicek', 'Dibuat'];
  const keys = ['name', 'ip_address', 'port', 'protocol', 'access_url', 'description', 'category', 'environment', 'status', 'is_active', 'last_checked_at', 'created_at'];

  const csvRows = [headers.join(',')];
  for (const s of servers) {
    const row = keys.map(k => {
      let val = s[k] ?? '';
      val = String(val).replace(/"/g, '""');
      if (k === 'is_active') val = val === '1' ? 'Ya' : 'Tidak';
      return `"${val}"`;
    });
    csvRows.push(row.join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=servers.csv');
  res.send('﻿' + csvRows.join('\n'));
});

export default router;
