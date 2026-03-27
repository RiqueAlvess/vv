'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const responseRate = data.response_rate as number;
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;

  const rateColor =
    responseRate >= 70 ? '#22c55e' :
    responseRate >= 50 ? '#eab308' : '#ef4444';

  const rateLabel =
    responseRate >= 70 ? 'Boa adesão' :
    responseRate >= 50 ? 'Adesão moderada' : 'Baixa adesão';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1 — Convidados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Convidados
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {(data.total_invited as number).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.total_responded as number} responderam
          </p>
        </CardContent>
      </Card>

      {/* Card 2 — Taxa de Adesão (was gauge, now card) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Taxa de Adesão
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold" style={{ color: rateColor }}>
            {responseRate.toFixed(1)}%
          </p>
          <p className="text-xs mt-1" style={{ color: rateColor }}>
            {rateLabel}
          </p>
          {/* Simple progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, responseRate)}%`, backgroundColor: rateColor }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>0%</span>
            <span style={{ color: '#eab308' }}>50%</span>
            <span style={{ color: '#22c55e' }}>70%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — IGRP */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            IGRP
          </CardTitle>
          <BarChart3 className="h-4 w-4" style={{ color: igrpColor }} />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{(data.igrp as number).toFixed(1)}</p>
          <Badge
            className="mt-1 text-white text-xs"
            style={{ backgroundColor: igrpColor }}
          >
            {igrpLabel}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">índice geral (1–16)</p>
        </CardContent>
      </Card>

      {/* Card 4 — Em Risco Alto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Em Risco Alto
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-orange-500">
            {data.workers_high_risk_pct as number}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">trabalhadores NR ≥ 9</p>
        </CardContent>
      </Card>
    </div>
  );
}
