import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const ServerContext = createContext();

export function ServerProvider({ children }) {
  const [servers, setServers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchServers = useCallback(() => {
    return api.getServers({ active: '1' })
      .then(data => setServers(data.servers))
      .catch(console.error);
  }, []);

  const fetchServersAll = useCallback(() => {
    return api.getServers()
      .then(data => setServers(data.servers))
      .catch(console.error);
  }, []);

  const fetchLogs = useCallback(() => {
    // Only admin can see activity logs
    if (user?.role !== 'admin') {
      setLogs([]);
      return Promise.resolve();
    }
    return api.getLogs({ limit: 100 })
      .then(data => setLogs(data.logs || []))
      .catch(console.error);
  }, [user]);

  // Initial load — re-fetch setiap kali user ganti (login/logout)
  useEffect(() => {
    if (user) {
      Promise.all([fetchServersAll(), fetchLogs()]).finally(() => setLoading(false));
    } else {
      setServers([]);
      setLogs([]);
      setLoading(false);
    }
  }, [user, fetchServersAll, fetchLogs]);

  const addServer = async (data) => {
    const res = await api.createServer(data);
    setServers(prev => [res.server, ...prev]);
    return res.server;
  };

  const updateServer = async (id, data) => {
    const res = await api.updateServer(id, data);
    setServers(prev => prev.map(s => s.id === id ? res.server : s));
    return res.server;
  };

  const deleteServer = async (id) => {
    await api.deleteServer(id);
    setServers(prev => prev.filter(s => s.id !== id));
  };

  const toggleActive = async (id) => {
    const res = await api.toggleServerActive(id);
    setServers(prev => prev.map(s => s.id === id ? { ...s, is_active: res.is_active ? 1 : 0 } : s));
  };

  const refreshStatus = useCallback(async () => {
    await api.checkAllStatus();
    // Ambil data terbaru setelah check
    api.getServers()
      .then(data => setServers(data.servers))
      .catch(console.error);
  }, []);

  return (
    <ServerContext.Provider
      value={{
        servers, logs, loading,
        addServer, updateServer, deleteServer, toggleActive, refreshStatus,
        fetchServersAll, fetchLogs,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export const useServers = () => {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServers must be used within ServerProvider');
  return ctx;
};
