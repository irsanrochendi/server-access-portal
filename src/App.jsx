import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import AdminServers from './pages/admin/AdminServers';
import ChatPage from './pages/chat/ChatPage';
import AdminUsers from './pages/admin/AdminUsers';
import OnlineUsersAdmin from './pages/admin/OnlineUsers';
import OnlineUsers from './pages/OnlineUsers';
import ActivityLogs from './pages/admin/ActivityLogs';
import AdminRoles from './pages/admin/AdminRoles';
import DbBrowser from './pages/admin/DbBrowser';
import Settings from './pages/admin/Settings';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/online-users" element={<OnlineUsers />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/chat" element={<ChatPage />} />

        {/* Admin routes */}
        <Route
          path="/admin/servers"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminServers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/online-users"
          element={
            <ProtectedRoute roles={['admin']}>
              <OnlineUsersAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity-logs"
          element={
            <ProtectedRoute roles={['admin']}>
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminRoles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/db-browser"
          element={
            <ProtectedRoute roles={['admin']}>
              <DbBrowser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Redirect root */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
