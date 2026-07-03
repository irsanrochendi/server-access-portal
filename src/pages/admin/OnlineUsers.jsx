import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, User, Shield, RefreshCw, LogOut, Clock } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

export default function OnlineUsers() {
  const toast = useToast();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logoutTarget, setLogoutTarget] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const data = await api.getOnlineUsers(5);
      setOnlineUsers(data.users || []);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error('Gagal mengambil data user online');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOnlineUsers();
    // Auto-refresh setiap 30 detik
    const interval = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  const handleForceLogout = async () => {
    if (!logoutTarget) return;
    setLoggingOut(true);
    try {
      await api.forceLogout(logoutTarget.id);
      toast.success(`User "${logoutTarget.name}" berhasil di-logout`);
      setLogoutTarget(null);
      fetchOnlineUsers();
    } catch (err) {
      toast.error(err.message);
    }
    setLoggingOut(false);
  };

  const formatLastActivity = (timestamp) => {
    if (!timestamp) return 'Baru saja';
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s lalu`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m lalu`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h lalu`;
  };

  const timeSinceRefresh = () => {
    const diff = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m`;
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
              {onlineUsers.length} user aktif dalam 5 menit terakhir · Auto-refresh 30s
            </p>
          </div>
        </div>
        <button
          onClick={fetchOnlineUsers}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Refresh sekarang"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          User dianggap <strong>"online"</strong> jika ada aktivitas dalam <strong>5 menit</strong> terakhir. Refresh terakhir: {timeSinceRefresh()} yang lalu.
        </p>
      </div>

      {/* Online Users Grid */}
      {onlineUsers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {onlineUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    {/* Online indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0d1321] animate-pulse" />
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
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Aksi 1 jam terakhir</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{user.recent_actions || 0} kali</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => setLogoutTarget(user)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Force Logout
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-12 shadow-sm">
          <EmptyState
            icon={<WifiOff className="w-12 h-12 text-slate-300 dark:text-slate-600" />}
            title="Tidak ada user online"
            description="Semua user sedang tidak aktif. User akan muncul di sini saat mereka berinteraksi dengan portal."
          />
        </div>
      )}

      {/* Confirm Logout Modal */}
      <ConfirmModal
        open={!!logoutTarget}
        title="Force Logout"
        message={`Yakin ingin mengakhiri sesi "${logoutTarget?.name}"? User akan otomatis diarahkan ke halaman login.`}
        confirmText="Ya, Logout Sekarang"
        confirmColor="red"
        loading={loggingOut}
        onConfirm={handleForceLogout}
        onCancel={() => setLogoutTarget(null)}
      />
    </div>
  );
}
