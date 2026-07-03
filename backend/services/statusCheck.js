import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { execSync } from 'node:child_process';

/**
 * Check server via HTTP/HTTPS
 */
export async function checkServerHttp(url) {
  if (!url) return { online: false, error: 'No URL configured' };

  return new Promise((resolve) => {
    const isHttps = url.startsWith('https://');
    const agent = isHttps
      ? new https.Agent({ rejectUnauthorized: false })
      : new http.Agent();

    const req = (isHttps ? https : http).get(url, {
      agent,
      timeout: 5000,
      rejectUnauthorized: false,
    }, (res) => {
      resolve({ online: true, statusCode: res.statusCode });
      res.resume();
    });

    req.on('timeout', () => { req.destroy(); resolve({ online: false, error: 'Timeout' }); });
    req.on('error', (err) => { resolve({ online: false, error: err.code || err.message }); });
  });
}

/**
 * Check server via TCP
 */
export async function checkServerTcp(host, port) {
  if (!host || !port) return { online: false, error: 'Host/port required' };

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on('connect', () => { socket.destroy(); resolve({ online: true }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ online: false, error: 'Timeout' }); });
    socket.on('error', () => { resolve({ online: false, error: 'TCP connection failed' }); });
    socket.connect(port, host);
  });
}

/**
 * Ping latency ke IP/host menggunakan system ping (ICMP)
 */
export async function pingHost(host) {
  if (!host) return { latency: null, error: 'No host' };

  // Bersihkan host dari protocol/port
  const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

  return new Promise((resolve) => {
    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `ping -n 1 -w 3000 ${cleanHost}`
        : `ping -c 1 -W 3 ${cleanHost}`;

      const output = execSync(cmd, { timeout: 5000, encoding: 'utf-8' });

      // Parse latency dari output
      let latency = null;
      if (isWindows) {
        const match = output.match(/time[=<]\s*(\d+)ms/i);
        if (match) latency = parseInt(match[1]);
      } else {
        const match = output.match(/time=(\d+\.?\d*)\s*ms/i);
        if (match) latency = parseFloat(match[1]);
      }

      resolve({ latency, host: cleanHost });
    } catch (err) {
      resolve({ latency: null, host: cleanHost, error: 'Ping failed' });
    }
  });
}

/**
 * TCP connect latency
 */
export async function tcpLatency(host, port) {
  if (!host || !port) return { latency: null, error: 'Host/port required' };

  const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ latency, host: cleanHost, port });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ latency: null, host: cleanHost, port, error: 'Timeout' });
    });

    socket.on('error', (err) => {
      resolve({ latency: null, host: cleanHost, port, error: err.code || err.message });
    });

    socket.connect(port, cleanHost);
  });
}

/**
 * Check latency server — ICMP ping dicoba dulu, fallback ke TCP
 */
export async function checkLatency(server) {
  const host = server.ip_address;
  if (!host) return { latency: null, error: 'No IP' };

  // Coba ICMP dulu
  const ping = await pingHost(host);
  if (ping.latency !== null) {
    return { latency: ping.latency, method: 'icmp' };
  }

  // Fallback ke TCP
  const port = server.port || (server.protocol?.toUpperCase() === 'HTTPS' ? 443 : 80);
  const tcp = await tcpLatency(host, port);
  if (tcp.latency !== null) {
    return { latency: tcp.latency, method: 'tcp' };
  }

  return { latency: null, error: ping.error || tcp.error };
}
