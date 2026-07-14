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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back button */}
      <button
        onClick={() => navigate('/forum')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Forum
      </button>

      {/* Topic */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{topic.title}</h1>
              {!!topic.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Pin className="w-3 h-3" /> Dipin
                </span>
              )}
              {!!topic.is_locked && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Dikunci
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {topic.author_name?.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{topic.author_name}</span>
              </span>
              <span>{topicTime}</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium">
                {topic.category_name}
              </span>
            </div>
          </div>

          {/* Admin actions — only admin can delete topics */}
          {isAdmin && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handleTogglePin} className={`p-2 rounded-lg transition-colors ${!!topic.is_pinned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'}`} title={!!topic.is_pinned ? 'Lepas pin' : 'Pin'}>
                <Pin className="w-4 h-4" />
              </button>
              <button onClick={handleToggleLock} className={`p-2 rounded-lg transition-colors ${!!topic.is_locked ? 'bg-red-100 dark:bg-red-500/20 text-red-500' : 'text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'}`} title={!!topic.is_locked ? 'Buka kunci' : 'Kunci'}>
                <Lock className="w-4 h-4" />
              </button>
              <button onClick={handleDeleteTopic} className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Hapus topik">
                🗑️
              </button>
            </div>
          )}
        </div>

        <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {topic.content}
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
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
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Tulis Balasan</h3>
          <ReplyForm topicId={topic.id} parentId={null} onSubmit={loadTopic} />
        </div>
      )}

      {!!topic.is_locked && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
          <Lock className="w-4 h-4" /> Topik ini dikunci. Tidak dapat menambah balasan.
        </div>
      )}
    </div>
  );
}
