import { useState, useMemo } from 'react';
import { Search, Wifi, WifiOff, HelpCircle, RefreshCw, Server, Activity, Zap } from 'lucide-react';
import ServerCard from '../components/ServerCard';
import ServerNotesModal from '../components/ServerNotesModal';
import EmptyState from '../components/EmptyState';
import { useServers } from '../contexts/ServerContext';
import { useToast } from '../contexts/ToastContext';

export default function Dashboard() {
  const { servers, refreshStatus } = useServers();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [notesServer, setNotesServer] = useState(null);
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
      <div className="flex items-center justify-between mb-2">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3 mb-2">
            <span className="gradient-text">Server Dashboard</span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
              bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-500/20 dark:to-green-500/20
              border border-emerald-300 dark:border-emerald-500/30
              text-emerald-700 dark:text-emerald-400 text-xs font-bold shadow-sm">
              <span className="relative flex w-2 h-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                <span className="relative w-full h-full rounded-full bg-emerald-500" />
              </span>
              {stats.online} Online
            </span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Server className="w-4 h-4 opacity-60" />
            Monitoring {stats.total} internal servers
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl
            bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600
            text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
            transition-all duration-300 active:scale-95 animate-fade-in"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Server */}
        <div className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 hover:-translate-y-1 animate-fade-in stagger-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Server className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Total</span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-1">{stats.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Servers</p>
        </div>

        {/* Online */}
        <div className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-500 hover:-translate-y-1 animate-fade-in stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
          <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mb-1">{stats.online}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Running Now</p>
        </div>

        {/* Offline */}
        <div className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-red-500/10 transition-all duration-500 hover:-translate-y-1 animate-fade-in stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <WifiOff className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Alert</span>
          </div>
          <p className="text-4xl font-black text-red-600 dark:text-red-400 tracking-tight mb-1">{stats.offline}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Down</p>
        </div>

        {/* Unknown */}
        <div className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-500/10 transition-all duration-500 hover:-translate-y-1 animate-fade-in stagger-4">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Pending</span>
          </div>
          <p className="text-4xl font-black text-slate-600 dark:text-slate-400 tracking-tight mb-1">{stats.unknown}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Checking</p>
        </div>
      </div>

      {/* Health Bar */}
      <div className="glass-card rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-500 animate-fade-in stagger-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-white">System Health</span>
          </div>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">{healthPercent}%</span>
        </div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-lg"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-in stagger-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search servers by name or IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl
              bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10
              text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20
              text-sm font-medium transition-all duration-300 shadow-sm"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3">
          <select
            value={activeFilters['status'] || ''}
            onChange={e => setActiveFilters(prev => ({ ...prev, status: e.target.value || null }))}
            className="px-4 py-3.5 rounded-xl border text-sm font-semibold cursor-pointer appearance-none
              bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200
              focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-sm
              bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px] bg-[right_12px_center] bg-no-repeat pr-8"
          >
            <option value="">All Status</option>
            <option value="online">🟢 Online</option>
            <option value="offline">🔴 Offline</option>
            <option value="unknown">⚪ Unknown</option>
          </select>

          <select
            value={activeFilters['environment'] || ''}
            onChange={e => setActiveFilters(prev => ({ ...prev, environment: e.target.value || null }))}
            className="px-4 py-3.5 rounded-xl border text-sm font-semibold cursor-pointer appearance-none
              bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200
              focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-sm
              bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px] bg-[right_12px_center] bg-no-repeat pr-8"
          >
            <option value="">All Environments</option>
            <option value="Production">🌍 Production</option>
            <option value="Staging">🔶 Staging</option>
            <option value="Development">🛠️ Development</option>
            <option value="Internal">🏠 Internal</option>
          </select>

          {Object.values(activeFilters).some(Boolean) && (
            <button
              onClick={() => setActiveFilters({})}
              className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all duration-300 border border-red-300 dark:border-red-500/30 shadow-sm active:scale-95"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Server Count */}
      <div className="flex items-center gap-2.5 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
          Showing <span className="font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700">{filtered.length}</span> of {activeServers.length} servers
        </p>
      </div>

      {/* Server Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filtered.map((server, i) => (
            <ServerCard
              key={server.id}
              server={server}
              onCopyIp={() => toast.success('IP copied to clipboard')}
              onShowNotes={(s) => setNotesServer(s)}
              index={i}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No servers found"
          description={search ? `No results for "${search}"` : 'No servers match the current filters'}
        />
      )}

      {notesServer && (
        <ServerNotesModal
          server={notesServer}
          onClose={() => setNotesServer(null)}
          onSave={() => setNotesServer(null)}
        />
      )}
    </div>
  );
}
