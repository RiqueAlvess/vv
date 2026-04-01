'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Lock, Download, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { KpiRow } from './charts/kpi-row';
import { IgrpBarChart } from './charts/igrp-bar-chart';
import { WorkersRiskDonut } from './charts/workers-risk-donut';
import { StackedDimensionChart } from './charts/stacked-dimension-chart';
import { StackedQuestionChart } from './charts/stacked-question-chart';
import { RadarScoreChart } from './charts/radar-score-chart';
import { HeatmapChart } from './charts/heatmap-chart';
import { PositionTable } from './charts/position-table';
import { GenderRiskChart } from './charts/gender-risk-chart';
import { AgeRiskChart } from './charts/age-risk-chart';

interface CampaignDashboardProps {
  campaignId: string;
  campaignStatus: string;
  campaignName?: string;
  unitId?: string;
  sectorId?: string;
}

export function CampaignDashboard({ campaignId, campaignStatus, campaignName, unitId, sectorId }: CampaignDashboardProps) {
  const { get } = useApi();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleExportPGR = async () => {
    setDownloading(true);
    try {
      const url = `/api/campaigns/${campaignId}/report/pdf`;
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          setTimeout(() => win.print(), 500);
        });
      }
    } catch (e) {
      console.error('PGR export error:', e);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (campaignStatus !== 'closed') { setLoading(false); return; }

    const params = new URLSearchParams();
    if (unitId)   params.set('unit_id',   unitId);
    if (sectorId) params.set('sector_id', sectorId);
    const qs = params.toString();

    setLoading(true);
    setData(null);

    get(`/api/campaigns/${campaignId}/dashboard${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaignId, campaignStatus, unitId, sectorId, get]);

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

  const filterContext = data.filter_context as { note: string | null } | undefined;

  return (
    <div className="space-y-6">
      {/* ROW 1 — KPIs */}
      <KpiRow data={data} />

      {filterContext?.note && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {filterContext.note}
        </div>
      )}

      {/* Export button row */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleExportPGR}
          disabled={downloading}
          className="gap-2"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? 'Gerando PDF...' : 'Exportar Relatório PGR'}
        </Button>
      </div>

      {/* ROW 2 — IGRP by dimension (full width) */}
      {data.dimension_analysis && <IgrpBarChart dimensions={data.dimension_analysis as unknown[]} />}

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
        {Array.isArray(data.dimension_analysis) && data.dimension_analysis.length > 0 && (
          <RadarScoreChart dimensions={data.dimension_analysis as unknown[]} />
        )}
        <HeatmapChart heatmap={data.heatmap as unknown[]} />
      </div>

      {/* ROW 6 — Demographic risk analysis */}
      {((data.gender_risk as unknown[])?.length > 0 || (data.age_risk as unknown[])?.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GenderRiskChart data={(data.gender_risk as unknown[]) as Parameters<typeof GenderRiskChart>[0]['data']} />
          <AgeRiskChart data={(data.age_risk as unknown[]) as Parameters<typeof AgeRiskChart>[0]['data']} />
        </div>
      )}

      {/* ROW 7 — Position Table */}
      <PositionTable positions={data.position_table as unknown[]} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
