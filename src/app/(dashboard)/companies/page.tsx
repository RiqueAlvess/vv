'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import type { Company } from '@/types';

export default function CompaniesPage() {
  const { get, post, put, del } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', cnpj: '', cnae: '' });

  const { data: companies = [], isLoading: loading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await get('/api/companies');
      if (res.status === 429) {
        notifyError('Muitas requisições', 'Aguarde alguns segundos e tente novamente.');
        throw new Error('429');
      }
      if (!res.ok) throw new Error('Failed to fetch companies');
      const data = await res.json();
      return data.data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedCompany) {
        const res = await put(`/api/companies/${selectedCompany.id}`, form);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao atualizar empresa');
        }
        return 'updated';
      } else {
        const res = await post('/api/companies', form);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao criar empresa');
        }
        return 'created';
      }
    },
    onSuccess: (result) => {
      success(result === 'updated' ? 'Empresa atualizada' : 'Empresa criada');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: Error) => {
      notifyError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (company: Company) => {
      const res = await del(`/api/companies/${company.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir empresa');
      }
    },
    onSuccess: () => {
      success('Empresa excluída');
      setDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: Error) => {
      notifyError(err.message);
    },
  });

  if (user?.role !== 'ADM') {
    return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  const openCreate = () => {
    setSelectedCompany(null);
    setForm({ name: '', cnpj: '', cnae: '' });
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setSelectedCompany(company);
    setForm({ name: company.name, cnpj: company.cnpj, cnae: company.cnae || '' });
    setModalOpen(true);
  };

  const openDelete = (company: Company) => {
    setSelectedCompany(company);
    setDeleteModalOpen(true);
  };

  const saving = saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas cadastradas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {companies.length} empresa{companies.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : companies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma empresa cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>CNAE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="font-mono text-sm">{company.cnpj}</TableCell>
                    <TableCell>{company.cnae || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={company.active ? 'default' : 'secondary'}>
                        {company.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(company)}>
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
            <DialogTitle>{selectedCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE (opcional)</Label>
              <Input id="cnae" value={form.cnae} onChange={(e) => setForm({ ...form, cnae: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saving || !form.name || !form.cnpj}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Excluir Empresa"
        description={`Deseja realmente excluir a empresa "${selectedCompany?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={() => selectedCompany && deleteMutation.mutate(selectedCompany)}
      />
    </div>
  );
}
