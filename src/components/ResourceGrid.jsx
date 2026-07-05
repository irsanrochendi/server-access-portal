import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import ResourceCard from './ResourceCard';
import EmptyState from './EmptyState';

export default function ResourceGrid({ resources, loading }) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = resources.filter(r =>
      !q || r.name?.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    );

    const groups = {};
    filtered.forEach(r => {
      const cat = r.category || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }, [resources, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari resource..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white"
        />
      </div>

      {/* Resource Groups */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState
          title="Tidak ada resource"
          description={search ? `Tidak ditemukan "${search}"` : 'Belum ada resource yang ditugaskan'}
        />
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(r => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
