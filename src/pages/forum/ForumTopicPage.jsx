import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ReplyCard from '../../components/forum/ReplyCard';
import ReplyForm from '../../components/forum/ReplyForm';
import Button from '../../components/ui/Button';
import { ArrowLeft, Pin, Lock, MessageSquare, User } from 'lucide-react';

export default function ForumTopicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTopic = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getForumTopic(id);
      setTopic(res.topic);
      setReplies(res.replies || []);
    } catch (err) {
      console.error('Load topic error:', err);
      alert('Topik tidak ditemukan');
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadTopic(); }, [loadTopic]);

  const handleDeleteReply = async (replyId) => {
    if (!confirm('Hapus balasan ini?')) return;
    try {
      await api.deleteForumReply(replyId);
      loadTopic();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTopic = async () => {
    if (!confirm('Hapus topik ini beserta semua balasannya?')) return;
    try {
      await api.deleteForumTopic(id);
      navigate('/forum');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleLock = async () => {
    await api.toggleLockTopic(id);
    loadTopic();
  };

  const handleTogglePin = async () => {
    await api.togglePinTopic(id);
    loadTopic();
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!topic) return null;

  // Build reply tree: level 1 = replies with parent_id=NULL, level 2 = replies whose parent_id points to level 1
  const topLevelReplies = replies.filter(r => !r.parent_id);
  const getSubReplies = (parentId) => replies.filter(r => r.parent_id === parentId);

  const topicTime = new Date(topic.created_at + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/forum')}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Forum
      </button>

      {/* Topic */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{topic.title}</h1>
              {topic.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
              {topic.is_locked && <Lock className="w-4 h-4 text-red-400" />}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {topic.author_name}</span>
              <span>{topicTime}</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {topic.category_name}
              </span>
            </div>
          </div>

          {/* Admin/mod actions */}
          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                <button onClick={handleTogglePin} className={`p-1.5 rounded-lg text-sm ${topic.is_pinned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/5'}`} title="Toggle pin">
                  <Pin className="w-4 h-4" />
                </button>
                <button onClick={handleToggleLock} className={`p-1.5 rounded-lg text-sm ${topic.is_locked ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5'}`} title="Toggle lock">
                  <Lock className="w-4 h-4" />
                </button>
              </>
            )}
            {(topic.author_id === user?.id || isAdmin) && (
              <button onClick={handleDeleteTopic} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Hapus topik">
                🗑️
              </button>
            )}
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {topic.content}
        </div>
      </div>

      {/* Replies */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {topic.reply_count} Balasan
        </h2>

        <div className="space-y-4">
          {topLevelReplies.map(reply => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              subReplies={getSubReplies(reply.id)}
              topicId={topic.id}
              onReplyAdded={loadTopic}
              isAdmin={isAdmin}
              authorId={user?.id}
              onDelete={handleDeleteReply}
            />
          ))}

          {topLevelReplies.length === 0 && (
            <p className="text-center text-slate-400 dark:text-slate-500 py-8">
              Belum ada balasan. Jadilah yang pertama membalas!
            </p>
          )}
        </div>
      </div>

      {/* Reply form (if not locked) */}
      {!topic.is_locked && (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Tulis Balasan</h3>
          <ReplyForm topicId={topic.id} parentId={null} onSubmit={loadTopic} />
        </div>
      )}

      {topic.is_locked && (
        <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500 bg-red-50 dark:bg-red-500/5 rounded-xl border border-red-200 dark:border-red-500/10">
          🔒 Topik ini dikunci. Tidak dapat menambah balasan baru.
        </div>
      )}
    </div>
  );
}
