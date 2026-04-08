'use client';

import { createContext, useContext, useState, useEffect, useCallback, createElement, type ReactNode } from 'react';

interface CompanyRef {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADM' | 'RH' | 'LIDERANCA';
  company_id: string;
  company_name?: string;
  companies: CompanyRef[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ needs_company_select: boolean; companies: CompanyRef[] }>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      let res = await fetch('/api/auth/me', { credentials: 'include' });

      // Access token expired — try refreshing before giving up
      if (res.status === 401) {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!refreshRes.ok) {
          setUser(null);
          return;
        }
        res = await fetch('/api/auth/me', { credentials: 'include' });
      }

      if (res.ok) {
        const data = await res.json();
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          company_id: data.company_id,
          company_name: data.company?.name,
          companies: data.companies ?? [],
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
    setUser({
      ...data.user,
      company_name: undefined,
      companies: data.companies ?? [],
    });

    return {
      needs_company_select: data.needs_company_select ?? false,
      companies: (data.companies ?? []) as CompanyRef[],
    };
  };

  const logout = () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    window.location.href = '/login';
  };

  const switchCompany = async (companyId: string) => {
    const res = await fetch('/api/auth/switch-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ company_id: companyId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao trocar empresa');
    }

    // Full page reload to reset all cached queries with the new company context
    window.location.href = '/dashboard';
  };

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, login, logout, refreshAuth, switchCompany } },
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
