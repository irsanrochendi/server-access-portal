import { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import ReplyForm from './ReplyForm';

export default function ReplyCard({ reply, subReplies = [], topicId, onReplyAdded, isAdmin, authorId, onDelete }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const time = new Date(reply.created_at + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-3">
      {/* This reply */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[11px] font-bold text-white">
              {reply.author_name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{reply.author_name}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              {showReplyForm ? 'Batal' : 'Balas'}
            </button>
            {isAdmin && (
              <button
                onClick={() => onDelete(reply.id)}
                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
      </div>

      {/* Reply form for this reply */}
      {showReplyForm && (
        <div className="ml-6">
          <ReplyForm
            topicId={topicId}
            parentId={reply.id}
            onSubmit={() => { setShowReplyForm(false); onReplyAdded(); }}
          />
        </div>
      )}

      {/* Sub-replies (level 2) */}
      {subReplies.length > 0 && (
        <div className="ml-6 space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4">
          {subReplies.map(sr => (
            <div key={sr.id} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[9px] font-bold text-white">
                    {sr.author_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{sr.author_name}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(sr.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {isAdmin && (
                  <button onClick={() => onDelete(sr.id)} className="text-[10px] text-red-500 hover:text-red-600 font-medium transition-colors">Hapus</button>
                )}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{sr.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
