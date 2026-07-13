import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function AnnouncementModal({ isOpen, onClose, onSubmit, divisions, initialData }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContent(initialData.content || '');
      setDivisionId(initialData.division_id ? String(initialData.division_id) : '');
    } else {
      setTitle('');
      setContent('');
      setDivisionId('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        division_id: divisionId ? Number(divisionId) : null,
      });
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Pengumuman' : 'Buat Pengumuman'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konten</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Isi pengumuman... (Markdown didukung)"
            rows={6}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Divisi</label>
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Divisi</option>
            {divisions.map(d => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={submitting || !title.trim() || !content.trim()}>
            {submitting ? 'Menyimpan...' : initialData ? 'Simpan' : 'Buat Pengumuman'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
