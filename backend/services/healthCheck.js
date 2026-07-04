import { getDb } from '../database.js';
import { checkServerHttp, checkLatency } from './statusCheck.js';

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let intervalId = null;

/**
 * Check a single server and record its health.
 */
export async function checkServerHealth(server) {
  const db = getDb();

  try {
    // Determine latency
    const latencyResult = await checkLatency(server);
    const isOnline = latencyResult.latency !== null;
    const latencyMs = latencyResult.latency;
    const error = latencyResult.error || null;

    // Get previous status to detect state changes
    const prev = db.prepare(`
      SELECT status, error FROM server_uptime_history
      WHERE server_id = ? AND status != 'unknown'
      ORDER BY checked_at DESC LIMIT 1
    `).get(server.id);

    const prevStatus = prev?.status || null;

    // Record in history
    db.prepare(`
      INSERT INTO server_uptime_history (server_id, status, latency_ms, error)
      VALUES (?, ?, ?, ?)
    `).run(server.id, isOnline ? 'online' : 'offline', latencyMs, error);

    // Update server table with current state
    db.prepare(`
      UPDATE servers SET
        status = ?,
        latency_ms = ?,
        last_checked_at = datetime('now')
      WHERE id = ?
    `).run(isOnline ? 'online' : 'offline', latencyMs, server.id);

    // Alert: server went DOWN
    if (prevStatus === 'online' && !isOnline) {
      db.prepare(`
        INSERT INTO alerts (server_id, type, message)
        VALUES (?, 'down', ?)
      `).run(server.id, `Server "${server.name}" (${server.ip_address}) is unreachable`);

    // Alert: server RECOVERED
    } else if (prevStatus === 'offline' && isOnline) {
      db.prepare(`
        INSERT INTO alerts (server_id, type, message)
        VALUES (?, 'recovery', ?)
      `).run(server.id, `Server "${server.name}" (${server.ip_address}) is back online`);

    // Alert: high latency
    } else if (isOnline && latencyMs !== null && latencyMs > 1000) {
      // Upsert: update existing unread latency alert or create new
      const existing = db.prepare(`
        SELECT id FROM alerts WHERE server_id = ? AND type = 'latency' AND is_read = 0 AND is_resolved = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(server.id);

      if (!existing) {
        db.prepare(`
          INSERT INTO alerts (server_id, type, message)
          VALUES (?, 'latency', ?)
        `).run(server.id, `Server "${server.name}" has high latency: ${latencyMs}ms`);
      }
    }

    return { serverId: server.id, online: isOnline, latency: latencyMs, error };
  } catch (err) {
    console.error(`[health-check] Error checking server ${server.id}:`, err.message);
    return { serverId: server.id, online: false, latency: null, error: err.message };
  }
}

/**
 * Check all active servers.
 */
export async function checkAllServers() {
  const db = getDb();
  const servers = db.prepare(`
    SELECT id, name, ip_address, port, protocol, access_url, status
    FROM servers WHERE is_active = 1
  `).all();

  const results = await Promise.allSettled(
    servers.map(server => checkServerHealth(server))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`[health-check] Checked ${servers.length} servers — ${succeeded} ok, ${failed} failed`);
  return results;
}

/**
 * Start the background health checker.
 */
export function startHealthChecker() {
  if (intervalId) {
    console.log('[health-check] Already running');
    return;
  }

  // Run immediately on start
  checkAllServers().catch(err => console.error('[health-check] Initial check failed:', err));

  // Then repeat every CHECK_INTERVAL_MS
  intervalId = setInterval(() => {
    checkAllServers().catch(err => console.error('[health-check] Scheduled check failed:', err));
  }, CHECK_INTERVAL_MS);

  console.log(`[health-check] Started — checking every ${CHECK_INTERVAL_MS / 1000}s`);
}

/**
 * Stop the background health checker.
 */
export function stopHealthChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[health-check] Stopped');
  }
}
