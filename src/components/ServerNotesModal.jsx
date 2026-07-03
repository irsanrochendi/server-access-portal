import { useState, useEffect } from 'react';
import {
  X, Eye, EyeOff, Copy, Plus, Trash2, ExternalLink, AlertTriangle,
  Server, Lock, Link as LinkIcon, Calendar, User, FileText, RotateCcw, ChevronDown,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function ServerNotesModal({ server, notes: initialNotes, onClose, onSave }) {
  const toast = useToast();

  const defaultDraft = {
    defaultUsername: '',
    defaultPassword: '',
    sshPort: 22,
    vspherePort: 443,
    notes: '',
    licenseKey: '',
    licenseExpire: '',
    owner: '',
    docLinks: [],
    visibleTo: '',
  };

  const [draft, setDraft] = useState(defaultDraft);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdRevealedAt, setPwdRevealedAt] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const isAdmin = (() => {
    try { const t = JSON.parse(atob(localStorage.getItem('portal_token').split('.')[1])); return t.role === 'admin'; } catch(_) { return false; }
  })();

  // Load all users for visible_to dropdown (only if admin)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` },
        });
        const data = await res.json();
        setAllUsers(data.users || []);
      } catch (_) {}
    };
    fetchUsers();
  }, [isAdmin]);

  const [loading, setLoading] = useState(true);

  // Auto-fetch notes dari API saat modal dibuka
  useEffect(() => {
    if (!server) return;
    setLoading(true);
    const fetchNotes = async () => {
      try {
        const token = localStorage.getItem('portal_token');
        const res = await fetch(`/api/server-notes/${server.id}/notes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Gagal memuat catatan');
        const data = await res.json();
        const notes = data.notes;
        setDraft({
          defaultUsername: notes.defaultUsername || '',
          defaultPassword: notes.defaultPassword || '',
          sshPort: notes.sshPort ?? 22,
          vspherePort: notes.vspherePort ?? 443,
          notes: notes.notes || '',
          licenseKey: notes.licenseKey || '',
          licenseExpire: notes.licenseExpire || '',
          owner: notes.owner || '',
          docLinks: Array.isArray(notes.docLinks) ? notes.docLinks : [],
          visibleTo: notes.visibleTo || '',
        });
        setSelectedUsernames(
          (notes.visibleTo || '').split(',').filter(Boolean).map(u => u.trim().toLowerCase())
        );
      } catch (_) {
        // Keep defaults if fetch fails
      }
      setLoading(false);
    };
    fetchNotes();
  }, [server]);

  // Auto-hide password after 30 seconds
  useEffect(() => {
    if (!pwdRevealedAt) return;
    const timer = setTimeout(() => {
      setShowPwd(false);
      setPwdRevealedAt(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [pwdRevealedAt]);

  const handleRevealPwd = async () => {
    if (showPwd) {
      setShowPwd(false);
      setPwdRevealedAt(null);
      return;
    }
    setShowPwd(true);
    setPwdRevealedAt(Date.now());
    // Log access
    try {
      await fetch(`/api/server-notes/${server.id}/notes/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('portal_token')}`,
        },
        body: JSON.stringify({ action: 'view' }),
      });
      toast.warning('Password ditampilkan. Aktivitas di-log di audit trail.');
    } catch (_) {}
  };

  const handleCopyPwd = async () => {
    if (!draft.defaultPassword) return;
    try {
      await navigator.clipboard.writeText(draft.defaultPassword);
      await fetch(`/api/server-notes/${server.id}/notes/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('portal_token')}`,
        },
        body: JSON.stringify({ action: 'copy' }),
      });
      toast.warning('Password disalin. Aktivitas di-log di audit trail.');
    } catch (_) {
      toast.error('Gagal menyalin ke clipboard');
    }
  };

  const handleSave = async () => {
    if (confirming) {
      setSaving(true);
      try {
        const { api } = await import('../services/api.js');
        const saveData = { ...draft, visibleTo: selectedUsernames.join(',') };
        await api.updateServerNotes(server.id, saveData);
        toast.success('Catatan server disimpan');
        onSave && onSave();
        onClose();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  const addLink = () => {
    const url = newLink.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('URL harus diawali http:// atau https://');
      return;
    }
    setDraft((d) => ({ ...d, docLinks: [...d.docLinks, url] }));
    setNewLink('');
  };

  const removeLink = (i) => {
    setDraft((d) => ({ ...d, docLinks: d.docLinks.filter((_, idx) => idx !== i) }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0d1321] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-white/10 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Catatan Server</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Server className="w-3 h-3" />
                {server.name} &middot; {server.ip_address}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Kredensial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Lock className="w-4 h-4 text-amber-500" />
              Kredensial Default
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Username</label>
                <input
                  value={draft.defaultUsername}
                  onChange={(e) => setDraft((d) => ({ ...d, defaultUsername: e.target.value }))}
                  placeholder="root, admin, dll"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                  <span>Password</span>
                  {showPwd && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">revealed &middot; auto-hide 30s</span>
                  )}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={draft.defaultPassword}
                    onChange={(e) => setDraft((d) => ({ ...d, defaultPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    onClick={handleRevealPwd}
                    title={showPwd ? 'Sembunyikan' : 'Lihat & log akses'}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 shrink-0"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCopyPwd}
                    title="Salin ke clipboard"
                    disabled={!draft.defaultPassword}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 disabled:opacity-30 shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">SSH Port</label>
                <input
                  type="number"
                  value={draft.sshPort}
                  onChange={(e) => setDraft((d) => ({ ...d, sshPort: parseInt(e.target.value) || 22 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Port vSphere / Web</label>
                <input
                  type="number"
                  value={draft.vspherePort}
                  onChange={(e) => setDraft((d) => ({ ...d, vspherePort: parseInt(e.target.value) || 443 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </div>

          {/* Catatan bebas */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Catatan Maintenance
            </label>
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Catatan internal, jadwal maintenance, peringatan penting..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          {/* Lisensi & Owner */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">License Key</label>
              <input
                value={draft.licenseKey}
                onChange={(e) => setDraft((d) => ({ ...d, licenseKey: e.target.value }))}
                placeholder="XXXXX-XXXXX-XXXXX"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Expire
              </label>
              <input
                type="date"
                value={draft.licenseExpire}
                onChange={(e) => setDraft((d) => ({ ...d, licenseExpire: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                Owner / Penanggung Jawab
              </label>
              <input
                value={draft.owner}
                onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                placeholder="Pak Irsan"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {isAdmin && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-500" />
              User yang Boleh Lihat (selain admin)
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10"
              >
                <span className={selectedUsernames.length === 0 ? 'text-slate-400' : ''}>
                  {selectedUsernames.length === 0
                    ? 'Admin Only'
                    : `${selectedUsernames.length} user dipilih`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showUserDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#0d1321] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u => u.role !== 'admin')
                    .map(u => {
                      const sel = selectedUsernames.includes(u.email.toLowerCase());
                      return (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => {
                              setSelectedUsernames(prev =>
                                sel
                                  ? prev.filter(e => e !== u.email.toLowerCase())
                                  : [...prev, u.email.toLowerCase()]
                              );
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm">{u.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{u.email}</span>
                        </label>
                      );
                    })}
                  {allUsers.filter(u => u.role !== 'admin').length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-400">Tidak ada user non-admin</p>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {selectedUsernames.length === 0
                  ? 'Kosong = hanya admin yang bisa lihat catatan server ini'
                  : `User yang dipilih bisa melihat kredensial server ini: ${selectedUsernames.join(', ')}`
                }
              </p>
            </div>
          </div>
          )}

          {/* Link Dokumentasi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-500" />
              Link Dokumentasi
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLink()}
                placeholder="https://..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                onClick={addLink}
                className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {draft.docLinks.map((url, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {url}
                    <ExternalLink className="inline w-3 h-3 ml-1 opacity-50" />
                  </a>
                  <button
                    onClick={() => removeLink(i)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {draft.docLinks.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada link. Tambah URL di atas.</p>
              )}
            </div>
          </div>

          {/* Audit notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Akses kredensial dicatat di Audit Log</p>
              <p>Setiap kali Anda melihat atau menyalin password, sistem mencatat siapa, kapan, dan dari mana. Log ini tidak bisa dihapus.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl flex items-center gap-2 transition-colors ${
              confirming
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:opacity-60`}
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <RotateCcw className="w-4 h-4" />
            {confirming ? 'Klik lagi untuk konfirmasi' : 'Simpan Catatan'}
          </button>
        </div>
      </div>
    </div>
  );
}
