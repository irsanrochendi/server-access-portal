import { useState, useEffect } from 'react';
import { Server, ExternalLink, Copy, Globe, Shield, Terminal, Monitor, Cpu, Activity } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { api } from '../services/api';

function field(s, k1, k2) { return s[k1] ?? s[k2]; }

async function openServer(server) {
  const proto = field(server, 'protocol', 'protocol')?.toUpperCase();
  const ip = field(server, 'ip_address', 'ipAddress');
  const port = field(server, 'port', 'port');
  const url = field(server, 'access_url', 'accessUrl');
  const pref = field(server, 'browser_pref', 'browserPref');
  try {
    const token = localStorage.getItem('portal_token');
    const body = { protocol: proto, browser: pref || undefined };
    if (proto === 'SSH') body.url = `${ip}${port && port !== 22 ? ':'+port : ''}`;
    else if (proto === 'RDP') body.url = `${ip}${port && port !== 3389 ? ':'+port : ''}`;
    else body.url = url;
    const r = await fetch('/api/open', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    if (!r.ok) alert((await r.json()).error || 'Gagal');
  } catch (e) { alert('Gagal: ' + e.message); }
}

export default function ServerCard({ server, onCopyIp, index = 0 }) {
  const [latency, setLatency] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [pingError, setPingError] = useState(null);

  const name = field(server, 'name', 'name');
  const ipAddress = field(server, 'ip_address', 'ipAddress');
  const accessUrl = field(server, 'access_url', 'accessUrl');
  const description = field(server, 'description', 'description');
  const category = field(server, 'category', 'category');
  const environment = field(server, 'environment', 'environment');
  const status = field(server, 'status', 'status');
  const protocol = field(server, 'protocol', 'protocol');
  const isSSH = protocol?.toUpperCase() === 'SSH';
  const isRDP = protocol?.toUpperCase() === 'RDP';
  const isOnline = status === 'online';
  const displayUrl = (accessUrl || ipAddress || '').replace(/^https?:\/\//, '');

  const handlePing = async () => {
    try {
      const res = await api.checkLatency(server.id);
      if (res.latency !== null) {
        setLatency(res.latency);
        setPingError(null);
      } else {
        setPingError(res.error || 'Unreachable');
      }
    } catch (err) {
      setPingError(err.message);
    }
  };

  // Auto-ping on mount + refresh every 10 seconds
  useEffect(() => {
    // Initial ping
    handlePing();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      handlePing();
    }, 10000);

    return () => clearInterval(interval);
  }, [server.id]);

  // Environment styles
  const envStyles = {
    Production: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', icon: '🌍' },
    Staging: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', icon: '🔶' },
    Development: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', icon: '🛠️' },
    Internal: { bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400', icon: '🏠' },
  };

  const envStyle = envStyles[environment] || envStyles.Internal;

  // Latency color
  const latencyColor = latency !== null
    ? latency < 30 ? 'text-emerald-500 dark:text-emerald-400'
      : latency < 80 ? 'text-amber-500 dark:text-amber-400'
      : 'text-red-500 dark:text-red-400'
    : '';

  return (
    <div
      className={`group bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10
        shadow-sm hover:shadow-md dark:shadow-none
        overflow-hidden transition-all duration-300 ease-out
        hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:-translate-y-0.5 animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Top accent line */}
      <div className={`h-0.5 bg-gradient-to-r ${isOnline ? 'from-emerald-500 to-emerald-400' : 'from-slate-400 to-slate-300 dark:from-slate-500 dark:to-slate-400'}`} />

      <div className="p-4">
        {/* Header: Environment badge + Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${envStyle.bg} ${envStyle.text}`}>
              <span className="opacity-70">{envStyle.icon}</span>
              {environment}
            </span>
            {isSSH && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
                <Terminal className="w-3 h-3" /> SSH
              </span>
            )}
            {isRDP && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                <Monitor className="w-3 h-3" /> RDP
              </span>
            )}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Server Info with Icon */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Server className={`w-5 h-5 ${isOnline ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 opacity-60" />
              {category || 'Server'}
            </p>
          </div>
        </div>

        {/* Connection Info */}
        <div className={`rounded-xl p-3 mb-3 ${isOnline ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-slate-50 dark:bg-slate-500/10'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Globe className={`w-3.5 h-3.5 ${isOnline ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span className={`text-[11px] font-medium ${isOnline ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {/* Latency */}
            <div className="flex items-center gap-1">
              {latency !== null && (
                <span className={`text-[11px] font-mono font-semibold ${latencyColor}`}>
                  {latency}<span className="text-[9px] font-normal">ms</span>
                </span>
              )}
              <Activity
                className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ${latency === null && !pingError ? 'animate-pulse' : ''}`}
              />
            </div>
          </div>
          <p className="font-mono text-[13px] text-slate-700 dark:text-white/80 truncate pl-5">{displayUrl}</p>
          {pingError && latency === null && (
            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 pl-5">⚠ {pingError}</p>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">{description}</p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={() => openServer(server)}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs
              transition-all duration-200 active:scale-[0.98] shadow-sm
              ${isOnline
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            disabled={!isOnline}
          >
            {isSSH ? <Terminal className="w-3.5 h-3.5" /> : isRDP ? <Monitor className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            {isSSH ? 'Open SSH' : isRDP ? 'Open RDP' : 'Open Server'}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(ipAddress); onCopyIp?.(ipAddress); }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl
              bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400
              hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white
              text-xs font-medium transition-all duration-200 active:scale-[0.98]"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footer: Security badge */}
        <div className="flex items-center justify-center gap-1.5 mt-3 py-1.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
          <Shield className="w-3 h-3 text-amber-500 dark:text-amber-400/70" />
          <span className="text-[10px] text-amber-600 dark:text-amber-400/70 font-medium">Intranet Only</span>
        </div>
      </div>
    </div>
  );
}

export { openServer };