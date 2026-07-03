import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, User, Shield, ShieldOff, RefreshCw, X, Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'staff', division: '', isActive: true });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [adUsers, setAdUsers] = useState([]);
  const [showAdUsers, setShowAdUsers] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  const fetchUsers = () => api.getUsers().then(d => setUsers(d.users)).catch(e => toast.error(e.message));
  const fetchDivisions = () => fetch('/api/divisions', { headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` } }).then(r => r.json()).then(d => setDivisions(d.divisions || [])).catch(() => {});

  useEffect(() => { Promise.all([fetchUsers(), fetchDivisions()]).finally(() => setLoading(false)); }, []);

  const syncAdUsers = async () => {
    setAdLoading(true);
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch('/api/ad/users', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAdUsers(data.users || []);
      api.getUsers().then(d => setUsers(d.users)).catch(e => toast.error(e.message));
      toast.success(`Sync AD: ${data.synced?.created || 0} baru, ${data.synced?.updated || 0} update, ${data.synced?.removed || 0} dihapus`);
      setShowAdUsers(true);
    } catch (err) { toast.error('Gagal sync AD: ' + err.message); }
    setAdLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', email: '', username: '', password: '', role: 'staff', division: '', isActive: true });
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, username: u.username || '', password: '', role: u.role, division: u.division || '', isActive: !!u.is_active });
    setShowForm(true);
  };

  const changeRole = async (user, newRole) => {
    try {
      await api.updateUser(user.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      toast.success(`Role "${user.name}" → ${newRole}`);
    } catch (err) { toast.error(err.message); }
  };

  const changeDivision = async (user, newDivision) => {
    try {
      await api.updateUser(user.id, { division: newDivision });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, division: newDivision } : u));
      toast.success(`Divisi "${user.name}" → ${newDivision || '(kosong)'}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { name: form.name, email: form.email, username: form.username, role: form.role, division: form.division, is_active: form.isActive };
      if (form.password) data.password = form.password;
      if (editingId) {
        await api.updateUser(editingId, data);
        toast.success('User berhasil diupdate');
      } else {
        if (!form.password) { toast.error('Password wajib untuk user baru'); return; }
        await api.createUser(data);
        toast.success('User baru berhasil ditambahkan');
      }
      setShowForm(false);
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    try {
      await api.deleteUser(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      toast.success(`User "${deleteTarget.name}" dihapus`);
    } catch (err) { toast.error(err.message); }
    setDeleteTarget(null);
  };

  const toggleUser = async (user) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active ? 1 : 0 } : u));
      toast.info(`User "${user.name}" ${user.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola akun dan role pengguna portal</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncAdUsers} disabled={adLoading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
            <RefreshCw className={'w-4 h-4' + (adLoading ? ' animate-spin' : '')} /> Sync AD
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25">
            <Plus className="w-4 h-4" /> Tambah User
          </button>
        </div>
      </div>

      {/* AD Users Modal */}
      {showAdUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0d1321] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Users Active Directory ({adUsers.length})</h2>
              <button onClick={() => setShowAdUsers(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#0d1321]">
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Nama</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Email / UPN</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Groups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {adUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-mono">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'}`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{u.groups?.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400">User</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400 hidden lg:table-cell">Username</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400 hidden lg:table-cell">Divisi</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Status</th>
                <th className="text-right px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400 font-mono text-xs">{user.email}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600 dark:text-slate-400 text-xs font-mono">{user.username || '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <select value={user.division || ''}
                      onChange={(e) => changeDivision(user, e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 min-w-[100px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                      <option value="">—</option>
                      {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={user.role}
                      onChange={(e) => changeRole(user, e.target.value)}
                      className={`text-xs font-medium rounded-lg px-2.5 py-1.5 min-w-[80px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors
                        ${user.role === 'admin'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                      }`}>
                      <option value="admin">Admin</option><option value="staff">Staff</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {user.is_active ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleUser(user)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors" title={user.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                        {user.is_active ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(user)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(user)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7}><EmptyState title="Belum ada user" description="Klik 'Tambah User' untuk menambahkan user pertama" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0d1321] rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-scale">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit User' : 'Tambah User Baru'}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{editingId ? 'Update informasi pengguna' : 'Tambah pengguna baru ke portal'}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name & Username Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nama <span className="text-red-500">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Nama lengkap"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                  <input
                    value={form.username || ''}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    placeholder="Username login"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email & Password Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                    placeholder="email@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password {editingId ? '' : <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required={!editingId}
                    placeholder={editingId ? 'Kosongkan jika tidak diubah' : 'Password login'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Division & Role Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Divisi</label>
                  <select
                    value={form.division}
                    onChange={e => setForm({ ...form, division: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm cursor-pointer transition-all"
                  >
                    <option value="">-- Pilih Divisi --</option>
                    {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role <span className="text-red-500">*</span></label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm cursor-pointer transition-all"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${form.isActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Akun Aktif</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{form.isActive ? 'User dapat login ke portal' : 'User tidak dapat login'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-500/25 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Hapus User" message={`Yakin ingin menghapus user "${deleteTarget?.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
