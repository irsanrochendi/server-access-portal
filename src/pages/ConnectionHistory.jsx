import { useState, useEffect } from 'react';
import { Clock, Server, TrendingUp, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConnectionHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = (page - 1) * limit;
      const res = await fetch(
        `http://localhost:4000/api/connections/history?limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setHistory(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch connection history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3 mb-2">
          <Clock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <span className="gradient-text">Connection History</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          View your server connection activity over time
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Total Connections</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{total}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Unique Servers</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {new Set(history.map(h => h.server_id)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">This Page</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{history.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in" style={{ animationDelay: '200ms' }}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No connection history yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Start connecting to servers to see your activity here
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0">
                  <tr className="border-b border-white/20 dark:border-white/10">
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/10 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(row.connected_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 dark:text-white">{row.server_name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">
                        {row.ip_address}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {row.environment}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {row.category}
                      </td>
                      <td className="px-6 py-4">
                        {row.status === 'online' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {row.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-white/10 bg-white/5 dark:bg-white/5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page <span className="font-bold text-gray-900 dark:text-white">{page}</span> of{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
