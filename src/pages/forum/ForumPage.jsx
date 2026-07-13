import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import TopicCard from '../../components/forum/TopicCard';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { MessagesSquare, Plus, Filter } from 'lucide-react';

export default function ForumPage() {
  const { isAdmin } = useAuth();
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [sort, setSort] = useState('latest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const result = await api.getForumTopics({ category_id: filterCategory || undefined, page, sort });
      setTopics(result.topics || []);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      console.error('Forum load error:', err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await api.getForumCategories();
      setCategories(cats || []);
      if (cats.length > 0 && !newCategory) setNewCategory(String(cats[0].id));
    } catch (err) {
      console.error('Load categories error:', err);
    }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadTopics(); }, [page, filterCategory, sort]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newCategory) {
      alert('Semua field wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await api.createForumTopic({
        category_id: parseInt(newCategory),
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setNewTitle('');
      setNewContent('');
      setNewCategory(categories.length > 0 ? String(categories[0].id) : '');
      setShowCreateModal(false);
      setPage(1);
      loadTopics();
    } catch (err) {
      console.error('Create error:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <MessagesSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forum Diskusi</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Berbagi ide dan pengalaman</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="lg">
          <Plus className="w-4 h-4 mr-2" /> Topik Baru
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
        >
          <option value="latest">Terbaru</option>
          <option value="popular">Terpopuler</option>
        </select>
      </div>

      {/* Topic list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white dark:bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12">
          <MessagesSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Belum ada topik dalam kategori ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(topic => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create Topic Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Buat Topik Baru" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
            >
              <option value="">Pilih Kategori</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Judul topik..."
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Isi</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Tulis topik diskusi..."
              rows={5}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Batal</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Membuat...' : 'Buat Topik'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
