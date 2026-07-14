import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnouncements } from '../../contexts/AnnouncementContext';
import { api } from '../../services/api';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Megaphone, Plus } from 'lucide-react';

export default function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const { markAllAsRead } = useAnnouncements();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  // Mark as read only once when page loads (not in dependency array)
  useEffect(() => {
    loadAnnouncements();
  }, [page]);

  useEffect(() => {
    markAllAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.getAnnouncements({ page });
      setAnnouncements(res.announcements || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Load announcements error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      await api.createAnnouncement({
        title: newTitle.trim(),
        content: newContent.trim(),
        priority: newPriority,
      });
      setNewTitle('');
      setNewContent('');
      setShowCreateModal(false);
      loadAnnouncements();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      await api.deleteAnnouncement(id);
      loadAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePin = async (id) => {
    try {
      await api.togglePinAnnouncement(id);
      loadAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = announcements.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengumuman</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informasi dan pengumuman perusahaan</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Buat Pengumuman
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Cari pengumuman..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Belum ada pengumuman</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className="relative group">
              <AnnouncementCard
                announcement={a}
                onClick={() => { setSelectedAnnouncement(a); setShowDetailModal(true); }}
              />
              {isAdmin && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleTogglePin(a.id)} className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-700/90 text-slate-500 hover:text-amber-500">
                    📌
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-700/90 text-slate-500 hover:text-red-500">
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
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>←</Button>
          <span className="px-4 py-2 text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={selectedAnnouncement?.title || ''} size="lg">
        {selectedAnnouncement && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{selectedAnnouncement.author_name}</span>
              <span>·</span>
              <span>{new Date(selectedAnnouncement.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {selectedAnnouncement.priority === 'urgent' && <Badge variant="danger">Urgent</Badge>}
              {selectedAnnouncement.priority === 'high' && <Badge variant="warning">Penting</Badge>}
            </div>
            <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Buat Pengumuman" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required placeholder="Judul pengumuman..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konten</label>
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} required placeholder="Isi pengumuman..." rows={5}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioritas</label>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="low">Rendah</option>
              <option value="normal">Normal</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Batal</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Membuat...' : 'Buat'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
