import { useState, useRef, useEffect } from 'react';
import { Menu, Moon, Sun, LogOut, User, Settings, ChevronDown, RefreshCw, LayoutDashboard, Orbit } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useServers } from "../contexts/ServerContext";

export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { servers, refreshStatus } = useServers();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customIcon, setCustomIcon] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetch('/api/upload/icon', { headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` } })
      .then(r => r.json()).then(d => { if (d?.filename) setCustomIcon(d.filename); }).catch(() => {});
  }, []);

  // Status indicator removed per user request

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshStatus(); } catch (e) {}
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 h-16 rounded-2xl border backdrop-blur-3xl transition-all duration-300
      bg-white/70 border-slate-200/50 shadow-xl shadow-indigo-500/10
      dark:bg-[#0d1321]/70 dark:border-white/10 dark:shadow-indigo-500/10">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">

        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl
            hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white
            transition-all duration-300 active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: Title + Status */}
        <div className="flex items-center gap-4 mx-auto lg:mx-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-indigo-500/40 shrink-0 animate-glow">
              {customIcon ? (
                <img src={`/uploads/${customIcon}`} className="w-6 h-6 rounded-lg" alt="" />
              ) : (
                <Orbit className="w-5 h-5 text-white" />
              )}
            </div>

            <div className="hidden sm:block">
              <h1 className="text-sm font-black gradient-text tracking-tight">Portal AST</h1>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">Server Access Portal</p>
            </div>
          </div>

          {/* Status indicator removed per user request */}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="w-10 h-10 flex items-center justify-center rounded-xl
              hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400
              transition-all duration-300 active:scale-95 shadow-sm"
            title="Refresh status"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl
              hover:bg-amber-100 dark:hover:bg-amber-500/20 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400
              transition-all duration-300 active:scale-95 shadow-sm"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User dropdown */}
          <div className="relative ml-2" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl
                hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="text-sm font-black text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>

              {/* User info - desktop only */}
              <div className="hidden lg:block min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[100px]">{user?.name}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wide">{user?.role}</p>
              </div>

              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border shadow-2xl z-50 animate-fade-in-scale overflow-hidden
                glass-card">
                {/* User info header */}
                <div className="px-4 py-4 border-b border-slate-200/50 dark:border-white/10 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                      <span className="text-base font-black text-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">{user?.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full
                          bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30">
                          {user?.role}
                        </span>
                        {user?.division && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-semibold">{user.division}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-2">
                  <button
                    onClick={() => { setOpen(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                  >
                    <User className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    Profile & Security
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate('/admin/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                  >
                    <Settings className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    Settings
                  </button>
                </div>

                {/* Divider */}
                <div className="h-px mx-4 bg-slate-200 dark:bg-white/10 my-1" />

                {/* Logout */}
                <div className="py-2">
                  <button
                    onClick={() => { setOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
