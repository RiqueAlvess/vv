'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ListChecks, AlertTriangle, CheckCircle2, ChevronRight,
  Clock, Building2, RefreshCw,
} from 'lucide-react';

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
  const { error: notifyError } = useNotifications();
  const router = useRouter();
  const [plans, setPlans] = useState<ActionPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
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
  };

  useEffect(() => { fetchPlans(); }, []);

  const criticalCount = plans.reduce((s: number, p: ActionPlanSummary) => s + p.critical_problems, 0);
  const pendingCount = plans.reduce((s: number, p: ActionPlanSummary) => s + (p.total_actions - p.done_actions), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos de Ação</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe as intervenções geradas a partir das avaliações psicossociais
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPlans} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
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
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="font-medium text-muted-foreground">Nenhum plano de ação encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Planos são gerados automaticamente ao encerrar uma campanha e acionar o assistente IA
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/campaigns">Ver campanhas</Link>
            </Button>
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
                  {/* Left: icon + progress ring placeholder */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="relative h-10 w-10 flex items-center justify-center rounded-full bg-[#144660]/10">
                      <ListChecks className="h-5 w-5 text-[#144660]" />
                    </div>
                  </div>

                  {/* Center: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{plan.campaign_name}</span>
                      {user?.role === 'ADM' && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{plan.company_name}
                        </span>
                      )}
                    </div>

                    {/* Problem badges */}
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

                    {/* Progress bar */}
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

                  {/* Right: date + arrow */}
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
    </div>
  );
}
