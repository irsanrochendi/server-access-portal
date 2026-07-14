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
  const intervalRef = useRef(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.getAnnouncements({ page: 1 });
      const items = res.announcements || [];
      const lastVisit = getLastVisit();

      if (lastVisit === 0) {
        setNewCount(items.length);
      } else {
        const count = items.filter(a => {
          // SQLite created_at is UTC, so append 'Z' before parsing
          const t = new Date(a.created_at + 'Z').getTime();
          return t > lastVisit;
        }).length;
        setNewCount(count);
      }
    } catch (err) {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    intervalRef.current = setInterval(fetchAnnouncements, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnnouncements]);

  const markAllAsRead = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(LAST_VISIT_KEY, now.toString());
    setNewCount(0);
  }, []);

  return (
    <AnnouncementContext.Provider value={{ newCount, markAllAsRead, refresh: fetchAnnouncements }}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error('useAnnouncements must be used within AnnouncementProvider');
  return ctx;
}
