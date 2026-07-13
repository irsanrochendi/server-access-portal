import { Megaphone, Pin, ChevronRight } from 'lucide-react';
import Badge from '../ui/Badge';

export default function AnnouncementCard({ announcement, onClick }) {
  const timeAgo = getTimeAgo(announcement.created_at);

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {announcement.title}
            </h3>
            {announcement.is_pinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Pin className="w-3 h-3" /> Dipin
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
            {announcement.content}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span>{announcement.author_name}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {announcement.division_name && (
              <>
                <span>·</span>
                <Badge variant="default">{announcement.division_name}</Badge>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-2" />
      </div>
    </div>
  );
}

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
