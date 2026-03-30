import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storeToken(token: string) {
  localStorage.setItem('auth_token', token);
}

function clearToken() {
  localStorage.removeItem('auth_token');
}

function serverUserToAuthUser(u: {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role?: string;
}): AuthUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, role: u.role || 'user' };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** On mount: validate existing token via /api/auth/me */
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiClient
      .get<{ success: boolean; user: { id: string; email: string | null; name: string; role?: string } }>(
        '/auth/me'
      )
      .then((res) => {
        if (res.data.success) {
          setUser({ ...res.data.user, avatarUrl: null, role: res.data.user.role || 'user' });
        } else {
          clearToken();
        }
      })
      .catch(() => {
        // 401 or network error — clear stale token
        clearToken();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{
      success: boolean;
      token: string;
      user: { id: string; email: string | null; name: string; avatarUrl: string | null; role?: string };
    }>('/auth/login', { email, password });
    localStorage.removeItem('active_workspace_id');
    storeToken(res.data.token);
    setUser(serverUserToAuthUser(res.data.user));
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiClient.post<{
      success: boolean;
      token: string;
      user: { id: string; email: string | null; name: string; avatarUrl: string | null; role?: string };
    }>('/auth/register', { email, password, name });
    localStorage.removeItem('active_workspace_id');
    storeToken(res.data.token);
    setUser(serverUserToAuthUser(res.data.user));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem('active_workspace_id');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
