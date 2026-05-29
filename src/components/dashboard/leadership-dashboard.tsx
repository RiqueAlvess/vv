'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IgrpBarChart } from './charts/igrp-bar-chart';
import { RadarScoreChart } from './charts/radar-score-chart';
import { WorkersRiskDonut } from './charts/workers-risk-donut';
import { StackedDimensionChart } from './charts/stacked-dimension-chart';
import { GenderRiskChart } from './charts/gender-risk-chart';
import { AgeRiskChart } from './charts/age-risk-chart';
import { KpiRow } from './charts/kpi-row';
import {
  Shield, TrendingDown, TrendingUp, Minus,
  Users, AlertTriangle, Lock,
} from 'lucide-react';

const MIN_RESPONDENTS = 5;

interface DimensionAnalysis {
  key: string;
  name: string;
  type: 'positive' | 'negative';
  avg_score: number;
  risk_level: string;
  nr: number;
  nr_label: string;
  nr_color: string;
}

interface DashboardData {
  total_responded: number;
  igrp: number;
  igrp_label: string;
  igrp_color: string;
  workers_high_risk_pct: number;
  workers_critical_pct: number;
  dimension_analysis: DimensionAnalysis[];
  stacked_by_dimension: unknown[];
  gender_risk: unknown[];
  age_risk: unknown[];
  [key: string]: unknown;
}

export interface LeadershipDashboardProps {
  campaignId: string;
  sectorId: string;
  sectorName?: string;
}

// ─── Delta strip ────────────────────────────────────────────────────────────

function DeltaStrip({
  sectorDims,
  campaignDims,
}: {
  sectorDims: DimensionAnalysis[];
  campaignDims: DimensionAnalysis[];
}) {
  const campaignMap = Object.fromEntries(campaignDims.map((d) => [d.key, d]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Comparativo por Dimensão — Setor vs. Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectorDims.map((dim) => {
            const camp = campaignMap[dim.key];
            if (!camp) return null;
            const deltaNr = dim.nr - camp.nr;
            const isWorse = deltaNr > 0;
            const isBetter = deltaNr < 0;
            const deltaAbs = Math.abs(deltaNr);

            return (
              <div
                key={dim.key}
                className="rounded-lg border p-3 space-y-2 bg-card"
              >
                <p className="text-xs font-medium text-muted-foreground leading-tight line-clamp-2">
                  {dim.name}
                </p>

                {/* Sector badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: dim.nr_color }}
                  />
                  <span className="text-xs font-semibold">{dim.nr_label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">NR {dim.nr}</span>
                </div>

                {/* Campaign average */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0 opacity-60"
                    style={{ backgroundColor: camp.nr_color }}
                  />
                  <span>Empresa: {camp.nr_label}</span>
                  <span className="ml-auto">NR {camp.nr}</span>
                </div>

                {/* Delta */}
                <div
                  className={`flex items-center gap-1 text-xs font-medium rounded px-1.5 py-0.5 w-fit ${
                    isBetter
                      ? 'bg-green-50 text-green-700'
                      : isWorse
                      ? 'bg-red-50 text-red-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isBetter ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : isWorse ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {deltaNr === 0
                    ? 'Na média'
                    : `${isBetter ? '−' : '+'}${deltaAbs.toFixed(1)} vs empresa`}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-green-600 shrink-0" />
          NR menor = menor risco. Verde = setor melhor que a média da empresa.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function LeadershipDashboard({ campaignId, sectorId, sectorName }: LeadershipDashboardProps) {
  const { get } = useApi();
  const [sectorData, setSectorData] = useState<DashboardData | null>(null);
  const [campaignData, setCampaignData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSectorData(null);
    setCampaignData(null);
    setError(null);

    Promise.all([
      get(`/api/campaigns/${campaignId}/dashboard?sector_id=${sectorId}`).then((r) => r.json()),
      get(`/api/campaigns/${campaignId}/dashboard`).then((r) => r.json()),
    ])
      .then(([sector, campaign]) => {
        if (sector.error) throw new Error(sector.error);
        setSectorData(sector as DashboardData);
        if (!campaign.error) setCampaignData(campaign as DashboardData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaignId, sectorId, get]);

  if (loading) return <DashboardSkeleton />;

  if (error || !sectorData) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error ?? 'Erro ao carregar dashboard do setor'}</AlertDescription>
      </Alert>
    );
  }

  // Privacy gate: require minimum respondents before showing any data
  if (sectorData.total_responded < MIN_RESPONDENTS) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold">Respondentes insuficientes</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Seu setor possui{' '}
          <strong>{sectorData.total_responded}</strong>{' '}
          {sectorData.total_responded === 1 ? 'resposta' : 'respostas'}.
          São necessárias pelo menos <strong>{MIN_RESPONDENTS}</strong> para
          exibir os dados, protegendo a anonimidade dos participantes.
        </p>
        <Badge variant="outline" className="mt-4 text-xs text-muted-foreground gap-1">
          <Shield className="h-3 w-3" />
          Proteção Blind-Drop
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sector banner */}
      <div className="flex items-center gap-2 bg-[#144660]/5 border border-[#144660]/20 rounded-lg px-4 py-2.5">
        <Shield className="h-4 w-4 text-[#144660] shrink-0" />
        <span className="text-sm text-[#144660] font-medium">
          Visão restrita ao setor:{' '}
          <span className="font-bold">{sectorName ?? 'Seu setor'}</span>
        </span>
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {sectorData.total_responded} respondentes
        </span>
      </div>

      {/* KPIs */}
      <KpiRow data={sectorData as Record<string, unknown>} />

      {/* Delta comparison */}
      {campaignData && Array.isArray(sectorData.dimension_analysis) && Array.isArray(campaignData.dimension_analysis) && (
        <DeltaStrip
          sectorDims={sectorData.dimension_analysis}
          campaignDims={campaignData.dimension_analysis}
        />
      )}

      {/* IGRP bar chart */}
      {Array.isArray(sectorData.dimension_analysis) && (
        <IgrpBarChart dimensions={sectorData.dimension_analysis} />
      )}

      {/* Donut + stacked */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WorkersRiskDonut
          highRiskPct={sectorData.workers_high_risk_pct ?? 0}
          criticalPct={sectorData.workers_critical_pct ?? 0}
          totalResponded={sectorData.total_responded}
        />
        <StackedDimensionChart data={sectorData.stacked_by_dimension as unknown[]} />
      </div>

      {/* Radar — setor only (no heatmap for LIDERANÇA, it's cross-unit) */}
      {Array.isArray(sectorData.dimension_analysis) && sectorData.dimension_analysis.length > 0 && (
        <RadarScoreChart dimensions={sectorData.dimension_analysis} />
      )}

      {/* Demographic charts (only when groups have enough data) */}
      {((sectorData.gender_risk as unknown[])?.length > 0 ||
        (sectorData.age_risk as unknown[])?.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GenderRiskChart
            data={(sectorData.gender_risk as unknown[]) as Parameters<typeof GenderRiskChart>[0]['data']}
          />
          <AgeRiskChart
            data={(sectorData.age_risk as unknown[]) as Parameters<typeof AgeRiskChart>[0]['data']}
          />
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
