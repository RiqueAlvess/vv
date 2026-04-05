'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { DataTable } from '@/components/companies/companies-data-table';
import type { ColumnDef } from '@/components/companies/companies-data-table';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
import type { Company } from '@/types';

const PAGE_SIZE = 20;

function buildColumns(
  onEdit: (company: Company) => void,
  onDelete: (company: Company) => void
): ColumnDef<Company>[] {
  return [
    {
      id: 'name',
      header: 'Nome',
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: 'cnpj',
      header: 'CNPJ',
      cell: (c) => <span className="font-mono text-sm">{c.cnpj}</span>,
    },
    {
      id: 'cnae',
      header: 'CNAE',
      cell: (c) => c.cnae ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge variant={c.active ? 'default' : 'secondary'}>
          {c.active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      headerClassName: 'w-20',
      cellClassName: 'text-right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(c)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(c)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];
}

export default function CompaniesPage() {
  const { get, post, put, del } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', cnpj: '', cnae: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (user?.role !== 'ADM') {
    return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) qs.set('search', search);
      const res = await get(`/api/companies?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setCompanies(data.data ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      notifyError('Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  }, [get, page, search, notifyError]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  function openCreate() {
    setSelected(null);
    setForm({ name: '', cnpj: '', cnae: '' });
    setFormOpen(true);
  }

  function openEdit(company: Company) {
    setSelected(company);
    setForm({ name: company.name, cnpj: company.cnpj, cnae: company.cnae ?? '' });
    setFormOpen(true);
  }

  function openDelete(company: Company) {
    setSelected(company);
    setDeleteOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (selected) {
        const res = await put(`/api/companies/${selected.id}`, {
          name: form.name,
          cnae: form.cnae || undefined,
        });
        if (!res.ok) {
          const data = await res.json();
          notifyError(data.error || 'Erro ao atualizar empresa');
          return;
        }
        success('Empresa atualizada');
      } else {
        const res = await post('/api/companies', {
          name: form.name,
          cnpj: form.cnpj,
          cnae: form.cnae || undefined,
        });
        if (!res.ok) {
          const data = await res.json();
          notifyError(data.error || 'Erro ao criar empresa');
          return;
        }
        success('Empresa criada');
      }
      setFormOpen(false);
      fetchCompanies();
    } catch {
      notifyError('Erro ao salvar empresa');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await del(`/api/companies/${selected.id}`);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao excluir empresa');
        return;
      }
      success('Empresa excluída');
      setDeleteOpen(false);
      fetchCompanies();
    } catch {
      notifyError('Erro ao excluir empresa');
    } finally {
      setDeleting(false);
    }
  }

  const columns = buildColumns(openEdit, openDelete);

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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {!isLoading && <>{total} empresa{total !== 1 ? 's' : ''}</>}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                className="pl-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={companies}
            isLoading={isLoading}
            skeletonRows={5}
            emptyMessage={search ? 'Nenhuma empresa encontrada para esta busca' : 'Nenhuma empresa cadastrada'}
            getRowKey={(c) => c.id}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {!selected && (
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE (opcional)</Label>
              <Input
                id="cnae"
                value={form.cnae}
                onChange={(e) => setForm({ ...form, cnae: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || (!selected && !form.cnpj)}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Empresa"
        description={`Deseja realmente excluir "${selected?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
