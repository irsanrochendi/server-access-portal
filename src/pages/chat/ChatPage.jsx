import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import RoomList from '../../components/chat/RoomList';
import ChatWindow from '../../components/chat/ChatWindow';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Plus, Hash } from 'lucide-react';

export default function ChatPage() {
  const { isAdmin } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMessages, setHistoryMessages] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const { messages, typingUsers, sendMessage, joinRoom, emitTyping, clearMessages, markChatAsRead, markChatAsLeft } = useSocket();

  // Mark chat as read when on this page
  useEffect(() => {
    markChatAsRead();
    return () => markChatAsLeft();
  }, []);

  // Load rooms
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const res = await api.getChatRooms();
      const allRooms = res.rooms || [];
      setRooms(allRooms);
      if (allRooms.length > 0 && !activeRoom) {
        setActiveRoom(allRooms[0]);
      }
    } catch (err) {
      console.error('Load rooms error:', err);
    }
  };

  // Join room on selection
  useEffect(() => {
    if (activeRoom) {
      joinRoom(activeRoom.id);
      loadHistory(activeRoom.id);
    }
  }, [activeRoom]);

  const loadHistory = async (roomId) => {
    try {
      setLoadingHistory(true);
      clearMessages(roomId);
      const res = await api.getChatMessages(roomId, { limit: 50 });
      if (res.messages?.length > 0) {
        setHistoryMessages(prev => ({ ...prev, [roomId]: res.messages }));
      }
    } catch (err) {
      console.error('Load history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await api.createChatRoom({ name: newRoomName.trim() });
      setNewRoomName('');
      setShowCreateModal(false);
      loadRooms();
      // Auto-select new room
      const newRoom = res.room;
      if (newRoom) {
        setActiveRoom(newRoom);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Merge history + live messages
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
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="w-56 flex-shrink-0 rounded-2xl overflow-hidden flex flex-col">
        <div className="bg-slate-100 dark:bg-slate-800/50 p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Channels</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Buat room baru"
          >
            <Plus className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <RoomList rooms={rooms} activeRoom={activeRoom} onSelect={setActiveRoom} />
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden">
        <ChatWindow
          room={activeRoom}
          messages={mergedMessages}
          typingUser={activeRoom ? typingUsers[activeRoom.id] : null}
          onSend={handleSend}
          onTyping={handleTyping}
          loading={loadingHistory}
        />
      </div>

      {/* Create Room Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Buat Room Chat" size="sm">
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Room</label>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Contoh: Random, Teknologi, dll"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Batal</Button>
            <Button type="submit">Buat</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
