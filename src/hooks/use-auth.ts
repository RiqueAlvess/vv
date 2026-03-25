'use client';

import { createContext, useContext, useState, useEffect, useCallback, createElement, type ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADM' | 'RH' | 'LIDERANCA';
  company_id: string;
  company_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // API returns user data directly with optional company object
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          company_id: data.company_id,
          company_name: data.company?.name,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao fazer login');
    }

    const data = await res.json();
    setUser(data.user);
  };

  const logout = () => {
    // Clear cookies (works for non-httpOnly, API sets httpOnly ones which expire)
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    window.location.href = '/login';
  };

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, login, logout, refreshAuth } },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export the context for external use
export { AuthContext };
