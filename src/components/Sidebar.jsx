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
        className={`fixed top-3 left-3 z-40 h-[calc(100vh-24px)] flex flex-col rounded-2xl transition-all duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${collapsed ? "w-[72px]" : "w-[240px]"}
          /* Light mode */
          bg-white border border-slate-200 shadow-lg
          /* Dark mode */
          dark:bg-[#0d1321] dark:border-white/10 dark:shadow-none`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 dark:border-white/10">
          <NavLink to="/dashboard" className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              {customIcon ? (
                <img src={`/uploads/${customIcon}`} className="w-5 h-5 rounded-lg" alt="" />
              ) : (
                <Orbit className="w-5 h-5 text-white" />
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Portal AST</span>
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400/70" />
                  Server Control
                </span>
              </div>
            )}
          </NavLink>

          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onToggle}
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-all duration-200 active:scale-95"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.role.includes(user?.role || "staff")).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
                ${isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white"}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400/70 font-medium uppercase tracking-wider">
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
