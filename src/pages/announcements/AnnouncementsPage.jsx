import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import AnnouncementModal from '../../components/announcements/AnnouncementModal';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Megaphone, Search, Plus } from 'lucide-react';

export default function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [divisions, setDivisions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    loadDivisions();
  }, [page, filterDivision]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const params = { page };
      if (filterDivision) params.division = filterDivision;
      const res = await api.getAnnouncements(params);
      setAnnouncements(res.announcements || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Load announcements error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await fetch('/api/divisions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDivisions(data.divisions || []);
        }
      } catch (err) {
        // Silently fail; divisions optional
        console.error('Failed to load divisions:', err);
      }
    };
    fetchDivisions();
  }, []);

  const handleCreate = async (data) => {
    await api.createAnnouncement(data);
    loadAnnouncements();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    await api.deleteAnnouncement(id);
    loadAnnouncements();
  };

  const handleTogglePin = async (id) => {
    await api.togglePinAnnouncement(id);
    loadAnnouncements();
  };

  const filtered = announcements.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengumuman</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Informasi dan pengumuman perusahaan
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Buat Pengumuman
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pengumuman..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterDivision}
          onChange={(e) => { setFilterDivision(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Divisi</option>
          {divisions.map(d => (
            <option key={d.id} value={String(d.id)}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada pengumuman</p>
          {isAdmin && <p className="text-sm mt-1">Klik "Buat Pengumuman" untuk membuat yang pertama</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className="relative group/card">
              <AnnouncementCard
                announcement={a}
                onClick={() => { setSelectedAnnouncement(a); setShowDetailModal(true); }}
              />
              {isAdmin && (
                <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTogglePin(a.id); }}
                    className={`p-1.5 rounded-lg text-xs ${a.is_pinned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-amber-500'}`}
                    title={a.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    📌
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20"
                    title="Hapus"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnnouncementModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        divisions={divisions}
      />

      {/* Detail Modal */}
      {selectedAnnouncement && (
        <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={selectedAnnouncement.title} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{selectedAnnouncement.author_name}</span>
              <span>·</span>
              <span>{new Date(selectedAnnouncement.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {selectedAnnouncement.division_name && (
                <>
                  <span>·</span>
                  <Badge variant="default">{selectedAnnouncement.division_name}</Badge>
                </>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
