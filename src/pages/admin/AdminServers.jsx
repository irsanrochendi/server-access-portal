import { useState, useEffect } from 'react';
import { Server, ExternalLink, Eye, EyeOff, Pencil, Trash2, Download, Lock } from 'lucide-react';
import { openServer } from '../../components/ServerCard';
import { useServers } from '../../contexts/ServerContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

const PROTOCOLS = ['HTTP', 'HTTPS', 'SSH', 'RDP', 'FTP', 'TCP', 'OTHER'];
const ENVS = ['Production', 'Staging', 'Development', 'Internal'];
const DEFAULT_CATEGORIES = ['App', 'Database', 'Monitoring', 'Network', 'Storage', 'Other'];

const emptyForm = {
  name: '', ip_address: '', port: '', protocol: 'HTTP', access_url: '',
  description: '', category: '', environment: 'Production',
  status_check_url: '', status_check_method: 'none', browser_pref: '', visible_to: '', is_active: true,
  shared_username: '', shared_password: '', auto_login_enabled: false, logo_url: '',
};

export default function AdminServers() {
  const { servers, addServer, updateServer, deleteServer, toggleActive, refreshStatus } = useServers();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [divisions, setDivisions] = useState([]);

  // Load custom categories + divisions dari backend
  useEffect(() => {
    Promise.all([
      api.getCategories().then(d => setCategories(d.categories.map(c => c.value))),
      api.getUsers().then(d => setUsers(d.users || [])),
      fetch('/api/divisions', { headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` } })
        .then(r => r.json()).then(d => setDivisions(d.divisions || [])),
    ]).catch(() => {});
  }, []);

  // Gabungin default + custom
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  // Parse visible_to string → array
  const toggleVisibleTo = (div) => {
    const current = (form.visible_to || '').split(',').filter(Boolean);
    const updated = current.includes(div)
      ? current.filter(d => d !== div)
      : [...current, div];
    setForm({ ...form, visible_to: updated.join(',') });
  };

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name, ip_address: s.ip_address, port: s.port?.toString() || '',
      protocol: s.protocol, access_url: s.access_url,
      description: s.description || '', category: s.category || '',
      environment: s.environment, status_check_url: s.status_check_url || '',
      status_check_method: s.status_check_method || 'none',
      browser_pref: s.browser_pref || '',
      visible_to: s.visible_to || '',
      is_active: !!s.is_active,
      shared_username: s.shared_username || '',
      shared_password: '',
      auto_login_enabled: !!s.auto_login_enabled,
      logo_url: s.logo_url || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = { ...form, port: form.port ? parseInt(form.port) : null };
      if (editingId) {
        await updateServer(editingId, data);
        toast.success('Server berhasil diupdate');
      } else {
        await addServer(data);
        toast.success('Server baru berhasil ditambahkan');
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteServer(deleteTarget.id);
      toast.success(`Server "${deleteTarget.name}" dihapus`);
    } catch (err) {
      toast.error(err.message);
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleToggle = async (s) => {
    try {
      await toggleActive(s.id);
      toast.info(`Server "${s.name}" ${s.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCheckStatus = async (s) => {
    try {
      const { api } = await import('../../services/api');
      await api.checkServerStatus(s.id);
      const { api: api2 } = await import('../../services/api');
      const res = await api2.getServers();
      // Use the ServerContext's fetch
      window.location.reload();
      toast.success('Status diperiksa');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRefreshAll = async () => {
    try {
      await refreshStatus();
      toast.success('Semua status diperbarui');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const envColor = (env) => {
    const m = { Production: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', Staging: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', Development: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', Internal: 'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300' };
    return m[env] || m.Internal;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Server Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola semua server yang muncul di dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefreshAll} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh Status
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Server className="w-4 h-4" />Tambah Server
          </button>
          <button onClick={() => {
            const token = localStorage.getItem('portal_token');
            fetch('/api/export/servers', { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.blob())
              .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'servers.csv';
                a.click();
              });
          }} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Server</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">IP Address</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Environment</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {servers.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{s.protocol}{s.port ? ` :${s.port}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{s.ip_address}{s.port ? `:${s.port}` : ''}</code>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600 dark:text-gray-400">{s.category || '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${envColor(s.environment)}`}>{s.environment}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openServer(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 transition-colors" title="Open"><ExternalLink className="w-4 h-4" /></button>
                      <button onClick={() => handleToggle(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-600 transition-colors" title={s.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                        {s.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="Belum ada server" description="Klik 'Tambah Server' untuk menambahkan server pertama" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[5vh] overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 mb-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingId ? 'Edit Server' : 'Tambah Server Baru'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Server *</label>
                  <input name="name" value={form.name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address *</label>
                  <input name="ip_address" value={form.ip_address} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                  <input name="port" type="number" value={form.port} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Protocol *</label>
                  <select name="protocol" value={form.protocol} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PROTOCOLS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Akses *</label>
                  <input name="access_url" value={form.access_url} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                  <textarea name="description" value={form.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo Server</label>
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setForm({...form, logo_url: reader.result});
                      reader.readAsDataURL(file);
                    }
                  }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {form.logo_url && <img src={form.logo_url} alt="Preview" className="mt-2 h-16 w-16 object-contain rounded-lg border border-gray-300 dark:border-gray-600" />}
                  <p className="text-xs text-gray-400 mt-1">Upload gambar logo server (opsional)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                  <select name="category" value={form.category} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Pilih --</option>
                    {allCategories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment *</label>
                  <select name="environment" value={form.environment} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ENVS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status Check URL</label>
                  <input name="status_check_url" value={form.status_check_url} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Browser Preference</label>
                  <select name="browser_pref" value={form.browser_pref} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Default Browser</option>
                    <option value="firefox">Mozilla Firefox</option>
                    <option value="chrome">Google Chrome</option>
                    <option value="edge">Microsoft Edge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visible To (Divisi)</label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                    {divisions.length === 0 && <p className="text-xs text-gray-400 italic">Memuat divisi...</p>}
                    {divisions.map(d => {
                      const checked = (form.visible_to || '').split(',').includes(d);
                      return (
                        <label key={d} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleVisibleTo(d)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{d}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {(!form.visible_to || form.visible_to === '') ? 'Semua divisi dapat melihat server ini' : `Dipilih: ${form.visible_to}`}
                  </p>
                </div>
              </div>

              {/* Credentials Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Shared Credentials (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <input type="text" name="shared_username" value={form.shared_username} onChange={handleChange} placeholder="admin" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input type="password" name="shared_password" value={form.shared_password} onChange={handleChange} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input type="checkbox" name="auto_login_enabled" checked={form.auto_login_enabled} onChange={handleChange} id="autologin" className="rounded" />
                  <label htmlFor="autologin" className="text-sm text-gray-700 dark:text-gray-300">Enable auto-login helper</label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Credentials disimpan terenkripsi AES-256. Staff yang di-assign dapat melihat credentials ini.</p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} id="sactive" className="rounded" />
                <label htmlFor="sactive" className="text-sm text-gray-700 dark:text-gray-300">Server Aktif (tampil di dashboard)</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">{submitting ? '...' : editingId ? 'Simpan' : 'Tambah'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Hapus Server" message={`Yakin ingin menghapus server "${deleteTarget?.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
