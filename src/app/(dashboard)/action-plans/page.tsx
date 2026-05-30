'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { useApi } from '@/hooks/use-api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ListChecks, AlertTriangle, CheckCircle2, ChevronRight,
  Clock, Building2, RefreshCw, Sparkles, Loader2, Plus,
} from 'lucide-react';
import type { Campaign } from '@/types';

interface ActionPlanSummary {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  campaign_end: string | null;
  company_name: string;
  total_problems: number;
  critical_problems: number;
  important_problems: number;
  total_actions: number;
  done_actions: number;
  completion_pct: number;
  updated_at: string;
}

export default function ActionPlansPage() {
  const { user } = useAuth();
  const { error: notifyError, success } = useNotifications();
  const router = useRouter();
  const { get } = useApi();
  const [plans, setPlans] = useState<ActionPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate modal state
  const [genOpen, setGenOpen] = useState(false);
  const [closedCampaigns, setClosedCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/action-plans', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar planos');
      setPlans(await res.json());
    } catch {
      notifyError('Erro ao carregar planos de ação');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openGenModal = async () => {
    setGenOpen(true);
    setSelectedCampaignId('');
    setLoadingCampaigns(true);
    try {
      const res = await get('/api/campaigns?limit=100');
      const body = await res.json();
      const existing = new Set(plans.map(p => p.campaign_id));
      const eligible = ((body.data ?? []) as Campaign[]).filter(
        (c) => c.status === 'closed' && !existing.has(c.id),
      );
      setClosedCampaigns(eligible);
    } catch {
      notifyError('Erro ao carregar campanhas');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCampaignId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/hse-agent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.status === 409) {
        notifyError('Plano já existe para esta campanha');
        setGenOpen(false);
        return;
      }
      if (!res.ok && res.status !== 202) {
        notifyError(data.error ?? 'Erro ao iniciar geração');
        return;
      }
      success('Plano em geração', 'O assistente IA está trabalhando. O plano aparecerá aqui quando estiver pronto.');
      setGenOpen(false);
      // Poll for plan to appear (max 3 min)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 36) { clearInterval(poll); return; }
        try {
          const r = await fetch(`/api/campaigns/${selectedCampaignId}/hse-agent`, { credentials: 'include' });
          if (r.ok) {
            clearInterval(poll);
            fetchPlans();
          }
        } catch { /* ignore */ }
      }, 5000);
    } catch {
      notifyError('Erro de conexão');
    } finally {
      setGenerating(false);
    }
  };

  const criticalCount = plans.reduce((s, p) => s + p.critical_problems, 0);
  const pendingCount = plans.reduce((s, p) => s + (p.total_actions - p.done_actions), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos de Ação</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Intervenções geradas a partir das avaliações psicossociais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlans} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {(user?.role === 'ADM' || user?.role === 'RH') && (
            <Button size="sm" onClick={openGenModal}>
              <Plus className="h-4 w-4 mr-2" />
              Gerar Plano de IA
            </Button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Planos ativos</p>
              <p className="text-2xl font-bold mt-1">{plans.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Problemas críticos</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ações pendentes</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{pendingCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="font-medium text-muted-foreground">Nenhum plano de ação encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              Gere um plano a partir de uma campanha encerrada usando o assistente IA
            </p>
            {(user?.role === 'ADM' || user?.role === 'RH') && (
              <Button onClick={openGenModal}>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Primeiro Plano
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => router.push(`/action-plans/${plan.campaign_id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="relative h-10 w-10 flex items-center justify-center rounded-full bg-[#144660]/10">
                      <ListChecks className="h-5 w-5 text-[#144660]" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{plan.campaign_name}</span>
                      {user?.role === 'ADM' && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{plan.company_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {plan.critical_problems > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {plan.critical_problems} crítico{plan.critical_problems > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {plan.important_problems > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">
                          {plan.important_problems} importante{plan.important_problems > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {plan.total_problems === 0 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Sem problemas mapeados</Badge>
                      )}
                    </div>
                    {plan.total_actions > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            {plan.done_actions}/{plan.total_actions} ações concluídas
                          </span>
                          <span className="font-medium">{plan.completion_pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${plan.completion_pct}%`,
                              backgroundColor: plan.completion_pct === 100 ? '#16a34a' : '#144660',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2 ml-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(plan.updated_at), 'dd MMM yyyy', { locale: ptBR })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate plan modal */}
      <Dialog open={genOpen} onOpenChange={(o) => { if (!generating) setGenOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#144660]" />
              Gerar Plano de Ação com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione a campanha encerrada para gerar um plano de intervenção. O processo ocorre em segundo plano — você pode navegar para outras telas sem perder o progresso.
            </p>
            <div className="space-y-2">
              <Label>Campanha</Label>
              {loadingCampaigns ? (
                <Skeleton className="h-10 w-full" />
              ) : closedCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                  Nenhuma campanha disponível — todas já possuem plano gerado ou não há campanhas encerradas.
                </p>
              ) : (
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {closedCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={generating}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedCampaignId || closedCampaigns.length === 0}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Iniciando...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Gerar Plano</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
