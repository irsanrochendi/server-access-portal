import { createContext, useContext, useState, useCallback } from "react";
import { mockServers, mockActivityLogs } from "../data/mockData";

const ServerContext = createContext();

export function ServerProvider({ children }) {
  const [servers, setServers] = useState(mockServers);
  const [activityLogs, setActivityLogs] = useState(mockActivityLogs);

  const addServer = useCallback((server) => {
    const newServer = { ...server, id: Date.now(), status: "unknown" };
    setServers((prev) => [...prev, newServer]);
    setActivityLogs((prev) => [
      {
        id: Date.now(),
        user_id: 1,
        action: "create",
        module: "server",
        description: `Membuat server baru: ${server.name}`,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const updateServer = useCallback((id, updates) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    const server = servers.find((s) => s.id === id);
    setActivityLogs((prev) => [
      {
        id: Date.now(),
        user_id: 1,
        action: "update",
        module: "server",
        description: `Mengupdate server: ${server?.name}`,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, [servers]);

  const deleteServer = useCallback((id) => {
    const server = servers.find((s) => s.id === id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    setActivityLogs((prev) => [
      {
        id: Date.now(),
        user_id: 1,
        action: "delete",
        module: "server",
        description: `Menghapus server: ${server?.name}`,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, [servers]);

  const toggleServerActive = useCallback((id) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s))
    );
  }, []);

  return (
    <ServerContext.Provider
      value={{
        servers,
        activityLogs,
        addServer,
        updateServer,
        deleteServer,
        toggleServerActive,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export const useServers = () => useContext(ServerContext);
