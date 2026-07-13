import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle } from 'lucide-react';

export default function ChatWindow({ room, messages, typingUser, onSend, onTyping, loading }) {
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Pilih channel untuk mulai chat</p>
        </div>
      </div>
    );
  }

  const roomMessages = messages[room.id] || [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Room header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
        <h3 className="font-semibold text-slate-900 dark:text-white"># {room.name}</h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && roomMessages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">Memuat pesan...</div>
        ) : roomMessages.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-16">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada pesan. Kirim pesan pertama!</p>
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
