'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, Pencil, Trash2, Users, Search, Building2 } from 'lucide-react';
import type { User, Company } from '@/types';

const PAGE_SIZE = 20;

const roleLabels: Record<string, string> = {
  ADM: 'Administrador',
  RH: 'RH',
  LIDERANCA: 'Liderança',
};

interface UserRow extends User {
  companies?: { id: string; name: string }[];
  company_count?: number;
}

interface UserPage {
  data: UserRow[];
  pagination: { page: number; totalPages: number; total: number; limit: number };
}

export default function UsersPage() {
  const { get, post, put, del } = useApi();
  const { user: authUser } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'RH',
    company_id: '',
  });
  const [extraCompanyIds, setExtraCompanyIds] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: usersPage, isLoading: loadingUsers } = useQuery<UserPage>({
    queryKey: ['users', page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) qs.set('search', search);
      const res = await get(`/api/users?${qs}`);
      if (res.status === 429) {
        notifyError('Muitas requisições', 'Aguarde alguns segundos e tente novamente.');
        throw new Error('429');
      }
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const users = usersPage?.data ?? [];
  const pagination = usersPage?.pagination;

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await get('/api/companies?limit=100');
      if (res.status === 429) throw new Error('429');
      if (!res.ok) throw new Error('Failed to fetch companies');
      const data = await res.json();
      return data.data || [];
    },
    enabled: authUser?.role === 'ADM',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const company_ids = Array.from(
        new Set([form.company_id, ...extraCompanyIds].filter(Boolean))
      );

      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        company_id: form.company_id,
        company_ids,
      };

      if (form.password) {
        payload.password = form.password;
      }

      const endpoint = selectedUser ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = selectedUser ? put : post;
      const res = await method(endpoint, payload);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar usuário');
      }

      return selectedUser ? 'updated' : 'created';
    },
    onSuccess: (result) => {
      success(result === 'updated' ? 'Usuário atualizado' : 'Usuário criado');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      notifyError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (user: UserRow) => {
      const res = await del(`/api/users/${user.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir usuário');
      }
    },
    onSuccess: () => {
      success('Usuário excluído');
      setDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      notifyError(err.message);
    },
  });

  if (authUser?.role !== 'ADM') {
    return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  const openCreate = () => {
    const firstCompanyId = companies[0]?.id ?? '';
    setSelectedUser(null);
    setForm({ name: '', email: '', password: '', role: 'RH', company_id: firstCompanyId });
    setExtraCompanyIds(firstCompanyId ? [firstCompanyId] : []);
    setModalOpen(true);
  };

  const openEdit = (u: UserRow) => {
    const assignedCompanyIds = u.companies?.length
      ? u.companies.map((c) => c.id)
      : [u.company_id];

    setSelectedUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, company_id: u.company_id });
    setExtraCompanyIds(Array.from(new Set(assignedCompanyIds)));
    setModalOpen(true);
  };

  const openDelete = (u: UserRow) => {
    setSelectedUser(u);
    setDeleteModalOpen(true);
  };

  const toggleExtraCompany = (companyId: string) => {
    if (companyId === form.company_id) return;

    setExtraCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const saving = saveMutation.isPending || deleteMutation.isPending;
  const canSave = !!form.name && !!form.email && !!form.company_id && (!!selectedUser || !!form.password);
  const otherCompanies = companies.filter((c) => c.id !== form.company_id);

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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {!loadingUsers && pagination && (
                <>{pagination.total} usuário{pagination.total !== 1 ? 's' : ''}</>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? 'Nenhum usuário encontrado para esta busca' : 'Nenhum usuário cadastrado'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa(s)</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const companyCount = u.company_count ?? u.companies?.length ?? 1;

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{u.company_name ?? '-'}</span>
                          {companyCount > 1 && (
                            <Badge variant="secondary" className="text-xs gap-1 px-1.5">
                              <Building2 className="h-3 w-3" />
                              +{companyCount - 1}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
          {pagination && (
            <PaginationControls
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
              <Label>Empresa principal</Label>
              <Select
                value={form.company_id}
                onValueChange={(v) => {
                  setExtraCompanyIds((prev) => {
                    const withoutOldPrimary = prev.filter((id) => id !== form.company_id && id !== v);
                    return [v, ...withoutOldPrimary];
                  });
                  setForm({ ...form, company_id: v });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {otherCompanies.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Acesso a outras empresas
                </Label>
                <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                  {otherCompanies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`company-${c.id}`}
                        checked={extraCompanyIds.includes(c.id)}
                        onCheckedChange={() => toggleExtraCompany(c.id)}
                        disabled={saving}
                      />
                      <label
                        htmlFor={`company-${c.id}`}
                        className="text-sm cursor-pointer select-none flex-1"
                      >
                        {c.name}
                      </label>
                    </div>
                  ))}
                </div>
                {extraCompanyIds.filter((id) => id !== form.company_id).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {extraCompanyIds.filter((id) => id !== form.company_id).length} empresa(s) adicional(is) selecionada(s)
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saving || !canSave}>
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
        onConfirm={() => selectedUser && deleteMutation.mutate(selectedUser)}
      />
    </div>
  );
}