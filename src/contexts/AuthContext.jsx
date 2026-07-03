import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 menit
const WARNING_BEFORE = 30 * 1000; // 30 detik sebelum logout

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (token) {
      api.getMe()
        .then(data => setUser(data.user))
        .catch(() => { localStorage.removeItem('portal_token'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const idleTimer = useRef(null);
  const warningTimer = useRef(null);
  const logoutRef = useRef(null);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    localStorage.removeItem('portal_token');
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setIdleWarning(false);
    setUser(null);
  }, []);

  // Keep ref synced
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  // Idle timeout: reset setiap ada aktivitas user di browser
  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) { clearTimeout(warningTimer.current); warningTimer.current = null; }
    setIdleWarning(false);

    // Warning setelah 4:30 menit (30 detik sebelum logout)
    warningTimer.current = setTimeout(() => {
      setIdleWarning(true);
    }, IDLE_TIMEOUT - WARNING_BEFORE);

    // Logout setelah 5 menit
    idleTimer.current = setTimeout(() => {
      logoutRef.current?.();
    }, IDLE_TIMEOUT);
  }, []);

  // Attach/detach event listeners
  useEffect(() => {
    if (!user) return;

    resetIdleTimer();
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => document.addEventListener(e, resetIdleTimer, { passive: true }));

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      events.forEach(e => document.removeEventListener(e, resetIdleTimer));
    };
  }, [user, resetIdleTimer]);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('portal_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isStaff }}>
      {children}
      {/* Idle warning modal */}
      {idleWarning && user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Session Akan Berakhir</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Tidak ada aktivitas selama 4½ menit. Anda akan logout otomatis dalam <strong>30 detik</strong>.
            </p>
            <button
              onClick={resetIdleTimer}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Saya Masih Disini
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
