import { useState, useMemo } from 'react';
import { Search, Wifi, WifiOff, HelpCircle, RefreshCw, Server, Activity, Zap } from 'lucide-react';
import ServerCard from '../components/ServerCard';
import EmptyState from '../components/EmptyState';
import { useServers } from '../contexts/ServerContext';
import { useToast } from '../contexts/ToastContext';

export default function Dashboard() {
  const { servers, refreshStatus } = useServers();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const activeServers = useMemo(() => servers.filter(s => s.is_active), [servers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeServers.filter(s => {
      const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.ip_address?.toLowerCase().includes(q);
      const f = activeFilters;
      return matchSearch && (!f.environment || s.environment === f.environment) && (!f.status || s.status === f.status);
    });
  }, [activeServers, search, activeFilters]);

  const stats = useMemo(() => ({
    total: activeServers.length,
    online: activeServers.filter(s => s.status === 'online').length,
    offline: activeServers.filter(s => s.status === 'offline').length,
    unknown: activeServers.filter(s => s.status === 'unknown').length,
  }), [activeServers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshStatus(); toast.success('Status diperbarui'); } catch (e) { toast.error(e.message); }
    setTimeout(() => setRefreshing(false), 600);
  };

  const healthPercent = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="gradient-text">Server Dashboard</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30
              text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <span className="relative flex w-2 h-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
                <span className="relative w-full h-full rounded-full bg-emerald-500" />
              </span>
              {stats.online} Online
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitoring {stats.total} server internal
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30
            text-indigo-600 dark:text-indigo-400 text-sm font-medium
            hover:bg-indigo-100 dark:hover:bg-indigo-500/30
            transition-all duration-200 active:scale-[0.98] animate-fade-in"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Server */}
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm dark:shadow-none hover:shadow-md transition-all animate-fade-in stagger-1">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{stats.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Servers</p>
        </div>

        {/* Online */}
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm dark:shadow-none hover:shadow-md transition-all animate-fade-in stagger-2">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.online}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Online</p>
        </div>

        {/* Offline */}
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm dark:shadow-none hover:shadow-md transition-all animate-fade-in stagger-3">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Alert</span>
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 tracking-tight">{stats.offline}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Offline</p>
        </div>

        {/* Unknown */}
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm dark:shadow-none hover:shadow-md transition-all animate-fade-in stagger-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">Pending</span>
          </div>
          <p className="text-3xl font-bold text-slate-600 dark:text-slate-400 tracking-tight">{stats.unknown}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Unknown</p>
        </div>
      </div>

      {/* Health Bar */}
      <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm dark:shadow-none animate-fade-in stagger-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-white/80">System Health</span>
          </div>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{healthPercent}%</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-in stagger-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari server..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl
              bg-white dark:bg-[#0d1321] border border-slate-200 dark:border-white/10
              text-slate-900 dark:text-white placeholder-slate-400
              focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50
              text-sm transition-all duration-200"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={activeFilters['status'] || ''}
            onChange={e => setActiveFilters(prev => ({ ...prev, status: e.target.value || null }))}
            className="px-3 py-2.5 rounded-xl border text-sm cursor-pointer
              bg-white dark:bg-[#0d1321] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300
              focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-all"
          >
            <option value="" className="text-slate-500">Status</option>
            <option value="online" className="text-emerald-600 dark:text-emerald-400">🟢 Online</option>
            <option value="offline" className="text-red-600 dark:text-red-400">🔴 Offline</option>
            <option value="unknown" className="text-slate-500 dark:text-slate-400">⚪ Unknown</option>
          </select>

          <select
            value={activeFilters['environment'] || ''}
            onChange={e => setActiveFilters(prev => ({ ...prev, environment: e.target.value || null }))}
            className="px-3 py-2.5 rounded-xl border text-sm cursor-pointer
              bg-white dark:bg-[#0d1321] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300
              focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-all"
          >
            <option value="" className="text-slate-500">Environment</option>
            <option value="Production" className="text-emerald-600 dark:text-emerald-400">🌍 Production</option>
            <option value="Staging" className="text-amber-600 dark:text-amber-400">🔶 Staging</option>
            <option value="Development" className="text-purple-600 dark:text-purple-400">🛠️ Development</option>
            <option value="Internal" className="text-slate-500 dark:text-slate-400">🏠 Internal</option>
          </select>

          {Object.values(activeFilters).some(Boolean) && (
            <button
              onClick={() => setActiveFilters({})}
              className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors border border-red-200 dark:border-red-500/20"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Server Count */}
      <div className="flex items-center gap-2 animate-fade-in">
        <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Menampilkan <span className="font-medium text-slate-900 dark:text-white">{filtered.length}</span> dari {activeServers.length} server
        </p>
      </div>

      {/* Server Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((server, i) => (
            <ServerCard
              key={server.id}
              server={server}
              onCopyIp={() => toast.success('IP disalin')}
              index={i}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Server tidak ditemukan"
          description={search ? `Tidak ada hasil untuk "${search}"` : 'Tidak ada server sesuai filter'}
        />
      )}
    </div>
  );
}
