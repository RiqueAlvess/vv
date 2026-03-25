'use client';

import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotifyOptions {
  title: string;
  description?: string;
  duration?: number;
}

export function useNotifications() {
  const notify = (type: NotificationType, options: NotifyOptions) => {
    const { title, description, duration = 4000 } = options;

    switch (type) {
      case 'success':
        toast.success(title, { description, duration });
        break;
      case 'error':
        toast.error(title, { description, duration: duration || 6000 });
        break;
      case 'warning':
        toast.warning(title, { description, duration });
        break;
      case 'info':
        toast.info(title, { description, duration });
        break;
    }
  };

  return {
    notify,
    success: (title: string, description?: string) => notify('success', { title, description }),
    error: (title: string, description?: string) => notify('error', { title, description }),
    warning: (title: string, description?: string) => notify('warning', { title, description }),
    info: (title: string, description?: string) => notify('info', { title, description }),
  };
}
