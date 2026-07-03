import { useState, useEffect } from 'react';
import { Database, Table, RefreshCw, Pencil, Trash2, X, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TABLE_NAMES = ['users', 'servers', 'activity_logs', 'roles', 'settings', 'custom_fields', 'user_roles'];

export default function DbBrowser() {
  const toast = useToast();
  const [tables, setTables] = useState({});
  const [activeTable, setActiveTable] = useState('servers');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newValues, setNewValues] = useState({});

  const fetchTable = async (table) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch(`/api/db/${table}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.json().then(d => d.error));
      const data = await res.json();
      setRows(data.rows);
      setColumns(data.columns.filter(c => c !== 'password_hash'));
      setTotal(data.total);
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  useEffect(() => { fetchTable(activeTable); }, [activeTable]);

  const handleEdit = (row) => {
    setEditingRow(row.id);
    setEditValues({ ...row });
    delete editValues.password_hash;
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch(`/api/db/${activeTable}/${editingRow}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editValues),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Row updated');
      setEditingRow(null);
      fetchTable(activeTable);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus row ini?')) return;
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch(`/api/db/${activeTable}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Row deleted');
      fetchTable(activeTable);
    } catch (err) { toast.error(err.message); }
  };

  const handleAdd = async () => {
    try {
      const token = localStorage.getItem('portal_token');
      const res = await fetch(`/api/db/${activeTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newValues),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Row added');
      setShowAdd(false);
      setNewValues({});
      fetchTable(activeTable);
    } catch (err) { toast.error(err.message); }
  };

  const formatValue = (val) => {
    if (val === null) return <span className="text-gray-400 italic">null</span>;
    if (val === 0 || val === 1) return <span className={val ? 'text-green-600' : 'text-red-400'}>{val ? '1 ✓' : '0 ✗'}</span>;
    if (typeof val === 'string' && val.length > 80) return val.slice(0, 80) + '…';
    if (typeof val === 'string' && val.startsWith('[')) return <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{val}</code>;
    return String(val);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Database className="w-6 h-6" /> Database Browser
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View & edit database langsung dari browser</p>
      </div>

      {/* Table tabs */}
      <div className="flex flex-wrap gap-2">
        {TABLE_NAMES.map(t => (
          <button
            key={t}
            onClick={() => setActiveTable(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTable === t
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> {t}
          </button>
        ))}
        <button onClick={() => fetchTable(activeTable)} className="px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-sm text-gray-500">{activeTable}: {total} rows</p>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-auto">
        {loading ? <div className="flex items-center justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div> : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {columns.map(c => <th key={c} className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-800/50">{c}</th>)}
                <th className="px-3 py-2 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {rows.map(row => (
                editingRow === row.id ? (
                  <tr key={row.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                    {columns.map(c => (
                      <td key={c} className="px-3 py-1">
                        <input
                          value={editValues[c] ?? ''}
                          onChange={e => setEditValues({ ...editValues, [c]: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1 flex gap-1">
                      <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingRow(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {columns.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap">{formatValue(row[c])}</td>)}
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(row)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        {activeTable !== 'activity_logs' && activeTable !== 'settings' && <button onClick={() => handleDelete(row.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new row */}
      {['servers', 'custom_fields'].includes(activeTable) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <button onClick={() => setShowAdd(!showAdd)} className="text-sm font-medium text-blue-600 hover:underline">
            {showAdd ? 'Tutup' : '+ Tambah Row'}
          </button>
          {showAdd && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {columns.filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at').map(c => (
                <div key={c}><input placeholder={c} value={newValues[c] || ''} onChange={e => setNewValues({ ...newValues, [c]: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
              ))}
              <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
