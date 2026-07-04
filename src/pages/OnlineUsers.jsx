import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, User, Shield, Clock } from 'lucide-react';
import { api } from '../services/api';

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const data = await api.getOnlineUsers(5);
      setOnlineUsers(data.users || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Gagal mengambil data user online');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnlineUsers();
    // Auto-refresh setiap 30 detik
    const interval = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  const formatLastActivity = (timestamp) => {
    if (!timestamp) return 'Baru saja';
    // Handle both Unix timestamp (ms) and string date
    const ts = typeof timestamp === 'number' ? timestamp : parseInt(timestamp);
    if (isNaN(ts)) return 'Baru saja';
    const diff = Date.now() - ts;
    if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return 'Baru saja';
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s lalu`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m lalu`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h lalu`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Online</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {onlineUsers.length} user aktif dalam 5 menit terakhir
            </p>
          </div>
        </div>
        <button
          onClick={fetchOnlineUsers}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <Clock className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
        <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          User dianggap <strong>"online"</strong> jika ada aktivitas dalam <strong>5 menit</strong> terakhir.
        </p>
      </div>

      {/* Online Users Grid */}
      {onlineUsers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {onlineUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    {/* Online indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0d1321]" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user.email}</p>
                  </div>
                </div>
                {/* Role badge */}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  user.role === 'admin'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                  {user.role === 'admin' && <Shield className="w-3 h-3 inline mr-1" />}
                  {user.role}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Aktivitas terakhir</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatLastActivity(user.last_activity_at)}
                  </span>
                </div>
                {user.division && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Divisi</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{user.division}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-12 shadow-sm text-center">
          <WifiOff className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Belum ada yang online</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Semua user sedang tidak aktif.
          </p>
        </div>
      )}
    </div>
  );
}
