import { useState, useEffect } from 'react';
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  Users,
  ShieldCheck,
  ClipboardList,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Orbit,
  Sparkles
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", role: ["admin", "staff"] },
  { to: "/admin/servers", icon: Server, label: "Servers", role: ["admin"] },
  { to: "/admin/users", icon: Users, label: "Users", role: ["admin"] },
  { to: "/admin/roles", icon: ShieldCheck, label: "Roles", role: ["admin"] },
  { to: "/admin/activity-logs", icon: ClipboardList, label: "Activity Log", role: ["admin"] },
  { to: "/admin/settings", icon: Settings, label: "Settings", role: ["admin"] },
  { to: "/admin/db-browser", icon: Database, label: "DB Browser", role: ["admin"] },
];

export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { user } = useAuth();
  const [customIcon, setCustomIcon] = useState(null);
  const [onlineCount, setOnlineCount] = useState(null);

  // Fetch online users count (available for all authenticated users)
  useEffect(() => {
    const fetchOnlineCount = () => {
      fetch('/api/users/online', {
        headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.count !== undefined) setOnlineCount(d.count); })
        .catch(() => {});
    };

    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/upload/icon', { headers: { Authorization: `Bearer ${localStorage.getItem('portal_token')}` } })
      .then(r => r.json()).then(d => { if (d?.filename) setCustomIcon(d.filename); }).catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-3 left-3 z-40 h-[calc(100vh-24px)] flex flex-col rounded-3xl transition-all duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${collapsed ? "w-[72px]" : "w-[240px]"}
          glass-card shadow-2xl`}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-slate-200/50 dark:border-white/10 h-16
          ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <NavLink to="/dashboard" className={`flex items-center ${collapsed ? 'ml-1' : 'gap-3'}`}>
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-indigo-500/40 shrink-0 animate-glow">
              {customIcon ? (
                <img src={`/uploads/${customIcon}`} className="w-6 h-6 object-contain" alt="" />
              ) : (
                <Orbit className="w-6 h-6 text-white" />
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-black gradient-text tracking-tight">Portal AST</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Server Control
                </span>
              </div>
            )}
          </NavLink>

          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={onToggle}
                className="hidden lg:flex w-8 h-8 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all duration-300 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle (when sidebar is collapsed) */}
        {collapsed && (
          <div className="flex justify-center py-1">
            <button
              onClick={onToggle}
              className="flex w-8 h-8 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all duration-300 active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {navItems.filter(item => item.role.includes(user?.role || "staff")).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center py-3 rounded-xl text-sm font-bold transition-all duration-300
                ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}
                ${isActive
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:shadow-md"}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Online Users Indicator */}
        <div className="px-3 py-3 border-t border-slate-200/50 dark:border-white/10">
            <NavLink
              to={user?.role === 'admin' ? '/admin/online-users' : '/online-users'}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-500/15 dark:to-green-500/15
                hover:from-emerald-200 hover:to-green-200 dark:hover:from-emerald-500/25 dark:hover:to-green-500/25
                border border-emerald-300/50 dark:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
              </span>
              {!collapsed && (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {onlineCount !== null ? (
                    onlineCount > 0
                      ? <>{onlineCount} user online</>
                      : <>No users online</>
                  ) : (
                    <>Loading...</>
                  )}
                </span>
              )}
            </NavLink>
          </div>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-200/50 dark:border-white/10">
          <div className={`flex items-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/10 border border-slate-200 dark:border-white/10 shadow-sm
            ${collapsed ? 'justify-center p-2' : 'gap-3 p-3'}`}>
            {/* Avatar */}
            <div className={`rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0
              ${collapsed ? 'w-9 h-9' : 'w-10 h-10'}`}>
              <span className={`font-black text-white ${collapsed ? 'text-xs' : 'text-sm'}`}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">
                  {user?.role}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
