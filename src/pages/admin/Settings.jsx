import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Settings as SettingsIcon, Plus, Trash2, Tag, Building2, Upload, Image, Shield, ChevronDown, ChevronRight, Info, Check, HardDrive, Clock, Download, Play, Monitor, Lock, Globe, Database, RotateCcw, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';

const TABS = [
  { id: 'umum', label: 'Umum', icon: Globe },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'monitoring', label: 'Monitoring', icon: Monitor },
  { id: 'integrasi', label: 'Integrasi', icon: Shield },
  { id: 'backup', label: 'Backup', icon: HardDrive },
  { id: 'keamanan', label: 'Keamanan', icon: Lock },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('umum');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});

  // Icon upload
  const [customIconUrl, setCustomIconUrl] = useState('');
  const [customIconPreview, setCustomIconPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const iconInputRef = useRef(null);

  // Custom categories
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  // Custom divisions
  const [divisions, setDivisions] = useState([]);
  const [newDivision, setNewDivision] = useState('');

  // AD Config
  const [adEnabled, setAdEnabled] = useState(false);
  const [adUrl, setAdUrl] = useState('ldap://10.78.78.61:389');
  const [adBaseDN, setAdBaseDN] = useState('DC=ad,DC=ast,DC=com');
  const [adUsername, setAdUsername] = useState('access.server@ad.ast.com');
  const [adPassword, setAdPassword] = useState('');
  const [adUserFilter, setAdUserFilter] = useState('');
  const [adGroupFilter, setAdGroupFilter] = useState('');
  const [adTesting, setAdTesting] = useState(false);
  const [adTestResult, setAdTestResult] = useState(null);
  const [showAdFilters, setShowAdFilters] = useState(false);

  // Backup
  const [backupList, setBackupList] = useState([]);
  const [backupRunning, setBackupRunning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [backupSettings, setBackupSettings] = useState({
    autoEnabled: false,
    frequency: 'daily',
    retentionDays: 30,
    time: '02:00',
  });

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload/icon', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('portal_token') },
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setCustomIconUrl(data.url);
      setCustomIconPreview(data.url);
      toast.success('Icon berhasil diupload!');
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  const fetchAdConfig = useCallback(() => {
    fetch('/api/ad/config', { headers: { Authorization: 'Bearer ' + localStorage.getItem('portal_token') } })
      .then(r => r.json())
      .then(d => {
        setAdEnabled(d.enabled);
        if (d.url) setAdUrl(d.url);
        if (d.baseDN) setAdBaseDN(d.baseDN);
        if (d.username) setAdUsername(d.username);
        if (d.userFilter) setAdUserFilter(d.userFilter);
        if (d.groupFilter) setAdGroupFilter(d.groupFilter);
      })
      .catch(() => {});
  }, []);

  const fetchCategories = useCallback(() => {
    api.getCategories().then(d => setCategories(d.categories)).catch(() => {});
  }, []);

  const fetchDivisions = useCallback(() => {
    fetch('/api/divisions', { headers: { Authorization: 'Bearer ' + localStorage.getItem('portal_token') } })
      .then(r => r.json())
      .then(d => setDivisions(d.records || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      api.getSettings().then(data => {
        const map = {};
        for (const s of data.settings) map[s.key] = s.value;
        setSettings(map);
      }),
      fetchCategories(),
      fetchDivisions(),
      fetchAdConfig(),
      api.getBackupSettings().then(d => {
        if (d?.settings) setBackupSettings(d.settings);
      }).catch(() => {}),
      api.listBackups().then(d => {
        if (d?.backups) setBackupList(d.backups);
      }).catch(() => {}),
      (async () => {
        try {
          const token = localStorage.getItem('portal_token');
          const r = await fetch('/api/upload/icon', { headers: { Authorization: 'Bearer ' + token } });
          const d = await r.json();
          if (d?.url) { setCustomIconUrl(d.url); setCustomIconPreview(d.url); }
        } catch (e) {}
      })(),
    ])
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [fetchCategories, fetchDivisions, fetchAdConfig]);

  const get = (key, def = '') => settings[key] ?? def;

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: String(value) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const arr = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await api.updateSettings(arr);
      const token = localStorage.getItem('portal_token');
      const adPayload = {
        enabled: adEnabled,
        url: adUrl || undefined,
        baseDN: adBaseDN || undefined,
        username: adUsername || undefined,
        userFilter: adUserFilter || undefined,
        groupFilter: adGroupFilter || undefined,
      };
      if (adPassword) adPayload.password = adPassword;
      await fetch('/api/ad/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(adPayload),
      });
      await api.saveBackupSettings(backupSettings);
      toast.success('Pengaturan berhasil disimpan');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleTestAd = async () => {
    setAdTesting(true);
    setAdTestResult(null);
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch('/api/ad/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          url: adUrl,
          baseDN: adBaseDN,
          username: adUsername,
          password: adPassword,
          userFilter: adUserFilter,
          groupFilter: adGroupFilter,
        }),
      });
      const data = await res.json();
      setAdTestResult(data);
    } catch (err) {
      setAdTestResult({ success: false, error: err.message });
    }
    setAdTesting(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.restoreBackup(restoreTarget.filename);
      toast.success('Database berhasil direstore. Halaman akan direfresh...');
      setRestoreTarget(null);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) { toast.error(err.message); }
    setRestoring(false);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const val = newCategory.trim();
    if (!val) return toast.error('Nama kategori wajib diisi');
    if (val.length > 100) return toast.error('Maksimal 100 karakter');
    if (categories.some(c => c.value.toLowerCase() === val.toLowerCase())) return toast.error('Kategori sudah ada');
    try {
      const res = await api.createCategory({ value: val });
      setCategories(prev => [...prev, res.category]);
      setNewCategory('');
      toast.success('Kategori "' + val + '" ditambahkan');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteCategory = async (cat) => {
    try {
      await api.deleteCategory(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast.success('Kategori "' + cat.value + '" dihapus');
    } catch (err) { toast.error(err.message); }
  };

  const handleAddDivision = async (e) => {
    e.preventDefault();
    const val = newDivision.trim();
    if (!val) return toast.error('Nama divisi wajib diisi');
    if (val.length > 100) return toast.error('Maksimal 100 karakter');
    if (divisions.some(c => c.value.toLowerCase() === val.toLowerCase())) return toast.error('Divisi sudah ada');
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch('/api/db/custom_fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ field_type: 'division', value: val, label: val }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Divisi "' + val + '" ditambahkan');
      setNewDivision('');
      fetchDivisions();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteDivision = async (r) => {
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch('/api/db/custom_fields/' + r.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.error) throw new Error(err.error);
      }
      setDivisions(prev => prev.filter(d => d.id !== r.id));
      toast.success('Divisi "' + r.value + '" dihapus');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Konfigurasi portal dan preferensi sistem</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-thin">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/5'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <form onSubmit={handleSave}>

        {/* ===== TAB: UMUM ===== */}
        {activeTab === 'umum' && (
          <div className="space-y-6 animate-fade-in">
            {/* Portal Name */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" /> Informasi Portal
              </h2>
              <div className="max-w-lg">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nama Portal</label>
                <input
                  value={get('portal_name')}
                  onChange={(e) => handleChange('portal_name', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            {/* Icon */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Image className="w-5 h-5 text-indigo-500" /> Icon / Logo
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Upload icon untuk favicon dan logo sidebar.</p>
              <div className="flex items-start gap-6 max-w-lg">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 flex items-center justify-center border border-slate-200 dark:border-white/10 overflow-hidden">
                  {customIconPreview ? <img src={customIconPreview} className="w-full h-full object-contain" alt="" /> : <Image className="w-7 h-7 text-indigo-400" />}
                </div>
                <div className="flex-1">
                  <input type="file" accept=".ico,.png,.svg,.jpg,.jpeg" onChange={handleIconUpload} ref={iconInputRef} className="hidden" />
                  <button type="button" onClick={() => iconInputRef.current?.click()} disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
                    <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Pilih File'}
                  </button>
                  {customIconUrl && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1"><Check className="w-3 h-3" /> Icon aktif</p>}
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Appearance</h2>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tema Default</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white text-sm cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}>
                    <option value="light" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">Light</option>
                    <option value="dark" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">Dark</option>
                    <option value="system" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">System</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Item per Halaman</label>
                  <select value={get('items_per_page', '12')} onChange={(e) => handleChange('items_per_page', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white text-sm cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}>
                    <option value="8" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">8</option>
                    <option value="12" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">12</option>
                    <option value="16" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">16</option>
                    <option value="20" className="bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white">20</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Chat Upload Whitelist */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Upload Chat — Whitelist Format
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Format file yang boleh dikirim lewat chat. Pisahkan dengan koma. Contoh: <code className="text-xs bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">pdf, doc, zip, exe, msi</code>
              </p>
              <div className="max-w-2xl">
                <textarea
                  value={get('chat_upload_whitelist', '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.zip,.rar,.exe,.msi,.7z')}
                  onChange={(e) => handleChange('chat_upload_whitelist', e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  placeholder=".pdf,.doc,.zip,.exe,.msi"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Ekstensi default: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, GIF, ZIP, RAR, EXE, MSI, 7Z
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: DATA ===== */}
        {activeTab === 'data' && (
          <div className="space-y-6 animate-fade-in">
            {/* Categories */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" /> Kategori Server
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Tambah/hapus opsi kategori server.</p>
              <div className="space-y-2 mb-4 max-w-md">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.value}</span>
                    <button type="button" onClick={() => handleDeleteCategory(cat)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nama kategori..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory(e)} />
                <button type="button" onClick={handleAddCategory}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>

            {/* Divisions */}
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" /> Divisi
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Tambah/hapus opsi divisi.</p>
              <div className="space-y-2 mb-4 max-w-md">
                <p className="text-xs text-slate-400">Default: Directeur, Engineer, HR/Finance</p>
                {divisions.filter(d => !['Directeur','Engineer','HR/Finance'].includes(d.value)).map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{r.value}</span>
                    <button type="button" onClick={() => handleDeleteDivision(r)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <input type="text" value={newDivision} onChange={(e) => setNewDivision(e.target.value)} placeholder="Nama divisi..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDivision(e)} />
                <button type="button" onClick={handleAddDivision}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: MONITORING ===== */}
        {activeTab === 'monitoring' && (
          <div className="animate-fade-in">
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-500" /> Status Check
              </h2>
              <div className="space-y-4 max-w-lg">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => handleChange('status_check_enabled', get('status_check_enabled') === 'true' ? 'false' : 'true')}
                    className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (get('status_check_enabled') === 'true' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600')}>
                    <span className={'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ' + (get('status_check_enabled') === 'true' ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Aktifkan Auto Status Check</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Interval (detik)</label>
                  <input type="number" value={get('status_check_interval', '60')} onChange={(e) => handleChange('status_check_interval', e.target.value)} min={10} max={300}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: INTEGRASI ===== */}
        {activeTab === 'integrasi' && (
          <div className="animate-fade-in">
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" /> Active Directory
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Integrasi login dengan Active Directory.</p>

              {/* Enable Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 mb-4 max-w-lg">
                <button type="button" onClick={() => setAdEnabled(!adEnabled)}
                  className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (adEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600')}>
                  <span className={'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ' + (adEnabled ? 'translate-x-6' : 'translate-x-1')} />
                </button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Aktifkan Login AD</span>
              </div>

              {/* Basic Config */}
              <div className="grid grid-cols-2 gap-4 max-w-lg mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">AD Server URL</label>
                  <input value={adUrl} onChange={(e) => setAdUrl(e.target.value)} placeholder="ldap://..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Base DN</label>
                  <input value={adBaseDN} onChange={(e) => setAdBaseDN(e.target.value)} placeholder="DC=..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Service Account</label>
                  <input value={adUsername} onChange={(e) => setAdUsername(e.target.value)} placeholder="user@domain.local"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password SA <span className="text-xs text-slate-400">(kosongkan jika tidak diubah)</span></label>
                  <input type="password" value={adPassword} onChange={(e) => setAdPassword(e.target.value)} placeholder="********"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                </div>
              </div>

              {/* Advanced Filters */}
              <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden mb-4">
                <button type="button" onClick={() => setShowAdFilters(!showAdFilters)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Advanced: User & Group Query</span>
                  </div>
                  {showAdFilters ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {showAdFilters && (
                  <div className="p-4 space-y-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">User Filter dan Group Filter adalah query LDAP untuk memfilter user yang boleh login dan menentukan role.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">User Filter (LDAP)</label>
                      <textarea value={adUserFilter} onChange={(e) => setAdUserFilter(e.target.value)} rows={3}
                        placeholder="(&amp;(objectClass=person)(memberOf=*))"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm font-mono resize-none" />
                      <p className="text-xs text-slate-400 mt-1">Filter untuk memilih user yang boleh login.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Group Filter (LDAP)</label>
                      <textarea value={adGroupFilter} onChange={(e) => setAdGroupFilter(e.target.value)} rows={3}
                        placeholder="(|(cn=Administrators)(cn=IT-Team)(cn=Domain Users))"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm font-mono resize-none" />
                      <p className="text-xs text-slate-400 mt-1">Filter untuk group-group yang menentukan role user.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Test Button */}
              <button type="button" onClick={handleTestAd} disabled={adTesting}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-white/10 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {adTesting ? 'Testing...' : 'Test Koneksi AD'}
              </button>

              {adTestResult && (
                <div className={'mt-3 p-3.5 rounded-xl text-sm ' + (adTestResult.success ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400')}>
                  {adTestResult.success ? (
                    <div className="flex items-center gap-2"><Check className="w-4 h-4" /> {adTestResult.message}</div>
                  ) : (
                    <div className="flex items-center gap-2">&#10060; {adTestResult.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: BACKUP ===== */}
        {activeTab === 'backup' && (
          <div className="animate-fade-in">
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-indigo-500" /> Backup Database
                </h2>
                <button
                  onClick={async () => {
                    setBackupRunning(true);
                    try {
                      await api.runBackup('manual');
                      toast.success('Backup berhasil dibuat!');
                      const d = await api.listBackups();
                      if (d?.backups) setBackupList(d.backups);
                    } catch (err) { toast.error(err.message); }
                    setBackupRunning(false);
                  }}
                  disabled={backupRunning}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                >
                  <Play className={'w-4 h-4' + (backupRunning ? ' animate-pulse' : '')} />
                  {backupRunning ? 'Backup...' : 'Backup Sekarang'}
                </button>
              </div>

              {/* Auto Backup Settings */}
              <div className="space-y-4 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Backup</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Jalankan backup otomatis secara terjadwal</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackupSettings(s => ({ ...s, autoEnabled: !s.autoEnabled }))}
                    className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (backupSettings.autoEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600')}
                  >
                    <span className={'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ' + (backupSettings.autoEnabled ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>

                {backupSettings.autoEnabled && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Frekuensi</label>
                      <select
                        value={backupSettings.frequency}
                        onChange={e => setBackupSettings(s => ({ ...s, frequency: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs"
                      >
                        <option value="hourly">Setiap Jam</option>
                        <option value="daily">Harian</option>
                        <option value="weekly">Mingguan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Waktu</label>
                      <input
                        type="time"
                        value={backupSettings.time}
                        onChange={e => setBackupSettings(s => ({ ...s, time: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Retensi (hari)</label>
                      <input
                        type="number"
                        value={backupSettings.retentionDays}
                        onChange={e => setBackupSettings(s => ({ ...s, retentionDays: parseInt(e.target.value) || 30 }))}
                        min={1} max={365}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Backup History */}
              {backupList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada backup</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {backupList.map((b) => (
                    <div key={b.filename} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                          <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{b.filename}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(b.createdAt).toLocaleString('id-ID')}
                            <span className="ml-2">·</span>
                            <span>{(b.size / 1024).toFixed(1)} KB</span>
                            {b.label !== 'manual' && <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded text-[10px]">{b.label}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setRestoreTarget(b)}
                          className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <a
                          href={api.downloadBackup(b.filename)}
                          download={b.filename}
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={async () => {
                            try {
                              await api.deleteBackup(b.filename);
                              setBackupList(prev => prev.filter(x => x.filename !== b.filename));
                              toast.success('Backup dihapus');
                            } catch (err) { toast.error(err.message); }
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        <ConfirmModal
          open={!!restoreTarget}
          title="Restore Database"
          message={`Yakin ingin restore database dari backup "${restoreTarget?.filename}"? Data saat ini akan ditimpa dengan data dari backup. Tindakan ini tidak bisa dibatalkan.`}
          confirmText="Restore"
          confirmColor="amber"
          loading={restoring}
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
        />

        {/* ===== TAB: KEAMANAN ===== */}
        {activeTab === 'keamanan' && (
          <div className="animate-fade-in">
            <div className="bg-white dark:bg-[#0d1321] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-500" /> Keamanan
              </h2>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Session Timeout (menit)</label>
                  <input type="number" value={get('session_timeout', '5')} onChange={(e) => handleChange('session_timeout', e.target.value)} min={5} max={480}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                  <p className="text-xs text-slate-400 mt-1">User auto logout setelah tidak aktif</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Max Login Attempts</label>
                  <input type="number" value={get('max_login_attempts', '5')} onChange={(e) => handleChange('max_login_attempts', e.target.value)} min={1} max={10}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm" />
                  <p className="text-xs text-slate-400 mt-1">Max percobaan login sebelum blokir</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
}
