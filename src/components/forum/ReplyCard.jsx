import { useState } from 'react';
import { User, CornerDownRight } from 'lucide-react';
import ReplyForm from './ReplyForm';

export default function ReplyCard({ reply, subReplies = [], topicId, onReplyAdded, isAdmin, authorId, onDelete }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const time = new Date(reply.created_at + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-3">
      {/* This reply */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-900 dark:text-white">{reply.author_name}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Balas
            </button>
            {(reply.author_id === authorId || isAdmin) && (
              <button
                onClick={() => onDelete(reply.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{reply.content}</p>
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
        <div className="ml-6 space-y-3 border-l-2 border-slate-200 dark:border-white/10 pl-4">
          {subReplies.map(sr => (
            <div key={sr.id} className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-white">{sr.author_name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(sr.created_at + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {(sr.author_id === authorId || isAdmin) && (
                  <button onClick={() => onDelete(sr.id)} className="text-xs text-red-500 hover:underline">Hapus</button>
                )}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{sr.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
