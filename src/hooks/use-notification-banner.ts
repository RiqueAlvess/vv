'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useNotificationBanner() {
  const { user } = useAuth();
  const { get } = useApi();

  return useQuery<{ notification: SystemNotification | null }>({
    queryKey: ['notification-banner'],
    queryFn: () => get('/api/notifications/active').then(res => res.json()),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useDismissNotification() {
  const { post } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      post(`/api/notifications/${notificationId}/dismiss`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-banner'] });
    },
  });
}
