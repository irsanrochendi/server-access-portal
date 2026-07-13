import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import Header from './Header';
import { SocketProvider } from '../contexts/SocketContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:bg-gradient-to-br dark:from-[#0a0e1a] dark:via-[#0f1729] dark:to-[#0a0e1a]">
        <div className="flex">
          <Sidebar
            open={sidebarOpen}
            collapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            onToggle={() => setSidebarCollapsed(prev => !prev)}
          />
          <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-[100px]' : 'lg:ml-[272px]'
          }`}>
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 p-4 lg:p-8 pt-6 pb-12">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SocketProvider>
  );
}
