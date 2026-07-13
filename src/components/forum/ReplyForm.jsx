import { useState } from 'react';
import { api } from '../../services/api';
import Button from '../ui/Button';
import { Send } from 'lucide-react';

export default function ReplyForm({ topicId, parentId, onSubmit }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.createForumReply(topicId, { content: content.trim(), parent_id: parentId || null });
      setContent('');
      onSubmit();
    } catch (err) {
      console.error('Reply error:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Tulis balasan..."
        rows={2}
        required
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting || !content.trim()} size="sm">
          <Send className="w-3.5 h-3.5 mr-1" />
          {submitting ? 'Mengirim...' : 'Kirim'}
        </Button>
      </div>
    </form>
  );
}
