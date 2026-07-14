import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { openServer } from '../components/ServerCard';
import StatusBadge from '../components/StatusBadge';
import { Server, Globe, Monitor, Terminal, Users, Activity, ExternalLink, Eye, EyeOff, Copy, Lock } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [servers, setServers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creds, setCreds] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [pings, setPings] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  // Fetch ping for all servers
  useEffect(() => {
    const fetchPings = async () => {
      if (servers.length > 0) {
        for (const s of servers) {
          try {
            const res = await api.checkLatency(s.id);
            setPings(prev => ({ ...prev, [s.id]: res.latency }));
          } catch (err) {
            // silently ignore ping errors
          }
        }
      }
    };
    fetchPings();
  }, [servers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, stRes] = await Promise.all([
        api.getServers(),
        api.getServerStats().catch(() => null),
      ]);
      setServers(sRes.servers || []);
      setStats(stRes);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevealCreds = async (serverId) => {
    if (creds[serverId]) {
      setCreds(prev => ({ ...prev, [serverId]: null }));
      return;
    }
    try {
      const res = await api.getServerCredentials(serverId);
      setCreds(prev => ({ ...prev, [serverId]: res }));

      // Log credential access
      const server = servers.find(s => s.id === serverId);
      try {
        await api.logActivity({
          action: 'credential_access',
          module: 'server',
          description: `Mengakses kredensial server ${server?.name || serverId}`,
          metadata: { server_id: serverId }
        });
      } catch (err) {
        console.error('Failed to log credential access:', err);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter servers
  const filteredServers = servers.filter(s => {
    if (filterCategory && s.category !== filterCategory) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  // Get unique categories
  const categories = [...new Set(servers.map(s => s.category).filter(Boolean))];

  const TypeIcon = ({ type }) => {
    if (type === 'rdp') return <Monitor className="w-4 h-4" />;
    if (type === 'ssh') return <Terminal className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  // ─── UNIFIED VIEW (for both staff and admin) ─────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {isAdmin ? 'Admin Dashboard' : `Selamat Datang, ${user?.name}`}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isAdmin ? 'Overview server dan aktivitas sistem' : 'Akses server perusahaan Anda'}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Server</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.online || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Online</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.offline || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Offline</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.unknown || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Unknown</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Server</h2>
          {isAdmin && (
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Semua Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-64 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="text-center py-16">
            <Server className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400">
              {servers.length === 0 ? 'Belum ada server yang tersedia' : 'Tidak ada server yang sesuai filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredServers.map((s) => {
              const isOnline = s.status === 'online';
              const ping = pings[s.id];
              return (
                <div key={s.id} className="group relative">
                  {/* Glow effect */}
                  <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg ${isOnline ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}></div>

                  {/* Card */}
                  <div className={`relative bg-gradient-to-br ${isOnline ? 'from-white to-blue-50/30 dark:from-slate-800/90 dark:to-blue-900/20' : 'from-white to-red-50/30 dark:from-slate-800/90 dark:to-red-900/20'} backdrop-blur-xl rounded-2xl border ${isOnline ? 'border-slate-200/50 dark:border-white/10' : 'border-red-200/50 dark:border-red-500/20'} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>

                    {/* Status bar */}
                    <div className={`h-1.5 w-full ${isOnline ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-400 via-rose-500 to-pink-500'}`}></div>

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30' : 'bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/30'}`}>
                            {s.logo_url ? (
                              <img src={s.logo_url} alt={s.name} className="w-full h-full rounded-xl object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <Server className="w-6 h-6 text-white" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">{s.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{s.ip_address || s.access_url}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {s.category && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm">{s.category}</span>
                        )}
                        {s.environment && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-sm">{s.environment}</span>
                        )}
                        {s.protocol && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 dark:bg-slate-700 text-white shadow-sm uppercase">{s.protocol}</span>
                        )}
                        {ping !== undefined && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm ${ping < 100 ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : ping < 300 ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white' : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'}`}>
                            <Activity className="w-3 h-3" />
                            {ping}ms
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {s.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{s.description}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openServer(s)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02]"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Buka Server
                        </button>
                        <button
                          onClick={() => handleRevealCreds(s.id)}
                          className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-lg shadow-amber-500/25"
                          title="Kredensial"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Credentials */}
                      {creds[s.id] && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
                          {creds[s.id].username && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{creds[s.id].username}</span>
                                <button onClick={() => copyToClipboard(creds[s.id].username, `u-${s.id}`)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 text-slate-400 hover:text-blue-600">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                          {creds[s.id].password && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm font-semibold text-slate-900 dark:text-white ${showPassword[s.id] ? '' : 'blur-sm select-none'}`}>{creds[s.id].password}</span>
                                <button onClick={() => setShowPassword(p => ({ ...p, [s.id]: !p[s.id] }))} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 text-slate-400 hover:text-blue-600">
                                  {showPassword[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => copyToClipboard(creds[s.id].password, `p-${s.id}`)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 text-slate-400 hover:text-blue-600">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                          <button onClick={() => setShowPassword(p => ({ ...p, [s.id]: false }))} className="w-full text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
                            Sembunyikan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
