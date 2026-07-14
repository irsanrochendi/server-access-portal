import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';

/* ================================================================
   ChatWidget — Floating glass chat popup (Awwwards-tier)
   Vibe: Ethereal Glass | Layout: Z-Axis Cascade
   Double-Bezel (Doppelrand) architecture throughout
   ================================================================ */

// ── Ultra-light inline SVGs (replaces thick-stroked Lucide for primary icons) ──

const ChatBubbleIcon = ({ className }) => (
  <svg
    className={className}
    width="22" height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg
    className={className}
    width="18" height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const HashIcon = ({ className }) => (
  <svg
    className={className}
    width="15" height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg
    className={className}
    width="14" height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const PlusIcon = ({ className }) => (
  <svg
    className={className}
    width="16" height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

// ── Hook: click outside + escape ──
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    const keyListener = (e) => {
      if (e.key === 'Escape') handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('keydown', keyListener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('keydown', keyListener);
    };
  }, [ref, handler]);
}

// ── Main Component ──
export default function ChatWidget() {
  const { user } = useAuth();
  const {
    messages,
    typingUsers,
    unreadChatCount,
    connected,
    sendMessage,
    joinRoom,
    emitTyping,
    markChatAsRead,
    markChatAsLeft,
  } = useSocket();

  // ── UI State ──
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMessages, setHistoryMessages] = useState({});
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const panelRef = useRef(null);
  const bottomRef = useRef(null);
  const dropdownRef = useRef(null);
  const createInputRef = useRef(null);

  // ── Close on click outside & Escape ──
  useClickOutside(panelRef, () => {
    if (isOpen) setIsOpen(false);
  });

  // ── Load rooms on mount ──
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const res = await api.getChatRooms();
      const all = res.rooms || [];
      console.log('[ChatWidget] rooms loaded:', all.map((r) => r.name));
      setRooms(all);
      if (all.length > 0 && !activeRoom) {
        setActiveRoom(all[0]);
      }
    } catch (err) {
      console.error('[ChatWidget] loadRooms error:', err);
    }
  };

  const handleCreateRoom = async (e) => {
    e?.preventDefault();
    const name = newRoomName.trim();
    if (!name || creatingRoom) return;
    setCreatingRoom(true);
    try {
      const res = await api.createChatRoom({ name, type: 'public' });
      const created = res.room;
      console.log('[ChatWidget] room created:', created);
      if (created) {
        const newRoom = {
          id: String(created.id),
          name: created.name,
          type: created.type || 'public',
          description: created.description || '',
        };
        setRooms((prev) => [newRoom, ...prev]);
        setActiveRoom(newRoom);
        setNewRoomName('');
        setShowCreateRoom(false);
        setRoomDropdownOpen(false);
      }
    } catch (err) {
      console.error('[ChatWidget] create room error:', err);
      alert(err.message || 'Gagal membuat room');
    } finally {
      setCreatingRoom(false);
    }
  };

  // ── Join room + load history when active room changes ──
  useEffect(() => {
    if (!activeRoom) return;
    joinRoom(activeRoom.id);
    loadHistory(activeRoom.id);
  }, [activeRoom?.id]);

  // ── Retry join + history when socket connects (handles race condition) ──
  useEffect(() => {
    if (!connected || !activeRoom) return;
    joinRoom(activeRoom.id);
    loadHistory(activeRoom.id);
  }, [connected]);

  const loadHistory = async (roomId) => {
    // Skip only if we already have history for this room
    if (historyMessages[roomId] !== undefined || loadingHistory) return;
    console.log('[ChatWidget] loading history for room:', roomId);
    setLoadingHistory(true);
    try {
      const res = await api.getChatMessages(roomId, { limit: 50 });
      // API already returns chronological order (oldest → newest)
      const msgs = res.messages || [];
      console.log('[ChatWidget] history loaded:', msgs.length, 'messages', msgs);
      setHistoryMessages((prev) => ({ ...prev, [roomId]: msgs }));
    } catch (err) {
      console.error('[ChatWidget] loadHistory error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Mark read / left based on open state ──
  useEffect(() => {
    if (isOpen) {
      markChatAsRead();
    } else {
      markChatAsLeft();
    }
  }, [isOpen]);

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, activeRoom]);

  // ── Controlled entry animation ──
  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setEntering(true);
      setIsOpen(true);
      // Allow DOM paint then animate in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntering(false));
      });
    } else {
      setIsOpen(false);
    }
  }, [isOpen]);

  // ── Room selector ──
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    setRoomDropdownOpen(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!roomDropdownOpen) return;
    const listener = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [roomDropdownOpen]);

  // ── Keyboard shortcut: toggle widget with Ctrl+K ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleToggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleToggle]);

  // ── Merge history + real-time messages ──
  const roomMessages = activeRoom
    ? [
        ...(historyMessages[activeRoom.id] || []),
        ...(messages[activeRoom.id] || []),
      ]
    : [];

  if (activeRoom) {
    console.log('[ChatWidget] merged messages:', roomMessages.length, 'history:', historyMessages[activeRoom.id]?.length || 0, 'socket:', messages[activeRoom.id]?.length || 0);
  }

  const typingUser = activeRoom ? typingUsers?.[activeRoom.id] : null;
  const isLoading = loadingHistory && roomMessages.length === 0;

  // ── Render ──
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          TOGGLE BUTTON — Floating pill with Button-in-Button icon nest
          ═══════════════════════════════════════════════════════════════ */}
      <button
        onClick={handleToggle}
        aria-label={isOpen ? 'Tutup chat' : 'Buka chat'}
        className={`
          group fixed bottom-6 right-6 z-40
          flex items-center gap-2.5
          rounded-full
          transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
          active:scale-[0.98]
          ${isOpen
            ? 'bg-white/80 dark:bg-white/10 backdrop-blur-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.25)]'
            : 'bg-slate-900 dark:bg-white/10 backdrop-blur-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.25)] dark:hover:shadow-[0_8px_32px_rgba(99,102,241,0.25),0_0_0_1px_rgba(255,255,255,0.08)]'
          }
          ${!isOpen ? 'px-5 py-3' : 'p-3'}
        `}
      >
        {/* Collapsed: show label + icon */}
        {!isOpen && (
          <>
            <ChatBubbleIcon className="w-[18px] h-[18px] text-white dark:text-white/90" />
            <span className="text-sm font-medium text-white dark:text-white/90 tracking-[-0.01em]">
              Chat
            </span>
            {/* Unread badge */}
            {unreadChatCount > 0 && (
              <span className="
                absolute -top-1 -right-1
                min-w-[20px] h-5 px-1.5
                flex items-center justify-center
                rounded-full
                bg-red-500
                text-[10px] font-bold text-white
                shadow-[0_0_12px_rgba(239,68,68,0.5)]
                animate-[pulse-glow_2s_ease-in-out_infinite]
              ">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </>
        )}

        {/* Opened: show X icon inside its own circular nest (Button-in-Button) */}
        {isOpen && (
          <span className="
            w-8 h-8 rounded-full
            bg-slate-900/5 dark:bg-white/5
            flex items-center justify-center
            transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            group-hover:bg-slate-900/10 dark:group-hover:bg-white/10 group-hover:scale-105
          ">
            <CloseIcon className="w-[16px] h-[16px] text-slate-600 dark:text-white/80 transition-transform duration-500 group-hover:rotate-90" />
          </span>
        )}
      </button>

      {/* ═══════════════════════════════════════════════════════════════
          POPUP PANEL — Double-Bezel glass card
          ═══════════════════════════════════════════════════════════════ */}
      {isOpen &&
        createPortal(
          <div
            className={`fixed bottom-24 right-6 z-40
              w-[380px] max-w-[calc(100vw-1.5rem)]
              h-[520px] max-h-[calc(100dvh-7rem)]
              transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${entering
                ? 'opacity-0 translate-y-6 scale-[0.96] blur-[2px]'
                : 'opacity-100 translate-y-0 scale-100 blur-0'
              }
            `}
            ref={panelRef}
          >
            {/* ── Outer Shell (Doppelrand outer) ── */}
            <div className="
              w-full h-full
              p-[5px]
              rounded-[1.75rem]
              bg-white/70 dark:bg-white/[0.03]
              ring-1 ring-slate-900/5 dark:ring-white/[0.06]
              shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_24px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_24px_64px_rgba(0,0,0,0.35),0_0_120px_rgba(99,102,241,0.06)]
              backdrop-blur-3xl
            ">
              {/* ── Inner Core (Doppelrand inner) ── */}
              <div className="
                w-full h-full
                rounded-[calc(1.75rem-5px)]
                bg-white dark:bg-[#12121a]
                shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]
                flex flex-col overflow-hidden
              ">
                {/* ══════════════════════════════════
                    HEADER — Room selector + close
                    ══════════════════════════════════ */}
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/[0.1] bg-slate-50/80 dark:bg-[#1c1c25]/50">
                  {/* Room dropdown */}
                  <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                    <button
                      onClick={() => setRoomDropdownOpen((v) => !v)}
                      className="
                        w-full flex items-center gap-2 px-3 py-1.5
                        rounded-xl
                        bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1]
                        ring-1 ring-slate-200 dark:ring-white/[0.06]
                        transition-colors duration-300
                        text-left
                      "
                    >
                      <HashIcon className="w-[14px] h-[14px] text-slate-400 dark:text-white/50 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-white/95 truncate">
                        {activeRoom?.name || 'Pilih channel'}
                      </span>
                      {activeRoom && roomMessages.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70 flex-shrink-0">
                          {roomMessages.length}
                        </span>
                      )}
                      <ChevronDownIcon className={`
                        w-[12px] h-[12px] text-slate-400 dark:text-white/50 ml-auto flex-shrink-0
                        transition-transform duration-300
                        ${roomDropdownOpen ? 'rotate-180' : ''}
                      `} />
                    </button>

                    {/* Dropdown menu */}
                    {roomDropdownOpen && (
                      <div className="
                        absolute top-full left-0 right-0 mt-1
                        rounded-xl
                        bg-white dark:bg-[#12121a]
                        ring-1 ring-slate-200 dark:ring-white/[0.08]
                        shadow-[0_16px_48px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]
                        backdrop-blur-2xl
                        overflow-hidden
                        z-50
                        max-h-48 overflow-y-auto
                      ">
                        {rooms.map((room) => (
                          <button
                            key={room.id}
                            onClick={() => handleSelectRoom(room)}
                            className={`
                              w-full flex items-center gap-2 px-3 py-2.5
                              text-sm transition-colors duration-150 text-left
                              ${activeRoom?.id === room.id
                                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                                : 'text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white/80'
                              }
                            `}
                          >
                            <HashIcon className="w-[13px] h-[13px] flex-shrink-0 opacity-50" />
                            <span className="truncate">{room.name}</span>
                          </button>
                        ))}
                        {rooms.length === 0 && (
                          <p className="px-3 py-3 text-xs text-slate-400 dark:text-white/30 italic">
                            Tidak ada channel
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Create room button */}
                  <button
                    onClick={() => {
                      setShowCreateRoom((v) => !v);
                      setRoomDropdownOpen(false);
                    }}
                    className="
                      p-1.5 rounded-lg
                      text-slate-400 hover:text-slate-700
                      dark:text-white/40 dark:hover:text-white/80
                      hover:bg-slate-100 dark:hover:bg-white/[0.05]
                      transition-all duration-300
                      flex-shrink-0
                    "
                    title="Buat room baru"
                    aria-label="Buat room baru"
                  >
                    <PlusIcon className="w-[14px] h-[14px]" />
                  </button>

                  {/* Close button (inline, subtle) */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="
                      p-1.5 rounded-lg
                      text-slate-400 hover:text-slate-700
                      dark:text-white/30 dark:hover:text-white/70
                      hover:bg-slate-100 dark:hover:bg-white/[0.05]
                      transition-all duration-300
                      flex-shrink-0
                    "
                    aria-label="Tutup"
                  >
                    <CloseIcon className="w-[14px] h-[14px]" />
                  </button>
                </div>

                {/* ══════════════════════════════════
                    CREATE ROOM FORM
                    ══════════════════════════════════ */}
                {showCreateRoom && (
                  <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <form onSubmit={handleCreateRoom} className="flex items-center gap-2">
                      <input
                        ref={createInputRef}
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Nama room..."
                        className="
                          flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg
                          bg-white dark:bg-white/[0.05]
                          border border-slate-200 dark:border-white/10
                          text-slate-900 dark:text-white/95
                          placeholder-slate-400 dark:placeholder-white/30
                          focus:outline-none focus:ring-2 focus:ring-blue-500
                        "
                      />
                      <button
                        type="submit"
                        disabled={creatingRoom || !newRoomName.trim()}
                        className="
                          px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700
                          text-white
                          transition-colors disabled:cursor-not-allowed
                        "
                      >
                        {creatingRoom ? '...' : 'Buat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowCreateRoom(false); setNewRoomName(''); }}
                        className="
                          px-3 py-1.5 rounded-lg text-xs font-medium
                          text-slate-600 dark:text-white/70
                          hover:bg-slate-100 dark:hover:bg-white/[0.05]
                          transition-colors
                        "
                      >
                        Batal
                      </button>
                    </form>
                  </div>
                )}

                {/* ══════════════════════════════════
                    MESSAGES AREA
                    ══════════════════════════════════ */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-slate-400 dark:text-white/50 animate-pulse">
                        Memuat pesan...
                      </p>
                    </div>
                  ) : !activeRoom ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="
                        w-14 h-14 rounded-2xl
                        bg-slate-100 dark:bg-white/[0.06] ring-1 ring-slate-200 dark:ring-white/[0.1]
                        flex items-center justify-center
                      ">
                        <HashIcon className="w-6 h-6 text-slate-300 dark:text-white/30" />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-white/50 text-center leading-relaxed">
                        Pilih channel untuk<br />memulai percakapan
                      </p>
                    </div>
                  ) : roomMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="
                        w-14 h-14 rounded-2xl
                        bg-slate-100 dark:bg-white/[0.06] ring-1 ring-slate-200 dark:ring-white/[0.1]
                        flex items-center justify-center
                      ">
                        <HashIcon className="w-6 h-6 text-slate-300 dark:text-white/30" />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-white/50 text-center leading-relaxed">
                        Belum ada pesan di{' '}
                        <span className="text-slate-700 dark:text-white/80 font-semibold">
                          #{activeRoom.name}
                        </span>
                        <br />
                        <span className="text-slate-300 dark:text-white/35">Kirim pesan pertama!</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {roomMessages.map((msg, i) => (
                        <div
                          key={msg.id || i}
                          className="opacity-100"
                        >
                          <MessageBubble
                            message={msg}
                            isOwn={
                              msg.sender?.id === user?.id ||
                              msg.sender_id === user?.id
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <TypingIndicator userName={typingUser} />
                  <div ref={bottomRef} />
                </div>

                {/* ══════════════════════════════════
                    INPUT AREA
                    ══════════════════════════════════ */}
                {activeRoom && (
                  <div className="flex-shrink-0 border-t border-slate-200 dark:border-white/[0.06] px-3 py-3 bg-white dark:bg-transparent">
                    <ChatInput
                      onSend={(text, fileUrl, fileName) => {
                        console.log('[ChatWidget] sending message:', { room: activeRoom.id, text });
                        sendMessage(activeRoom.id, text, fileUrl, fileName);
                      }}
                      onTyping={() => emitTyping(activeRoom.id)}
                      room={activeRoom.id}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
