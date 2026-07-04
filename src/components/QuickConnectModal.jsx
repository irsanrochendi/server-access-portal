import { useState, useEffect, useCallback } from 'react';
import { X, Search, Clock, Zap, TrendingUp } from 'lucide-react';
import { openServer } from './ServerCard';

export default function QuickConnectModal({ isOpen, onClose }) {
  const [recent, setRecent] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRecent();
      setSearch('');
    }
  }, [isOpen]);

  const fetchRecent = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/connections/recent?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRecent(data.data || []);
    } catch (err) {
      console.error('Failed to fetch recent servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? recent.filter(
        (s) =>
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.ip_address?.toLowerCase().includes(search.toLowerCase()) ||
          s.category?.toLowerCase().includes(search.toLowerCase())
      )
    : recent;

  const handleConnect = async (server) => {
    try {
      await openServer(server);
      onClose();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const formatLastConnected = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-[15vh]">
      <div
        className="glass-card rounded-3xl shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden animate-fade-in"
        style={{ animationDuration: '150ms' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Quick Connect</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/20 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers..."
              autoFocus
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Recent servers list */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'No servers found' : 'No recent connections'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((server, idx) => (
                <button
                  key={server.id}
                  onClick={() => handleConnect(server)}
                  className="w-full p-4 rounded-2xl hover:bg-white/20 dark:hover:bg-white/10 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {server.name}
                        </h3>
                        {server.status === 'online' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <span>{server.ip_address}</span>
                        <span>•</span>
                        <span className="capitalize">{server.environment}</span>
                        <span>•</span>
                        <span className="capitalize">{server.category}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatLastConnected(server.last_connected_at)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {server.connection_count}x
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-white/20 dark:border-white/10 bg-white/5 dark:bg-white/5">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 rounded bg-white/20 dark:bg-white/10 font-mono text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 rounded bg-white/20 dark:bg-white/10 font-mono text-[10px]">Enter</kbd>
              Connect
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 rounded bg-white/20 dark:bg-white/10 font-mono text-[10px]">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
