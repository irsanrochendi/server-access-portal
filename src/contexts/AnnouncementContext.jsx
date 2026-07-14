import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

const AnnouncementContext = createContext();

// Session key for tracking if user has visited announcements page
// Use localStorage so it persists across page refreshes
const VISITED_KEY = 'ann_visited';

export function AnnouncementProvider({ children }) {
  const [announcements, setAnnouncements] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [hasVisited, setHasVisited] = useState(
    localStorage.getItem(VISITED_KEY) === 'true'
  );
  const intervalRef = useRef(null);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.getAnnouncements({ page: 1 });
      const items = res.announcements || [];
      setAnnouncements(items);

      // Show badge count based on visit status
      if (hasVisited) {
        setNewCount(0);
      } else {
        setNewCount(items.length);
      }
    } catch (err) {
      console.error('Fetch announcements error:', err);
    }
  }, [hasVisited]);

  // Initial fetch and polling
  useEffect(() => {
    fetchAnnouncements();

    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchAnnouncements, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnnouncements]);

  // Mark as read when visiting announcements page
  const markAllAsRead = useCallback(() => {
    localStorage.setItem(VISITED_KEY, 'true');
    setHasVisited(true);
    setNewCount(0);
  }, []);

  const value = {
    newCount,
    announcements,
    markAllAsRead,
    refresh: fetchAnnouncements,
  };

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error('useAnnouncements must be used within AnnouncementProvider');
  return ctx;
}
