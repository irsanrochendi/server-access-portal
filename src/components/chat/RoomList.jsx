import { Hash } from 'lucide-react';

export default function RoomList({ rooms, activeRoom, onSelect }) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-y-auto">
      <div className="p-3 space-y-1">
        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Channels
        </div>
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
              activeRoom?.id === room.id
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Hash className="w-4 h-4 flex-shrink-0 opacity-60" />
            <span className="truncate">{room.name}</span>
          </button>
        ))}
        {rooms.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">Tidak ada channel</p>
        )}
      </div>
    </div>
  );
}
