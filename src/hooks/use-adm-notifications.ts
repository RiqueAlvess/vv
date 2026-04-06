'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  status: 'scheduled' | 'active' | 'expired';
  creator: { name: string };
}

export interface CreateNotificationPayload {
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  active?: boolean;
}

export interface UpdateNotificationPayload {
  title?: string;
  message?: string;
  starts_at?: string;
  ends_at?: string;
  active?: boolean;
}

const QUERY_KEY = ['adm', 'notifications'] as const;

export function useAdmNotifications() {
  const { get } = useApi();

  return useQuery<{ data: AdminNotification[] }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await get('/api/adm/notifications');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ data: AdminNotification[] }>;
    },
    staleTime: 30_000,
  });
}

export function useCreateNotification() {
  const { post } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateNotificationPayload) =>
      post('/api/adm/notifications', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateNotification() {
  const { patch } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateNotificationPayload & { id: string }) =>
      patch(`/api/adm/notifications/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteNotification() {
  const { del } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => del(`/api/adm/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
