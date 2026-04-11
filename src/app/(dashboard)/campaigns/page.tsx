'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Plus, FileBarChart2, Eye, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import type { Campaign, Company } from '@/types';

const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  closed: 'Encerrada',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {statusLabels[status]}
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        {statusLabels[status]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      {statusLabels[status]}
    </span>
  );
}

export default function CampaignsPage() {
  const { get, post } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    company_id: '',
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      const res = await get(`/api/campaigns?${qs}`);
      const data = await res.json();
      setCampaigns(data.data || []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      notifyError('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, [get, notifyError, page]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await get('/api/companies?limit=100');
      const data = await res.json();
      setCompanies(data.data || []);
    } catch {
      // ignore
    }
  }, [get]);

  useEffect(() => {
    fetchCampaigns();
    if (user?.role === 'ADM') fetchCompanies();
  }, [fetchCampaigns, fetchCompanies, user?.role]);

  const canCreate = user?.role === 'ADM' || user?.role === 'RH';

  const openCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setForm({
      name: '',
      description: '',
      start_date: today,
      end_date: nextMonth,
      company_id: user?.role === 'RH' ? user.company_id : (companies[0]?.id || ''),
    });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await post('/api/campaigns', form);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao criar campanha');
        return;
      }
      success('Campanha criada');
      setModalOpen(false);
      fetchCampaigns();
    } catch {
      notifyError('Erro ao criar campanha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie as campanhas de pesquisa</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        )}
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden shadow-sm">
        {/* Card header count row */}
        <div className="flex items-center gap-2 px-6 py-4 border-b bg-muted/30">
          <FileBarChart2 className="h-4 w-4 text-muted-foreground" />
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {total} campanha{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <CalendarRange className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada</p>
              {canCreate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Clique em &quot;Nova Campanha&quot; para começar
                </p>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Nome</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="group">
                      <TableCell className="pl-6 font-medium">{campaign.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(campaign.start_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(campaign.end_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={campaign.status} />
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                        >
                          <Link href={`/campaigns/${campaign.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-6 py-3 border-t">
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {user?.role === 'ADM' && (
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
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Data Início</Label>
                <Input id="start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Data Fim</Label>
                <Input id="end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.company_id}>
              {saving ? 'Criando...' : 'Criar Campanha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
