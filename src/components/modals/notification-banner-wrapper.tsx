'use client';

import { useNotificationBanner, useDismissNotification, type SystemNotification } from '@/hooks/use-notification-banner';
import { NotificationModal } from '@/components/modals/notification-modal';

export function NotificationBannerWrapper() {
  const { data } = useNotificationBanner() as { data?: { notification: SystemNotification | null } };
  const dismiss = useDismissNotification();

  const notification = data?.notification ?? null;

  function handleDismiss() {
    if (!notification) return;
    dismiss.mutate(notification.id);
  }

  return <NotificationModal notification={notification} onDismiss={handleDismiss} />;
}
