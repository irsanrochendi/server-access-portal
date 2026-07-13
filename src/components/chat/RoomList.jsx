import { Hash } from 'lucide-react';

export default function RoomList({ rooms, activeRoom, onSelect }) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] overflow-y-auto">
      <div className="p-3">
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          Channels
        </h2>
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              activeRoom?.id === room.id
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Hash className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{room.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
