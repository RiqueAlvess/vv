'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Building2, Users, FileBarChart2, LogOut, ChevronUp, MessageSquare, KeyRound, BookOpen, ScrollText, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { LogoImage } from '@/components/ui/logo-image';

const navItems = {
  ADM: [
    { title: 'Dashboard', url: '/adm/dashboard', icon: LayoutDashboard },
    { title: 'Empresas', url: '/companies', icon: Building2 },
    { title: 'Usuários', url: '/users', icon: Users },
    { title: 'Base de Conhecimento', url: '/articles', icon: BookOpen },
    { title: 'Notificações', url: '/adm/notifications', icon: Bell },
    { title: 'Logs do Sistema', url: '/adm/system-logs', icon: ScrollText },
  ],
  RH: [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Campanhas', url: '/campaigns', icon: FileBarChart2 },
    { title: 'Feedback Anônimo', url: '/feedback', icon: MessageSquare },
    { title: 'Base de Conhecimento', url: '/articles', icon: BookOpen },
  ],
  LIDERANCA: [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Base de Conhecimento', url: '/articles', icon: BookOpen },
  ],
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('Nova senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Senhas não coincidem');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPasswordError(data.error ?? 'Erro ao alterar senha'); return; }
      setPasswordOpen(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch {
      setPasswordError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  const items = navItems[user?.role as keyof typeof navItems] || navItems.LIDERANCA;
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
      <Sidebar className="bg-[#0D3D4F]">
      <SidebarHeader className="border-b border-[#00C896]/30 bg-[#0D3D4F]">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-9 w-full min-w-0"><LogoImage /></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/40 text-xs uppercase tracking-widest">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + '/')}>
                    <Link href={item.url} className="text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors data-[active=true]:bg-[#00C896] data-[active=true]:text-[#0D3D4F] data-[active=true]:font-semibold data-[active=true]:rounded-lg">
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
        <div ref={menuRef} className="relative p-2">
          <p className="text-[10px] text-white/25 text-center pb-1">v1.0.5</p>

          {/* Floating menu — appears above the button */}
          {menuOpen && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 z-[9999] rounded-md border border-[#00C896]/30 bg-[#0D3D4F] shadow-lg"
              style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}
            >
              <div className="py-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-[#00C896]/20 hover:text-[#00C896] transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordOpen(true);
                  }}
                >
                  <KeyRound className="h-4 w-4 text-[#00C896]" />
                  <span>Mudar Senha</span>
                </button>
                <div className="my-1 mx-2 h-px bg-[#00C896]/30" />
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}

          {/* User button */}
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-white hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#00C896]/20 text-[#00C896] text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left text-sm min-w-0 flex-1">
              <span className="font-medium truncate">{user?.name}</span>
              <span className="text-xs text-white/60 truncate">{user?.role}</span>
            </div>
            <ChevronUp
              className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                menuOpen ? '' : 'rotate-180'
              }`}
            />
          </button>

        </div>
      </SidebarFooter>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Senha atual</Label>
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
