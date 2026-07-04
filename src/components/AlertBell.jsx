import { useState, useEffect } from 'react';
import { Bell, X, CheckCheck, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function AlertBell() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/alerts?unread=false&limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAlerts(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:4000/api/alerts/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:4000/api/alerts/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:4000/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'down':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'recovery':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'latency':
        return <Clock className="w-5 h-5 text-amber-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl glass-card hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-300"
      >
        <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 max-h-[500px] glass-card rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Mark all read */}
            {unreadCount > 0 && (
              <div className="p-3 border-b border-white/20 dark:border-white/10">
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  {loading ? 'Marking...' : 'Mark all as read'}
                </button>
              </div>
            )}

            {/* Alerts list */}
            <div className="max-h-[350px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border-b border-white/10 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-colors ${
                      alert.is_read === 0 ? 'bg-indigo-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                          {alert.server_name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {formatTime(alert.created_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            {alert.is_read === 0 && (
                              <button
                                onClick={() => markAsRead(alert.id)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
