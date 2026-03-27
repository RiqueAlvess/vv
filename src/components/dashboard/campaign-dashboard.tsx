'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Lock } from 'lucide-react';

import { KpiRow } from './charts/kpi-row';
import { GaugeChart } from './charts/gauge-chart';
import { IgrpBarChart } from './charts/igrp-bar-chart';
import { WorkersRiskDonut } from './charts/workers-risk-donut';
import { StackedDimensionChart } from './charts/stacked-dimension-chart';
import { StackedQuestionChart } from './charts/stacked-question-chart';
import { RadarScoreChart } from './charts/radar-score-chart';
import { HeatmapChart } from './charts/heatmap-chart';
import { PositionTable } from './charts/position-table';

interface CampaignDashboardProps {
  campaignId: string;
  campaignStatus: string;
  campaignName?: string;
}

export function CampaignDashboard({ campaignId, campaignStatus, campaignName: _campaignName }: CampaignDashboardProps) {
  const { get } = useApi();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignStatus !== 'closed') { setLoading(false); return; }
    get(`/api/campaigns/${campaignId}/dashboard`)
      .then(res => res.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaignId, campaignStatus, get]);

  if (campaignStatus !== 'closed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">
          {campaignStatus === 'draft' ? 'Campanha em rascunho' : 'Coleta em andamento'}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          O dashboard é liberado somente após o encerramento da campanha, para garantir a anonimidade dos respondentes.
        </p>
      </div>
    );
  }

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error ?? 'Erro ao carregar dashboard'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* ROW 1 — KPIs */}
      <KpiRow data={data} />

      {/* ROW 2 — Gauge + IGRP bars */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GaugeChart
          responseRate={data.response_rate as number}
          totalInvited={data.total_invited as number}
          totalResponded={data.total_responded as number}
        />
        <IgrpBarChart dimensions={data.dimension_analysis as unknown[]} />
      </div>

      {/* ROW 3 — Donut + Stacked by dimension */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WorkersRiskDonut
          highRiskPct={data.workers_high_risk_pct as number}
          criticalPct={data.workers_critical_pct as number}
          totalResponded={data.total_responded as number}
        />
        <StackedDimensionChart data={data.stacked_by_dimension as unknown[]} />
      </div>

      {/* ROW 4 — Stacked by question */}
      <StackedQuestionChart data={data.stacked_by_question as unknown[]} />

      {/* ROW 5 — Radar + Heatmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RadarScoreChart dimensions={data.dimension_analysis as unknown[]} />
        <HeatmapChart heatmap={data.heatmap as unknown[]} />
      </div>

      {/* ROW 6 — Position Table */}
      <PositionTable positions={data.position_table as unknown[]} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
