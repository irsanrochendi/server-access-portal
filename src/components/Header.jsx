import { useState, useRef, useEffect } from 'react';
import { Menu, Moon, Sun, LogOut, User, Settings, ChevronDown, RefreshCw, LayoutDashboard, Bell, Orbit } from "lucide-react";
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

  const onlineCount = servers.filter(s => s.is_active && s.status === 'online').length;
  const totalCount = servers.filter(s => s.is_active).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshStatus(); } catch (e) {}
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 h-16 rounded-2xl border backdrop-blur-xl transition-all duration-300
      /* Light mode */
      bg-white/90 border-slate-200 shadow-lg shadow-slate-200/50
      /* Dark mode */
      dark:bg-[#0d1321]/90 dark:border-white/10 dark:shadow-none">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">

        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl
            hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white
            transition-all duration-200 active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: Title + Status */}
        <div className="flex items-center gap-4 mx-auto lg:mx-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              {customIcon ? (
                <img src={`/uploads/${customIcon}`} className="w-5 h-5 rounded-lg" alt="" />
              ) : (
                <Orbit className="w-5 h-5 text-white" />
              )}
            </div>

            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Portal AST</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Server Access Portal</p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="relative flex w-2 h-2 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
              <span className="relative w-full h-full rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-slate-700 dark:text-white font-medium">
              {onlineCount} <span className="text-slate-400 dark:text-slate-500">/ {totalCount}</span>
            </span>
            <div className="w-px h-3 bg-slate-300 dark:bg-white/10" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Online</span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="w-10 h-10 flex items-center justify-center rounded-xl
              hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white
              transition-all duration-200 active:scale-95"
            title="Refresh status"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl
              hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white
              transition-all duration-200 active:scale-95"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* User dropdown */}
          <div className="relative ml-2" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl
                hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-xs font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>

              {/* User info - desktop only */}
              <div className="hidden lg:block min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">{user?.name}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400/70 font-medium">{user?.role}</p>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border shadow-xl z-50 animate-fade-in-scale overflow-hidden
                bg-white dark:bg-[#1a1a24] border-slate-200 dark:border-white/10 shadow-slate-200/50 dark:shadow-black/50">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <span className="text-sm font-bold text-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full
                          bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20
                          text-indigo-700 dark:text-indigo-400">
                          {user?.role}
                        </span>
                        {user?.division && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate">{user.division}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => { setOpen(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    Profile & Keamanan
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate('/admin/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    Settings
                  </button>
                </div>

                {/* Divider */}
                <div className="h-px mx-4 bg-slate-200 dark:bg-white/10 my-1" />

                {/* Logout */}
                <div className="py-1">
                  <button
                    onClick={() => { setOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
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
