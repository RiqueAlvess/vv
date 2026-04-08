'use client';

import { createContext, useContext, useState, useEffect, useCallback, createElement, type ReactNode } from 'react';

export interface CompanyRef {
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

    // Full page reload to the correct home for the new company context
    const currentRole = user?.role;
    window.location.href = currentRole === 'ADM' ? '/companies' : '/dashboard';
  };

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, logout, refreshAuth, switchCompany } },
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
