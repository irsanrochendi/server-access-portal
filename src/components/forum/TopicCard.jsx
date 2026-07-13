import { useNavigate } from 'react-router-dom';
import { MessageSquare, Pin, Lock, User } from 'lucide-react';
import Badge from '../ui/Badge';

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID');
}

export default function TopicCard({ topic }) {
  const navigate = useNavigate();
  const timeAgo = getTimeAgo(topic.created_at);

  return (
    <div
      onClick={() => navigate(`/forum/topics/${topic.id}`)}
      className="group bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {topic.title}
            </h3>
            {topic.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            {topic.is_locked && <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            {topic.category_name && <Badge variant="info" size="sm">{topic.category_name}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {topic.author_name}</span>
            <span>{timeAgo}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {topic.reply_count || 0} balasan</span>
            <span>{topic.view_count || 0} views</span>
          </div>
        </div>
      </div>
    </div>
  );
}
