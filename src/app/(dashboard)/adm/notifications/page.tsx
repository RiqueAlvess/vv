'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  useAdmNotifications,
  useCreateNotification,
  useUpdateNotification,
  useDeleteNotification,
  type AdminNotification,
  type CreateNotificationPayload,
} from '@/hooks/use-adm-notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  scheduled: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-red-100 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  scheduled: 'Agendado',
  expired: 'Expirado',
};

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FormState {
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  message: '',
  starts_at: '',
  ends_at: '',
  active: true,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useAdmNotifications();
  const createMutation = useCreateNotification();
  const updateMutation = useUpdateNotification();
  const deleteMutation = useDeleteNotification();
  const { success, error: notifyError } = useNotifications();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminNotification | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(null);

  if (user?.role !== 'ADM') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const notifications = data?.data ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(n: AdminNotification) {
    setEditTarget(n);
    setForm({
      title: n.title,
      message: n.message,
      starts_at: toLocalDatetime(n.starts_at),
      ends_at: toLocalDatetime(n.ends_at),
      active: n.active,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title || !form.message || !form.starts_at || !form.ends_at) return;

    const payload: CreateNotificationPayload = {
      title: form.title,
      message: form.message,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      active: form.active,
    };

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, ...payload });
        success('Notificação atualizada com sucesso');
      } else {
        await createMutation.mutateAsync(payload);
        success('Notificação criada com sucesso');
      }
      setModalOpen(false);
    } catch {
      notifyError('Erro ao salvar notificação');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      success('Notificação removida');
    } catch {
      notifyError('Erro ao remover notificação');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D3D4F]">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Avisos exibidos a todos os usuários na abertura do sistema
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#0D3D4F] hover:bg-[#0D3D4F]/90 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Notificação
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-44">Início</TableHead>
              <TableHead className="w-44">Fim</TableHead>
              <TableHead className="w-20 text-center">Views</TableHead>
              <TableHead className="w-24">Criado por</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Nenhuma notificação cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[n.status]}`}
                    >
                      {STATUS_LABELS[n.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(n.starts_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(n.ends_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-center text-sm">{n.view_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {n.creator?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar Notificação' : 'Nova Notificação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="n-title">Título</Label>
              <Input
                id="n-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Manutenção programada"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="n-message">Mensagem</Label>
              <Textarea
                id="n-message"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Descreva o aviso para os usuários..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="n-starts">Início</Label>
                <Input
                  id="n-starts"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n-ends">Fim</Label>
                <Input
                  id="n-ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="n-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label htmlFor="n-active" className="cursor-pointer">
                Notificação ativa
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !form.title ||
                !form.message ||
                !form.starts_at ||
                !form.ends_at
              }
              className="bg-[#0D3D4F] hover:bg-[#0D3D4F]/90 text-white"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remover notificação"
        description={`Tem certeza que deseja remover "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
