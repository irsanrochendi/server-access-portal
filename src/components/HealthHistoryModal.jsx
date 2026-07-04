import { useState, useEffect } from 'react';
import { X, Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export default function HealthHistoryModal({ server, onClose }) {
  const [history, setHistory] = useState([]);
  const [uptime, setUptime] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, [server.id, days]);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch uptime stats
      const uptimeRes = await fetch(
        `http://localhost:4000/api/health/uptime?serverId=${server.id}&days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const uptimeData = await uptimeRes.json();
      setUptime(uptimeData.data[0] || null);

      // Fetch history
      const historyRes = await fetch(
        `http://localhost:4000/api/health/history?serverId=${server.id}&days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const historyData = await historyRes.json();
      setHistory(historyData.data || []);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
      case 'offline':
        return 'text-red-600 dark:text-red-400 bg-red-500/10';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Health History
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {server.name} • {server.ip_address}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Time range selector */}
        <div className="p-4 border-b border-white/20 dark:border-white/10 flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                days === d
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/10 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-white/10'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats cards */}
            {uptime && (
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Uptime % */}
                <div className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                      Uptime
                    </span>
                  </div>
                  <p className="text-2xl font-black bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    {uptime.uptime_percent !== null ? `${uptime.uptime_percent}%` : 'N/A'}
                  </p>
                </div>

                {/* Total checks */}
                <div className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                      Checks
                    </span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {uptime.total_checks}
                  </p>
                </div>

                {/* Avg latency */}
                <div className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                      Avg Latency
                    </span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {uptime.avg_latency !== null ? `${Math.round(uptime.avg_latency)}ms` : 'N/A'}
                  </p>
                </div>

                {/* Offline count */}
                <div className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                      Downtime
                    </span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {uptime.offline_checks}
                  </p>
                </div>
              </div>
            )}

            {/* History table */}
            <div className="p-6 pt-0">
              <div className="max-h-[400px] overflow-y-auto glass-card rounded-2xl">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <tr className="border-b border-white/20 dark:border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
                        Latency
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          No history available
                        </td>
                      </tr>
                    ) : (
                      history.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-white/10 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(row.checked_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(
                                row.status
                              )}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {row.latency_ms !== null ? `${row.latency_ms}ms` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {row.error || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
