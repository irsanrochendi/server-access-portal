import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, User, Shield, Clock } from 'lucide-react';
import { api } from '../services/api';

export default function OnlineUsers({ compact = false }) {
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
    if (!timestamp || isNaN(timestamp)) return 'Baru saja';
    const diff = Date.now() - Number(timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins}m lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j lalu`;
    return `${Math.floor(hours / 24)}d lalu`;
  };

  // ─── Compact Mode ────────────────────────────────────────────────────────
  if (compact) {
    if (loading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }
    if (onlineUsers.length === 0) {
      return (
        <div className="text-center py-4">
          <WifiOff className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Belum ada yang online</p>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {onlineUsers.slice(0, 5).map(user => (
          <div key={user.id} className="flex items-center gap-2.5 py-1.5">
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{user.name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400">{formatLastActivity(user.last_activity_at)}</p>
            </div>
          </div>
        ))}
        {onlineUsers.length > 5 && (
          <p className="text-xs text-slate-400 text-center pt-1">+{onlineUsers.length - 5} lainnya</p>
        )}
      </div>
    );
  }

  // ─── Full Mode ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Wifi className="w-5 h-5 text-indigo-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">User Online</h1>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {onlineUsers.length} user aktif
        </span>
      </div>

      {/* List */}
      {onlineUsers.length > 0 ? (
        <div className="space-y-3">
          {onlineUsers.map(user => (
            <div key={user.id} className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-white">{user.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{user.name}</p>
                    {user.is_admin === 1 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        <Shield className="w-3 h-3" />Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{user.email}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatLastActivity(user.last_activity_at)}
                    </span>
                  </div>
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
