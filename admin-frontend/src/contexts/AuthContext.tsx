import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getMe } from '../services/api';

interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_auth_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    getMe()
      .then((res) => {
        if (res.success && res.user) {
          const u = res.user;
          if (u.role === 'admin' || u.role === 'super_admin') {
            setUser({ id: u.id, email: u.email, name: u.name, role: u.role });
          } else {
            localStorage.removeItem('admin_auth_token');
          }
        } else {
          localStorage.removeItem('admin_auth_token');
        }
      })
      .catch(() => {
        localStorage.removeItem('admin_auth_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    const u = res.user;
    if (u.role !== 'admin' && u.role !== 'super_admin') {
      throw new Error('Admin access required');
    }
    localStorage.setItem('admin_auth_token', res.token);
    setUser({ id: u.id, email: u.email, name: u.name, role: u.role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_auth_token');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
