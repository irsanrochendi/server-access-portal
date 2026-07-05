import { useState, useEffect } from 'react';
import { ClipboardList, Calendar, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from '../../components/EmptyState';

const actionColors = {
  login: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  logout: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
  create: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
  update: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  delete: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
  server_access: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
  credential_access: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
};

export default function ActivityLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getLogs({ limit: 100 }).then(d => setLogs(d.logs)).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const matchAction = !filterAction || log.action === filterAction;
    const matchSearch = !search || (log.description || '').toLowerCase().includes(search.toLowerCase()) || (log.module || '').toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  const formatDate = (d) => {
    try { return new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }); }
    catch { return d; }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Riwayat aktivitas penting administrator</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari aktivitas..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Aksi</option>
            <option value="login">Login</option><option value="logout">Logout</option>
            <option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option>
            <option value="server_access">Server Access</option>
            <option value="credential_access">Credential Access</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-[180px]"><div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Waktu</div></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Modul</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.user_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${actionColors[log.action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600 dark:text-gray-400 uppercase font-medium">{log.module}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.description}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Tidak ada log" description={search ? `Tidak ada log yang cocok dengan "${search}"` : 'Belum ada aktivitas tercatat'} /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
