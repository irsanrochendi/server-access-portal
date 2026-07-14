import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();
const SOCKET_URL = window.location.origin;

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadByRoom, setUnreadByRoom] = useState({});
  const typingTimeoutsRef = useRef({});
  const onChatPageRef = useRef(false);

  // Connect / disconnect based on auth state
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setMessages({});
      setTypingUsers({});
      return;
    }

    const token = localStorage.getItem('portal_token');

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
      // Expose socket globally for other contexts (e.g. AnnouncementContext)
      window.__socket = socket;
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('chat:new-message', (message) => {
      const room = message.room || 'general';
      setMessages((prev) => {
        const roomMessages = prev[room] || [];
        return { ...prev, [room]: [...roomMessages, message] };
      });
      // Per-room unread
      if (!onChatPageRef.current) {
        setUnreadByRoom(prev => ({ ...prev, [room]: (prev[room] || 0) + 1 }));
      }
    });

    socket.on('chat:user-typing', ({ userName, room }) => {
      if (!userName || !room) return;
      setTypingUsers((prev) => {
        const roomUsers = prev[room] || [];
        if (roomUsers.includes(userName)) return prev;
        return { ...prev, [room]: [...roomUsers, userName] };
      });

      const key = `${room}:${userName}`;
      if (typingTimeoutsRef.current[key]) clearTimeout(typingTimeoutsRef.current[key]);
      typingTimeoutsRef.current[key] = setTimeout(() => {
        setTypingUsers((prev) => {
          const users = prev[room] || [];
          return { ...prev, [room]: users.filter((u) => u !== userName) };
        });
        delete typingTimeoutsRef.current[key];
      }, 3000);
    });

    socket.on('chat:user-stop-typing', ({ userName, room }) => {
      const key = `${room}:${userName}`;
      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key]);
        delete typingTimeoutsRef.current[key];
      }
      setTypingUsers((prev) => {
        const users = prev[room] || [];
        return { ...prev, [room]: users.filter((u) => u !== userName) };
      });
    });

    socket.on('chat:error', ({ message }) => {
      console.error('Chat error:', message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const sendMessage = useCallback((room, content, fileUrl, fileName) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:message', { room, content, file_url: fileUrl, file_name: fileName });
    }
  }, []);

  const joinRoom = useCallback((room) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:join', room);
    }
  }, []);

  const emitTyping = useCallback((room) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:typing', { room });
    }
  }, []);

  const clearMessages = useCallback((room) => {
    setMessages(prev => ({ ...prev, [room]: [] }));
  }, []);

  // Clear unread for a specific room only (used on room switch)
  const markRoomAsRead = useCallback((roomId) => {
    setUnreadByRoom((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    onChatPageRef.current = true;
  }, []);

  // Clear all unread (used when opening widget)
  const markChatAsRead = useCallback(() => {
    setUnreadByRoom({});
    onChatPageRef.current = true;
  }, []);

  const markChatAsLeft = useCallback(() => {
    onChatPageRef.current = false;
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    messages,
    typingUsers,
    unreadByRoom,
    sendMessage,
    joinRoom,
    emitTyping,
    clearMessages,
    markChatAsRead,
    markChatAsLeft,
    markRoomAsRead,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket harus digunakan di dalam SocketProvider');
  return ctx;
}
