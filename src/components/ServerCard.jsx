import { useState, useEffect } from 'react';
import { Server, ExternalLink, Copy, Globe, Shield, Terminal, Monitor, Cpu, Activity, Lock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { api } from '../services/api';
import HealthHistoryModal from './HealthHistoryModal';

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

    // Log connection
    const authToken = localStorage.getItem('token');
    await fetch('http://localhost:4000/api/connections/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ serverId: server.id }),
    }).catch(err => console.error('Failed to log connection:', err));
  } catch (e) { alert('Gagal: ' + e.message); }
}

export default function ServerCard({ server, onCopyIp, onShowNotes, index = 0 }) {
  const [latency, setLatency] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [pingError, setPingError] = useState(null);
  const [showHealthModal, setShowHealthModal] = useState(false);

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
      className={`group glass-card rounded-2xl overflow-hidden transition-all duration-500 ease-out
        hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5
        hover:-translate-y-1 hover:scale-[1.02] animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Top accent line with gradient */}
      <div className={`h-1 bg-gradient-to-r ${isOnline ? 'from-emerald-400 via-green-500 to-emerald-400' : 'from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600'}`} />

      <div className="p-5">
        {/* Header: Environment badge + Status */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${envStyle.bg} ${envStyle.text} shadow-sm`}>
              <span className="opacity-80">{envStyle.icon}</span>
              {environment}
            </span>
            {isSSH && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 shadow-sm">
                <Terminal className="w-3 h-3" /> SSH
              </span>
            )}
            {isRDP && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 shadow-sm">
                <Monitor className="w-3 h-3" /> RDP
              </span>
            )}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Server Info with Icon */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 ${isOnline ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <Server className={`w-7 h-7 ${isOnline ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 opacity-60" />
              {category || 'Server'}
            </p>
          </div>
        </div>

        {/* Connection Info */}
        <div className={`rounded-xl p-4 mb-4 transition-all duration-300 ${isOnline ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 ${isOnline ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span className={`text-xs font-semibold ${isOnline ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {/* Latency */}
            <div className="flex items-center gap-1.5">
              {latency !== null && (
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${latencyColor} bg-white/50 dark:bg-black/20`}>
                  {latency}<span className="text-[10px] font-normal opacity-70">ms</span>
                </span>
              )}
              <Activity
                className={`w-4 h-4 text-slate-400 dark:text-slate-500 ${latency === null && !pingError ? 'animate-pulse' : ''}`}
              />
            </div>
          </div>
          <p className="font-mono text-sm text-slate-700 dark:text-white/90 truncate pl-6">{displayUrl}</p>
          {pingError && latency === null && (
            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1.5 pl-6 font-medium">⚠ {pingError}</p>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-5 leading-relaxed px-1">{description}</p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-200/80 dark:border-white/10">
          <button
            onClick={() => openServer(server)}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs
              transition-all duration-300 active:scale-95 shadow-md
              ${isOnline
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50'
                : 'bg-slate-200 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
              }`}
            disabled={!isOnline}
          >
            {isSSH ? <Terminal className="w-4 h-4" /> : isRDP ? <Monitor className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
            {isSSH ? 'Open SSH' : isRDP ? 'Open RDP' : 'Open Server'}
          </button>
          <button
            onClick={() => onShowNotes?.(server)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl
              bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400
              hover:bg-amber-200 dark:hover:bg-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/30
              text-xs font-semibold transition-all duration-300 active:scale-95 shadow-sm"
            title="Catatan & Kredensial"
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHealthModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl
              bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400
              hover:bg-indigo-200 dark:hover:bg-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/30
              text-xs font-semibold transition-all duration-300 active:scale-95 shadow-sm"
            title="Health History"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(ipAddress); onCopyIp?.(ipAddress); }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl
              bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white
              text-xs font-semibold transition-all duration-300 active:scale-95 shadow-sm"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Footer: Security badge */}
        <div className="flex items-center justify-center gap-2 mt-4 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200/50 dark:border-amber-500/20">
          <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold tracking-wide">Intranet Only</span>
        </div>
      </div>

      {/* Health History Modal */}
      {showHealthModal && (
        <HealthHistoryModal server={server} onClose={() => setShowHealthModal(false)} />
      )}
    </div>
  );
}

export { openServer };