import { useState, useEffect } from 'react';
import { X, Activity, User, Clock, Globe, ShieldCheck, Eye, Copy } from 'lucide-react';

export default function ServerNotesLogModal({ server, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/server-notes/${server.id}/notes/logs`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` },
        });
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (_) {
        setLogs([]);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [server.id]);

  const fmt = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0d1321] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Audit Log — Akses Kredensial</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {server.name} · {server.ip_address}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-slate-500">Belum ada akses tercatat untuk server ini.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${log.action === 'copy' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-amber-100 dark:bg-amber-500/20'}`}>
                    {log.action === 'copy'
                      ? <Copy className={`w-4 h-4 ${log.action === 'copy' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`} />
                      : <Eye className={`w-4 h-4 ${log.action === 'view' ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {log.action === 'copy' ? 'Disalin ke clipboard' : 'Password dilihat'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{log.user}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{fmt(log.timestamp)}
                      </span>
                      {log.ip && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />{log.ip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
