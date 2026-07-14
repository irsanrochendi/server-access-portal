import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

const AnnouncementContext = createContext();

const LAST_VISIT_KEY = 'ann_last_visit';

function getLastVisit() {
  const v = localStorage.getItem(LAST_VISIT_KEY);
  return v ? parseInt(v, 10) : 0;
}

export function AnnouncementProvider({ children }) {
  const [newCount, setNewCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const intervalRef = useRef(null);
  const lastVisitRef = useRef(getLastVisit());

  const countNew = useCallback((items, lastVisit) => {
    if (lastVisit === 0) {
      return items.length;
    }
    return items.filter(a => {
      const t = new Date(a.created_at + 'Z').getTime();
      return t > lastVisit;
    }).length;
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.getAnnouncements({ page: 1 });
      const items = res.announcements || [];
      setAnnouncements(items);

      const lastVisit = getLastVisit();
      lastVisitRef.current = lastVisit;
      setNewCount(countNew(items, lastVisit));
    } catch (err) {
      // silently fail
    }
  }, [countNew]);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchAnnouncements();
    intervalRef.current = setInterval(fetchAnnouncements, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnnouncements]);

  // Listen for real-time announcement:new via Socket.IO
  useEffect(() => {
    let socket = null;
    let checkCount = 0;
    const maxChecks = 30; // 15 seconds max

    const tryListen = () => {
      if (window.__socket) {
        socket = window.__socket;
        socket.on('announcement:new', () => {
          fetchAnnouncements();
        });
        return;
      }
      checkCount++;
      if (checkCount < maxChecks) {
        setTimeout(tryListen, 500);
      }
    };
    tryListen();

    return () => {
      if (socket) socket.off('announcement:new');
    };
  }, [fetchAnnouncements]);

  // Mark as read when visiting announcements page
  const markAllAsRead = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(LAST_VISIT_KEY, now.toString());
    lastVisitRef.current = now;
    setNewCount(0);
  }, []);

  return (
    <AnnouncementContext.Provider value={{ newCount, announcements, markAllAsRead, refresh: fetchAnnouncements }}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error('useAnnouncements must be used within AnnouncementProvider');
  return ctx;
}
