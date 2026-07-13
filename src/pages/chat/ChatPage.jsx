import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import RoomList from '../../components/chat/RoomList';
import ChatWindow from '../../components/chat/ChatWindow';

export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { messages, typingUsers, sendMessage, joinRoom, emitTyping, clearMessages } = useSocket();

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const res = await api.getChatRooms();
        setRooms(res.rooms || []);
        if (res.rooms?.length > 0 && !activeRoom) {
          setActiveRoom(res.rooms[0]);
        }
      } catch (err) {
        console.error('Load rooms error:', err);
      }
    };
    loadRooms();
  }, []);

  // Join room on selection
  useEffect(() => {
    if (activeRoom) {
      joinRoom(activeRoom.id);
      // Load history
      loadHistory(activeRoom.id);
    }
  }, [activeRoom]);

  const loadHistory = async (roomId) => {
    try {
      setLoadingHistory(true);
      clearMessages(roomId);
      const res = await api.getChatMessages(roomId, { limit: 50 });
      // Messages are loaded; they won't appear in socket messages state automatically
      // We need to merge history into the messages state
      if (res.messages?.length > 0) {
        // History is loaded via REST; the SocketContext doesn't auto-merge
        // We'll add them via a workaround: set them directly via sendMessage for history
        // Actually, we just display history + live messages in ChatWindow
        // Store history in local state
        setHistoryMessages(prev => ({ ...prev, [roomId]: res.messages }));
      }
    } catch (err) {
      console.error('Load history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const [historyMessages, setHistoryMessages] = useState({});

  // Merge history + live messages for display
  const mergedMessages = { ...historyMessages };
  Object.keys(messages).forEach(roomId => {
    mergedMessages[roomId] = [...(historyMessages[roomId] || []), ...(messages[roomId] || [])];
  });

  const handleSend = useCallback((roomId, text, fileUrl, fileName) => {
    sendMessage(roomId, text, fileUrl, fileName);
  }, [sendMessage]);

  const handleTyping = useCallback((roomId) => {
    emitTyping(roomId);
  }, [emitTyping]);

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden -m-4 lg:-m-8">
      <RoomList rooms={rooms} activeRoom={activeRoom} onSelect={setActiveRoom} />
      <ChatWindow
        room={activeRoom}
        messages={mergedMessages}
        typingUser={activeRoom ? typingUsers[activeRoom.id] : null}
        onSend={handleSend}
        onTyping={handleTyping}
        loading={loadingHistory}
      />
    </div>
  );
}
