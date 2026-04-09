'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { RISK_COLORS } from '@/lib/constants';
import type { CampaignMetrics, RiskLevel } from '@/types';

interface KpiCardsProps {
  metrics: CampaignMetrics;
}

/**
 * Four KPI cards in a responsive grid.
 *
 * Response Rate:  visual Progress bar + colour hint (green ≥70%, yellow ≥30%, red <30%).
 * IGRP:           coloured Badge matching the NR-1 risk tier so the summary risk is
 *                 immediately legible without reading the Radar chart.
 */
export function KpiCards({ metrics }: KpiCardsProps) {
  const responseRateColor = getResponseRateColor(metrics.response_rate);
  const igrpLevel = igrpToRiskLevel(metrics.igrp);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total invited */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Total Convidados</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{metrics.total_invited.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">participantes elegíveis</p>
        </CardContent>
      </Card>

      {/* Total responded */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Respostas Recebidas</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{metrics.total_responded.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.total_invited - metrics.total_responded} sem resposta
          </p>
        </CardContent>
      </Card>

      {/* Response rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold" style={{ color: responseRateColor }}>
            {metrics.response_rate.toFixed(1)}%
          </p>
          {/* Progress bar uses inline style for the colour so it matches the text */}
          <div className="mt-2">
            <Progress value={metrics.response_rate} className="h-1.5" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.response_rate >= 70 ? 'Boa adesão' : metrics.response_rate >= 30 ? 'Adesão moderada' : 'Baixa adesão'}
          </p>
        </CardContent>
      </Card>

      {/* IGRP — overall psychosocial risk index */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium leading-tight">Índice Geral de Riscos Psicossociais (IGRP)</CardTitle>
          <AlertTriangle
            className="h-4 w-4 shrink-0"
            style={{ color: RISK_COLORS[igrpLevel] }}
          />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{metrics.igrp.toFixed(2)}</p>
          <Badge
            className="mt-1 text-white"
            style={{ backgroundColor: RISK_COLORS[igrpLevel] }}
          >
            {RISK_LABELS[igrpLevel]}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Indicador que resume, em um único número, o nível de risco psicossocial da organização.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Maps IGRP (mean NR value across 7 dimensions, scale 1–16) to a risk tier.
 * Mirrors NR faixa final: 1–4 Aceitável, 5–8 Moderado, 9–12 Importante, 13–16 Crítico.
 */
function igrpToRiskLevel(igrp: number): RiskLevel {
  if (igrp > 12) return 'critico';
  if (igrp > 8)  return 'importante';
  if (igrp > 4)  return 'moderado';
  return 'aceitavel';
}

function getResponseRateColor(rate: number): string {
  if (rate >= 70) return '#009B00';
  if (rate >= 30) return '#F75900';
  return '#F60000';
}

const RISK_LABELS: Record<RiskLevel, string> = {
  aceitavel: 'Aceitável',
  moderado: 'Moderado',
  importante: 'Importante',
  critico: 'Crítico',
};
