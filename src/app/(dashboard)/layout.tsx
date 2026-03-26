'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { AuthProvider } from '@/hooks/use-auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // useState ensures the same QueryClient instance survives re-renders in
  // React 18 concurrent mode. Calling getQueryClient() directly in the render
  // body works in practice (singleton) but React's double-invoke in StrictMode
  // could create two clients before the module-level variable is set.
  const [queryClient] = useState(() => getQueryClient());

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <main className="flex-1 p-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
