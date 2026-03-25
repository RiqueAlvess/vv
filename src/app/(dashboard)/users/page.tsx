'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import type { User, Company } from '@/types';

const roleLabels: Record<string, string> = {
  ADM: 'Administrador',
  RH: 'RH',
  LIDERANCA: 'Liderança',
};

export default function UsersPage() {
  const { get, post, put, del } = useApi();
  const { user: authUser } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RH', company_id: '' });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await get('/api/users');
      const data = await res.json();
      setUsers(data.data || []);
    } catch {
      notifyError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [get, notifyError]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await get('/api/companies');
      const data = await res.json();
      setCompanies(data.data || []);
    } catch {
      // ignore
    }
  }, [get]);

  useEffect(() => {
    fetchUsers();
    if (authUser?.role === 'ADM') fetchCompanies();
  }, [fetchUsers, fetchCompanies, authUser?.role]);

  if (authUser?.role !== 'ADM') {
    return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  const openCreate = () => {
    setSelectedUser(null);
    setForm({ name: '', email: '', password: '', role: 'RH', company_id: companies[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setSelectedUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, company_id: u.company_id });
    setModalOpen(true);
  };

  const openDelete = (u: User) => {
    setSelectedUser(u);
    setDeleteModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (selectedUser && !payload.password) {
        const { password: _, ...rest } = payload;
        const res = await put(`/api/users/${selectedUser.id}`, rest);
        if (!res.ok) {
          const data = await res.json();
          notifyError(data.error || 'Erro ao atualizar usuário');
          return;
        }
        success('Usuário atualizado');
      } else {
        const endpoint = selectedUser ? `/api/users/${selectedUser.id}` : '/api/users';
        const method = selectedUser ? put : post;
        const res = await method(endpoint, payload);
        if (!res.ok) {
          const data = await res.json();
          notifyError(data.error || 'Erro ao salvar usuário');
          return;
        }
        success(selectedUser ? 'Usuário atualizado' : 'Usuário criado');
      }
      setModalOpen(false);
      fetchUsers();
    } catch {
      notifyError('Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await del(`/api/users/${selectedUser.id}`);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao excluir usuário');
        return;
      }
      success('Usuário excluído');
      setDeleteModalOpen(false);
      fetchUsers();
    } catch {
      notifyError('Erro ao excluir usuário');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {users.length} usuário{users.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[u.role] || u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? 'default' : 'secondary'}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(u)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha {selectedUser && '(deixe em branco para manter)'}</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADM">Administrador</SelectItem>
                  <SelectItem value="RH">RH</SelectItem>
                  <SelectItem value="LIDERANCA">Liderança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.email || !form.company_id || (!selectedUser && !form.password)}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Excluir Usuário"
        description={`Deseja realmente excluir o usuário "${selectedUser?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleDelete}
      />
    </div>
  );
}
