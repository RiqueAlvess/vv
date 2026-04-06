'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BellRing } from 'lucide-react';
import type { SystemNotification } from '@/hooks/use-notification-banner';

interface NotificationModalProps {
  notification: SystemNotification | null;
  onDismiss: () => void;
}

export function NotificationModal({ notification, onDismiss }: NotificationModalProps) {
  const open = !!notification;

  // Intercept both the X button and backdrop click so the view is always recorded
  function handleOpenChange(next: boolean) {
    if (!next) onDismiss();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        // Prevent closing by pressing Escape without recording the view
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onDismiss();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00C896]/15">
              <BellRing className="h-5 w-5 text-[#00C896]" />
            </div>
            <DialogTitle className="text-base leading-tight">
              {notification?.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription asChild>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed py-1">
            {notification?.message}
          </div>
        </DialogDescription>

        <DialogFooter>
          <Button
            onClick={onDismiss}
            className="bg-[#0D3D4F] hover:bg-[#0D3D4F]/90 text-white"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
