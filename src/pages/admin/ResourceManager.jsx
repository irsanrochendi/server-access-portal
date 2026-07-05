import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Globe, Terminal, Monitor, X, Users, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useResources } from '../../contexts/ResourceContext';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

const emptyForm = {
  name: '', url: '', type: 'web', category: '', icon: '',
  description: '', shared_username: '', shared_password: '',
  auto_login_enabled: false,
};

const TYPE_OPTIONS = [
  { value: 'web', label: 'Website', icon: Globe },
  { value: 'rdp', label: 'Remote Desktop', icon: Monitor },
  { value: 'ssh', label: 'SSH', icon: Terminal },
];

export default function ResourceManager() {
  const { resources, fetchResources } = useResources();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAssign, setShowAssign] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    if (showAssign) {
      api.getUsers().then(d => setUsers(d.users || [])).catch(() => {});
      api.getAssignments(showAssign.id).then(d => setAssignments(d.assignments || [])).catch(() => {});
    }
  }, [showAssign]);

  const handleSave = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateResource(editing.id, form);
      } else {
        await api.createResource(form);
      }
      await fetchResources();
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteResource(deleteTarget.id);
      await fetchResources();
    } catch (e) {
      alert(e.message);
    }
    setDeleteTarget(null);
  };

  const handleAssign = async (userId) => {
    try {
      await api.assignResource(showAssign.id, { user_id: userId });
      const updated = await api.getAssignments(showAssign.id);
      setAssignments(updated.assignments || []);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRemoveAssign = async (assignmentId) => {
    try {
      await api.removeAssignment(showAssign.id, assignmentId);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (e) {
      alert(e.message);
    }
  };

  const editResource = (r) => {
    setForm({
      name: r.name, url: r.url, type: r.type, category: r.category,
      icon: r.icon, description: r.description,
      shared_username: r.shared_username || '', shared_password: '',
      auto_login_enabled: r.auto_login_enabled,
    });
    setEditing(r);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resource Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola resource untuk staff</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Tambah Resource
        </button>
      </div>

      {/* List */}
      {resources.length === 0 ? (
        <EmptyState title="Belum ada resource" description="Tambahkan resource baru untuk staff akses" />
      ) : (
        <div className="space-y-3">
          {resources.map(r => (
            <div key={r.id} className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                  r.type === 'web' ? 'from-blue-500 to-cyan-500' :
                  r.type === 'rdp' ? 'from-purple-500 to-pink-500' : 'from-emerald-500 to-teal-500'
                } flex items-center justify-center`}>
                  {React.createElement(
                    r.type === 'web' ? Globe : r.type === 'rdp' ? Monitor : Terminal,
                    { className: 'w-5 h-5 text-white' }
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.url} {r.category && `• ${r.category}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAssign(r)} className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Assign ke user">
                  <Users className="w-4 h-4" />
                </button>
                <button onClick={() => editResource(r)} className="p-2 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(r)} className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Resource' : 'Tambah Resource'}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Resource</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL / IP Address</label>
                <input value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipe</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white">
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    placeholder="Internal Apps, Dev Servers..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deskripsi (opsional)</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
              </div>
              <hr className="dark:border-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kredensial (opsional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                  <input value={form.shared_username} onChange={e => setForm({...form, shared_username: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <input type="password" value={form.shared_password} onChange={e => setForm({...form, shared_password: e.target.value})}
                    placeholder={editing ? '(biarkan kosong jika tidak diubah)' : ''}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_login_enabled} onChange={e => setForm({...form, auto_login_enabled: e.target.checked})}
                  className="rounded border-slate-300" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Aktifkan auto-login</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !form.name || !form.url}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-6 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Assign: {showAssign.name}</h3>
              <button onClick={() => setShowAssign(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Assigned ke user:</p>
            <div className="space-y-2 mb-4">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{a.user_name || a.role || 'Unknown'}</span>
                  <button onClick={() => handleRemoveAssign(a.id)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {assignments.length === 0 && (
                <p className="text-sm text-slate-400">Belum ada assignment</p>
              )}
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Tambah user:</p>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white mb-3"
              value="" onChange={e => { handleAssign(parseInt(e.target.value)); e.target.value = ''; }}>
              <option value="">-- Pilih user --</option>
              {users.filter(u => u.is_active).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button onClick={() => setShowAssign(null)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Tutup</button>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Hapus Resource" message={`Yakin ingin menghapus resource "${deleteTarget?.name}"?`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
