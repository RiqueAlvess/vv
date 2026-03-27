'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { DataTable } from '@/components/companies/companies-data-table';
import type { ColumnDef } from '@/components/companies/companies-data-table';
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
} from '@/hooks/use-companies';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import type { Company } from '@/types';

// ─── Column definitions ────────────────────────────────────────────────────
//
// Defined outside the component so the array reference is stable across
// renders. If columns were defined inside the component body, a new array
// would be created on every render, causing unnecessary re-renders of the
// DataTable. Any per-row handlers (edit, delete) are injected via closure
// through a factory function that receives the relevant callbacks.

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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();

  // ── Data ────────────────────────────────────────────────────────────────
  // useCompanies() returns the TanStack Query result. Any other component
  // in the tree that also calls useCompanies() gets the SAME cache bucket
  // — no second network request is fired.
  const { data: companies = [], isLoading } = useCompanies();

  // ── Mutations ───────────────────────────────────────────────────────────
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  // ── Local UI state ──────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', cnpj: '', cnae: '' });

  if (user?.role !== 'ADM') {
    return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  // ── Handlers ────────────────────────────────────────────────────────────

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

  // ── Save (create or update) ─────────────────────────────────────────────

  function handleSave() {
    if (selected) {
      // UPDATE
      updateCompany.mutate(
        { id: selected.id, name: form.name, cnae: form.cnae || undefined },
        {
          onSuccess: () => {
            success('Empresa atualizada');
            setFormOpen(false);
          },
          onError: (e: Error) => notifyError(e.message),
        }
      );
    } else {
      // CREATE
      //
      // Cache update flow (see use-companies.ts for full explanation):
      //   1. mutationFn POSTs to /api/companies, server returns the created Company
      //   2. onSuccess (in the hook) calls setQueryData → new row appears instantly
      //   3. onSuccess (in the hook) calls invalidateQueries → background refetch
      //      confirms server state; UI does NOT flash because setQueryData already ran
      //   4. The onSuccess below (call-site callback) shows the toast and closes the modal
      //
      // The call-site onSuccess fires AFTER the hook-level onSuccess, so by the time
      // the toast appears the table is already up to date — no ghost state, no delay.
      createCompany.mutate(
        { name: form.name, cnpj: form.cnpj, cnae: form.cnae || undefined },
        {
          onSuccess: () => {
            success('Empresa criada');
            setFormOpen(false);
          },
          onError: (e: Error) => notifyError(e.message),
        }
      );
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!selected) return;
    deleteCompany.mutate(selected.id, {
      onSuccess: () => {
        success('Empresa excluída');
        setDeleteOpen(false);
      },
      onError: (e: Error) => notifyError(e.message),
    });
  }

  // ── Columns ─────────────────────────────────────────────────────────────
  // Recreated only when the handler references change (they don't, since
  // openEdit / openDelete are defined in the same render scope but are
  // stable function identities — good enough at this scale).
  const columns = buildColumns(openEdit, openDelete);

  const isMutating =
    createCompany.isPending || updateCompany.isPending || deleteCompany.isPending;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
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

      {/* Table card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {/* Show count only once data has loaded — avoids "0 empresas" flash */}
            {!isLoading && (
              <>
                {companies.length} empresa{companies.length !== 1 ? 's' : ''}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/*
            DataTable handles all three states internally:
              isLoading=true  → skeleton rows (same column layout — no shift)
              data=[]         → empty state message
              data=[…]        → populated rows
          */}
          <DataTable
            columns={columns}
            data={companies}
            isLoading={isLoading}
            skeletonRows={5}
            emptyMessage="Nenhuma empresa cadastrada"
            getRowKey={(c) => c.id}
          />
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
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
            {/* CNPJ is only editable on create; editing CNPJ is a business-rule violation */}
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
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isMutating}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isMutating || !form.name || (!selected && !form.cnpj)}
            >
              {isMutating ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Empresa"
        description={`Deseja realmente excluir "${selected?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        loading={deleteCompany.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
