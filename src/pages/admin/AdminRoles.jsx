import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Shield, ShieldAlert, Check, X, ChevronDown,
  Server, Users, Settings, ClipboardList, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

const ALL_PERMISSIONS = [
  { key: 'manage-servers', label: 'Manage Servers', description: 'CRUD server, toggle aktif/nonaktif', icon: Server },
  { key: 'manage-users', label: 'Manage Users', description: 'CRUD user, assign role', icon: Users },
  { key: 'manage-roles', label: 'Manage Roles', description: 'CRUD role, edit permissions', icon: Shield },
  { key: 'manage-settings', label: 'Manage Settings', description: 'Ubah konfigurasi portal', icon: Settings },
  { key: 'view-logs', label: 'View Activity Logs', description: 'Lihat riwayat aktivitas admin', icon: ClipboardList },
  { key: 'export-data', label: 'Export Data', description: 'Download daftar server ke CSV/Excel', icon: Download },
];

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Ungu', bg: 'bg-purple-500' },
  { value: 'blue', label: 'Biru', bg: 'bg-blue-500' },
  { value: 'green', label: 'Hijau', bg: 'bg-green-500' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-500' },
  { value: 'red', label: 'Merah', bg: 'bg-red-500' },
  { value: 'gray', label: 'Abu-abu', bg: 'bg-gray-500' },
];

export default function AdminRoles() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: [], color: 'blue' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchRoles = () => api.getRoles().then(d => setRoles(d.roles)).catch(e => toast.error(e.message));
  useEffect(() => { fetchRoles().finally(() => setLoading(false)); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', permissions: [], color: 'blue' });
    setShowForm(true);
  };

  const openEdit = (role) => {
    setEditingId(role.id);
    setForm({ name: role.name, description: role.description, permissions: [...role.permissions], color: role.color });
    setShowForm(true);
  };

  const togglePermission = (permKey) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nama role wajib diisi'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateRole(editingId, form);
        toast.success('Role berhasil diupdate');
      } else {
        await api.createRole(form);
        toast.success('Role baru berhasil dibuat');
      }
      setShowForm(false);
      fetchRoles();
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteRole(deleteTarget.id);
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast.success(`Role "${deleteTarget.name}" dihapus`);
    } catch (err) { toast.error(err.message); }
    setDeleteTarget(null);
  };

  const colorBadge = (color) => {
    const m = {
      purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
      amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
      red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600',
    };
    return m[color] || m.blue;
  };

  const iconBg = (color) => {
    const m = {
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    };
    return m[color] || m.blue;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola role dan akses pengguna portal</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"><Plus className="w-4 h-4" />Buat Role</button>
      </div>

      {/* Tabs-style vertical list */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Role list */}
        <div className="w-full lg:w-72 shrink-0 space-y-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                expandedRole === role.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg(role.color)}`}>
                {role.permissions.length === 6 ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{role.name}</span>
                  {role.is_builtin && <span className="text-[9px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 uppercase shrink-0">B</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{role.permissions.length} perm · {role.usersCount || 0} user</p>
              </div>
            </button>
          ))}
          {roles.length === 0 && <div className="col-span-2"><EmptyState title="Belum ada role" /></div>}
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1">
          {expandedRole ? (
            (() => {
              const role = roles.find(r => r.id === expandedRole);
              if (!role) return <p className="text-sm text-gray-400 italic">Pilih role</p>;
              return (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg(role.color)}`}>
                        {role.permissions.length === 6 ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{role.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!role.is_builtin && (
                        <>
                          <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteTarget(role)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {role.is_builtin && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />Role built-in tidak dapat diedit.
                    </div>
                  )}

                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Permissions ({role.permissions.length}/{ALL_PERMISSIONS.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map((perm) => {
                      const has = role.permissions.includes(perm.key);
                      const Icon = perm.icon;
                      return (
                        <div key={perm.key} className={`flex items-start gap-3 p-3 rounded-lg border ${
                          has ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${has ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}><Icon className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{perm.label}</p>{has ? <Check className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />}</div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{perm.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
              <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Pilih role dari daftar di samping</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[5vh] overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl mx-4 p-6 mb-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingId ? 'Edit Role' : 'Buat Role Baru'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Role *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Misal: Editor, Viewer, Manager..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Warna</label><div className="flex items-center gap-2 flex-wrap">{COLOR_OPTIONS.map((c) => (<button key={c.value} type="button" onClick={() => setForm({ ...form, color: c.value })} className={`w-7 h-7 rounded-lg ${c.bg} transition-transform ${form.color === c.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 dark:ring-offset-gray-800' : 'opacity-60 hover:opacity-100'}`} title={c.label} />))}</div></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Jelaskan fungsi role ini..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions ({form.permissions.length}/{ALL_PERMISSIONS.length})</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{ALL_PERMISSIONS.map((perm) => { const checked = form.permissions.includes(perm.key); const Icon = perm.icon; return (<label key={perm.key} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><input type="checkbox" checked={checked} onChange={() => togglePermission(perm.key)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 shrink-0" /><Icon className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" /><span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span></label>); })}</div></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Batal</button><button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">{editingId ? 'Simpan' : 'Buat Role'}</button></div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal open={!!deleteTarget} title="Hapus Role" message={deleteTarget?.usersCount > 0 ? `Role "${deleteTarget?.name}" masih dipakai user.` : `Yakin ingin menghapus role "${deleteTarget?.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
