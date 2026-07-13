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
  const typingTimeoutsRef = useRef({});

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
      setMessages((prev) => {
        const room = message.room || 'general';
        const roomMessages = prev[room] || [];
        return { ...prev, [room]: [...roomMessages, message] };
      });
    });

    socket.on('chat:user-typing', ({ username, room }) => {
      setTypingUsers((prev) => {
        const roomUsers = prev[room] || [];
        if (roomUsers.includes(username)) return prev;
        return { ...prev, [room]: [...roomUsers, username] };
      });

      // Auto-clear typing after 3s if stop-typing not received
      const key = `${room}:${username}`;
      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key]);
      }
      typingTimeoutsRef.current[key] = setTimeout(() => {
        setTypingUsers((prev) => {
          const users = prev[room] || [];
          return { ...prev, [room]: users.filter((u) => u !== username) };
        });
        delete typingTimeoutsRef.current[key];
      }, 3000);
    });

    socket.on('chat:user-stop-typing', ({ username, room }) => {
      const key = `${room}:${username}`;
      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key]);
        delete typingTimeoutsRef.current[key];
      }
      setTypingUsers((prev) => {
        const users = prev[room] || [];
        return { ...prev, [room]: users.filter((u) => u !== username) };
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

  const sendMessage = useCallback((room, content) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:send-message', { room, content });
    }
  }, []);

  const joinRoom = useCallback((room) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:join-room', { room });
    }
  }, []);

  const emitTyping = useCallback((room) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:typing', { room });
    }
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    messages,
    typingUsers,
    sendMessage,
    joinRoom,
    emitTyping,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
