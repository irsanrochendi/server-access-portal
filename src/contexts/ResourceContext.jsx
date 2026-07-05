import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const ResourceContext = createContext();

export function ResourceProvider({ children }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchResources = useCallback(() => {
    return api.getResources()
      .then(data => setResources(data.resources || []))
      .catch(err => {
        console.error('Failed to fetch resources:', err);
        setResources([]);
      });
  }, []);

  useEffect(() => {
    if (user) {
      fetchResources().finally(() => setLoading(false));
    } else {
      setResources([]);
      setLoading(false);
    }
  }, [user, fetchResources]);

  const value = {
    resources,
    loading,
    refreshResources: fetchResources,
  };

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
}

export const useResources = () => {
  const ctx = useContext(ResourceContext);
  if (!ctx) throw new Error('useResources must be used within ResourceProvider');
  return ctx;
};
