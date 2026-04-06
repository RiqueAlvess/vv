'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';

export interface SystemLog {
  id: string;
  level: string;
  action: string;
  user_id: string | null;
  company_id: string | null;
  target_id: string | null;
  target_type: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface LogFilters {
  level?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useSystemLogs(filters: LogFilters = {}) {
  const { get } = useApi();

  const params = new URLSearchParams();
  if (filters.level) params.set('level', filters.level);
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = params.toString();

  return useQuery<{ logs: SystemLog[]; total: number; page: number }>({
    queryKey: ['adm', 'system-logs', filters],
    queryFn: async () => {
      const res = await get(`/api/adm/system-logs${query ? `?${query}` : ''}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}
