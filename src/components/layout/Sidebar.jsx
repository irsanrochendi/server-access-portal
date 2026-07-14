import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAnnouncements } from '../../contexts/AnnouncementContext';
import { useSocket } from '../../contexts/SocketContext';
import {
  LayoutDashboard,
  Server,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Megaphone,
  MessageCircle,
  MessagesSquare,
} from 'lucide-react';

// General nav — visible to ALL users (staff + admin)
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/announcements', icon: Megaphone, label: 'Pengumuman', badge: 'announcements' },
  { to: '/chat', icon: MessageCircle, label: 'Chat', badge: 'chat' },
  { to: '/forum', icon: MessagesSquare, label: 'Forum' },
  { to: '/online-users', icon: Users, label: 'Online Users' },
];

// Admin-only nav — visible only to admin
const adminNavItems = [
  { to: '/admin/servers', icon: Server, label: 'Servers' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/activity-logs', icon: ClipboardList, label: 'Activity Logs' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle, onLogout }) {
  const { isAdmin, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const closeMobile = () => setIsMobileOpen(false);

  // Badge counts
  const { newCount: announceCount } = useAnnouncements();
  const { unreadChatCount } = useSocket();

  const renderNavItem = (item) => {
    const isActive = location.pathname.startsWith(item.to);
    let badgeCount = 0;
    if (item.badge === 'announcements') badgeCount = announceCount;
    if (item.badge === 'chat') badgeCount = unreadChatCount;
    const showBadge = badgeCount > 0;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={closeMobile}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
          transition-colors duration-150 group relative overflow-visible
          ${isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }
        `}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded
            opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
            {item.label}
          </div>
        )}
        {showBadge && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-md">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Server className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              Server Access
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Portal AST</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* General nav — all users */}
        {navItems.map(renderNavItem)}

        {/* Admin section — only for admin */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <p className={`px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${collapsed ? 'text-center' : ''}`}>
                {collapsed ? '⚙' : 'Admin'}
              </p>
            </div>
            {adminNavItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* User info */}
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-medium text-gray-700 dark:text-gray-300">{user.name}</p>
            <p className="capitalize">{user.role}</p>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span className="truncate">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="truncate">Logout</span>}
        </button>

        {/* Collapse button (desktop) */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-full items-center justify-center px-3 py-2 rounded-lg text-sm
            text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`
        hidden md:flex flex-col fixed left-0 top-0 h-full z-30
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}
      `}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <aside className="relative w-60 max-w-[80vw] bg-white dark:bg-gray-900 h-full shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-20 p-2 bg-white dark:bg-gray-800 rounded-lg shadow
          text-gray-600 dark:text-gray-300"
      >
        <LayoutDashboard className="w-5 h-5" />
      </button>
    </>
  );
}
