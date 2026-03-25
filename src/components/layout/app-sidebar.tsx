'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, Building2, Users, FileBarChart2, Shield, LogOut, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const navItems = {
  ADM: [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Empresas', url: '/companies', icon: Building2 },
    { title: 'Usuários', url: '/users', icon: Users },
    { title: 'Campanhas', url: '/campaigns', icon: FileBarChart2 },
  ],
  RH: [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Campanhas', url: '/campaigns', icon: FileBarChart2 },
  ],
  LIDERANCA: [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  ],
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const items = navItems[user?.role as keyof typeof navItems] || navItems.LIDERANCA;
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Asta</span>
            <span className="text-xs text-muted-foreground">Riscos Psicossociais NR-1</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + '/')}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left text-sm">
                    <span className="font-medium truncate">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.role}</span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
