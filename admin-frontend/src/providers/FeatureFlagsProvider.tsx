import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type FlagMap = Record<string, boolean>;

interface FeatureFlagsContextValue {
  flags: FlagMap;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000;

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FlagMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; flags: FlagMap }>('/me/flags');
      if (res.data.success) {
        setFlags(res.data.flags);
      }
    } catch {
      // keep previous flags on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFlags({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchFlags();

    intervalRef.current = setInterval(fetchFlags, POLL_INTERVAL_MS);

    const handleFocus = () => fetchFlags();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, fetchFlags]);

  return (
    <FeatureFlagsContext.Provider value={{ flags, isLoading, refetch: fetchFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export function useFeatureFlagsContext(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlagsContext must be used within <FeatureFlagsProvider>');
  return ctx;
}
