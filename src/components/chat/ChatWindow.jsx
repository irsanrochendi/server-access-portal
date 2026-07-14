import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { Hash } from 'lucide-react';

export default function ChatWindow({ room, messages, typingUser, onSend, onTyping, loading }) {
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="text-center">
          <Hash className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Pilih channel untuk mulai chat</p>
        </div>
      </div>
    );
  }

  const roomMessages = messages[room.id] || [];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-800/30">
      {/* Room header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">{room.name}</h3>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && roomMessages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">Memuat pesan...</div>
        ) : roomMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Hash className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-400 dark:text-slate-500">Belum ada pesan</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">Kirim pesan pertama!</p>
          </div>
        ) : (
          roomMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id || i}
              message={msg}
              isOwn={msg.sender?.id === user?.id || msg.sender_id === user?.id}
            />
          ))
        )}
        <TypingIndicator userName={typingUser} />
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(text, fileUrl, fileName) => onSend(room.id, text, fileUrl, fileName)} onTyping={onTyping} room={room.id} />
    </div>
  );
}
